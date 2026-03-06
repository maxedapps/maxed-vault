import { beforeEach, describe, expect, it, vi } from "vitest";
import type { CliRuntime } from "../runtime";

const resolveContextMock = vi.hoisted(() => vi.fn(() => ({ serverUrl: "http://vault.internal", project: "infographics", source: "workspace" })));
const createVaultClientMock = vi.hoisted(() => vi.fn());
const runProcessMock = vi.hoisted(() => vi.fn().mockResolvedValue(0));

vi.mock("../context", () => ({
  resolveContext: resolveContextMock,
}));

vi.mock("../api", () => ({
  createVaultClient: createVaultClientMock,
}));

vi.mock("../process-runner", () => ({
  runProcess: runProcessMock,
}));

import { cmdRun } from "./run";

function createRuntime(): CliRuntime {
  return {
    env: { PATH: "/usr/bin" },
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
  };
}

describe("cmdRun", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("loads env and executes the child process", async () => {
    createVaultClientMock.mockReturnValue({
      getEnv: vi.fn().mockResolvedValue({
        project: "infographics",
        secrets: [{ name: "TOKEN", value: "secret" }],
      }),
    });
    const runtime = createRuntime();

    const exitCode = await cmdRun(runtime, ["node", "app.js"]);

    expect(exitCode).toBe(0);
    expect(runProcessMock).toHaveBeenCalledWith(runtime, ["node", "app.js"], {
      PATH: "/usr/bin",
      TOKEN: "secret",
    });
  });
});
