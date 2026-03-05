import { mkdirSync, readFileSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join } from "node:path";
import { deriveMasterKey } from "./crypto";
import { initDatabase } from "./db";
import { router } from "./router";
import type { Context } from "./types";

type PromptPassphrase = (message: string) => string | null;

interface ParsedPassphraseArgs {
  passphrase?: string;
  passphraseFile?: string;
  error?: string;
}

export interface ServerDeps {
  env: NodeJS.ProcessEnv;
  argv: string[];
  platform: NodeJS.Platform;
  homedir: () => string;
  mkdirSync: typeof mkdirSync;
  readFileSync: typeof readFileSync;
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
    readFileSync,
    deriveMasterKey,
    initDatabase,
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

function parsePassphraseArg(argv: string[]): ParsedPassphraseArgs {
  let passphrase: string | undefined;
  let passphraseFile: string | undefined;

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

  return { passphrase, passphraseFile };
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

function resolvePassphrase(deps: ServerDeps): string {
  const { passphrase, passphraseFile, error } = parsePassphraseArg(deps.argv);
  if (error) {
    deps.error(error);
    deps.exit(1);
  }

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
