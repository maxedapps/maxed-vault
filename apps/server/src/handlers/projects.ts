import { json } from "../response";
import type { Context } from "../types";

const PROJECT_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export function isValidProjectName(name: string): boolean {
  return PROJECT_RE.test(name);
}

export async function handleCreateProject(req: Request, ctx: Context): Promise<Response> {
  const body = await req.json().catch(() => null);
  if (!body || typeof body.name !== "string") {
    return json({ error: "Body must contain a string 'name'" }, 400);
  }

  const name = body.name.trim();
  if (!isValidProjectName(name)) {
    return json({ error: "Invalid project name. Use lowercase slug format" }, 400);
  }

  const existing = ctx.db.query("SELECT id FROM projects WHERE name = ?1").get(name);
  if (existing) {
    return json({ error: "Project already exists" }, 409);
  }

  ctx.db.query("INSERT INTO projects (name) VALUES (?1)").run(name);
  return json({ name, created: true }, 201);
}

export function handleGetProject(name: string, ctx: Context): Response {
  const row = ctx.db.query("SELECT name FROM projects WHERE name = ?1").get(name) as
    | { name: string }
    | null;

  if (!row) {
    return json({ error: "Project not found" }, 404);
  }

  return json({ name: row.name });
}

export function handleListProjects(ctx: Context): Response {
  const rows = ctx.db.query("SELECT name FROM projects ORDER BY name").all() as { name: string }[];
  return json({ projects: rows.map((row) => row.name) });
}
