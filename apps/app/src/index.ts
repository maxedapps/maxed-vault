import { runCliEntrypoint } from "../../client/src/index.ts";
import { CLIENT_COMMAND_SUMMARY_LINES } from "../../client/src/help.ts";
import { runServerEntrypoint } from "../../server/src/index.ts";

const HELP_TOKENS = new Set(["help", "--help", "-h"]);
const SERVER_START_ALIASES = new Set(["start", "run"]);

type HelpTopic = "all" | "server";

export interface AppDeps {
  argv: string[];
  runClient: (argv: string[]) => Promise<void>;
  runServer: (argv: string[]) => Promise<void>;
  log: (...args: unknown[]) => void;
  error: (...args: unknown[]) => void;
  exit: (code: number) => never;
}

function buildAppDeps(overrides: Partial<AppDeps> = {}): AppDeps {
  const argv =
    typeof Bun !== "undefined" && Array.isArray(Bun.argv) ? Bun.argv.slice(2) : process.argv.slice(2);

  return {
    argv,
    runClient: (clientArgv) => runCliEntrypoint({ argv: clientArgv }),
    runServer: (serverArgv) => runServerEntrypoint({ argv: serverArgv }),
    log: console.log,
    error: console.error,
    exit: (code: number): never => process.exit(code),
    ...overrides,
  };
}

function isHelpToken(token: string | undefined): boolean {
  return typeof token === "string" && HELP_TOKENS.has(token);
}

function fullHelpMessage(): string {
  return [
    "MaxedVault — unified server + client CLI",
    "",
    "Usage:",
    "  maxedvault help [server|project|secret|env|run]",
    "  maxedvault --help",
    "  maxedvault -h",
    "",
    "Server commands:",
    "  maxedvault server [start|run] [--passphrase <value>|--passphrase=<value>|--passphrase-file <path>|--passphrase-file=<path>]",
    "",
    "Client commands:",
    ...CLIENT_COMMAND_SUMMARY_LINES,
  ].join("\n");
}

function serverHelpMessage(): string {
  return [
    "MaxedVault server help",
    "",
    "Usage:",
    "  maxedvault server [start|run] [--passphrase <value>|--passphrase=<value>|--passphrase-file <path>|--passphrase-file=<path>]",
    "",
    "Options:",
    "  --passphrase <value>",
    "  --passphrase=<value>",
    "  --passphrase-file <path>",
    "  --passphrase-file=<path>",
    "",
    "Environment variables:",
    "  VAULT_PASSPHRASE",
    "  VAULT_PASSPHRASE_FILE",
    "",
    "Notes:",
    "  - 'server' without a subcommand starts the server.",
    "  - 'run' is an alias for 'start' under the 'server' command.",
    "  - If no passphrase source is provided, an interactive prompt is shown.",
  ].join("\n");
}

function helpMessage(topic: HelpTopic): string {
  return topic === "server" ? serverHelpMessage() : fullHelpMessage();
}

function printHelp(topic: HelpTopic, deps: AppDeps): void {
  deps.log(helpMessage(topic));
}

function usageMessage(): string {
  return [
    "Usage:",
    "  maxedvault help [server|project|secret|env|run]",
    "  maxedvault server [start|run] [--passphrase <value>|--passphrase=<value>|--passphrase-file <path>|--passphrase-file=<path>]",
    "  maxedvault <init|status|project|secret|env|run> ...",
    "",
    "Run 'maxedvault help' for the full command reference.",
  ].join("\n");
}

function failUsage(deps: AppDeps): never {
  deps.error(usageMessage());
  return deps.exit(1);
}

export async function runApp(rawArgs: string[], overrides: Partial<AppDeps> = {}): Promise<void> {
  const deps = buildAppDeps({ ...overrides, argv: rawArgs });

  if (rawArgs.length === 0) {
    printHelp("all", deps);
    return;
  }

  const [command, ...rest] = rawArgs;

  if (isHelpToken(command)) {
    const topic = rest[0] === "server" ? "server" : "all";
    printHelp(topic, deps);
    return;
  }

  if (command === "server") {
    if (rest.length === 0) {
      await deps.runServer([]);
      return;
    }

    const [serverSubcommand] = rest;

    if (isHelpToken(serverSubcommand)) {
      printHelp("server", deps);
      return;
    }

    if (SERVER_START_ALIASES.has(serverSubcommand)) {
      const [, ...serverArgs] = rest;

      if (isHelpToken(serverArgs[0])) {
        printHelp("server", deps);
        return;
      }

      await deps.runServer(serverArgs);
      return;
    }

    if (serverSubcommand.startsWith("-")) {
      await deps.runServer(rest);
      return;
    }

    failUsage(deps);
  }

  await deps.runClient(rawArgs);
}

export async function runAppEntrypoint(overrides: Partial<AppDeps> = {}): Promise<void> {
  const deps = buildAppDeps(overrides);

  try {
    await runApp(deps.argv, deps);
  } catch (err) {
    deps.error("Unhandled error:", err);
    deps.exit(1);
  }
}

if (import.meta.main) {
  void runAppEntrypoint();
}
