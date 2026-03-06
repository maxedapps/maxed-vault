import { describe, expect, it, vi } from "vitest";
import { createVaultClient } from "./api";
import { CliError } from "./errors";

describe("createVaultClient", () => {
  it("requests project env from the new /env endpoint", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ project: "infographics", secrets: [] }), { status: 200 }),
    );
    const client = createVaultClient({
      serverUrl: "http://vault.internal",
      fetchImpl: fetchMock,
    });

    const result = await client.getEnv("infographics");

    expect(fetchMock).toHaveBeenCalledWith("http://vault.internal/projects/infographics/env", undefined);
    expect(result).toEqual({ project: "infographics", secrets: [] });
  });

  it("maps API errors to CliError", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ error: "Project not found" }), { status: 404 }),
    );
    const client = createVaultClient({
      serverUrl: "http://vault.internal",
      fetchImpl: fetchMock,
    });

    await expect(client.getProject("missing")).rejects.toThrowError(new CliError("Project not found"));
  });
});
