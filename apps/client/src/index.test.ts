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
    promptInput: vi.fn().mockReturnValue(null),
    probeServerUrl: vi.fn().mockResolvedValue(true),
    log: vi.fn(),
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

  it("dispatches init command with explicit URL", async () => {
    const deps = createDeps();

    await runCli(["init", "--server", "http://vault.internal"], deps);

    expect(deps.probeServerUrl).not.toHaveBeenCalled();
    expect(deps.saveConfig).toHaveBeenCalledWith("http://vault.internal");
    expect(deps.log).toHaveBeenCalledWith("Configured server: http://vault.internal");
  });

  it("prompts for init server when --server is missing", async () => {
    const deps = createDeps();
    deps.promptInput = vi.fn().mockReturnValue("localhost:8420");
    deps.probeServerUrl = vi
      .fn()
      .mockImplementation(async (url: string) => (url === "http://localhost:8420" ? true : false));

    await runCli(["init"], deps);

    expect(deps.promptInput).toHaveBeenCalledWith("Server URL or host (e.g. localhost:8420): ");
    expect(deps.probeServerUrl).toHaveBeenNthCalledWith(1, "https://localhost:8420");
    expect(deps.probeServerUrl).toHaveBeenNthCalledWith(2, "http://localhost:8420");
    expect(deps.saveConfig).toHaveBeenCalledWith("http://localhost:8420");
    expect(deps.log).toHaveBeenCalledWith("Configured server: http://localhost:8420");
  });

  it("tries https and keeps it when reachable for host-only --server", async () => {
    const deps = createDeps();
    deps.probeServerUrl = vi.fn().mockResolvedValue(true);

    await runCli(["init", "--server", "127.0.0.1:8420"], deps);

    expect(deps.probeServerUrl).toHaveBeenCalledTimes(1);
    expect(deps.probeServerUrl).toHaveBeenCalledWith("https://127.0.0.1:8420");
    expect(deps.saveConfig).toHaveBeenCalledWith("https://127.0.0.1:8420");
  });

  it("fails when init prompt is empty", async () => {
    const deps = createDeps();
    deps.promptInput = vi.fn().mockReturnValue("   ");

    await expect(runCli(["init"], deps)).rejects.toThrowError(ExitError);
    expect(deps.error).toHaveBeenCalledWith(
      "Server URL is required. Usage: maxedvault init [--server <url>]",
    );
    expect(deps.exitMock).toHaveBeenCalledWith(1);
  });

  it("fails when no-scheme init server is unreachable via both https and http", async () => {
    const deps = createDeps();
    deps.probeServerUrl = vi.fn().mockResolvedValue(false);

    await expect(runCli(["init", "--server", "localhost:8420"], deps)).rejects.toThrowError(ExitError);

    expect(deps.probeServerUrl).toHaveBeenNthCalledWith(1, "https://localhost:8420");
    expect(deps.probeServerUrl).toHaveBeenNthCalledWith(2, "http://localhost:8420");
    expect(deps.error).toHaveBeenCalledWith(
      "Could not reach server via https://localhost:8420 or http://localhost:8420. Start the server and try again, or pass a full URL with --server.",
    );
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
