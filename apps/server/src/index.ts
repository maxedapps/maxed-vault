import { deriveMasterKey } from "./crypto";
import { initDatabase } from "./db";
import { router } from "./router";
import type { Context } from "./types";

export interface ServerDeps {
  env: NodeJS.ProcessEnv;
  deriveMasterKey: typeof deriveMasterKey;
  initDatabase: typeof initDatabase;
  router: typeof router;
  serve: (options: { port: number; fetch: (req: Request) => Promise<Response> }) => unknown;
  log: (...args: unknown[]) => void;
  error: (...args: unknown[]) => void;
  exit: (code: number) => never;
}

function buildServerDeps(overrides: Partial<ServerDeps> = {}): ServerDeps {
  return {
    env: process.env,
    deriveMasterKey,
    initDatabase,
    router,
    serve: (options) => Bun.serve(options),
    log: console.log,
    error: console.error,
    exit: (code: number): never => process.exit(code),
    ...overrides,
  };
}

function parsePort(raw: string | undefined): number {
  if (!raw) return 8420;
  const parsed = Number(raw);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 8420;
}

export async function startServer(overrides: Partial<ServerDeps> = {}): Promise<Context> {
  const deps = buildServerDeps(overrides);
  const passphrase = deps.env.VAULT_PASSPHRASE;
  if (!passphrase) {
    deps.error("Fatal: VAULT_PASSPHRASE environment variable is required");
    deps.exit(1);
  }

  const port = parsePort(deps.env.VAULT_PORT);
  const dbPath = deps.env.VAULT_DB_PATH ?? "vault.db";

  const masterKey = await deps.deriveMasterKey(passphrase);
  const db = deps.initDatabase(dbPath);

  const ctx: Context = { db, masterKey };

  deps.serve({
    port,
    fetch: (req) => deps.router(req, ctx),
  });

  deps.log(`MaxedVault listening on http://localhost:${port}`);
  return ctx;
}

export async function runServerEntrypoint(overrides: Partial<ServerDeps> = {}): Promise<void> {
  const deps = buildServerDeps(overrides);
  try {
    await startServer(deps);
  } catch (err) {
    deps.error("Fatal startup error:", err);
    deps.exit(1);
  }
}

if (import.meta.main) {
  void runServerEntrypoint();
}
