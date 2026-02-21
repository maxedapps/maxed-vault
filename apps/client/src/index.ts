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
const rawArgs = Bun.argv.slice(2);

function parseRunInput(args: string[]): { project: string; command: string[] } | null {
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
    const { values, positionals } = parseArgs({
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

async function main(): Promise<void> {
  const [rawCommand, ...rawRest] = rawArgs;

  if (rawCommand === "run") {
    const parsed = parseRunInput(rawRest);
    if (!parsed) {
      console.error("Usage: maxedvault run --project <slug> -- <command> [args...]");
      process.exit(1);
    }

    await cmdRun(parsed.project, parsed.command);
    return;
  }

  const { positionals, values } = parseArgs({
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
      if (!values.server) {
        console.error("Usage: maxedvault init --server <url>");
        process.exit(1);
      }
      await saveConfig(values.server);
      console.error(`Configured server: ${values.server}`);
      break;
    }
    case "get": {
      if (!rest[0] || !values.project) {
        console.error("Usage: maxedvault get <name> --project <slug>");
        process.exit(1);
      }
      await cmdGet(values.project, rest[0]);
      break;
    }
    case "set": {
      if (!rest[0] || !values.project) {
        console.error("Usage: maxedvault set <name> --project <slug>");
        process.exit(1);
      }
      await cmdSet(values.project, rest[0]);
      break;
    }
    case "ls": {
      if (!values.project) {
        console.error("Usage: maxedvault ls [prefix] --project <slug>");
        process.exit(1);
      }
      await cmdLs(values.project, rest[0]);
      break;
    }
    case "rm": {
      if (!rest[0] || !values.project) {
        console.error("Usage: maxedvault rm <name> --project <slug>");
        process.exit(1);
      }
      await cmdRm(values.project, rest[0]);
      break;
    }
    case "status": {
      await cmdStatus();
      break;
    }
    case "project": {
      switch (rest[0]) {
        case "create": {
          if (!rest[1]) {
            console.error("Usage: maxedvault project create <slug>");
            process.exit(1);
          }
          await cmdProjectCreate(rest[1]);
          break;
        }
        case "ls": {
          await cmdProjectLs();
          break;
        }
        default: {
          console.error("Usage: maxedvault project <create|ls>");
          process.exit(1);
        }
      }
      break;
    }
    case "env": {
      if (!values.project) {
        console.error("Usage: maxedvault env --project <slug>");
        process.exit(1);
      }
      await cmdEnv(values.project);
      break;
    }
    default: {
      console.error("Usage: maxedvault <init|get|set|ls|rm|status|project|env|run>");
      process.exit(1);
    }
  }
}

main().catch((err) => {
  console.error("Unhandled error:", err);
  process.exit(1);
});
