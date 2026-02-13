import { describe, expect, it } from "vitest";
import { json } from "./response";

describe("json response", () => {
  it("returns JSON body with default status", async () => {
    const response = json({ ok: true });

    expect(response.status).toBe(200);
    expect(response.headers.get("Content-Type")).toBe("application/json");
    await expect(response.json()).resolves.toEqual({ ok: true });
  });

  it("uses custom status when provided", async () => {
    const response = json({ error: "bad" }, 400);

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({ error: "bad" });
  });
});