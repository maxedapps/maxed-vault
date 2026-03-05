import { beforeEach, describe, expect, it, vi } from "vitest";

const defaultDeriveMasterKeyMock = vi.hoisted(() => vi.fn().mockResolvedValue({} as CryptoKey));
const defaultInitDatabaseMock = vi.hoisted(() => vi.fn().mockReturnValue({ close: vi.fn() }));
const defaultRouterMock = vi.hoisted(() =>
  vi.fn().mockResolvedValue(new Response(JSON.stringify({ status: "ok" }))),
);

vi.mock("./crypto", () => ({
  deriveMasterKey: defaultDeriveMasterKeyMock,
}));

vi.mock("./db", () => ({
  initDatabase: defaultInitDatabaseMock,
}));

vi.mock("./router", () => ({
  router: defaultRouterMock,
}));

class ExitError extends Error {
  code: number;

  constructor(code: number) {
    super(`exit:${code}`);
    this.code = code;
  }
}

function createDeps(overrides: Record<string, unknown> = {}) {
  const deriveMasterKeyMock = vi.fn().mockResolvedValue({} as CryptoKey);
  const initDatabaseMock = vi.fn().mockReturnValue({ close: vi.fn() });
  const routerMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({ ok: true })));
  const promptPassphraseMock = vi.fn().mockReturnValue("test-passphrase");
  const homedirMock = vi.fn().mockReturnValue("/home/tester");
  const mkdirSyncMock = vi.fn();
  const serveMock = vi.fn();
  const logMock = vi.fn();
  const errorMock = vi.fn();
  const exitMock = vi.fn((code: number) => {
    throw new ExitError(code);
  });

  return {
    env: {},
    argv: [],
    platform: "linux",
    homedir: homedirMock,
    mkdirSync: mkdirSyncMock,
    deriveMasterKey: deriveMasterKeyMock,
    initDatabase: initDatabaseMock,
    router: routerMock,
    promptPassphrase: promptPassphraseMock,
    serve: serveMock,
    log: logMock,
    error: errorMock,
    exit: exitMock as unknown as (code: number) => never,
    deriveMasterKeyMock,
    initDatabaseMock,
    routerMock,
    promptPassphraseMock,
    homedirMock,
    mkdirSyncMock,
    serveMock,
    logMock,
    errorMock,
    exitMock,
    ...overrides,
  };
}

beforeEach(() => {
  vi.resetModules();
});

