import { parseArgs } from "node:util";
import { createDefaultRuntime, type CliRuntime } from "./runtime";
import { saveGlobalConfig } from "./config";
import { cmdProjectClear, cmdProjectCreate, cmdProjectCurrent, cmdProjectList, cmdProjectUse } from "./commands/project";
import { cmdSecretGet, cmdSecretList, cmdSecretRemove, cmdSecretSet } from "./commands/secret";
import { cmdEnv } from "./commands/env";
import { cmdRun } from "./commands/run";
import { cmdStatus } from "./commands/status";
import { clientHelpMessage, type ClientHelpTopic } from "./help";
import { CliError, isCliError } from "./errors";

type ProbeServerUrl = (serverUrl: string) => Promise<boolean>;

const HELP_TOKENS = new Set(["help", "--help", "-h"]);

type ProjectOptionParseResult = {
  project?: string;
  positionals: string[];
};

export interface CliDeps extends CliRuntime {
  argv: string[];
  parseArgs: typeof parseArgs;
  saveGlobalConfig: typeof saveGlobalConfig;
  cmdProjectCreate: typeof cmdProjectCreate;
  cmdProjectList: typeof cmdProjectList;
  cmdProjectUse: typeof cmdProjectUse;
  cmdProjectCurrent: typeof cmdProjectCurrent;
  cmdProjectClear: typeof cmdProjectClear;
  cmdSecretGet: typeof cmdSecretGet;
  cmdSecretSet: typeof cmdSecretSet;
  cmdSecretList: typeof cmdSecretList;
  cmdSecretRemove: typeof cmdSecretRemove;
  cmdEnv: typeof cmdEnv;
  cmdRun: typeof cmdRun;
  cmdStatus: typeof cmdStatus;
  probeServerUrl: ProbeServerUrl;
  error: (...args: unknown[]) => void;
  exit: (code: number) => never;
}

function buildCliDeps(overrides: Partial<CliDeps> = {}): CliDeps {
  const runtime = createDefaultRuntime();
  const argv =
    typeof Bun !== "undefined" && Array.isArray(Bun.argv) ? Bun.argv.slice(2) : process.argv.slice(2);

  return {
    ...runtime,
    argv,
    parseArgs,
    saveGlobalConfig,
    cmdProjectCreate,
    cmdProjectList,
    cmdProjectUse,
    cmdProjectCurrent,
    cmdProjectClear,
    cmdSecretGet,
    cmdSecretSet,
    cmdSecretList,
    cmdSecretRemove,
    cmdEnv,
    cmdRun,
    cmdStatus,
    probeServerUrl: async (serverUrl) => {
      try {
        const response = await runtime.fetch(`${serverUrl}/health`);
        if (!response.ok) {
          return false;
        }
        const data = (await response.json().catch(() => null)) as { status?: string } | null;
        return data?.status === "ok";
      } catch {
        return false;
      }
    },
    error: console.error,
    exit: (code: number): never => process.exit(code),
    ...overrides,
  };
}

function isHelpToken(token: string | undefined): boolean {
  return typeof token === "string" && HELP_TOKENS.has(token);
}

function normalizeServerInput(input: string): string {
  return input.trim().replace(/\/+$/, "");
}

function hasHttpScheme(input: string): boolean {
  return /^https?:\/\//i.test(input);
}

async function resolveInitServerUrl(rawServer: string, deps: CliDeps): Promise<string> {
  const normalizedInput = normalizeServerInput(rawServer);
  if (!normalizedInput) {
    throw new CliError("Server URL is required. Usage: maxedvault init [--server <url>]");
  }

  if (hasHttpScheme(normalizedInput)) {
    return normalizedInput;
  }

  const candidates = [`https://${normalizedInput}`, `http://${normalizedInput}`];
  for (const candidate of candidates) {
    if (await deps.probeServerUrl(candidate)) {
      return candidate;
    }
  }

  throw new CliError(
    `Could not reach server via https://${normalizedInput} or http://${normalizedInput}. Start the server and try again, or pass a full URL with --server.`,
  );
}

