import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import type { CliRuntime } from "../runtime";

const resolveContextMock = vi.hoisted(() =>
  vi.fn(() => ({ serverUrl: "http://vault.internal", project: "infographics", source: "workspace" })),
);
const createVaultClientMock = vi.hoisted(() => vi.fn());
const setSecretMock = vi.hoisted(() => vi.fn());

vi.mock("../context", () => ({
  resolveContext: resolveContextMock,
}));

vi.mock("../api", () => ({
  createVaultClient: createVaultClientMock,
}));

import { cmdSecretGet, cmdSecretImport, cmdSecretList, cmdSecretRemove, cmdSecretSet } from "./secret";

function createRuntime(overrides: Partial<CliRuntime> = {}): CliRuntime {
  return {
    env: {},
    cwd: () => "/workspace",
    fetch: vi.fn() as unknown as typeof fetch,
    promptInput: vi.fn().mockReturnValue("prompted-value"),
    log: vi.fn(),
    writeStdout: vi.fn(),
    readStdinText: vi.fn().mockResolvedValue("piped-value\n"),
    isStdinTTY: vi.fn().mockReturnValue(false),
    spawn: vi.fn() as unknown as typeof Bun.spawn,
    onSignal: vi.fn(),
    offSignal: vi.fn(),
    ...overrides,
  };
}

function createTempDir(): string {
  return mkdtempSync(join(tmpdir(), "maxedvault-secret-"));
}

describe("secret commands", () => {
  const tempDirs: string[] = [];

  beforeEach(() => {
    vi.clearAllMocks();
    setSecretMock.mockResolvedValue({ project: "infographics", name: "TOKEN", created: true });

    createVaultClientMock.mockReturnValue({
      getSecret: vi.fn().mockResolvedValue({ project: "infographics", name: "TOKEN", value: "secret" }),
      setSecret: setSecretMock,
      listSecrets: vi.fn().mockResolvedValue({ project: "infographics", names: ["A", "B"] }),
      deleteSecret: vi.fn().mockResolvedValue({ project: "infographics", name: "TOKEN", deleted: true }),
    });
  });

  afterEach(() => {
    for (const dir of tempDirs.splice(0)) {
      rmSync(dir, { force: true, recursive: true });
    }
  });

  it("gets, lists, and removes secrets", async () => {
    const runtime = createRuntime();

    await cmdSecretGet(runtime, "TOKEN");
    await cmdSecretList(runtime, undefined);
    await cmdSecretRemove(runtime, "TOKEN");

    expect(runtime.writeStdout).toHaveBeenCalledWith("secret");
    expect(runtime.log).toHaveBeenCalledWith("A");
    expect(runtime.log).toHaveBeenCalledWith("B");
    expect(runtime.log).toHaveBeenCalledWith("Deleted infographics/TOKEN");
  });

  it("reads piped values for secret set", async () => {
    const runtime = createRuntime();

    await cmdSecretSet(runtime, "TOKEN");

    expect(runtime.log).toHaveBeenCalledWith("Created infographics/TOKEN");
  });

  it("reads prompted values when stdin is interactive", async () => {
    const runtime = createRuntime({ isStdinTTY: vi.fn().mockReturnValue(true) });

    await cmdSecretSet(runtime, "TOKEN");

    expect(runtime.promptInput).toHaveBeenCalledWith("Enter secret value: ");
  });

  it("imports .env values into vault secrets", async () => {
    const tempDir = createTempDir();
    tempDirs.push(tempDir);

    const envPath = join(tempDir, ".env");
    writeFileSync(
      envPath,
      [
        "# comment",
        "API_KEY=abc123",
        "EMPTY=",
        "export TOKEN=\"line1\\nline2\"",
        "QUOTED=' spaced value '",
        "INLINE=foo # trailing",
        "HASH=abc#123",
        "DUP=one",
        "DUP=two",
      ].join("\n"),
    );

    const runtime = createRuntime({ cwd: () => tempDir });

    await cmdSecretImport(runtime, ".env");

    expect(setSecretMock).toHaveBeenCalledWith("infographics", "API_KEY", "abc123");
    expect(setSecretMock).toHaveBeenCalledWith("infographics", "EMPTY", "");
    expect(setSecretMock).toHaveBeenCalledWith("infographics", "TOKEN", "line1\nline2");
    expect(setSecretMock).toHaveBeenCalledWith("infographics", "QUOTED", " spaced value ");
    expect(setSecretMock).toHaveBeenCalledWith("infographics", "INLINE", "foo");
    expect(setSecretMock).toHaveBeenCalledWith("infographics", "HASH", "abc#123");
    expect(setSecretMock).toHaveBeenCalledWith("infographics", "DUP", "two");
    expect(setSecretMock).toHaveBeenCalledTimes(7);

    expect(runtime.log).toHaveBeenCalledWith(
      expect.stringContaining(`Imported 7 secrets into infographics from ${envPath}`),
    );
  });

  it("fails on invalid .env syntax", async () => {
    const tempDir = createTempDir();
    tempDirs.push(tempDir);

    const envPath = join(tempDir, ".env");
    writeFileSync(envPath, "NOT_A_VALID_ENV_LINE");

    const runtime = createRuntime({ cwd: () => tempDir });

    await expect(cmdSecretImport(runtime, ".env")).rejects.toThrowError(/Invalid \.env syntax/);
  });
});
