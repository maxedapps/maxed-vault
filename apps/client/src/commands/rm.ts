import { vaultFetch } from "../api";

export async function cmdRm(project: string, name: string): Promise<void> {
  const res = await vaultFetch(
    `/projects/${encodeURIComponent(project)}/secrets/${encodeURIComponent(name)}`,
    { method: "DELETE" },
  );
  const data = await res.json();

  if (!res.ok) {
    console.error(data.error ?? "Failed to delete secret");
    process.exit(1);
  }

  console.log(`Deleted ${project}/${name}`);
}
