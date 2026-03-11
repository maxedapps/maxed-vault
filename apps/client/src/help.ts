export const CLIENT_COMMAND_SUMMARY_LINES = [
  "  maxedvault init [--server <url>]",
  "  maxedvault status",
  "  maxedvault project create <slug>",
  "  maxedvault project list",
  "  maxedvault project use <slug>",
  "  maxedvault project current",
  "  maxedvault project clear",
  "  maxedvault secret set <name> [--project <slug>]",
  "  maxedvault secret get <name> [--project <slug>]",
  "  maxedvault secret import --file <path> [--project <slug>]",
  "  maxedvault secret list [prefix] [--project <slug>]",
  "  maxedvault secret remove <name> [--project <slug>]",
  "  maxedvault env [--project <slug>]",
  "  maxedvault run [--project <slug>] -- <command> [args...]",
] as const;

export type ClientHelpTopic = "all" | "project" | "secret" | "env" | "run";

const PROJECT_COMMAND_LINES = [
  "  maxedvault project create <slug>",
  "  maxedvault project list",
  "  maxedvault project use <slug>",
  "  maxedvault project current",
  "  maxedvault project clear",
];

const SECRET_COMMAND_LINES = [
  "  maxedvault secret set <name> [--project <slug>]",
  "  maxedvault secret get <name> [--project <slug>]",
  "  maxedvault secret import --file <path> [--project <slug>]",
  "  maxedvault secret list [prefix] [--project <slug>]",
  "  maxedvault secret remove <name> [--project <slug>]",
];

export function clientHelpMessage(topic: ClientHelpTopic = "all"): string {
  switch (topic) {
    case "project":
      return [
        "MaxedVault project help",
        "",
        "Commands:",
        ...PROJECT_COMMAND_LINES,
        "",
        "Notes:",
        "  - `project use` binds the current workspace to a project.",
        "  - `project current` resolves from MAXEDVAULT_PROJECT or workspace config.",
      ].join("\n");
    case "secret":
      return [
        "MaxedVault secret help",
        "",
        "Commands:",
        ...SECRET_COMMAND_LINES,
        "",
        "Project resolution order:",
        "  1. --project",
        "  2. MAXEDVAULT_PROJECT",
        "  3. nearest .maxedvault/project.json",
      ].join("\n");
    case "env":
      return [
        "MaxedVault env help",
        "",
        "Usage:",
        "  maxedvault env [--project <slug>]",
      ].join("\n");
    case "run":
      return [
        "MaxedVault run help",
        "",
        "Usage:",
        "  maxedvault run [--project <slug>] -- <command> [args...]",
        "",
        "Examples:",
        "  maxedvault run -- node app.js",
        "  maxedvault run --project infographics -- bun run dev",
      ].join("\n");
    default:
      return [
        "MaxedVault client help",
        "",
        "Commands:",
        "  maxedvault init [--server <url>]",
        "  maxedvault status",
        ...PROJECT_COMMAND_LINES,
        ...SECRET_COMMAND_LINES,
        "  maxedvault env [--project <slug>]",
        "  maxedvault run [--project <slug>] -- <command> [args...]",
        "",
        "Project resolution order:",
        "  1. --project",
        "  2. MAXEDVAULT_PROJECT",
        "  3. nearest .maxedvault/project.json",
      ].join("\n");
  }
}
