import { beforeEach, describe, expect, it, vi } from "vitest";
import type { CliRuntime } from "../runtime";

const requireServerUrlMock = vi.hoisted(() => vi.fn(() => "http://vault.internal"));
const maybeResolveProjectMock = vi.hoisted(() => vi.fn());
const createVaultClientMock = vi.hoisted(() => vi.fn());

vi.mock("../config", () => ({
  requireServerUrl: requireServerUrlMock,
}));

vi.mock("../context", () => ({
  maybeResolveProject: maybeResolveProjectMock,
}));

vi.mock("../api", () => ({
  createVaultClient: createVaultClientMock,
}));

import { cmdStatus } from "./status";

function createRuntime(): CliRuntime {
  return {
    env: {},
    cwd: () => "/workspace",
    fetch: vi.fn() as unknown as typeof fetch,
    promptInput: vi.fn(),
    log: vi.fn(),
    writeStdout: vi.fn(),
    readStdinText: vi.fn(),
    isStdinTTY: vi.fn().mockReturnValue(false),
    spawn: vi.fn() as unknown as typeof Bun.spawn,
    onSignal: vi.fn(),
    offSignal: vi.fn(),
  };
}

describe("cmdStatus", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("prints server, health, and project source", async () => {
    createVaultClientMock.mockReturnValue({
      health: vi.fn().mockResolvedValue({ status: "ok" }),
    });
    maybeResolveProjectMock.mockReturnValue({ project: "infographics", source: "workspace" });
    const runtime = createRuntime();

    await cmdStatus(runtime);

    expect(runtime.log).toHaveBeenCalledWith("Server: http://vault.internal");
    expect(runtime.log).toHaveBeenCalledWith("Health: ok");
    expect(runtime.log).toHaveBeenCalledWith("Project: infographics (workspace)");
  });
});
