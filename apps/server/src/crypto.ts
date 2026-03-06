const PBKDF2_ITERATIONS = 600_000;
const LEGACY_STATIC_SALT = new TextEncoder().encode("maxedvault-domain-separation-salt");

function decodeSalt(salt: string): Uint8Array {
  return Buffer.from(salt, "base64");
}

async function deriveKey(passphrase: string, salt: Uint8Array): Promise<CryptoKey> {
  const keyMaterial = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(passphrase),
    "PBKDF2",
    false,
    ["deriveKey"],
  );

  return crypto.subtle.deriveKey(
    { name: "PBKDF2", salt, iterations: PBKDF2_ITERATIONS, hash: "SHA-256" },
    keyMaterial,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"],
  );
}

export function generateSalt(): string {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  return Buffer.from(salt).toString("base64");
}

export async function deriveMasterKey(passphrase: string, salt: string): Promise<CryptoKey> {
  return deriveKey(passphrase, decodeSalt(salt));
}

export async function deriveLegacyMasterKey(passphrase: string): Promise<CryptoKey> {
  return deriveKey(passphrase, LEGACY_STATIC_SALT);
}

export async function encryptSecret(
  plaintext: string,
  key: CryptoKey,
): Promise<{ encrypted: string; iv: string }> {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ciphertext = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    key,
    new TextEncoder().encode(plaintext),
  );

  return {
    encrypted: Buffer.from(ciphertext).toString("base64"),
    iv: Buffer.from(iv).toString("base64"),
  };
}

export async function decryptSecret(
  encrypted: string,
  iv: string,
  key: CryptoKey,
): Promise<string> {
  const plaintext = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv: Buffer.from(iv, "base64") },
    key,
    Buffer.from(encrypted, "base64"),
  );

  return new TextDecoder().decode(plaintext);
}
