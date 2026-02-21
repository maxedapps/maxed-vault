import { describe, expect, it } from "vitest";
import { handleHealth } from "./health";

describe("handleHealth", () => {
  it("returns ok status payload", async () => {
    const res = handleHealth();

    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual({ status: "ok" });
  });
});
