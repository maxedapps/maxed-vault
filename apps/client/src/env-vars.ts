const ENV_VAR_NAME_RE = /^[A-Za-z_][A-Za-z0-9_]*$/;

export function isEnvVarSafeName(name: string): boolean {
  return ENV_VAR_NAME_RE.test(name);
}

export function findInvalidEnvVarNames(names: string[]): string[] {
  return [...new Set(names.filter((name) => !isEnvVarSafeName(name)))].sort((a, b) =>
    a.localeCompare(b),
  );
}
