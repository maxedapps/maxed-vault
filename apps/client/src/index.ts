import { parseArgs } from "util";
import { saveConfig } from "./config";
import { cmdGet } from "./commands/get";
import { cmdSet } from "./commands/set";
import { cmdLs } from "./commands/ls";
import { cmdRm } from "./commands/rm";
import { cmdStatus } from "./commands/status";
import { cmdProjectCreate, cmdProjectLs } from "./commands/project.ts";
import { cmdEnv } from "./commands/env.ts";

const { positionals, values } = parseArgs({
  args: Bun.argv.slice(2),
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
      console.error("Usage: bunvault init --server <url>");
      process.exit(1);
    }
    await saveConfig(values.server);
    console.error(`Configured server: ${values.server}`);
    break;
  }
  case "get": {
    if (!rest[0] || !values.project) {
      console.error("Usage: bunvault get <name> --project <slug>");
      process.exit(1);
    }
    await cmdGet(values.project, rest[0]);
    break;
  }
  case "set": {
    if (!rest[0] || !values.project) {
      console.error("Usage: bunvault set <name> --project <slug>");
      process.exit(1);
    }
    await cmdSet(values.project, rest[0]);
    break;
  }
  case "ls": {
    if (!values.project) {
      console.error("Usage: bunvault ls [prefix] --project <slug>");
      process.exit(1);
    }
    await cmdLs(values.project, rest[0]);
    break;
  }
  case "rm": {
    if (!rest[0] || !values.project) {
      console.error("Usage: bunvault rm <name> --project <slug>");
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
          console.error("Usage: bunvault project create <slug>");
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
        console.error("Usage: bunvault project <create|ls>");
        process.exit(1);
      }
    }
    break;
  }
  case "env": {
    if (!values.project) {
      console.error("Usage: bunvault env --project <slug>");
      process.exit(1);
    }
    await cmdEnv(values.project);
    break;
  }
  default: {
    console.error("Usage: bunvault <init|get|set|ls|rm|status|project|env>");
    process.exit(1);
  }
}
