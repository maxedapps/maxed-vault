import { describe, expect, it } from "vitest";
import { findInvalidEnvVarNames, isEnvVarSafeName } from "./env-vars";

describe("env var name helpers", () => {
  it("accepts environment-variable-safe names", () => {
    expect(isEnvVarSafeName("TOKEN")).toBe(true);
    expect(isEnvVarSafeName("_PRIVATE_KEY")).toBe(true);
    expect(isEnvVarSafeName("API_KEY_2")).toBe(true);
  });

  it("rejects unsafe names", () => {
    expect(isEnvVarSafeName("1TOKEN")).toBe(false);
    expect(isEnvVarSafeName("BAD-KEY")).toBe(false);
    expect(isEnvVarSafeName("HAS SPACE")).toBe(false);
  });

  it("returns sorted, deduplicated invalid names", () => {
    expect(
      findInvalidEnvVarNames(["GOOD", "bad-key", "1BAD", "bad-key", "_OK", "HAS SPACE"]),
    ).toEqual(["1BAD", "bad-key", "HAS SPACE"]);
  });
});
