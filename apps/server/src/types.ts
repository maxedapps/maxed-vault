import type { Database } from "bun:sqlite";

export interface Context {
  db: Database;
  masterKey: CryptoKey;
}
