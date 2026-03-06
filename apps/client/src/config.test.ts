import { afterEach, describe, expect, it } from "vitest";
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { mkdtempSync } from "node:fs";
import {
  clearWorkspaceConfig,
  findWorkspaceConfig,
  getGlobalConfigPath,
  loadGlobalConfig,
  resolveWorkspaceRoot,
  saveGlobalConfig,
  saveWorkspaceConfig,
} from "./config";

function createTempDir(): string {
  return mkdtempSync(join(tmpdir(), "maxedvault-config-"));
}

describe("config", () => {
  const tempDirs: string[] = [];

  afterEach(() => {
    for (const dir of tempDirs.splice(0)) {
      rmSync(dir, { force: true, recursive: true });
    }
  });

  it("saves and loads normalized global config", async () => {
    const homeDir = createTempDir();
    tempDirs.push(homeDir);

    await saveGlobalConfig("http://vault.internal///", homeDir);

    expect(loadGlobalConfig(homeDir)).toEqual({ serverUrl: "http://vault.internal" });
    expect(JSON.parse(readFileSync(getGlobalConfigPath(homeDir), "utf-8"))).toEqual({
      serverUrl: "http://vault.internal",
    });
  });

  it("finds workspace config by walking upward", () => {
    const rootDir = createTempDir();
    tempDirs.push(rootDir);
    mkdirSync(join(rootDir, ".maxedvault"), { recursive: true });
    writeFileSync(join(rootDir, ".maxedvault", "config.json"), JSON.stringify({ project: "alpha" }));
    mkdirSync(join(rootDir, "src", "nested"), { recursive: true });

    expect(findWorkspaceConfig(join(rootDir, "src", "nested"))).toMatchObject({
      rootDir,
      config: { project: "alpha" },
    });
  });

  it("prefers nearest package root when choosing where to write workspace config", async () => {
    const rootDir = createTempDir();
    tempDirs.push(rootDir);
    writeFileSync(join(rootDir, "package.json"), "{}");
    mkdirSync(join(rootDir, "src", "feature"), { recursive: true });

    const configPath = await saveWorkspaceConfig("alpha", join(rootDir, "src", "feature"));

    expect(configPath).toBe(join(rootDir, ".maxedvault", "config.json"));
    expect(resolveWorkspaceRoot(join(rootDir, "src", "feature"))).toBe(rootDir);
  });

  it("clears workspace config when present", async () => {
    const rootDir = createTempDir();
    tempDirs.push(rootDir);
    writeFileSync(join(rootDir, "package.json"), "{}");

    const configPath = await saveWorkspaceConfig("alpha", rootDir);
    expect(existsSync(configPath)).toBe(true);

    const cleared = clearWorkspaceConfig(rootDir);

    expect(cleared).toBe(configPath);
    expect(existsSync(configPath)).toBe(false);
  });
});
