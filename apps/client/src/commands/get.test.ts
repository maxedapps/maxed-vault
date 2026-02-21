import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cmdGet } from "./get";

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

describe("cmdGet", () => {
  const originalExit = process.exit;

  beforeEach(() => {
    vaultFetchMock.mockReset();
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    vi.spyOn(process.stdout, "write").mockImplementation(() => true);
  });

  afterEach(() => {
    process.exit = originalExit;
  });

  it("prints secret value to stdout on success", async () => {
    vaultFetchMock.mockResolvedValue(new Response(JSON.stringify({ value: "abc123" }), { status: 200 }));

    await cmdGet("infographics", "WEBHOOK_SECRET");

    expect(vaultFetchMock).toHaveBeenCalledWith(
      "/projects/infographics/secrets/WEBHOOK_SECRET",
    );
    expect(process.stdout.write).toHaveBeenCalledWith("abc123");
  });

  it("prints API error and exits when request fails", async () => {
    vaultFetchMock.mockResolvedValue(
      new Response(JSON.stringify({ error: "Secret not found" }), { status: 404 }),
    );
    process.exit = vi.fn((code: number) => {
      throw new ExitError(code);
    }) as never;

    await expect(cmdGet("infographics", "MISSING")).rejects.toThrowError(ExitError);
    expect(console.error).toHaveBeenCalledWith("Secret not found");
    expect(process.exit).toHaveBeenCalledWith(1);
    expect(process.stdout.write).not.toHaveBeenCalled();
  });

  it("uses fallback message when API error has no error field", async () => {
    vaultFetchMock.mockResolvedValue(new Response(JSON.stringify({}), { status: 500 }));
    process.exit = vi.fn((code: number) => {
      throw new ExitError(code);
    }) as never;

    await expect(cmdGet("infographics", "MISSING")).rejects.toThrowError(ExitError);
    expect(console.error).toHaveBeenCalledWith("Failed to get secret");
    expect(process.exit).toHaveBeenCalledWith(1);
  });
});
