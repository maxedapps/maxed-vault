import { createVaultClient } from "../api";
import { requireServerUrl } from "../config";
import { maybeResolveProject } from "../context";
import { CliError } from "../errors";
import type { CliRuntime } from "../runtime";

export async function cmdStatus(runtime: CliRuntime): Promise<void> {
  const serverUrl = requireServerUrl();
  runtime.log(`Server: ${serverUrl}`);

  const client = createVaultClient({ serverUrl, fetchImpl: runtime.fetch });

  try {
    const health = await client.health();
    runtime.log(`Health: ${health.status}`);
  } catch (error) {
    const message = (error as Error).message.replace(/^Request failed: /, "");
    throw new CliError(`Health: unreachable (${message})`);
  }

  const project = maybeResolveProject({ env: runtime.env, cwd: runtime.cwd() });
  if (project) {
    runtime.log(`Project: ${project.project} (${project.source})`);
    return;
  }

  runtime.log("Project: not selected");
}
