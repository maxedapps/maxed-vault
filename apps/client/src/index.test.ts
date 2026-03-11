import { parseArgs } from "node:util";
import { describe, expect, it, vi } from "vitest";
import { CliError } from "./errors";
import { parseRunInput, runCli, runCliEntrypoint } from "./index";
import type { CliDeps } from "./index";

class ExitError extends Error {
  code: number;

  constructor(code: number) {
    super(`exit:${code}`);
    this.code = code;
  }
}

function createDeps(): Partial<CliDeps> & { exitMock: ReturnType<typeof vi.fn> } {
  const exitMock = vi.fn((code: number) => {
    throw new ExitError(code);
  });

  return {
    env: {},
    cwd: () => "/workspace",
    fetch: vi.fn() as unknown as typeof fetch,
    promptInput: vi.fn().mockReturnValue(null),
    log: vi.fn(),
    writeStdout: vi.fn(),
    readStdinText: vi.fn().mockResolvedValue(""),
    isStdinTTY: vi.fn().mockReturnValue(false),
    spawn: vi.fn() as unknown as typeof Bun.spawn,
    onSignal: vi.fn(),
    offSignal: vi.fn(),
    parseArgs,
    saveGlobalConfig: vi.fn().mockResolvedValue(undefined),
    cmdProjectCreate: vi.fn().mockResolvedValue(undefined),
    cmdProjectList: vi.fn().mockResolvedValue(undefined),
    cmdProjectUse: vi.fn().mockResolvedValue(undefined),
    cmdProjectCurrent: vi.fn(),
    cmdProjectClear: vi.fn(),
    cmdSecretGet: vi.fn().mockResolvedValue(undefined),
    cmdSecretSet: vi.fn().mockResolvedValue(undefined),
    cmdSecretImport: vi.fn().mockResolvedValue(undefined),
    cmdSecretList: vi.fn().mockResolvedValue(undefined),
    cmdSecretRemove: vi.fn().mockResolvedValue(undefined),
    cmdEnv: vi.fn().mockResolvedValue(undefined),
    cmdRun: vi.fn().mockResolvedValue(0),
    cmdStatus: vi.fn().mockResolvedValue(undefined),
    probeServerUrl: vi.fn().mockResolvedValue(true),
    error: vi.fn(),
    exit: exitMock as unknown as (code: number) => never,
    exitMock,
  };
}

describe("parseRunInput", () => {
  it("parses optional project and command when separator is present", () => {
    expect(parseRunInput(["--project", "infographics", "--", "bun", "run", "dev"])).toEqual({
      project: "infographics",
      command: ["bun", "run", "dev"],
    });
    expect(parseRunInput(["--", "node", "app.js"])).toEqual({
      project: undefined,
      command: ["node", "app.js"],
    });
  });

  it("returns null for malformed input", () => {
    expect(parseRunInput(["--project", "infographics"])).toBeNull();
    expect(parseRunInput(["positional", "--", "node"])).toBeNull();
  });
});

describe("runCli", () => {
  it("dispatches the new secret command surface", async () => {
    const deps = createDeps();

    await runCli(["secret", "get", "TOKEN", "--project", "infographics"], deps);

    expect(deps.cmdSecretGet).toHaveBeenCalledWith(expect.any(Object), "TOKEN", "infographics");
  });

  it("dispatches secret import", async () => {
    const deps = createDeps();

    await runCli(["secret", "import", "--file", ".env", "--project", "infographics"], deps);

    expect(deps.cmdSecretImport).toHaveBeenCalledWith(expect.any(Object), ".env", "infographics");
  });

  it("dispatches run with optional project", async () => {
    const deps = createDeps();

    await runCli(["run", "--", "node", "app.js"], deps);

    expect(deps.cmdRun).toHaveBeenCalledWith(expect.any(Object), ["node", "app.js"], undefined);
  });

  it("prints help for project help", async () => {
    const deps = createDeps();

    await runCli(["help", "project"], deps);

    expect(deps.log).toHaveBeenCalledWith(expect.stringContaining("MaxedVault project help"));
  });

  it("throws CliError for unknown commands", async () => {
    const deps = createDeps();

    await expect(runCli(["unknown"], deps)).rejects.toThrowError(CliError);
  });
});

describe("runCliEntrypoint", () => {
  it("prints cli errors and exits with their code", async () => {
    const deps = createDeps();
    deps.argv = ["secret", "get"];

    await expect(runCliEntrypoint(deps)).rejects.toThrowError(ExitError);
    expect(deps.error).toHaveBeenCalledWith(expect.stringContaining("Usage:"));
    expect(deps.exitMock).toHaveBeenCalledWith(1);
  });
});
