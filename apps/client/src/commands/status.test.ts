import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cmdStatus } from "./status";

vi.mock("../config", () => ({
  getServerUrl: () => "http://vault.internal",
}));

describe("cmdStatus", () => {
  const originalExit = process.exit;

  beforeEach(() => {
    vi.spyOn(console, "log").mockImplementation(() => undefined);
    vi.spyOn(console, "error").mockImplementation(() => undefined);
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
    process.exit = originalExit;
  });

  it("prints server and health status when reachable", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ status: "ok" }), { status: 200 }),
    );
    vi.stubGlobal("fetch", fetchMock);

    await cmdStatus();

    expect(console.log).toHaveBeenCalledWith("Server: http://vault.internal");
    expect(console.log).toHaveBeenCalledWith("Health: ok");
    expect(fetchMock).toHaveBeenCalledWith("http://vault.internal/health");
  });

  it("exits with code 1 when health endpoint is unreachable", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("network down")));
    process.exit = vi.fn() as never;

    await cmdStatus();

    expect(console.error).toHaveBeenCalledWith("Health: unreachable (network down)");
    expect(process.exit).toHaveBeenCalledWith(1);
  });
});