import { describe, expect, it } from "vitest";
import { router } from "./router";

describe("router", () => {
  it("returns health status", async () => {
    const req = new Request("http://vault.local/health", { method: "GET" });
    const res = await router(req, {} as never);

    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual({ status: "ok" });
  });

  it("returns 400 for missing secret name", async () => {
    const req = new Request("http://vault.local/projects/infographics/secrets/", { method: "GET" });
    const res = await router(req, {} as never);

    expect(res.status).toBe(400);
    await expect(res.json()).resolves.toEqual({ error: "Missing secret name" });
  });

  it("routes project lookup requests", async () => {
    const req = new Request("http://vault.local/projects/infographics", { method: "GET" });
    const res = await router(req, {
      db: {
        query: () => ({
          get: () => ({ name: "infographics" }),
        }),
      },
      masterKey: {} as CryptoKey,
    } as never);

    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual({ name: "infographics" });
  });

  it("returns 400 for invalid project slug", async () => {
    const req = new Request("http://vault.local/projects/Infographics/secrets", { method: "GET" });
    const res = await router(req, {} as never);

    expect(res.status).toBe(400);
    await expect(res.json()).resolves.toEqual({
      error: "Invalid project name. Use lowercase slug format",
    });
  });

  it("returns 400 for invalid secret name on set", async () => {
    const req = new Request("http://vault.local/projects/infographics/secrets/bad-key", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ value: "secret" }),
    });
    const res = await router(req, {} as never);

    expect(res.status).toBe(400);
    await expect(res.json()).resolves.toEqual({
      error:
        "Invalid secret name. Use environment-variable-safe format: letters/underscores, then letters/digits/underscores",
    });
  });

  it("returns 404 for unknown routes", async () => {
    const req = new Request("http://vault.local/unknown", { method: "GET" });
    const res = await router(req, {} as never);

    expect(res.status).toBe(404);
    await expect(res.json()).resolves.toEqual({ error: "Not found" });
  });
});