async function resolveInitServerArg(serverArg: string | undefined, deps: CliDeps): Promise<string> {
  if (typeof serverArg === "string" && serverArg.trim().length > 0) {
    return resolveInitServerUrl(serverArg, deps);
  }

  const prompted = deps.promptInput("Server URL or host (e.g. localhost:8420): ");
  if (!prompted || prompted.trim().length === 0) {
    throw new CliError("Server URL is required. Usage: maxedvault init [--server <url>]");
  }

  return resolveInitServerUrl(prompted, deps);
}

function parseProjectOptionArgs(args: string[], parseArgsImpl: typeof parseArgs = parseArgs): ProjectOptionParseResult {
  const { values, positionals } = parseArgsImpl({
    args,
    allowPositionals: true,
    options: {
      project: { type: "string" },
    },
  });

  return {
    project: values.project,
    positionals,
  };
}

export function parseRunInput(
  args: string[],
  parseArgsImpl: typeof parseArgs = parseArgs,
): { project?: string; command: string[] } | null {
  const separatorIndex = args.indexOf("--");
  if (separatorIndex === -1) {
    return null;
  }

  const optionArgs = args.slice(0, separatorIndex);
  const commandArgs = args.slice(separatorIndex + 1);
  if (commandArgs.length === 0) {
    return null;
  }

  try {
    const { values, positionals } = parseArgsImpl({
      args: optionArgs,
      allowPositionals: true,
      options: {
        project: { type: "string" },
      },
    });

    if (positionals.length > 0) {
      return null;
    }

    return { project: values.project, command: commandArgs };
  } catch {
    return null;
  }
}

function helpTopicFromArg(arg: string | undefined): ClientHelpTopic {
  switch (arg) {
    case "project":
    case "secret":
    case "env":
    case "run":
      return arg;
    default:
      return "all";
  }
}

function printHelp(topic: ClientHelpTopic, deps: CliDeps): void {
  deps.log(clientHelpMessage(topic));
}

function failUsage(message: string): never {
  throw new CliError(message);
}

async function runInitCommand(args: string[], deps: CliDeps): Promise<void> {
  const { values, positionals } = deps.parseArgs({
    args,
    allowPositionals: true,
    options: {
      server: { type: "string" },
    },
  });

  if (positionals.length > 0) {
    failUsage("Usage: maxedvault init [--server <url>]");
  }

  const serverUrl = await resolveInitServerArg(values.server, deps);
  await deps.saveGlobalConfig(serverUrl);
  deps.log(`Configured server: ${serverUrl}`);
}

async function runProjectCommand(args: string[], deps: CliDeps): Promise<void> {
  const [subcommand, ...rest] = args;

  if (!subcommand || isHelpToken(subcommand)) {
    printHelp("project", deps);
    return;
  }

  switch (subcommand) {
    case "create": {
      if (!rest[0] || rest.length !== 1) {
        failUsage("Usage: maxedvault project create <slug>");
      }
      await deps.cmdProjectCreate(deps, rest[0]);
      return;
    }
    case "list": {
      if (rest.length > 0) {
        failUsage("Usage: maxedvault project list");
      }
      await deps.cmdProjectList(deps);
      return;
    }
    case "use": {
      if (!rest[0] || rest.length !== 1) {
        failUsage("Usage: maxedvault project use <slug>");
      }
      await deps.cmdProjectUse(deps, rest[0]);
      return;
    }
    case "current": {
      if (rest.length > 0) {
        failUsage("Usage: maxedvault project current");
      }
      deps.cmdProjectCurrent(deps);
      return;
    }
    case "clear": {
      if (rest.length > 0) {
        failUsage("Usage: maxedvault project clear");
      }
      deps.cmdProjectClear(deps);
      return;
    }
    default:
      failUsage("Usage: maxedvault project <create|list|use|current|clear>");
  }
}

