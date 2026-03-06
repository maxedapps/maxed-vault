import { describe, expect, it, vi } from "vitest";

const runCliEntrypointMock = vi.hoisted(() => vi.fn().mockResolvedValue(undefined));
const runServerEntrypointMock = vi.hoisted(() => vi.fn().mockResolvedValue(undefined));

vi.mock("../../client/src/index.ts", () => ({
  runCliEntrypoint: runCliEntrypointMock,
}));

vi.mock("../../server/src/index.ts", () => ({
  runServerEntrypoint: runServerEntrypointMock,
}));

import { runApp, runAppEntrypoint } from "./index";
import type { AppDeps } from "./index";

class ExitError extends Error {
  code: number;

  constructor(code: number) {
    super(`exit:${code}`);
    this.code = code;
  }
}

function createDeps(): Partial<AppDeps> & { exitMock: ReturnType<typeof vi.fn> } {
  const exitMock = vi.fn((code: number) => {
    throw new ExitError(code);
  });

  return {
    runClient: vi.fn().mockResolvedValue(undefined),
    runServer: vi.fn().mockResolvedValue(undefined),
    log: vi.fn(),
    error: vi.fn(),
    exit: exitMock as unknown as (code: number) => never,
    exitMock,
  };
}

describe("runApp", () => {
  it("dispatches non-server commands to the client CLI", async () => {
    const deps = createDeps();

    await runApp(["status"], deps);

    expect(deps.runClient).toHaveBeenCalledWith(["status"]);
    expect(deps.runServer).not.toHaveBeenCalled();
  });

  it("starts server when called as 'server'", async () => {
    const deps = createDeps();

    await runApp(["server"], deps);

    expect(deps.runServer).toHaveBeenCalledWith([]);
  });

  it("prints updated help text", async () => {
    const deps = createDeps();

    await runApp(["help"], deps);

    expect(deps.log).toHaveBeenCalledWith(expect.stringContaining("maxedvault secret set <name>"));
    expect(deps.log).toHaveBeenCalledWith(expect.stringContaining("maxedvault project use <slug>"));
  });

  it("prints usage and exits for invalid server subcommands", async () => {
    const deps = createDeps();

    await expect(runApp(["server", "stop"], deps)).rejects.toThrowError(ExitError);
    expect(deps.error).toHaveBeenCalledWith(expect.stringContaining("Run 'maxedvault help'"));
  });
});

describe("runAppEntrypoint", () => {
  it("handles uncaught command errors", async () => {
    const deps = createDeps();
    const boom = new Error("boom");
    deps.argv = ["status"];
    deps.runClient = vi.fn().mockRejectedValue(boom);

    await expect(runAppEntrypoint(deps)).rejects.toThrowError(ExitError);
    expect(deps.error).toHaveBeenCalledWith("Unhandled error:", boom);
  });
});
