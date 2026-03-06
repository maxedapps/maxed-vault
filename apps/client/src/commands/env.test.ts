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

import { cmdEnv } from "./env";

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

describe("cmdEnv", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("prints shell exports", async () => {
    createVaultClientMock.mockReturnValue({
      getEnv: vi.fn().mockResolvedValue({
        project: "infographics",
        secrets: [
          { name: "TOKEN", value: "abc123" },
          { name: "QUOTED", value: "contains'quote" },
        ],
      }),
    });
    const runtime = createRuntime();

    await cmdEnv(runtime);

    expect(runtime.writeStdout).toHaveBeenCalledWith("export TOKEN='abc123'\n");
    expect(runtime.writeStdout).toHaveBeenCalledWith("export QUOTED='contains'\\''quote'\n");
  });
});
