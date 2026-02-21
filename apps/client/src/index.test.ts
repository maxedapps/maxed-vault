import { describe, expect, it, vi } from "vitest";
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
    saveConfig: vi.fn().mockResolvedValue(undefined),
    cmdGet: vi.fn().mockResolvedValue(undefined),
    cmdSet: vi.fn().mockResolvedValue(undefined),
    cmdLs: vi.fn().mockResolvedValue(undefined),
    cmdRm: vi.fn().mockResolvedValue(undefined),
    cmdStatus: vi.fn().mockResolvedValue(undefined),
    cmdProjectCreate: vi.fn().mockResolvedValue(undefined),
    cmdProjectLs: vi.fn().mockResolvedValue(undefined),
    cmdEnv: vi.fn().mockResolvedValue(undefined),
    cmdRun: vi.fn().mockResolvedValue(undefined),
    error: vi.fn(),
    exit: exitMock as unknown as (code: number) => never,
    exitMock,
  };
}

describe("parseRunInput", () => {
  it("parses project and command when separator is present", () => {
    expect(parseRunInput(["--project", "infographics", "--", "bun", "run", "dev"])).toEqual({
      project: "infographics",
      command: ["bun", "run", "dev"],
    });
  });

  it("returns null for invalid run syntax", () => {
    expect(parseRunInput(["--project", "infographics"])).toBeNull();
    expect(parseRunInput(["--project", "infographics", "--"])).toBeNull();
    expect(parseRunInput(["positional", "--project", "infographics", "--", "bun"])).toBeNull();
  });
});

describe("runCli", () => {
  it("dispatches run command", async () => {
    const deps = createDeps();

    await runCli(["run", "--project", "infographics", "--", "bun", "run"], deps);

    expect(deps.cmdRun).toHaveBeenCalledWith("infographics", ["bun", "run"]);
  });

  it("fails with usage for malformed run command", async () => {
    const deps = createDeps();

    await expect(runCli(["run", "--project", "infographics"], deps)).rejects.toThrowError(ExitError);
    expect(deps.error).toHaveBeenCalledWith(
      "Usage: maxedvault run --project <slug> -- <command> [args...]",
    );
    expect(deps.exitMock).toHaveBeenCalledWith(1);
  });

  it("dispatches init command", async () => {
    const deps = createDeps();

    await runCli(["init", "--server", "http://vault.internal"], deps);

    expect(deps.saveConfig).toHaveBeenCalledWith("http://vault.internal");
    expect(deps.error).toHaveBeenCalledWith("Configured server: http://vault.internal");
  });

  it("fails with usage for missing init server", async () => {
    const deps = createDeps();

    await expect(runCli(["init"], deps)).rejects.toThrowError(ExitError);
    expect(deps.error).toHaveBeenCalledWith("Usage: maxedvault init --server <url>");
    expect(deps.exitMock).toHaveBeenCalledWith(1);
  });

  it("dispatches get command", async () => {
    const deps = createDeps();

    await runCli(["get", "WEBHOOK_SECRET", "--project", "infographics"], deps);

    expect(deps.cmdGet).toHaveBeenCalledWith("infographics", "WEBHOOK_SECRET");
  });

  it("dispatches project commands", async () => {
    const depsCreate = createDeps();
    await runCli(["project", "create", "infographics"], depsCreate);
    expect(depsCreate.cmdProjectCreate).toHaveBeenCalledWith("infographics");

    const depsLs = createDeps();
    await runCli(["project", "ls"], depsLs);
    expect(depsLs.cmdProjectLs).toHaveBeenCalledTimes(1);
  });

  it("fails with usage for unknown command", async () => {
    const deps = createDeps();

    await expect(runCli(["unknown"], deps)).rejects.toThrowError(ExitError);
    expect(deps.error).toHaveBeenCalledWith("Usage: maxedvault <init|get|set|ls|rm|status|project|env|run>");
    expect(deps.exitMock).toHaveBeenCalledWith(1);
  });
});

describe("runCliEntrypoint", () => {
  it("handles uncaught command errors", async () => {
    const deps = createDeps();
    const boom = new Error("boom");
    deps.argv = ["status"];
    deps.cmdStatus = vi.fn().mockRejectedValue(boom);

    await expect(runCliEntrypoint(deps)).rejects.toThrowError(ExitError);
    expect(deps.error).toHaveBeenCalledWith("Unhandled error:", boom);
    expect(deps.exitMock).toHaveBeenCalledWith(1);
  });
});
