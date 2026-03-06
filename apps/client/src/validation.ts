import { CliError } from "./errors";

const PROJECT_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const SECRET_NAME_RE = /^[A-Za-z_][A-Za-z0-9_]*$/;

export function isValidProjectName(name: string): boolean {
  return PROJECT_RE.test(name);
}

export function isValidSecretName(name: string): boolean {
  return SECRET_NAME_RE.test(name);
}

export function assertValidProjectName(name: string): string {
  const normalized = name.trim();
  if (!isValidProjectName(normalized)) {
    throw new CliError("Invalid project name. Use lowercase slug format");
  }
  return normalized;
}

export function assertValidSecretName(name: string): string {
  const normalized = name.trim();
  if (!isValidSecretName(normalized)) {
    throw new CliError(
      "Invalid secret name. Use environment-variable-safe format: letters/underscores, then letters/digits/underscores",
    );
  }
  return normalized;
}

export function findInvalidEnvVarNames(names: string[]): string[] {
  return [...new Set(names.filter((name) => !isValidSecretName(name)))].sort((a, b) =>
    a.localeCompare(b),
  );
}
