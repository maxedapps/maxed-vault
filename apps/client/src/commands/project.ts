import { createVaultClient } from "../api";
import { clearWorkspaceConfig, requireServerUrl, saveWorkspaceConfig } from "../config";
import { maybeResolveProject } from "../context";
import { CliError } from "../errors";
import type { CliRuntime } from "../runtime";
import { assertValidProjectName } from "../validation";

export async function cmdProjectCreate(runtime: CliRuntime, name: string): Promise<void> {
  const project = assertValidProjectName(name);
  const client = createVaultClient({ serverUrl: requireServerUrl(), fetchImpl: runtime.fetch });
  const data = await client.createProject(project);
  runtime.log(`Created project ${data.name}`);
}

export async function cmdProjectList(runtime: CliRuntime): Promise<void> {
  const client = createVaultClient({ serverUrl: requireServerUrl(), fetchImpl: runtime.fetch });
  const data = await client.listProjects();

  for (const project of data.projects) {
    runtime.log(project);
  }
}

export async function cmdProjectUse(runtime: CliRuntime, name: string): Promise<void> {
  const project = assertValidProjectName(name);
  const serverUrl = requireServerUrl();
  const client = createVaultClient({ serverUrl, fetchImpl: runtime.fetch });

  await client.getProject(project);
  const configPath = await saveWorkspaceConfig(project, runtime.cwd());
  runtime.log(`Bound project ${project} in ${configPath}`);
}

export function cmdProjectCurrent(runtime: CliRuntime): void {
  const resolved = maybeResolveProject({ env: runtime.env, cwd: runtime.cwd() });
  if (!resolved) {
    throw new CliError(
      "No project selected. Run 'maxedvault project use <slug>' or set MAXEDVAULT_PROJECT.",
    );
  }

  runtime.log(resolved.project);
}

export function cmdProjectClear(runtime: CliRuntime): void {
  const clearedPath = clearWorkspaceConfig(runtime.cwd());
  if (clearedPath) {
    runtime.log(`Cleared workspace project binding at ${clearedPath}`);
    return;
  }

  runtime.log("No workspace project binding found");
}
