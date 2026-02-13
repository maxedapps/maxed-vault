import { vaultFetch } from "../api";

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

  for (const secret of data.secrets as { name: string; value: string }[]) {
    process.stdout.write(`export ${secret.name}=${shellEscape(secret.value)}\n`);
  }
}
