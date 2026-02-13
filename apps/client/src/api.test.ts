import { afterEach, describe, expect, it, vi } from "vitest";
import { vaultFetch } from "./api";

vi.mock("./config", () => ({
  getServerUrl: () => "http://vault.internal",
}));

describe("vaultFetch", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it("calls fetch with the configured base URL", async () => {
    const response = new Response(JSON.stringify({ ok: true }), { status: 200 });
    const fetchMock = vi.fn().mockResolvedValue(response);
    vi.stubGlobal("fetch", fetchMock);

    const result = await vaultFetch("/secrets/demo", { method: "GET" });

    expect(fetchMock).toHaveBeenCalledWith("http://vault.internal/secrets/demo", {
      method: "GET",
    });
    expect(result).toBe(response);
  });
});