import { vaultFetch } from "../api";

export async function cmdProjectCreate(name: string): Promise<void> {
  const res = await vaultFetch("/projects", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name }),
  });
  const data = await res.json();

  if (!res.ok) {
    console.error(data.error ?? "Failed to create project");
    process.exit(1);
    return;
  }

  console.log(`Created project ${data.name}`);
}

export async function cmdProjectLs(): Promise<void> {
  const res = await vaultFetch("/projects");
  const data = await res.json();

  if (!res.ok) {
    console.error(data.error ?? "Failed to list projects");
    process.exit(1);
    return;
  }

  for (const project of data.projects) {
    console.log(project);
  }
}
