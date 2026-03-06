import { createVaultClient } from "../api";
import { resolveContext } from "../context";
import { CliError } from "../errors";
import type { CliRuntime } from "../runtime";
import { findInvalidEnvVarNames } from "../validation";

function shellEscape(value: string): string {
  return `'${value.replace(/'/g, `'\\''`)}'`;
}

export async function cmdEnv(runtime: CliRuntime, explicitProject?: string): Promise<void> {
  const context = resolveContext({
    explicitProject,
    env: runtime.env,
    cwd: runtime.cwd(),
  });
  const client = createVaultClient({ serverUrl: context.serverUrl, fetchImpl: runtime.fetch });
  const data = await client.getEnv(context.project);

  const invalidNames = findInvalidEnvVarNames(data.secrets.map((secret) => secret.name));
  if (invalidNames.length > 0) {
    throw new CliError(`Invalid secret names for environment variables: ${invalidNames.join(", ")}`);
  }

  for (const secret of data.secrets) {
    runtime.writeStdout(`export ${secret.name}=${shellEscape(secret.value)}\n`);
  }
}
