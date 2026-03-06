type ProjectRow = { id: number; name: string };
type SecretRow = {
  id: number;
  project_id: number;
  name: string;
  encrypted_value: string;
  iv: string;
  created_at: string;
  updated_at: string;
};
type VaultMetaRow = {
  id: number;
  salt: string;
  check_ciphertext: string;
  check_iv: string;
  created_at: string;
};

function nowIso(): string {
  return new Date().toISOString().replace(/\.\d{3}Z$/, "Z");
}

export class FakeDb {
  private projects: ProjectRow[] = [];
  private secrets: SecretRow[] = [];
  private vaultMeta: VaultMetaRow | null = null;
  private nextProjectId = 1;
  private nextSecretId = 1;

  query(sql: string): {
    get: (...args: unknown[]) => unknown;
    all: (...args: unknown[]) => unknown[];
    run: (...args: unknown[]) => unknown;
  } {
    const normalizedSql = sql.replace(/\s+/g, " ").trim();

    return {
      get: (...args: unknown[]) => this.get(normalizedSql, args),
      all: (...args: unknown[]) => this.all(normalizedSql, args),
      run: (...args: unknown[]) => this.run(normalizedSql, args),
    };
  }

  close(): void {}

  exec(sql: string): void {
    const normalizedSql = sql.replace(/\s+/g, " ").trim();

    if (
      normalizedSql === "BEGIN IMMEDIATE" ||
      normalizedSql === "COMMIT" ||
      normalizedSql === "ROLLBACK"
    ) {
      return;
    }

    throw new Error(`Unsupported exec SQL in FakeDb: ${sql}`);
  }

  private get(sql: string, args: unknown[]): unknown {
    if (sql === "SELECT salt, check_ciphertext, check_iv FROM vault_meta WHERE id = 1") {
      return this.vaultMeta
        ? {
            salt: this.vaultMeta.salt,
            check_ciphertext: this.vaultMeta.check_ciphertext,
            check_iv: this.vaultMeta.check_iv,
          }
        : null;
    }

    if (sql === "SELECT salt FROM vault_meta WHERE id = 1") {
      return this.vaultMeta ? { salt: this.vaultMeta.salt } : null;
    }

    if (sql === "SELECT id FROM projects WHERE name = ?1") {
      const name = String(args[0]);
      const row = this.projects.find((project) => project.name === name);
      return row ? { id: row.id } : null;
    }

    if (sql === "SELECT name FROM projects WHERE name = ?1") {
      const name = String(args[0]);
      const row = this.projects.find((project) => project.name === name);
      return row ? { name: row.name } : null;
    }

    if (
      sql === "SELECT encrypted_value, iv, updated_at FROM secrets WHERE project_id = ?1 AND name = ?2"
    ) {
      const projectId = Number(args[0]);
      const name = String(args[1]);
      const row = this.secrets.find(
        (secret) => secret.project_id === projectId && secret.name === name,
      );
      return row
        ? { encrypted_value: row.encrypted_value, iv: row.iv, updated_at: row.updated_at }
        : null;
    }

    if (sql === "SELECT id FROM secrets WHERE project_id = ?1 AND name = ?2") {
      const projectId = Number(args[0]);
      const name = String(args[1]);
      const row = this.secrets.find(
        (secret) => secret.project_id === projectId && secret.name === name,
      );
      return row ? { id: row.id } : null;
    }

    if (sql === "SELECT encrypted_value, iv FROM secrets WHERE id = ?1") {
      const secretId = Number(args[0]);
      const row = this.secrets.find((secret) => secret.id === secretId);
      return row
        ? { encrypted_value: row.encrypted_value, iv: row.iv }
        : null;
    }

    if (sql === "DELETE FROM secrets WHERE project_id = ?1 AND name = ?2 RETURNING id") {
      const projectId = Number(args[0]);
      const name = String(args[1]);
      const index = this.secrets.findIndex(
        (secret) => secret.project_id === projectId && secret.name === name,
      );
      if (index === -1) return null;
      const [deleted] = this.secrets.splice(index, 1);
      return { id: deleted.id };
    }

    throw new Error(`Unsupported get SQL in FakeDb: ${sql}`);
  }

