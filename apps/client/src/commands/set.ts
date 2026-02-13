import { vaultFetch } from "../api";

export async function cmdSet(project: string, name: string): Promise<void> {
  let value: string;

  if (Bun.stdin.isTTY()) {
    process.stderr.write("Enter secret value: ");
    const reader = Bun.stdin.stream().getReader();
    const { value: chunk } = await reader.read();
    reader.releaseLock();
    value = chunk ? new TextDecoder().decode(chunk).trimEnd() : "";
  } else {
    value = (await Bun.stdin.text()).trimEnd();
  }

  if (!value) {
    console.error("No value provided");
    process.exit(1);
  }

  const res = await vaultFetch(
    `/projects/${encodeURIComponent(project)}/secrets/${encodeURIComponent(name)}`,
    {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ value }),
    },
  );

  const data = await res.json();

  if (!res.ok) {
    console.error(data.error ?? "Failed to set secret");
    process.exit(1);
  }

  console.error(data.created ? `Created ${project}/${name}` : `Updated ${project}/${name}`);
}
