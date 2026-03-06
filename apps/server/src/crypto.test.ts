import { describe, expect, it } from "vitest";
import {
  decryptSecret,
  deriveLegacyMasterKey,
  deriveMasterKey,
  encryptSecret,
  generateSalt,
} from "./crypto";

describe("crypto", () => {
  it("encrypts and decrypts round-trip", async () => {
    const key = await deriveMasterKey("test-passphrase", generateSalt());
    const plaintext = "secret-value";

    const encrypted = await encryptSecret(plaintext, key);
    const decrypted = await decryptSecret(encrypted.encrypted, encrypted.iv, key);

    expect(decrypted).toBe(plaintext);
    expect(encrypted.iv).not.toBe("");
    expect(encrypted.encrypted).not.toBe("");
  });

  it("fails to decrypt with a different key", async () => {
    const keyA = await deriveMasterKey("passphrase-a", generateSalt());
    const keyB = await deriveMasterKey("passphrase-b", generateSalt());
    const encrypted = await encryptSecret("top-secret", keyA);

    await expect(decryptSecret(encrypted.encrypted, encrypted.iv, keyB)).rejects.toThrow();
  });

  it("fails to decrypt with the same passphrase when salts differ", async () => {
    const keyA = await deriveMasterKey("same-passphrase", generateSalt());
    const keyB = await deriveMasterKey("same-passphrase", generateSalt());
    const encrypted = await encryptSecret("salted-secret", keyA);

    await expect(decryptSecret(encrypted.encrypted, encrypted.iv, keyB)).rejects.toThrow();
  });

  it("preserves legacy derivation for migration", async () => {
    const legacyA = await deriveLegacyMasterKey("legacy-passphrase");
    const legacyB = await deriveLegacyMasterKey("legacy-passphrase");
    const encrypted = await encryptSecret("legacy-secret", legacyA);

    await expect(decryptSecret(encrypted.encrypted, encrypted.iv, legacyB)).resolves.toBe(
      "legacy-secret",
    );
  });
});
