import { describe, expect, it } from "vitest";
import { getWeakPassphraseWarning } from "./passphrase";

describe("getWeakPassphraseWarning", () => {
  it("warns when passphrase is too short", () => {
    expect(getWeakPassphraseWarning("short123!")).toContain("at least 14 characters");
  });

  it("warns when passphrase lacks character variety", () => {
    expect(getWeakPassphraseWarning("alllowercasepassphrase")).toContain("mix upper/lowercase");
  });

  it("accepts longer mixed passphrases", () => {
    expect(getWeakPassphraseWarning("CorrectHorseBatteryStaple!42")).toBeNull();
  });
});
