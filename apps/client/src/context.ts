import { findWorkspaceConfig, requireServerUrl } from "./config";
import { CliError } from "./errors";
import { assertValidProjectName } from "./validation";

export type ProjectSource = "flag" | "env" | "workspace";

export interface ResolvedProject {
  project: string;
  source: ProjectSource;
}

export interface ResolvedContext extends ResolvedProject {
  serverUrl: string;
}

export interface ProjectResolutionOptions {
  explicitProject?: string;
  env?: NodeJS.ProcessEnv;
  cwd?: string;
}

function projectSelectionError(): CliError {
  return new CliError(
    "No project selected. Run 'maxedvault project use <slug>', set MAXEDVAULT_PROJECT, or pass --project.",
  );
}

export function maybeResolveProject(options: ProjectResolutionOptions = {}): ResolvedProject | null {
  const env = options.env ?? process.env;
  const cwd = options.cwd ?? process.cwd();

  if (typeof options.explicitProject === "string" && options.explicitProject.trim().length > 0) {
    return {
      project: assertValidProjectName(options.explicitProject),
      source: "flag",
    };
  }

  const envProject = env.MAXEDVAULT_PROJECT;
  if (typeof envProject === "string" && envProject.trim().length > 0) {
    return {
      project: assertValidProjectName(envProject),
      source: "env",
    };
  }

  const workspaceConfig = findWorkspaceConfig(cwd);
  if (workspaceConfig) {
    return {
      project: workspaceConfig.config.project,
      source: "workspace",
    };
  }

  return null;
}

export function resolveProject(options: ProjectResolutionOptions = {}): ResolvedProject {
  const resolved = maybeResolveProject(options);
  if (!resolved) {
    throw projectSelectionError();
  }
  return resolved;
}

export function resolveContext(options: ProjectResolutionOptions & { homeDir?: string } = {}): ResolvedContext {
  const serverUrl = requireServerUrl(options.homeDir);
  const resolvedProject = resolveProject(options);

  return {
    serverUrl,
    ...resolvedProject,
  };
}
