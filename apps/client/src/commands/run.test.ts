import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cmdRun } from "./run";

vi.mock("../config", () => ({
  getServerUrl: () => "http://vault.internal",
}));

describe("cmdRun", () => {
  const originalExit = process.exit;

  beforeEach(() => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
    process.exit = originalExit;
  });

  it("spawns the provided command with project secrets in env", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({
            project: "infographics",
            secrets: [{ name: "WEBHOOK_SECRET", value: "abc123" }],
          }),
          { status: 200 },
        ),
      ),
    );
    const spawnMock = vi.fn().mockReturnValue({ exited: Promise.resolve(0) });
    vi.stubGlobal("Bun", { spawn: spawnMock });

    await cmdRun("infographics", ["npm", "start"]);

    expect(spawnMock).toHaveBeenCalledTimes(1);
    const [opts] = spawnMock.mock.calls[0];
    expect(opts.cmd).toEqual(["npm", "start"]);
    expect(opts.stdin).toBe("inherit");
    expect(opts.stdout).toBe("inherit");
    expect(opts.stderr).toBe("inherit");
    expect(opts.env.WEBHOOK_SECRET).toBe("abc123");
  });

  it("exits with child exit code when child fails", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({
            project: "infographics",
            secrets: [{ name: "TOKEN", value: "secret" }],
          }),
          { status: 200 },
        ),
      ),
    );
    const spawnMock = vi.fn().mockReturnValue({ exited: Promise.resolve(42) });
    vi.stubGlobal("Bun", { spawn: spawnMock });
    process.exit = vi.fn() as never;

    await cmdRun("infographics", ["npm", "start"]);

    expect(spawnMock).toHaveBeenCalledTimes(1);
    expect(process.exit).toHaveBeenCalledWith(42);
  });

  it("exits with code 1 on API error", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(new Response(JSON.stringify({ error: "Project not found" }), { status: 404 })),
    );
    const spawnMock = vi.fn();
    vi.stubGlobal("Bun", { spawn: spawnMock });
    process.exit = vi.fn() as never;

    await cmdRun("unknown", ["npm", "start"]);

    expect(console.error).toHaveBeenCalledWith("Project not found");
    expect(process.exit).toHaveBeenCalledWith(1);
    expect(spawnMock).not.toHaveBeenCalled();
  });

  it("fails hard when a secret name is not env-var-safe", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({
            project: "infographics",
            secrets: [{ name: "bad-key", value: "abc123" }],
          }),
          { status: 200 },
        ),
      ),
    );
    const spawnMock = vi.fn();
    vi.stubGlobal("Bun", { spawn: spawnMock });
    process.exit = vi.fn() as never;

    await cmdRun("infographics", ["npm", "start"]);

    expect(console.error).toHaveBeenCalledWith(
      "Invalid secret names for environment variables: bad-key",
    );
    expect(process.exit).toHaveBeenCalledWith(1);
    expect(spawnMock).not.toHaveBeenCalled();
  });
});
