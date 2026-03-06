import type { Database } from "bun:sqlite";
import {
  decryptSecret,
  deriveLegacyMasterKey,
  deriveMasterKey,
  encryptSecret,
  generateSalt,
} from "./crypto";

const VAULT_CHECK_VALUE = "maxedvault:v1";

interface VaultMetaRow {
  salt: string;
  check_ciphertext: string;
  check_iv: string;
}

interface SecretRow {
  id: number;
  encrypted_value: string;
  iv: string;
}

export interface OpenVaultResult {
  masterKey: CryptoKey;
  mode: "created" | "opened" | "migrated";
}

function getVaultMetadata(db: Database): VaultMetaRow | null {
  return db
    .query("SELECT salt, check_ciphertext, check_iv FROM vault_meta WHERE id = 1")
    .get() as VaultMetaRow | null;
}

function listEncryptedSecrets(db: Database): SecretRow[] {
  return db
    .query("SELECT id, encrypted_value, iv FROM secrets ORDER BY id")
    .all() as SecretRow[];
}

async function createVaultMetadata(passphrase: string): Promise<{
  salt: string;
  checkCiphertext: string;
  checkIv: string;
  masterKey: CryptoKey;
}> {
  const salt = generateSalt();
  const masterKey = await deriveMasterKey(passphrase, salt);
  const verifier = await encryptSecret(VAULT_CHECK_VALUE, masterKey);

  return {
    salt,
    checkCiphertext: verifier.encrypted,
    checkIv: verifier.iv,
    masterKey,
  };
}

function insertVaultMetadata(
  db: Database,
  salt: string,
  checkCiphertext: string,
  checkIv: string,
): void {
  db.query(
    "INSERT INTO vault_meta (id, salt, check_ciphertext, check_iv) VALUES (1, ?1, ?2, ?3)",
  ).run(salt, checkCiphertext, checkIv);
}

async function assertPassphraseMatchesMetadata(
  passphrase: string,
  metadata: VaultMetaRow,
): Promise<CryptoKey> {
  try {
    const masterKey = await deriveMasterKey(passphrase, metadata.salt);
    const decrypted = await decryptSecret(
      metadata.check_ciphertext,
      metadata.check_iv,
      masterKey,
    );

    if (decrypted !== VAULT_CHECK_VALUE) {
      throw new Error("Fatal: passphrase did not match this vault");
    }

    return masterKey;
  } catch {
    throw new Error("Fatal: passphrase did not match this vault");
  }
}

async function migrateLegacyVault(db: Database, passphrase: string): Promise<OpenVaultResult> {
  const legacyKey = await deriveLegacyMasterKey(passphrase);
  const legacySecrets = listEncryptedSecrets(db);

  try {
    for (const row of legacySecrets) {
      await decryptSecret(row.encrypted_value, row.iv, legacyKey);
    }
  } catch {
    throw new Error("Fatal: passphrase did not match this vault");
  }

  const nextMetadata = await createVaultMetadata(passphrase);
  const migratedSecrets = await Promise.all(
    legacySecrets.map(async (row) => {
      const plaintext = await decryptSecret(row.encrypted_value, row.iv, legacyKey);
      const encrypted = await encryptSecret(plaintext, nextMetadata.masterKey);

      return {
        id: row.id,
        encryptedValue: encrypted.encrypted,
        iv: encrypted.iv,
      };
    }),
  );

  db.exec("BEGIN IMMEDIATE");
  try {
    insertVaultMetadata(
      db,
      nextMetadata.salt,
      nextMetadata.checkCiphertext,
      nextMetadata.checkIv,
    );

    const updateSecret = db.query(
      "UPDATE secrets SET encrypted_value = ?1, iv = ?2 WHERE id = ?3",
    );

    for (const row of migratedSecrets) {
      updateSecret.run(row.encryptedValue, row.iv, row.id);
    }

    db.exec("COMMIT");
  } catch (err) {
    db.exec("ROLLBACK");
    throw err;
  }

  return {
    masterKey: nextMetadata.masterKey,
    mode: "migrated",
  };
}

export async function initializeOrUnlockVault(
  db: Database,
  passphrase: string,
): Promise<OpenVaultResult> {
  const metadata = getVaultMetadata(db);
  if (metadata) {
    const masterKey = await assertPassphraseMatchesMetadata(passphrase, metadata);
    return { masterKey, mode: "opened" };
  }

  const legacySecrets = listEncryptedSecrets(db);
  if (legacySecrets.length > 0) {
    return migrateLegacyVault(db, passphrase);
  }

  const metadataForNewVault = await createVaultMetadata(passphrase);
  insertVaultMetadata(
    db,
    metadataForNewVault.salt,
    metadataForNewVault.checkCiphertext,
    metadataForNewVault.checkIv,
  );

  return {
    masterKey: metadataForNewVault.masterKey,
    mode: "created",
  };
}
