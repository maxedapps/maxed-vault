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
    expect(deps.runClient).not.toHaveBeenCalled();
  });

  it("dispatches server start and run aliases with forwarded args", async () => {
    const depsStart = createDeps();
    await runApp(["server", "start", "--passphrase", "change-me"], depsStart);
    expect(depsStart.runServer).toHaveBeenCalledWith(["--passphrase", "change-me"]);

    const depsRun = createDeps();
    await runApp(["server", "run", "--passphrase=change-me"], depsRun);
    expect(depsRun.runServer).toHaveBeenCalledWith(["--passphrase=change-me"]);

    const depsFlagOnly = createDeps();
    await runApp(["server", "--passphrase-file", "/tmp/passphrase.txt"], depsFlagOnly);
    expect(depsFlagOnly.runServer).toHaveBeenCalledWith(["--passphrase-file", "/tmp/passphrase.txt"]);
  });

  it("prints global help for help commands", async () => {
    const depsHelp = createDeps();
    await runApp(["help"], depsHelp);
    expect(depsHelp.log).toHaveBeenCalledWith(
      expect.stringContaining("MaxedVault — unified server + client CLI"),
    );

    const depsDashHelp = createDeps();
    await runApp(["--help"], depsDashHelp);
    expect(depsDashHelp.log).toHaveBeenCalledWith(
      expect.stringContaining("maxedvault init [--server <url>]"),
    );

    const depsShortHelp = createDeps();
    await runApp(["-h"], depsShortHelp);
    expect(depsShortHelp.log).toHaveBeenCalledWith(
      expect.stringContaining("maxedvault help [server]"),
    );

    const depsNoArgs = createDeps();
    await runApp([], depsNoArgs);
    expect(depsNoArgs.log).toHaveBeenCalledWith(
      expect.stringContaining("MaxedVault — unified server + client CLI"),
    );
  });

  it("prints server help for server help forms", async () => {
    const depsHelpTopic = createDeps();
    await runApp(["help", "server"], depsHelpTopic);
    expect(depsHelpTopic.log).toHaveBeenCalledWith(expect.stringContaining("MaxedVault server help"));

    const depsServerHelp = createDeps();
    await runApp(["server", "--help"], depsServerHelp);
    expect(depsServerHelp.log).toHaveBeenCalledWith(expect.stringContaining("VAULT_PASSPHRASE_FILE"));

    const depsServerStartHelp = createDeps();
    await runApp(["server", "start", "--help"], depsServerStartHelp);
    expect(depsServerStartHelp.log).toHaveBeenCalledWith(
      expect.stringContaining("If no passphrase source is provided, an interactive prompt is shown."),
    );
  });

  it("treats removed top-level aliases as client commands", async () => {
    const depsServe = createDeps();
    await runApp(["serve"], depsServe);
    expect(depsServe.runClient).toHaveBeenCalledWith(["serve"]);
    expect(depsServe.runServer).not.toHaveBeenCalled();

    const depsStart = createDeps();
    await runApp(["start"], depsStart);
    expect(depsStart.runClient).toHaveBeenCalledWith(["start"]);
    expect(depsStart.runServer).not.toHaveBeenCalled();
  });

  it("prints usage and exits for invalid server subcommands", async () => {
    const deps = createDeps();

    await expect(runApp(["server", "stop"], deps)).rejects.toThrowError(ExitError);
    expect(deps.error).toHaveBeenCalledWith(expect.stringContaining("Run 'maxedvault help'"));
    expect(deps.exitMock).toHaveBeenCalledWith(1);
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
    expect(deps.exitMock).toHaveBeenCalledWith(1);
  });
});
