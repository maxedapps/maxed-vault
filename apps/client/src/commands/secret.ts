import { createVaultClient } from "../api";
import { resolveContext } from "../context";
import { CliError } from "../errors";
import type { CliRuntime } from "../runtime";
import { assertValidSecretName } from "../validation";

async function readSecretValue(runtime: CliRuntime): Promise<string> {
  if (runtime.isStdinTTY()) {
    const prompted = runtime.promptInput("Enter secret value: ");
    const value = typeof prompted === "string" ? prompted.trimEnd() : "";
    if (!value) {
      throw new CliError("No value provided");
    }
    return value;
  }

  const pipedValue = (await runtime.readStdinText()).trimEnd();
  if (!pipedValue) {
    throw new CliError("No value provided");
  }
  return pipedValue;
}

function createScopedClient(runtime: CliRuntime, explicitProject?: string) {
  const context = resolveContext({
    explicitProject,
    env: runtime.env,
    cwd: runtime.cwd(),
  });

  return {
    client: createVaultClient({ serverUrl: context.serverUrl, fetchImpl: runtime.fetch }),
    context,
  };
}

export async function cmdSecretGet(
  runtime: CliRuntime,
  name: string,
  explicitProject?: string,
): Promise<void> {
  const secretName = assertValidSecretName(name);
  const { client, context } = createScopedClient(runtime, explicitProject);
  const data = await client.getSecret(context.project, secretName);
  runtime.writeStdout(data.value);
}

export async function cmdSecretSet(
  runtime: CliRuntime,
  name: string,
  explicitProject?: string,
): Promise<void> {
  const secretName = assertValidSecretName(name);
  const value = await readSecretValue(runtime);
  const { client, context } = createScopedClient(runtime, explicitProject);
  const data = await client.setSecret(context.project, secretName, value);
  runtime.log(data.created ? `Created ${context.project}/${secretName}` : `Updated ${context.project}/${secretName}`);
}

export async function cmdSecretList(
  runtime: CliRuntime,
  prefix: string | undefined,
  explicitProject?: string,
): Promise<void> {
  const { client, context } = createScopedClient(runtime, explicitProject);
  const data = await client.listSecrets(context.project, prefix ?? "");

  for (const name of data.names) {
    runtime.log(name);
  }
}

export async function cmdSecretRemove(
  runtime: CliRuntime,
  name: string,
  explicitProject?: string,
): Promise<void> {
  const secretName = assertValidSecretName(name);
  const { client, context } = createScopedClient(runtime, explicitProject);
  await client.deleteSecret(context.project, secretName);
  runtime.log(`Deleted ${context.project}/${secretName}`);
}
