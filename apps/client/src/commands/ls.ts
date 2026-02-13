import { vaultFetch } from "../api";

export async function cmdLs(project: string, prefix = ""): Promise<void> {
  const res = await vaultFetch(
    `/projects/${encodeURIComponent(project)}/secrets?prefix=${encodeURIComponent(prefix)}`,
  );
  const data = await res.json();

  if (!res.ok) {
    console.error(data.error ?? "Failed to list secrets");
    process.exit(1);
  }

  for (const name of data.names) {
    console.log(name);
  }
}