describe("startServer", () => {
  it("fails fast when prompted passphrase is missing", async () => {
    const { startServer } = await import("./index");
    const deps = createDeps({ promptPassphrase: vi.fn().mockReturnValue("") });

    await expect(startServer(deps)).rejects.toThrowError(ExitError);
    expect(deps.errorMock).toHaveBeenCalledWith("Fatal: passphrase is required");
    expect(deps.exitMock).toHaveBeenCalledWith(1);
    expect(deps.serveMock).not.toHaveBeenCalled();
  });

  it("prompts for passphrase, then starts with default port/db and wires router fetch", async () => {
    const { startServer } = await import("./index");
    const key = {} as CryptoKey;
    const db = { close: vi.fn() };
    const deps = createDeps({
      deriveMasterKey: vi.fn().mockResolvedValue(key),
      initDatabase: vi.fn().mockReturnValue(db),
      promptPassphrase: vi.fn().mockReturnValue("prompted-passphrase"),
    });

    const startCtx = await startServer(deps);
    const [serveArgs] = deps.serveMock.mock.calls[0] as [{ port: number; fetch: (req: Request) => Promise<Response> }];

    expect(deps.promptPassphrase).toHaveBeenCalledWith("Vault passphrase: ");
    expect(deps.deriveMasterKey).toHaveBeenCalledWith("prompted-passphrase");
    expect(deps.initDatabase).toHaveBeenCalledWith("/home/tester/.local/share/maxedvault/vault.db");
    expect(deps.mkdirSyncMock).toHaveBeenCalledWith("/home/tester/.local/share/maxedvault", {
      recursive: true,
    });
    expect(serveArgs.port).toBe(8420);
    expect(startCtx).toEqual({ db, masterKey: key });
    expect(deps.logMock).toHaveBeenCalledWith("MaxedVault listening on http://localhost:8420");

    const req = new Request("http://vault.local/health");
    const res = await serveArgs.fetch(req);
    expect(res.status).toBe(200);
    expect(deps.routerMock).toHaveBeenCalledTimes(1);
    const [calledReq, calledCtx] = deps.routerMock.mock.calls[0] as [
      Request,
      { db: unknown; masterKey: unknown },
    ];
    expect(calledReq).toBe(req);
    expect(calledCtx).toEqual({ db, masterKey: key });
  });

  it("uses --passphrase value and skips prompt", async () => {
    const { startServer } = await import("./index");
    const promptPassphrase = vi.fn();
    const deps = createDeps({
      argv: ["--passphrase", "flag-passphrase"],
      promptPassphrase,
    });

    await startServer(deps);

    expect(promptPassphrase).not.toHaveBeenCalled();
    expect(deps.deriveMasterKey).toHaveBeenCalledWith("flag-passphrase");
  });

  it("uses --passphrase=<value> form", async () => {
    const { startServer } = await import("./index");
    const promptPassphrase = vi.fn();
    const deps = createDeps({
      argv: ["--passphrase=inline-passphrase"],
      promptPassphrase,
    });

    await startServer(deps);

    expect(promptPassphrase).not.toHaveBeenCalled();
    expect(deps.deriveMasterKey).toHaveBeenCalledWith("inline-passphrase");
  });

  it("fails fast when --passphrase has no value", async () => {
    const { startServer } = await import("./index");
    const deps = createDeps({
      argv: ["--passphrase"],
    });

    await expect(startServer(deps)).rejects.toThrowError(ExitError);
    expect(deps.errorMock).toHaveBeenCalledWith("Fatal: --passphrase flag requires a value");
    expect(deps.exitMock).toHaveBeenCalledWith(1);
    expect(deps.promptPassphraseMock).not.toHaveBeenCalled();
    expect(deps.serveMock).not.toHaveBeenCalled();
  });

  it("fails fast when --passphrase is empty", async () => {
    const { startServer } = await import("./index");
    const deps = createDeps({
      argv: ["--passphrase="],
    });

    await expect(startServer(deps)).rejects.toThrowError(ExitError);
    expect(deps.errorMock).toHaveBeenCalledWith("Fatal: --passphrase cannot be empty");
    expect(deps.exitMock).toHaveBeenCalledWith(1);
    expect(deps.promptPassphraseMock).not.toHaveBeenCalled();
    expect(deps.serveMock).not.toHaveBeenCalled();
  });

  it("uses custom port and db path from env", async () => {
    const { startServer } = await import("./index");
    const deps = createDeps({
      env: {
        VAULT_PORT: "9999",
        VAULT_DB_PATH: "/tmp/custom-vault.db",
      },
      argv: ["--passphrase", "test-passphrase"],
    });

    await startServer(deps);

    const [serveArgs] = deps.serveMock.mock.calls[0] as [{ port: number }];
    expect(serveArgs.port).toBe(9999);
    expect(deps.initDatabase).toHaveBeenCalledWith("/tmp/custom-vault.db");
    expect(deps.mkdirSyncMock).toHaveBeenCalledWith("/tmp", { recursive: true });
    expect(deps.logMock).toHaveBeenCalledWith("MaxedVault listening on http://localhost:9999");
  });

  it("uses macOS Application Support default path when platform is darwin", async () => {
    const { startServer } = await import("./index");
    const deps = createDeps({
      platform: "darwin",
      homedir: vi.fn().mockReturnValue("/Users/tester"),
    });

    await startServer(deps);

    expect(deps.initDatabase).toHaveBeenCalledWith(
      "/Users/tester/Library/Application Support/maxedvault/vault.db",
    );
    expect(deps.mkdirSyncMock).toHaveBeenCalledWith(
      "/Users/tester/Library/Application Support/maxedvault",
      { recursive: true },
    );
  });

  it("uses XDG_DATA_HOME on linux when available", async () => {
    const { startServer } = await import("./index");
    const deps = createDeps({
      env: {
        XDG_DATA_HOME: "/var/lib/user-data",
      },
    });

    await startServer(deps);

    expect(deps.initDatabase).toHaveBeenCalledWith("/var/lib/user-data/maxedvault/vault.db");
    expect(deps.mkdirSyncMock).toHaveBeenCalledWith("/var/lib/user-data/maxedvault", {
      recursive: true,
    });
  });
});

describe("runServerEntrypoint", () => {
  it("prints fatal startup errors and exits", async () => {
    const { runServerEntrypoint } = await import("./index");
    const boom = new Error("boom");
    const deps = createDeps({
      deriveMasterKey: vi.fn().mockRejectedValue(boom),
    });

    await expect(runServerEntrypoint(deps)).rejects.toThrowError(ExitError);
    expect(deps.errorMock).toHaveBeenCalledWith("Fatal startup error:", boom);
    expect(deps.exitMock).toHaveBeenCalledWith(1);
  });
});
