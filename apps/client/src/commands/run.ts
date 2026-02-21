import { vaultFetch } from "../api";
import { findInvalidEnvVarNames } from "../env-vars";

interface Secret {
  name: string;
  value: string;
}

export async function cmdRun(project: string, command: string[]): Promise<void> {
  const res = await vaultFetch(`/projects/${encodeURIComponent(project)}/secrets-env`);
  const data = await res.json();

  if (!res.ok) {
    console.error(data.error ?? "Failed to load project secrets");
    process.exit(1);
    return;
  }

  const secrets = data.secrets as Secret[];
  const invalidNames = findInvalidEnvVarNames(secrets.map((secret) => secret.name));
  if (invalidNames.length > 0) {
    console.error(`Invalid secret names for environment variables: ${invalidNames.join(", ")}`);
    process.exit(1);
    return;
  }

  const secretEnv = Object.fromEntries(secrets.map((secret) => [secret.name, secret.value]));

  let child: Bun.Subprocess<"inherit", "inherit", "inherit">;
  try {
    child = Bun.spawn({
      cmd: command,
      env: { ...process.env, ...secretEnv },
      stdin: "inherit",
      stdout: "inherit",
      stderr: "inherit",
    });
  } catch (err) {
    console.error(`Failed to start command: ${(err as Error).message}`);
    process.exit(1);
    return;
  }

  const exitCode = await child.exited;
  if (exitCode !== 0) {
    process.exit(exitCode);
  }
}
