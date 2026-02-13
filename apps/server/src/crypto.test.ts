import { describe, expect, it } from "vitest";
import { decryptSecret, deriveMasterKey, encryptSecret } from "./crypto";

describe("crypto", () => {
  it("encrypts and decrypts round-trip", async () => {
    const key = await deriveMasterKey("test-passphrase");
    const plaintext = "secret-value";

    const encrypted = await encryptSecret(plaintext, key);
    const decrypted = await decryptSecret(encrypted.encrypted, encrypted.iv, key);

    expect(decrypted).toBe(plaintext);
    expect(encrypted.iv).not.toBe("");
    expect(encrypted.encrypted).not.toBe("");
  });

  it("fails to decrypt with a different key", async () => {
    const keyA = await deriveMasterKey("passphrase-a");
    const keyB = await deriveMasterKey("passphrase-b");
    const encrypted = await encryptSecret("top-secret", keyA);

    await expect(decryptSecret(encrypted.encrypted, encrypted.iv, keyB)).rejects.toThrow();
  });
});