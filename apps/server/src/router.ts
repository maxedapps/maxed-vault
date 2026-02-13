import { json } from "./response";
import { handleHealth } from "./handlers/health";
import {
  handleCreateProject,
  handleListProjects,
  isValidProjectName,
} from "./handlers/projects";
import {
  handleListSecrets,
  handleListSecretsEnv,
  handleGetSecret,
  handleSetSecret,
  handleDeleteSecret,
} from "./handlers/secrets";
import type { Context } from "./types";

export async function router(req: Request, ctx: Context): Promise<Response> {
  try {
    const url = new URL(req.url);
    const method = req.method;

    if (method === "GET" && url.pathname === "/health") {
      return handleHealth();
    }

    if (method === "POST" && url.pathname === "/projects") {
      return handleCreateProject(req, ctx);
    }

    if (method === "GET" && url.pathname === "/projects") {
      return handleListProjects(ctx);
    }

    // /projects/:project/... routes
    if (url.pathname.startsWith("/projects/")) {
      const projectPath = url.pathname.slice("/projects/".length);
      const slashIndex = projectPath.indexOf("/");
      const project = decodeURIComponent(
        slashIndex === -1 ? projectPath : projectPath.slice(0, slashIndex),
      );

      if (!project) return json({ error: "Missing project name" }, 400);
      if (!isValidProjectName(project)) {
        return json({ error: "Invalid project name. Use lowercase slug format" }, 400);
      }

      const suffix = slashIndex === -1 ? "" : projectPath.slice(slashIndex + 1);

      if (method === "GET" && suffix === "secrets") {
        return handleListSecrets(project, url, ctx);
      }

      if (method === "GET" && suffix === "secrets-env") {
        return handleListSecretsEnv(project, ctx);
      }

      if (suffix.startsWith("secrets/")) {
        const name = decodeURIComponent(suffix.slice("secrets/".length));
        if (!name) return json({ error: "Missing secret name" }, 400);

        switch (method) {
          case "GET":
            return handleGetSecret(project, name, ctx);
          case "PUT":
            return handleSetSecret(req, project, name, ctx);
          case "DELETE":
            return handleDeleteSecret(project, name, ctx);
        }
      }
    }

    return json({ error: "Not found" }, 404);
  } catch (err) {
    console.error("Unhandled error:", err);
    return json({ error: "Internal server error" }, 500);
  }
}
