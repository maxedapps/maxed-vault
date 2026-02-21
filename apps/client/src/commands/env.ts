import { vaultFetch } from "../api";
import { findInvalidEnvVarNames } from "../env-vars";

function shellEscape(value: string): string {
  return `'${value.replace(/'/g, `'\\''`)}'`;
}

export async function cmdEnv(project: string): Promise<void> {
  const res = await vaultFetch(`/projects/${encodeURIComponent(project)}/secrets-env`);
  const data = await res.json();

  if (!res.ok) {
    console.error(data.error ?? "Failed to load project secrets");
    process.exit(1);
    return;
  }

  const secrets = data.secrets as { name: string; value: string }[];
  const invalidNames = findInvalidEnvVarNames(secrets.map((secret) => secret.name));
  if (invalidNames.length > 0) {
    console.error(`Invalid secret names for environment variables: ${invalidNames.join(", ")}`);
    process.exit(1);
    return;
  }

  for (const secret of secrets) {
    process.stdout.write(`export ${secret.name}=${shellEscape(secret.value)}\n`);
  }
}
