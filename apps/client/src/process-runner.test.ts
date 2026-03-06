import { describe, expect, it, vi } from "vitest";
import { runProcess } from "./process-runner";
import type { CliRuntime } from "./runtime";

function createRuntime(overrides: Partial<CliRuntime> = {}): CliRuntime {
  return {
    env: {},
    cwd: () => "/workspace",
    fetch: vi.fn() as unknown as typeof fetch,
    promptInput: vi.fn(),
    log: vi.fn(),
    writeStdout: vi.fn(),
    readStdinText: vi.fn(),
    isStdinTTY: vi.fn().mockReturnValue(false),
    spawn: vi.fn() as unknown as typeof Bun.spawn,
    onSignal: vi.fn(),
    offSignal: vi.fn(),
    ...overrides,
  };
}

describe("runProcess", () => {
  it("spawns with inherited stdio and returns the child exit code", async () => {
    const spawnMock = vi.fn().mockReturnValue({ exitCode: null, killed: false, kill: vi.fn(), exited: Promise.resolve(7) });
    const runtime = createRuntime({ spawn: spawnMock as unknown as typeof Bun.spawn });

    const exitCode = await runProcess(runtime, ["node", "app.js"], { TOKEN: "secret" });

    expect(spawnMock).toHaveBeenCalledWith({
      cmd: ["node", "app.js"],
      env: { TOKEN: "secret" },
      stdin: "inherit",
      stdout: "inherit",
      stderr: "inherit",
    });
    expect(exitCode).toBe(7);
  });

  it("registers and removes signal forwarding handlers", async () => {
    const killMock = vi.fn();
    let sigintHandler: (() => void) | undefined;
    let resolveExit: (code: number) => void = () => undefined;
    const exited = new Promise<number>((resolve) => {
      resolveExit = resolve;
    });
    const runtime = createRuntime({
      spawn: vi.fn().mockReturnValue({ exitCode: null, killed: false, kill: killMock, exited }) as unknown as typeof Bun.spawn,
      onSignal: vi.fn((signal, handler) => {
        if (signal === "SIGINT") sigintHandler = handler;
      }),
    });

    const runPromise = runProcess(runtime, ["node"], {});
    sigintHandler?.();
    resolveExit(0);
    await runPromise;

    expect(runtime.onSignal).toHaveBeenCalledWith("SIGINT", expect.any(Function));
    expect(runtime.onSignal).toHaveBeenCalledWith("SIGTERM", expect.any(Function));
    expect(runtime.offSignal).toHaveBeenCalledWith("SIGINT", expect.any(Function));
    expect(runtime.offSignal).toHaveBeenCalledWith("SIGTERM", expect.any(Function));
    expect(killMock).toHaveBeenCalledWith("SIGINT");
  });
});
