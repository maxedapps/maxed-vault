import { join } from "path";
import { homedir } from "os";
import { mkdirSync, chmodSync, readFileSync } from "fs";

const CONFIG_DIR = join(homedir(), ".maxedvault");
const CONFIG_FILE = join(CONFIG_DIR, "config.json");

interface Config {
  server: string;
}

export function loadConfig(): Config | null {
  try {
    const text = readFileSync(CONFIG_FILE, "utf-8");
    return JSON.parse(text) as Config;
  } catch {
    return null;
  }
}

export async function saveConfig(server: string): Promise<void> {
  mkdirSync(CONFIG_DIR, { recursive: true, mode: 0o700 });
  await Bun.write(CONFIG_FILE, JSON.stringify({ server }, null, 2));
  chmodSync(CONFIG_FILE, 0o600);
}

export function getServerUrl(): string {
  const config = loadConfig();
  if (!config?.server) {
    console.error("Not configured. Run: maxedvault init");
    process.exit(1);
  }
  return config.server.replace(/\/+$/, "");
}
