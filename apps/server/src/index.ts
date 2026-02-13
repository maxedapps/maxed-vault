import { deriveMasterKey } from "./crypto";
import { initDatabase } from "./db";
import { router } from "./router";
import type { Context } from "./types";

const passphrase = process.env.VAULT_PASSPHRASE;
if (!passphrase) {
  console.error("Fatal: VAULT_PASSPHRASE environment variable is required");
  process.exit(1);
}

const port = Number(process.env.VAULT_PORT) || 8420;
const dbPath = process.env.VAULT_DB_PATH ?? "vault.db";

const masterKey = await deriveMasterKey(passphrase);
const db = initDatabase(dbPath);

const ctx: Context = { db, masterKey };

Bun.serve({
  port,
  fetch: (req) => router(req, ctx),
});

console.log(`BunVault listening on http://localhost:${port}`);
