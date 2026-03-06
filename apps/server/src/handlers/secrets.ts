import { json } from "../response";
import { encryptSecret, decryptSecret } from "../crypto";
import type { Context } from "../types";

const SECRET_ENV_NAME_RE = /^[A-Za-z_][A-Za-z0-9_]*$/;

function getProjectId(project: string, ctx: Context): number | null {
  const row = ctx.db.query("SELECT id FROM projects WHERE name = ?1").get(project) as
    | { id: number }
    | null;
  return row?.id ?? null;
}

export function handleListSecrets(project: string, url: URL, ctx: Context): Response {
  const projectId = getProjectId(project, ctx);
  if (!projectId) {
    return json({ error: "Project not found" }, 404);
  }

  const prefix = url.searchParams.get("prefix") ?? "";
  const rows = ctx.db
    .query("SELECT name FROM secrets WHERE project_id = ?1 AND name LIKE ?2 ORDER BY name")
    .all(projectId, `${prefix}%`) as { name: string }[];

  return json({ project, names: rows.map((r) => r.name) });
}

export async function handleGetProjectEnv(project: string, ctx: Context): Promise<Response> {
  const projectId = getProjectId(project, ctx);
  if (!projectId) {
    return json({ error: "Project not found" }, 404);
  }

  const rows = ctx.db
    .query("SELECT name, encrypted_value, iv FROM secrets WHERE project_id = ?1 ORDER BY name")
    .all(projectId) as { name: string; encrypted_value: string; iv: string }[];

  const secrets = await Promise.all(
    rows.map(async (row) => ({
      name: row.name,
      value: await decryptSecret(row.encrypted_value, row.iv, ctx.masterKey),
    })),
  );

  return json({ project, secrets });
}

export async function handleGetSecret(
  project: string,
  name: string,
  ctx: Context,
): Promise<Response> {
  const projectId = getProjectId(project, ctx);
  if (!projectId) {
    return json({ error: "Project not found" }, 404);
  }

  const row = ctx.db
    .query("SELECT encrypted_value, iv, updated_at FROM secrets WHERE project_id = ?1 AND name = ?2")
    .get(projectId, name) as { encrypted_value: string; iv: string; updated_at: string } | null;

  if (!row) {
    return json({ error: "Secret not found" }, 404);
  }

  const value = await decryptSecret(row.encrypted_value, row.iv, ctx.masterKey);
  return json({ project, name, value, updated_at: row.updated_at });
}

export async function handleSetSecret(
  req: Request,
  project: string,
  name: string,
  ctx: Context,
): Promise<Response> {
  if (!SECRET_ENV_NAME_RE.test(name)) {
    return json(
      {
        error:
          "Invalid secret name. Use environment-variable-safe format: letters/underscores, then letters/digits/underscores",
      },
      400,
    );
  }

  const projectId = getProjectId(project, ctx);
  if (!projectId) {
    return json({ error: "Project not found" }, 404);
  }

  const body = await req.json().catch(() => null);
  if (!body || typeof body.value !== "string") {
    return json({ error: "Body must contain a string 'value'" }, 400);
  }

  const { encrypted, iv } = await encryptSecret(body.value, ctx.masterKey);

  const existing = ctx.db
    .query("SELECT id FROM secrets WHERE project_id = ?1 AND name = ?2")
    .get(projectId, name);

  if (existing) {
    ctx.db
      .query(
        "UPDATE secrets SET encrypted_value = ?1, iv = ?2, updated_at = strftime('%Y-%m-%dT%H:%M:%SZ','now') WHERE project_id = ?3 AND name = ?4",
      )
      .run(encrypted, iv, projectId, name);
    return json({ project, name, created: false });
  }

  ctx.db
    .query("INSERT INTO secrets (project_id, name, encrypted_value, iv) VALUES (?1, ?2, ?3, ?4)")
    .run(projectId, name, encrypted, iv);
  return json({ project, name, created: true }, 201);
}

export function handleDeleteSecret(project: string, name: string, ctx: Context): Response {
  const projectId = getProjectId(project, ctx);
  if (!projectId) {
    return json({ error: "Project not found" }, 404);
  }

  const result = ctx.db
    .query("DELETE FROM secrets WHERE project_id = ?1 AND name = ?2 RETURNING id")
    .get(projectId, name);

  if (!result) {
    return json({ error: "Secret not found" }, 404);
  }

  return json({ project, name, deleted: true });
}
