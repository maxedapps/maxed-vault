import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cmdRm } from "./rm";

class ExitError extends Error {
  code: number;

  constructor(code: number) {
    super(`exit:${code}`);
    this.code = code;
  }
}

const vaultFetchMock = vi.hoisted(() => vi.fn());

vi.mock("../api", () => ({
  vaultFetch: vaultFetchMock,
}));

describe("cmdRm", () => {
  const originalExit = process.exit;

  beforeEach(() => {
    vaultFetchMock.mockReset();
    vi.spyOn(console, "error").mockImplementation(() => undefined);
  });

  afterEach(() => {
    process.exit = originalExit;
  });

  it("deletes a secret and prints confirmation", async () => {
    vaultFetchMock.mockResolvedValue(new Response(JSON.stringify({ deleted: true }), { status: 200 }));

    await cmdRm("infographics", "TOKEN");

    expect(vaultFetchMock).toHaveBeenCalledWith("/projects/infographics/secrets/TOKEN", {
      method: "DELETE",
    });
    expect(console.error).toHaveBeenCalledWith("Deleted infographics/TOKEN");
  });

  it("prints API error and exits when delete fails", async () => {
    vaultFetchMock.mockResolvedValue(
      new Response(JSON.stringify({ error: "Secret not found" }), { status: 404 }),
    );
    process.exit = vi.fn((code: number) => {
      throw new ExitError(code);
    }) as never;

    await expect(cmdRm("infographics", "MISSING")).rejects.toThrowError(ExitError);
    expect(console.error).toHaveBeenCalledWith("Secret not found");
    expect(process.exit).toHaveBeenCalledWith(1);
  });

  it("uses fallback message when delete error body is empty", async () => {
    vaultFetchMock.mockResolvedValue(new Response(JSON.stringify({}), { status: 500 }));
    process.exit = vi.fn((code: number) => {
      throw new ExitError(code);
    }) as never;

    await expect(cmdRm("infographics", "TOKEN")).rejects.toThrowError(ExitError);
    expect(console.error).toHaveBeenCalledWith("Failed to delete secret");
  });
});
