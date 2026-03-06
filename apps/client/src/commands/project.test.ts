import { beforeEach, describe, expect, it, vi } from "vitest";
import type { CliRuntime } from "../runtime";

const requireServerUrlMock = vi.hoisted(() => vi.fn(() => "http://vault.internal"));
const saveWorkspaceConfigMock = vi.hoisted(() => vi.fn().mockResolvedValue("/workspace/.maxedvault/config.json"));
const clearWorkspaceConfigMock = vi.hoisted(() => vi.fn());
const maybeResolveProjectMock = vi.hoisted(() => vi.fn());
const createVaultClientMock = vi.hoisted(() => vi.fn());

vi.mock("../config", () => ({
  requireServerUrl: requireServerUrlMock,
  saveWorkspaceConfig: saveWorkspaceConfigMock,
  clearWorkspaceConfig: clearWorkspaceConfigMock,
}));

vi.mock("../context", () => ({
  maybeResolveProject: maybeResolveProjectMock,
}));

vi.mock("../api", () => ({
  createVaultClient: createVaultClientMock,
}));

import {
  cmdProjectClear,
  cmdProjectCreate,
  cmdProjectCurrent,
  cmdProjectList,
  cmdProjectUse,
} from "./project";

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

describe("project commands", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    createVaultClientMock.mockReturnValue({
      createProject: vi.fn().mockResolvedValue({ name: "infographics", created: true }),
      listProjects: vi.fn().mockResolvedValue({ projects: ["alpha", "infographics"] }),
      getProject: vi.fn().mockResolvedValue({ name: "infographics" }),
    });
  });

  it("creates and lists projects", async () => {
    const runtime = createRuntime();

    await cmdProjectCreate(runtime, "infographics");
    await cmdProjectList(runtime);

    expect(runtime.log).toHaveBeenCalledWith("Created project infographics");
    expect(runtime.log).toHaveBeenCalledWith("alpha");
    expect(runtime.log).toHaveBeenCalledWith("infographics");
  });

  it("binds a workspace to a project", async () => {
    const runtime = createRuntime();

    await cmdProjectUse(runtime, "infographics");

    expect(saveWorkspaceConfigMock).toHaveBeenCalledWith("infographics", "/workspace");
    expect(runtime.log).toHaveBeenCalledWith(
      "Bound project infographics in /workspace/.maxedvault/config.json",
    );
  });

  it("prints and clears current project state", () => {
    const runtime = createRuntime();
    maybeResolveProjectMock.mockReturnValue({ project: "infographics", source: "workspace" });
    clearWorkspaceConfigMock.mockReturnValue("/workspace/.maxedvault/config.json");

    cmdProjectCurrent(runtime);
    cmdProjectClear(runtime);

    expect(runtime.log).toHaveBeenCalledWith("infographics");
    expect(runtime.log).toHaveBeenCalledWith(
      "Cleared workspace project binding at /workspace/.maxedvault/config.json",
    );
  });
});