async function runSecretCommand(args: string[], deps: CliDeps): Promise<void> {
  const parsed = parseProjectOptionArgs(args, deps.parseArgs);
  const [subcommand, ...rest] = parsed.positionals;

  if (!subcommand || isHelpToken(subcommand)) {
    printHelp("secret", deps);
    return;
  }

  switch (subcommand) {
    case "get": {
      if (!rest[0] || rest.length !== 1) {
        failUsage("Usage: maxedvault secret get <name> [--project <slug>]");
      }
      await deps.cmdSecretGet(deps, rest[0], parsed.project);
      return;
    }
    case "set": {
      if (!rest[0] || rest.length !== 1) {
        failUsage("Usage: maxedvault secret set <name> [--project <slug>]");
      }
      await deps.cmdSecretSet(deps, rest[0], parsed.project);
      return;
    }
    case "list": {
      if (rest.length > 1) {
        failUsage("Usage: maxedvault secret list [prefix] [--project <slug>]");
      }
      await deps.cmdSecretList(deps, rest[0], parsed.project);
      return;
    }
    case "remove": {
      if (!rest[0] || rest.length !== 1) {
        failUsage("Usage: maxedvault secret remove <name> [--project <slug>]");
      }
      await deps.cmdSecretRemove(deps, rest[0], parsed.project);
      return;
    }
    default:
      failUsage("Usage: maxedvault secret <get|set|list|remove>");
  }
}

async function runEnvCommand(args: string[], deps: CliDeps): Promise<void> {
  if (args.some((arg) => isHelpToken(arg))) {
    printHelp("env", deps);
    return;
  }

  const parsed = parseProjectOptionArgs(args, deps.parseArgs);
  if (parsed.positionals.length > 0) {
    failUsage("Usage: maxedvault env [--project <slug>]");
  }

  await deps.cmdEnv(deps, parsed.project);
}

async function runRunCommand(args: string[], deps: CliDeps): Promise<void> {
  if (args.length === 1 && isHelpToken(args[0])) {
    printHelp("run", deps);
    return;
  }

  const parsed = parseRunInput(args, deps.parseArgs);
  if (!parsed) {
    failUsage("Usage: maxedvault run [--project <slug>] -- <command> [args...]");
  }

  const exitCode = await deps.cmdRun(deps, parsed.command, parsed.project);
  if (exitCode !== 0) {
    deps.exit(exitCode);
  }
}

export async function runCli(rawArgs: string[], overrides: Partial<CliDeps> = {}): Promise<void> {
  const deps = buildCliDeps({ ...overrides, argv: rawArgs });
  const [command, ...rest] = rawArgs;

  if (!command) {
    printHelp("all", deps);
    return;
  }

  if (command === "help") {
    printHelp(helpTopicFromArg(rest[0]), deps);
    return;
  }

  if (isHelpToken(command)) {
    printHelp("all", deps);
    return;
  }

  switch (command) {
    case "init":
      await runInitCommand(rest, deps);
      return;
    case "status":
      if (rest.some((arg) => isHelpToken(arg))) {
        printHelp("all", deps);
        return;
      }
      if (rest.length > 0) {
        failUsage("Usage: maxedvault status");
      }
      await deps.cmdStatus(deps);
      return;
    case "project":
      await runProjectCommand(rest, deps);
      return;
    case "secret":
      await runSecretCommand(rest, deps);
      return;
    case "env":
      await runEnvCommand(rest, deps);
      return;
    case "run":
      await runRunCommand(rest, deps);
      return;
    default:
      failUsage("Usage: maxedvault <init|status|project|secret|env|run>");
  }
}

export async function runCliEntrypoint(overrides: Partial<CliDeps> = {}): Promise<void> {
  const deps = buildCliDeps(overrides);

  try {
    await runCli(deps.argv, deps);
  } catch (error) {
    if (isCliError(error)) {
      deps.error(error.message);
      deps.exit(error.code);
    }

    deps.error("Unhandled error:", error);
    deps.exit(1);
  }
}

if (import.meta.main) {
  void runCliEntrypoint();
}