  private all(sql: string, args: unknown[]): unknown[] {
    if (sql === "SELECT id, encrypted_value, iv FROM secrets ORDER BY id") {
      return this.secrets
        .slice()
        .sort((a, b) => a.id - b.id)
        .map((secret) => ({
          id: secret.id,
          encrypted_value: secret.encrypted_value,
          iv: secret.iv,
        }));
    }

    if (sql === "SELECT name FROM projects ORDER BY name") {
      return this.projects
        .slice()
        .sort((a, b) => a.name.localeCompare(b.name))
        .map((project) => ({ name: project.name }));
    }

    if (sql === "SELECT name FROM secrets WHERE project_id = ?1 AND name LIKE ?2 ORDER BY name") {
      const projectId = Number(args[0]);
      const like = String(args[1]);
      const prefix = like.endsWith("%") ? like.slice(0, -1) : like;

      return this.secrets
        .filter((secret) => secret.project_id === projectId && secret.name.startsWith(prefix))
        .sort((a, b) => a.name.localeCompare(b.name))
        .map((secret) => ({ name: secret.name }));
    }

    if (sql === "SELECT name, encrypted_value, iv FROM secrets WHERE project_id = ?1 ORDER BY name") {
      const projectId = Number(args[0]);
      return this.secrets
        .filter((secret) => secret.project_id === projectId)
        .sort((a, b) => a.name.localeCompare(b.name))
        .map((secret) => ({
          name: secret.name,
          encrypted_value: secret.encrypted_value,
          iv: secret.iv,
        }));
    }

    throw new Error(`Unsupported all SQL in FakeDb: ${sql}`);
  }

  private run(sql: string, args: unknown[]): unknown {
    if (sql === "INSERT INTO vault_meta (id, salt, check_ciphertext, check_iv) VALUES (1, ?1, ?2, ?3)") {
      const timestamp = nowIso();
      this.vaultMeta = {
        id: 1,
        salt: String(args[0]),
        check_ciphertext: String(args[1]),
        check_iv: String(args[2]),
        created_at: timestamp,
      };
      return;
    }

    if (sql === "INSERT INTO projects (name) VALUES (?1)") {
      const name = String(args[0]);
      this.projects.push({ id: this.nextProjectId++, name });
      return;
    }

    if (sql === "INSERT INTO secrets (project_id, name, encrypted_value, iv) VALUES (?1, ?2, ?3, ?4)") {
      const projectId = Number(args[0]);
      const name = String(args[1]);
      const encryptedValue = String(args[2]);
      const iv = String(args[3]);
      const timestamp = nowIso();

      this.secrets.push({
        id: this.nextSecretId++,
        project_id: projectId,
        name,
        encrypted_value: encryptedValue,
        iv,
        created_at: timestamp,
        updated_at: timestamp,
      });
      return;
    }

    if (
      sql ===
      "UPDATE secrets SET encrypted_value = ?1, iv = ?2, updated_at = strftime('%Y-%m-%dT%H:%M:%SZ','now') WHERE project_id = ?3 AND name = ?4"
    ) {
      const encryptedValue = String(args[0]);
      const iv = String(args[1]);
      const projectId = Number(args[2]);
      const name = String(args[3]);
      const row = this.secrets.find(
        (secret) => secret.project_id === projectId && secret.name === name,
      );
      if (!row) return;
      row.encrypted_value = encryptedValue;
      row.iv = iv;
      row.updated_at = nowIso();
      return;
    }

    if (sql === "UPDATE secrets SET encrypted_value = ?1, iv = ?2 WHERE id = ?3") {
      const encryptedValue = String(args[0]);
      const iv = String(args[1]);
      const secretId = Number(args[2]);
      const row = this.secrets.find((secret) => secret.id === secretId);
      if (!row) return;
      row.encrypted_value = encryptedValue;
      row.iv = iv;
      return;
    }

    throw new Error(`Unsupported run SQL in FakeDb: ${sql}`);
  }
}
