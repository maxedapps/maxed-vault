import { vaultFetch } from "../api";

export async function cmdGet(project: string, name: string): Promise<void> {
  const res = await vaultFetch(
    `/projects/${encodeURIComponent(project)}/secrets/${encodeURIComponent(name)}`,
  );
  const data = await res.json();

  if (!res.ok) {
    console.error(data.error ?? "Failed to get secret");
    process.exit(1);
  }

  // Raw value to stdout — pipe-friendly
  process.stdout.write(data.value);
}
