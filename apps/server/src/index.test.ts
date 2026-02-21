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
  const serveMock = vi.fn();
  const logMock = vi.fn();
  const errorMock = vi.fn();
  const exitMock = vi.fn((code: number) => {
    throw new ExitError(code);
  });

  return {
    env: { VAULT_PASSPHRASE: "test-passphrase" },
    deriveMasterKey: deriveMasterKeyMock,
    initDatabase: initDatabaseMock,
    router: routerMock,
    serve: serveMock,
    log: logMock,
    error: errorMock,
    exit: exitMock as unknown as (code: number) => never,
    deriveMasterKeyMock,
    initDatabaseMock,
    routerMock,
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
  it("fails fast when passphrase is missing", async () => {
    const { startServer } = await import("./index");
    const deps = createDeps({ env: {} });

    await expect(startServer(deps)).rejects.toThrowError(ExitError);
    expect(deps.errorMock).toHaveBeenCalledWith(
      "Fatal: VAULT_PASSPHRASE environment variable is required",
    );
    expect(deps.exitMock).toHaveBeenCalledWith(1);
    expect(deps.serveMock).not.toHaveBeenCalled();
  });

  it("starts with default port and db path and wires router to serve fetch", async () => {
    const { startServer } = await import("./index");
    const key = {} as CryptoKey;
    const db = { close: vi.fn() };
    const deps = createDeps({
      deriveMasterKey: vi.fn().mockResolvedValue(key),
      initDatabase: vi.fn().mockReturnValue(db),
      env: { VAULT_PASSPHRASE: "test-passphrase" },
    });

    const startCtx = await startServer(deps);
    const [serveArgs] = deps.serveMock.mock.calls[0] as [{ port: number; fetch: (req: Request) => Promise<Response> }];

    expect(deps.deriveMasterKey).toHaveBeenCalledWith("test-passphrase");
    expect(deps.initDatabase).toHaveBeenCalledWith("vault.db");
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

  it("uses custom port and db path from env", async () => {
    const { startServer } = await import("./index");
    const deps = createDeps({
      env: {
        VAULT_PASSPHRASE: "test-passphrase",
        VAULT_PORT: "9999",
        VAULT_DB_PATH: "/tmp/custom-vault.db",
      },
    });

    await startServer(deps);

    const [serveArgs] = deps.serveMock.mock.calls[0] as [{ port: number }];
    expect(serveArgs.port).toBe(9999);
    expect(deps.initDatabase).toHaveBeenCalledWith("/tmp/custom-vault.db");
    expect(deps.logMock).toHaveBeenCalledWith("MaxedVault listening on http://localhost:9999");
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
