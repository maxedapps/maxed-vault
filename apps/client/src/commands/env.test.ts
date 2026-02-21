import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cmdEnv } from "./env";

vi.mock("../config", () => ({
  getServerUrl: () => "http://vault.internal",
}));

describe("cmdEnv", () => {
  const originalExit = process.exit;

  beforeEach(() => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    vi.spyOn(process.stdout, "write").mockImplementation(() => true);
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
    process.exit = originalExit;
  });

  it("prints shell export lines for all project secrets", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({
            project: "infographics",
            secrets: [
              { name: "WEBHOOK_SECRET", value: "abc123" },
              { name: "TOKEN", value: "contains'quote" },
            ],
          }),
          { status: 200 },
        ),
      ),
    );

    await cmdEnv("infographics");

    expect(process.stdout.write).toHaveBeenCalledWith("export WEBHOOK_SECRET='abc123'\n");
    expect(process.stdout.write).toHaveBeenCalledWith("export TOKEN='contains'\\''quote'\n");
  });

  it("exits with code 1 on API error", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(new Response(JSON.stringify({ error: "Project not found" }), { status: 404 })),
    );
    process.exit = vi.fn() as never;

    await cmdEnv("unknown");

    expect(console.error).toHaveBeenCalledWith("Project not found");
    expect(process.exit).toHaveBeenCalledWith(1);
  });

  it("fails on invalid environment variable names", async () => {
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
    process.exit = vi.fn() as never;

    await cmdEnv("infographics");

    expect(console.error).toHaveBeenCalledWith(
      "Invalid secret names for environment variables: bad-key",
    );
    expect(process.exit).toHaveBeenCalledWith(1);
    expect(process.stdout.write).not.toHaveBeenCalled();
  });
});
