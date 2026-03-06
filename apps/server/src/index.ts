import { mkdirSync, readFileSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join } from "node:path";
import { initDatabase } from "./db";
import { getWeakPassphraseWarning } from "./passphrase";
import { router } from "./router";
import type { Context } from "./types";
import { initializeOrUnlockVault } from "./vault";

type PromptPassphrase = (message: string) => string | null;

interface ParsedServerArgs {
  passphrase?: string;
  passphraseFile?: string;
  host?: string;
  error?: string;
}

export interface ServerDeps {
  env: NodeJS.ProcessEnv;
  argv: string[];
  platform: NodeJS.Platform;
  homedir: () => string;
  mkdirSync: typeof mkdirSync;
  readFileSync: typeof readFileSync;
  initDatabase: typeof initDatabase;
  initializeOrUnlockVault: typeof initializeOrUnlockVault;
  getWeakPassphraseWarning: typeof getWeakPassphraseWarning;
  router: typeof router;
  promptPassphrase: PromptPassphrase;
  serve: (options: {
    hostname: string;
    port: number;
    fetch: (req: Request) => Promise<Response>;
  }) => unknown;
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
    readFileSync,
    initDatabase,
    initializeOrUnlockVault,
    getWeakPassphraseWarning,
    router,
    promptPassphrase: (message) => {
      const runtimePrompt = (globalThis as { prompt?: (msg: string) => string | null }).prompt;
      if (!runtimePrompt) {
        throw new Error(
          "Interactive prompt is unavailable in this runtime. Use --passphrase/--passphrase-file or env vars.",
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

function parseServerArgs(argv: string[]): ParsedServerArgs {
  let passphrase: string | undefined;
  let passphraseFile: string | undefined;
  let host: string | undefined;

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
      continue;
    }

    if (arg === "--passphrase-file") {
      const next = argv[i + 1];
      if (!next || next.startsWith("--")) {
        return { error: "Fatal: --passphrase-file flag requires a path" };
      }
      passphraseFile = next;
      i += 1;
      continue;
    }

    if (arg.startsWith("--passphrase-file=")) {
      passphraseFile = arg.slice("--passphrase-file=".length);
      continue;
    }

    if (arg === "--host") {
      const next = argv[i + 1];
      if (!next || next.startsWith("--")) {
        return { error: "Fatal: --host flag requires a value" };
      }
      host = next;
      i += 1;
      continue;
    }

    if (arg.startsWith("--host=")) {
      host = arg.slice("--host=".length);
    }
  }

  if (passphrase !== undefined && passphrase.length === 0) {
    return { error: "Fatal: --passphrase cannot be empty" };
  }

  if (passphraseFile !== undefined && passphraseFile.trim().length === 0) {
    return { error: "Fatal: --passphrase-file cannot be empty" };
  }

  if (passphrase && passphraseFile) {
    return { error: "Fatal: use either --passphrase or --passphrase-file, not both" };
  }

  if (host !== undefined && host.trim().length === 0) {
    return { error: "Fatal: --host cannot be empty" };
  }

  return { passphrase, passphraseFile, host };
}

function stripTrailingNewlines(input: string): string {
  return input.replace(/[\r\n]+$/, "");
}

function readPassphraseFile(path: string, deps: ServerDeps): string {
  let text: string;
  try {
    text = deps.readFileSync(path, "utf-8");
  } catch (err) {
    deps.error(`Fatal: failed to read passphrase file '${path}':`, err);
    deps.exit(1);
  }

  const passphrase = stripTrailingNewlines(text);
  if (passphrase.length === 0) {
    deps.error("Fatal: passphrase from file cannot be empty");
    deps.exit(1);
  }

  return passphrase;
}

function resolvePassphrase(parsedArgs: ParsedServerArgs, deps: ServerDeps): string {
  const { passphrase, passphraseFile } = parsedArgs;
  if (passphrase) {
    return passphrase;
  }

  if (passphraseFile) {
    return readPassphraseFile(passphraseFile, deps);
  }

  const envPassphrase = deps.env.VAULT_PASSPHRASE;
  const envPassphraseFile = deps.env.VAULT_PASSPHRASE_FILE;

  if (envPassphrase !== undefined && envPassphraseFile !== undefined) {
    deps.error("Fatal: use either VAULT_PASSPHRASE or VAULT_PASSPHRASE_FILE, not both");
    deps.exit(1);
  }

  if (envPassphrase !== undefined) {
    if (envPassphrase.length === 0) {
      deps.error("Fatal: VAULT_PASSPHRASE cannot be empty");
      deps.exit(1);
    }
    return envPassphrase;
  }

  if (envPassphraseFile !== undefined) {
    if (envPassphraseFile.trim().length === 0) {
      deps.error("Fatal: VAULT_PASSPHRASE_FILE cannot be empty");
      deps.exit(1);
    }
    return readPassphraseFile(envPassphraseFile, deps);
  }

  const prompted = deps.promptPassphrase("Vault passphrase: ");
  if (!prompted) {
    deps.error("Fatal: passphrase is required");
    deps.exit(1);
  }

  return prompted;
}

function resolveHost(parsedArgs: ParsedServerArgs, deps: ServerDeps): string {
  if (parsedArgs.host) {
    return parsedArgs.host.trim();
  }

  const envHost = deps.env.VAULT_HOST;
  if (envHost !== undefined) {
    if (envHost.trim().length === 0) {
      deps.error("Fatal: VAULT_HOST cannot be empty");
      deps.exit(1);
    }

    return envHost.trim();
  }

  return "0.0.0.0";
}

function parsePort(raw: string | undefined): number {
  if (!raw) return 8420;
  const parsed = Number(raw);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 8420;
}

function formatBindAddress(host: string, port: number): string {
  const hostWithPort = host.includes(":") && !host.startsWith("[") ? `[${host}]` : host;

  if (host === "0.0.0.0" || host === "::") {
    return `${hostWithPort}:${port} (all interfaces)`;
  }

  return `${hostWithPort}:${port}`;
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
  const parsedArgs = parseServerArgs(deps.argv);
  if (parsedArgs.error) {
    deps.error(parsedArgs.error);
    deps.exit(1);
  }

  const passphrase = resolvePassphrase(parsedArgs, deps);
  const host = resolveHost(parsedArgs, deps);

  const port = parsePort(deps.env.VAULT_PORT);
  const dbPath = deps.env.VAULT_DB_PATH ?? resolveDefaultDbPath(deps.env, deps.platform, deps.homedir());
  deps.mkdirSync(dirname(dbPath), { recursive: true });

  const db = deps.initDatabase(dbPath);
  let masterKey: CryptoKey;
  let mode: "created" | "opened" | "migrated";

  try {
    const unlocked = await deps.initializeOrUnlockVault(db, passphrase);
    masterKey = unlocked.masterKey;
    mode = unlocked.mode;
  } catch (err) {
    if (err instanceof Error && err.message.startsWith("Fatal:")) {
      db.close();
      deps.error(err.message);
      deps.exit(1);
    }

    throw err;
  }

  if (mode === "created") {
    const weakPassphraseWarning = deps.getWeakPassphraseWarning(passphrase);
    if (weakPassphraseWarning) {
      deps.error(weakPassphraseWarning);
    }
  }

  const ctx: Context = { db, masterKey };

  deps.serve({
    hostname: host,
    port,
    fetch: (req) => deps.router(req, ctx),
  });

  deps.log(`MaxedVault listening on ${formatBindAddress(host, port)}`);
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
