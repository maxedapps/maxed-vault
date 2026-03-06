import { afterEach, describe, expect, it } from "vitest";
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { maybeResolveProject, resolveContext } from "./context";
import { saveGlobalConfig } from "./config";

function createTempDir(): string {
  return mkdtempSync(join(tmpdir(), "maxedvault-context-"));
}

describe("context resolution", () => {
  const tempDirs: string[] = [];

  afterEach(() => {
    for (const dir of tempDirs.splice(0)) {
      rmSync(dir, { force: true, recursive: true });
    }
  });

  it("resolves project by precedence: flag > env > workspace", () => {
    const workspaceDir = createTempDir();
    tempDirs.push(workspaceDir);
    mkdirSync(join(workspaceDir, ".maxedvault"), { recursive: true });
    writeFileSync(join(workspaceDir, ".maxedvault", "config.json"), JSON.stringify({ project: "workspace" }));

    expect(
      maybeResolveProject({
        explicitProject: "flag",
        env: { MAXEDVAULT_PROJECT: "env" },
        cwd: workspaceDir,
      }),
    ).toEqual({ project: "flag", source: "flag" });

    expect(
      maybeResolveProject({
        env: { MAXEDVAULT_PROJECT: "env" },
        cwd: workspaceDir,
      }),
    ).toEqual({ project: "env", source: "env" });

    expect(maybeResolveProject({ env: {}, cwd: workspaceDir })).toEqual({
      project: "workspace",
      source: "workspace",
    });
  });

  it("resolves full context using the configured server", async () => {
    const workspaceDir = createTempDir();
    const homeDir = createTempDir();
    tempDirs.push(workspaceDir, homeDir);
    mkdirSync(join(workspaceDir, ".maxedvault"), { recursive: true });
    writeFileSync(join(workspaceDir, ".maxedvault", "config.json"), JSON.stringify({ project: "workspace" }));
    await saveGlobalConfig("http://vault.internal", homeDir);

    expect(resolveContext({ env: {}, cwd: workspaceDir, homeDir })).toEqual({
      serverUrl: "http://vault.internal",
      project: "workspace",
      source: "workspace",
    });
  });
});
