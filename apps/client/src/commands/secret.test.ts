import { beforeEach, describe, expect, it, vi } from "vitest";
import type { CliRuntime } from "../runtime";

const resolveContextMock = vi.hoisted(() => vi.fn(() => ({ serverUrl: "http://vault.internal", project: "infographics", source: "workspace" })));
const createVaultClientMock = vi.hoisted(() => vi.fn());

vi.mock("../context", () => ({
  resolveContext: resolveContextMock,
}));

vi.mock("../api", () => ({
  createVaultClient: createVaultClientMock,
}));

import { cmdSecretGet, cmdSecretList, cmdSecretRemove, cmdSecretSet } from "./secret";

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

describe("secret commands", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    createVaultClientMock.mockReturnValue({
      getSecret: vi.fn().mockResolvedValue({ project: "infographics", name: "TOKEN", value: "secret" }),
      setSecret: vi.fn().mockResolvedValue({ project: "infographics", name: "TOKEN", created: true }),
      listSecrets: vi.fn().mockResolvedValue({ project: "infographics", names: ["A", "B"] }),
      deleteSecret: vi.fn().mockResolvedValue({ project: "infographics", name: "TOKEN", deleted: true }),
    });
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
});
