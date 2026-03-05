import { mkdirSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join } from "node:path";
import { deriveMasterKey } from "./crypto";
import { initDatabase } from "./db";
import { router } from "./router";
import type { Context } from "./types";

type PromptPassphrase = (message: string) => string | null;

export interface ServerDeps {
  env: NodeJS.ProcessEnv;
  argv: string[];
  platform: NodeJS.Platform;
  homedir: () => string;
  mkdirSync: typeof mkdirSync;
  deriveMasterKey: typeof deriveMasterKey;
  initDatabase: typeof initDatabase;
  router: typeof router;
  promptPassphrase: PromptPassphrase;
  serve: (options: { port: number; fetch: (req: Request) => Promise<Response> }) => unknown;
  log: (...args: unknown[]) => void;
  error: (...args: unknown[]) => void;
  exit: (code: number) => never;
}

function buildServerDeps(overrides: Partial<ServerDeps> = {}): ServerDeps {
  return {
    env: process.env,
    argv: process.argv.slice(2),
    platform: process.platform,
    homedir,
    mkdirSync,
    deriveMasterKey,
    initDatabase,
    router,
    promptPassphrase: (message) => {
      const runtimePrompt = (globalThis as { prompt?: (msg: string) => string | null }).prompt;
      if (!runtimePrompt) {
        throw new Error(
          "Interactive prompt is unavailable in this runtime. Start with --passphrase <value>.",
        );
      }
      return runtimePrompt(message);
    },
    serve: (options) => Bun.serve(options),
    log: console.log,
    error: console.error,
    exit: (code: number): never => process.exit(code),
    ...overrides,
  };
}

function parsePassphraseArg(argv: string[]): { passphrase?: string; error?: string } {
  let passphrase: string | undefined;
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--passphrase") {
      const next = argv[i + 1];
      if (!next || next.startsWith("--")) {
        return { error: "Fatal: --passphrase flag requires a value" };
      }
      passphrase = next;
      i += 1;
      continue;
    }
    if (arg.startsWith("--passphrase=")) {
      passphrase = arg.slice("--passphrase=".length);
    }
  }

  if (passphrase !== undefined && passphrase.length === 0) {
    return { error: "Fatal: --passphrase cannot be empty" };
  }

  return { passphrase };
}

function resolvePassphrase(deps: ServerDeps): string {
  const { passphrase, error } = parsePassphraseArg(deps.argv);
  if (error) {
    deps.error(error);
    deps.exit(1);
  }

  if (passphrase) {
    return passphrase;
  }

  const prompted = deps.promptPassphrase("Vault passphrase: ");
  if (!prompted) {
    deps.error("Fatal: passphrase is required");
    deps.exit(1);
  }

  return prompted;
}

function parsePort(raw: string | undefined): number {
  if (!raw) return 8420;
  const parsed = Number(raw);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 8420;
}

function resolveDefaultDbPath(
  env: NodeJS.ProcessEnv,
  platform: NodeJS.Platform,
  home: string,
): string {
  if (platform === "darwin") {
    return join(home, "Library", "Application Support", "maxedvault", "vault.db");
  }

  const xdgDataHome = env.XDG_DATA_HOME;
  const dataHome =
    typeof xdgDataHome === "string" && xdgDataHome.trim().length > 0
      ? xdgDataHome
      : join(home, ".local", "share");

  return join(dataHome, "maxedvault", "vault.db");
}

export async function startServer(overrides: Partial<ServerDeps> = {}): Promise<Context> {
  const deps = buildServerDeps(overrides);
  const passphrase = resolvePassphrase(deps);

  const port = parsePort(deps.env.VAULT_PORT);
  const dbPath = deps.env.VAULT_DB_PATH ?? resolveDefaultDbPath(deps.env, deps.platform, deps.homedir());
  deps.mkdirSync(dirname(dbPath), { recursive: true });

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
