import { chmodSync, existsSync, mkdirSync, readFileSync, rmSync } from "node:fs";
import { writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { homedir } from "node:os";
import { CliError } from "./errors";
import { assertValidProjectName } from "./validation";

const GLOBAL_CONFIG_DIRNAME = ".maxedvault";
const GLOBAL_CONFIG_FILENAME = "config.json";
const WORKSPACE_CONFIG_DIRNAME = ".maxedvault";
const WORKSPACE_CONFIG_FILENAME = "project.json";
const LEGACY_WORKSPACE_CONFIG_FILENAME = "config.json";

export interface GlobalConfig {
  serverUrl: string;
}

export interface WorkspaceConfig {
  project: string;
}

export interface ResolvedWorkspaceConfig {
  rootDir: string;
  path: string;
  config: WorkspaceConfig;
}

function parseJsonFile<T>(path: string): T | null {
  try {
    const text = readFileSync(path, "utf-8");
    return JSON.parse(text) as T;
  } catch {
    return null;
  }
}

function ensureParentDir(path: string): void {
  mkdirSync(dirname(path), { recursive: true, mode: 0o700 });
}

async function writeJsonFile(path: string, value: unknown): Promise<void> {
  ensureParentDir(path);
  await writeFile(path, JSON.stringify(value, null, 2));
  chmodSync(path, 0o600);
}

export function normalizeServerUrl(serverUrl: string): string {
  return serverUrl.trim().replace(/\/+$/, "");
}

export function getGlobalConfigPath(homeDir = homedir()): string {
  return join(homeDir, GLOBAL_CONFIG_DIRNAME, GLOBAL_CONFIG_FILENAME);
}

export function loadGlobalConfig(homeDir = homedir()): GlobalConfig | null {
  const config = parseJsonFile<{ serverUrl?: unknown }>(getGlobalConfigPath(homeDir));
  if (!config || typeof config.serverUrl !== "string" || config.serverUrl.trim().length === 0) {
    return null;
  }

  return { serverUrl: normalizeServerUrl(config.serverUrl) };
}

export async function saveGlobalConfig(serverUrl: string, homeDir = homedir()): Promise<void> {
  await writeJsonFile(getGlobalConfigPath(homeDir), {
    serverUrl: normalizeServerUrl(serverUrl),
  });
}

export function requireServerUrl(homeDir = homedir()): string {
  const config = loadGlobalConfig(homeDir);
  if (!config) {
    throw new CliError("Not configured. Run: maxedvault init");
  }
  return config.serverUrl;
}

export function getWorkspaceConfigPath(rootDir: string): string {
  return join(rootDir, WORKSPACE_CONFIG_DIRNAME, WORKSPACE_CONFIG_FILENAME);
}

function getLegacyWorkspaceConfigPath(rootDir: string): string {
  return join(rootDir, WORKSPACE_CONFIG_DIRNAME, LEGACY_WORKSPACE_CONFIG_FILENAME);
}

function parseWorkspaceConfig(path: string): WorkspaceConfig | null {
  const config = parseJsonFile<{ project?: unknown }>(path);
  if (!config || typeof config.project !== "string" || config.project.trim().length === 0) {
    return null;
  }

  return { project: assertValidProjectName(config.project) };
}

export function findWorkspaceConfig(
  startDir = process.cwd(),
  homeDir = homedir(),
): ResolvedWorkspaceConfig | null {
  let currentDir = resolve(startDir);
  const globalConfigPath = resolve(getGlobalConfigPath(homeDir));

  while (true) {
    const workspaceConfigPath = getWorkspaceConfigPath(currentDir);
    if (existsSync(workspaceConfigPath)) {
      const config = parseWorkspaceConfig(workspaceConfigPath);
      if (!config) {
        throw new CliError(`Invalid workspace config: ${workspaceConfigPath}`);
      }
      return { rootDir: currentDir, path: workspaceConfigPath, config };
    }

    const legacyWorkspaceConfigPath = getLegacyWorkspaceConfigPath(currentDir);
    if (resolve(legacyWorkspaceConfigPath) !== globalConfigPath && existsSync(legacyWorkspaceConfigPath)) {
      const config = parseWorkspaceConfig(legacyWorkspaceConfigPath);
      if (!config) {
        throw new CliError(`Invalid workspace config: ${legacyWorkspaceConfigPath}`);
      }
      return { rootDir: currentDir, path: legacyWorkspaceConfigPath, config };
    }

    const parentDir = dirname(currentDir);
    if (parentDir === currentDir) {
      return null;
    }

    currentDir = parentDir;
  }
}

function hasPackageManifest(dir: string): boolean {
  return existsSync(join(dir, "package.json"));
}

function hasGitRoot(dir: string): boolean {
  return existsSync(join(dir, ".git"));
}

export function resolveWorkspaceRoot(startDir = process.cwd()): string {
  const existingConfig = findWorkspaceConfig(startDir);
  if (existingConfig) {
    return existingConfig.rootDir;
  }

  let currentDir = resolve(startDir);
  while (true) {
    if (hasPackageManifest(currentDir)) {
      return currentDir;
    }

    const parentDir = dirname(currentDir);
    if (parentDir === currentDir) {
      break;
    }

    currentDir = parentDir;
  }

  currentDir = resolve(startDir);
  while (true) {
    if (hasGitRoot(currentDir)) {
      return currentDir;
    }

    const parentDir = dirname(currentDir);
    if (parentDir === currentDir) {
      return resolve(startDir);
    }

    currentDir = parentDir;
  }
}

export async function saveWorkspaceConfig(project: string, startDir = process.cwd()): Promise<string> {
  const rootDir = resolveWorkspaceRoot(startDir);
  const configPath = getWorkspaceConfigPath(rootDir);
  await writeJsonFile(configPath, { project: assertValidProjectName(project) });
  return configPath;
}

export function clearWorkspaceConfig(startDir = process.cwd()): string | null {
  const existingConfig = findWorkspaceConfig(startDir);
  if (!existingConfig) {
    return null;
  }

  rmSync(existingConfig.path, { force: true });
  return existingConfig.path;
}
