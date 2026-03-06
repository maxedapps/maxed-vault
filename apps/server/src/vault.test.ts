import { describe, expect, it } from "vitest";
import { decryptSecret, deriveLegacyMasterKey, encryptSecret } from "./crypto";
import { FakeDb } from "./test-utils/fake-db";
import { initializeOrUnlockVault } from "./vault";

describe("initializeOrUnlockVault", () => {
  it("creates verifier metadata for a new vault and reopens it", async () => {
    const db = new FakeDb();

    const created = await initializeOrUnlockVault(db as never, "CorrectHorseBatteryStaple!42");
    expect(created.mode).toBe("created");

    const metadata = db
      .query("SELECT salt, check_ciphertext, check_iv FROM vault_meta WHERE id = 1")
      .get() as { salt: string; check_ciphertext: string; check_iv: string } | null;
    expect(metadata?.salt).toEqual(expect.any(String));
    expect(metadata?.check_ciphertext).toEqual(expect.any(String));
    expect(metadata?.check_iv).toEqual(expect.any(String));

    const reopened = await initializeOrUnlockVault(db as never, "CorrectHorseBatteryStaple!42");
    expect(reopened.mode).toBe("opened");
  });

  it("rejects the wrong passphrase once metadata exists", async () => {
    const db = new FakeDb();

    await initializeOrUnlockVault(db as never, "CorrectHorseBatteryStaple!42");

    await expect(initializeOrUnlockVault(db as never, "wrong-passphrase")).rejects.toThrow(
      "Fatal: passphrase did not match this vault",
    );
  });

  it("migrates legacy vault secrets to per-vault metadata", async () => {
    const db = new FakeDb();
    db.query("INSERT INTO projects (name) VALUES (?1)").run("demo");

    const legacyKey = await deriveLegacyMasterKey("legacy-passphrase");
    const encrypted = await encryptSecret("secret-value", legacyKey);
    db.query("INSERT INTO secrets (project_id, name, encrypted_value, iv) VALUES (?1, ?2, ?3, ?4)")
      .run(1, "TOKEN", encrypted.encrypted, encrypted.iv);

    const migrated = await initializeOrUnlockVault(db as never, "legacy-passphrase");
    expect(migrated.mode).toBe("migrated");

    const metadata = db.query("SELECT salt FROM vault_meta WHERE id = 1").get() as
      | { salt: string }
      | null;
    expect(metadata?.salt).toEqual(expect.any(String));

    const row = db
      .query("SELECT encrypted_value, iv FROM secrets WHERE id = ?1")
      .get(1) as { encrypted_value: string; iv: string };
    await expect(
      decryptSecret(row.encrypted_value, row.iv, migrated.masterKey),
    ).resolves.toBe("secret-value");
  });

  it("rejects migration when the legacy passphrase is wrong", async () => {
    const db = new FakeDb();
    db.query("INSERT INTO projects (name) VALUES (?1)").run("demo");

    const legacyKey = await deriveLegacyMasterKey("legacy-passphrase");
    const encrypted = await encryptSecret("secret-value", legacyKey);
    db.query("INSERT INTO secrets (project_id, name, encrypted_value, iv) VALUES (?1, ?2, ?3, ?4)")
      .run(1, "TOKEN", encrypted.encrypted, encrypted.iv);

    await expect(initializeOrUnlockVault(db as never, "wrong-passphrase")).rejects.toThrow(
      "Fatal: passphrase did not match this vault",
    );

    const metadata = db.query("SELECT salt FROM vault_meta WHERE id = 1").get();
    expect(metadata).toBeNull();
  });
});
