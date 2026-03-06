import { createVaultClient } from "../api";
import { resolveContext } from "../context";
import { CliError } from "../errors";
import { runProcess } from "../process-runner";
import type { CliRuntime } from "../runtime";
import { findInvalidEnvVarNames } from "../validation";

export async function cmdRun(
  runtime: CliRuntime,
  command: string[],
  explicitProject?: string,
): Promise<number> {
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

  const secretEnv = Object.fromEntries(data.secrets.map((secret) => [secret.name, secret.value]));
  return runProcess(runtime, command, { ...runtime.env, ...secretEnv });
}
