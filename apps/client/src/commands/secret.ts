import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { createVaultClient } from "../api";
import { resolveContext } from "../context";
import { CliError } from "../errors";
import type { CliRuntime } from "../runtime";
import { assertValidSecretName } from "../validation";

interface ImportedSecret {
  name: string;
  value: string;
}

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

function ensureValidTrailingValueSyntax(
  trailing: string,
  sourcePath: string,
  lineNumber: number,
): void {
  const normalized = trailing.trim();
  if (!normalized || normalized.startsWith("#")) {
    return;
  }

  throw new CliError(`Invalid .env syntax at ${sourcePath}:${lineNumber}`);
}

function parseSingleQuotedValue(
  rawValue: string,
  sourcePath: string,
  lineNumber: number,
): { value: string; trailing: string } {
  const closingQuoteIndex = rawValue.indexOf("'", 1);
  if (closingQuoteIndex === -1) {
    throw new CliError(`Invalid quoted value at ${sourcePath}:${lineNumber}`);
  }

  return {
    value: rawValue.slice(1, closingQuoteIndex),
    trailing: rawValue.slice(closingQuoteIndex + 1),
  };
}

function parseDoubleQuotedValue(
  rawValue: string,
  sourcePath: string,
  lineNumber: number,
): { value: string; trailing: string } {
  let value = "";
  let escaping = false;

  for (let i = 1; i < rawValue.length; i += 1) {
    const char = rawValue[i];

    if (escaping) {
      switch (char) {
        case "n":
          value += "\n";
          break;
        case "r":
          value += "\r";
          break;
        case "t":
          value += "\t";
          break;
        case "\\":
          value += "\\";
          break;
        case '"':
          value += '"';
          break;
        default:
          value += char;
          break;
      }
      escaping = false;
      continue;
    }

    if (char === "\\") {
      escaping = true;
      continue;
    }

    if (char === '"') {
      return {
        value,
        trailing: rawValue.slice(i + 1),
      };
    }

    value += char;
  }

  throw new CliError(`Invalid quoted value at ${sourcePath}:${lineNumber}`);
}

function parseUnquotedValue(rawValue: string): string {
  if (rawValue.length === 0 || rawValue.startsWith("#")) {
    return "";
  }

  const commentIndex = rawValue.search(/\s+#/);
  const withoutComment = commentIndex === -1 ? rawValue : rawValue.slice(0, commentIndex);
  return withoutComment.trimEnd();
}

function parseDotEnvSecrets(text: string, sourcePath: string): ImportedSecret[] {
  const deduped = new Map<string, string>();
  const lines = text.split(/\r?\n/);

  for (const [index, rawLine] of lines.entries()) {
    const lineNumber = index + 1;
    const trimmedStart = rawLine.trimStart();

    if (!trimmedStart || trimmedStart.startsWith("#")) {
      continue;
    }

    const assignmentMatch = trimmedStart.match(/^(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/);
    if (!assignmentMatch) {
      throw new CliError(`Invalid .env syntax at ${sourcePath}:${lineNumber}`);
    }

    const [, rawName, rawValue] = assignmentMatch;
    const name = assertValidSecretName(rawName);

    if (rawValue.startsWith("'")) {
      const parsed = parseSingleQuotedValue(rawValue, sourcePath, lineNumber);
      ensureValidTrailingValueSyntax(parsed.trailing, sourcePath, lineNumber);
      deduped.set(name, parsed.value);
      continue;
    }

    if (rawValue.startsWith('"')) {
      const parsed = parseDoubleQuotedValue(rawValue, sourcePath, lineNumber);
      ensureValidTrailingValueSyntax(parsed.trailing, sourcePath, lineNumber);
      deduped.set(name, parsed.value);
      continue;
    }

    deduped.set(name, parseUnquotedValue(rawValue));
  }

  return [...deduped.entries()].map(([name, value]) => ({ name, value }));
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

export async function cmdSecretImport(
  runtime: CliRuntime,
  envFilePath: string,
  explicitProject?: string,
): Promise<void> {
  const normalizedPath = envFilePath.trim();
  if (!normalizedPath) {
    throw new CliError("Env file path is required");
  }

  const resolvedPath = resolve(runtime.cwd(), normalizedPath);

  let text: string;
  try {
    text = readFileSync(resolvedPath, "utf-8");
  } catch (error) {
    throw new CliError(`Failed to read env file '${resolvedPath}': ${(error as Error).message}`);
  }

  const parsedSecrets = parseDotEnvSecrets(text, resolvedPath);
  if (parsedSecrets.length === 0) {
    runtime.log(`No secrets found in ${resolvedPath}`);
    return;
  }

  const { client, context } = createScopedClient(runtime, explicitProject);

  let createdCount = 0;
  let updatedCount = 0;

  for (const secret of parsedSecrets) {
    const result = await client.setSecret(context.project, secret.name, secret.value);
    if (result.created) {
      createdCount += 1;
      continue;
    }

    updatedCount += 1;
  }

  runtime.log(
    `Imported ${parsedSecrets.length} secrets into ${context.project} from ${resolvedPath} (${createdCount} created, ${updatedCount} updated)`,
  );
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
