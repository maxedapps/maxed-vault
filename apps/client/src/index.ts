import { parseArgs } from "util";
import { saveConfig } from "./config";
import { cmdGet } from "./commands/get";
import { cmdSet } from "./commands/set";
import { cmdLs } from "./commands/ls";
import { cmdRm } from "./commands/rm";
import { cmdStatus } from "./commands/status";
import { cmdProjectCreate, cmdProjectLs } from "./commands/project.ts";
import { cmdEnv } from "./commands/env.ts";
import { cmdRun } from "./commands/run.ts";

type PromptInput = (message: string) => string | null;
type ProbeServerUrl = (serverUrl: string) => Promise<boolean>;

export interface CliDeps {
  argv: string[];
  parseArgs: typeof parseArgs;
  saveConfig: typeof saveConfig;
  cmdGet: typeof cmdGet;
  cmdSet: typeof cmdSet;
  cmdLs: typeof cmdLs;
  cmdRm: typeof cmdRm;
  cmdStatus: typeof cmdStatus;
  cmdProjectCreate: typeof cmdProjectCreate;
  cmdProjectLs: typeof cmdProjectLs;
  cmdEnv: typeof cmdEnv;
  cmdRun: typeof cmdRun;
  promptInput: PromptInput;
  probeServerUrl: ProbeServerUrl;
  log: (...args: unknown[]) => void;
  error: (...args: unknown[]) => void;
  exit: (code: number) => never;
}

function buildCliDeps(overrides: Partial<CliDeps> = {}): CliDeps {
  const argv =
    typeof Bun !== "undefined" && Array.isArray(Bun.argv) ? Bun.argv.slice(2) : process.argv.slice(2);

  return {
    argv,
    parseArgs,
    saveConfig,
    cmdGet,
    cmdSet,
    cmdLs,
    cmdRm,
    cmdStatus,
    cmdProjectCreate,
    cmdProjectLs,
    cmdEnv,
    cmdRun,
    promptInput: (message) => {
      const runtimePrompt = (globalThis as { prompt?: (msg: string) => string | null }).prompt;
      return runtimePrompt ? runtimePrompt(message) : null;
    },
    probeServerUrl: async (serverUrl) => {
      try {
        const res = await fetch(`${serverUrl}/health`);
        if (!res.ok) return false;
        const data = (await res.json().catch(() => null)) as { status?: string } | null;
        return data?.status === "ok";
      } catch {
        return false;
      }
    },
    log: console.log,
    error: console.error,
    exit: (code: number): never => process.exit(code),
    ...overrides,
  };
}

function fail(message: string, deps: CliDeps): never {
  deps.error(message);
  return deps.exit(1);
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
    fail("Server URL is required. Usage: maxedvault init [--server <url>]", deps);
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

  fail(
    `Could not reach server via https://${normalizedInput} or http://${normalizedInput}. ` +
      "Start the server and try again, or pass a full URL with --server.",
    deps,
  );
}

async function resolveInitServerArg(serverArg: string | undefined, deps: CliDeps): Promise<string> {
  if (typeof serverArg === "string" && serverArg.trim().length > 0) {
    return resolveInitServerUrl(serverArg, deps);
  }

  const prompted = deps.promptInput("Server URL or host (e.g. localhost:8420): ");
  if (!prompted || prompted.trim().length === 0) {
    fail(
      "Server URL is required. Usage: maxedvault init [--server <url>]",
      deps,
    );
  }

  return resolveInitServerUrl(prompted, deps);
}

export function parseRunInput(
  args: string[],
  parseArgsImpl: typeof parseArgs = parseArgs,
): { project: string; command: string[] } | null {
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

    if (!values.project || positionals.length > 0) {
      return null;
    }

    return { project: values.project, command: commandArgs };
  } catch {
    return null;
  }
}

export async function runCli(rawArgs: string[], overrides: Partial<CliDeps> = {}): Promise<void> {
  const deps = buildCliDeps({ ...overrides, argv: rawArgs });
  const [rawCommand, ...rawRest] = rawArgs;

  if (rawCommand === "run") {
    const parsed = parseRunInput(rawRest, deps.parseArgs);
    if (!parsed) {
      fail("Usage: maxedvault run --project <slug> -- <command> [args...]", deps);
    }

    await deps.cmdRun(parsed.project, parsed.command);
    return;
  }

  const { positionals, values } = deps.parseArgs({
    args: rawArgs,
    allowPositionals: true,
    options: {
      server: { type: "string" },
      project: { type: "string" },
    },
  });

  const [command, ...rest] = positionals;

  switch (command) {
    case "init": {
      const server = await resolveInitServerArg(values.server, deps);
      await deps.saveConfig(server);
      deps.log(`Configured server: ${server}`);
      break;
    }
    case "get": {
      if (!rest[0] || !values.project) {
        fail("Usage: maxedvault get <name> --project <slug>", deps);
      }
      await deps.cmdGet(values.project, rest[0]);
      break;
    }
    case "set": {
      if (!rest[0] || !values.project) {
        fail("Usage: maxedvault set <name> --project <slug>", deps);
      }
      await deps.cmdSet(values.project, rest[0]);
      break;
    }
    case "ls": {
      if (!values.project) {
        fail("Usage: maxedvault ls [prefix] --project <slug>", deps);
      }
      await deps.cmdLs(values.project, rest[0]);
      break;
    }
    case "rm": {
      if (!rest[0] || !values.project) {
        fail("Usage: maxedvault rm <name> --project <slug>", deps);
      }
      await deps.cmdRm(values.project, rest[0]);
      break;
    }
    case "status": {
      await deps.cmdStatus();
      break;
    }
    case "project": {
      switch (rest[0]) {
        case "create": {
          if (!rest[1]) {
            fail("Usage: maxedvault project create <slug>", deps);
          }
          await deps.cmdProjectCreate(rest[1]);
          break;
        }
        case "ls": {
          await deps.cmdProjectLs();
          break;
        }
        default: {
          fail("Usage: maxedvault project <create|ls>", deps);
        }
      }
      break;
    }
    case "env": {
      if (!values.project) {
        fail("Usage: maxedvault env --project <slug>", deps);
      }
      await deps.cmdEnv(values.project);
      break;
    }
    default: {
      fail("Usage: maxedvault <init|get|set|ls|rm|status|project|env|run>", deps);
    }
  }
}

export async function runCliEntrypoint(overrides: Partial<CliDeps> = {}): Promise<void> {
  const deps = buildCliDeps(overrides);
  try {
    await runCli(deps.argv, deps);
  } catch (err) {
    deps.error("Unhandled error:", err);
    deps.exit(1);
  }
}

if (import.meta.main) {
  void runCliEntrypoint();
}
