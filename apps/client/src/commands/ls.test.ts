import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cmdLs } from "./ls";

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

describe("cmdLs", () => {
  const originalExit = process.exit;

  beforeEach(() => {
    vaultFetchMock.mockReset();
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    vi.spyOn(console, "log").mockImplementation(() => undefined);
  });

  afterEach(() => {
    process.exit = originalExit;
  });

  it("prints secret names returned by the API", async () => {
    vaultFetchMock.mockResolvedValue(
      new Response(JSON.stringify({ names: ["API_KEY", "TOKEN"] }), { status: 200 }),
    );

    await cmdLs("infographics", "A");

    expect(vaultFetchMock).toHaveBeenCalledWith("/projects/infographics/secrets?prefix=A");
    expect(console.log).toHaveBeenCalledWith("API_KEY");
    expect(console.log).toHaveBeenCalledWith("TOKEN");
  });

  it("prints API error and exits when listing fails", async () => {
    vaultFetchMock.mockResolvedValue(
      new Response(JSON.stringify({ error: "Project not found" }), { status: 404 }),
    );
    process.exit = vi.fn((code: number) => {
      throw new ExitError(code);
    }) as never;

    await expect(cmdLs("missing")).rejects.toThrowError(ExitError);
    expect(console.error).toHaveBeenCalledWith("Project not found");
    expect(process.exit).toHaveBeenCalledWith(1);
  });

  it("uses fallback message when response has no error body", async () => {
    vaultFetchMock.mockResolvedValue(new Response(JSON.stringify({}), { status: 500 }));
    process.exit = vi.fn((code: number) => {
      throw new ExitError(code);
    }) as never;

    await expect(cmdLs("infographics")).rejects.toThrowError(ExitError);
    expect(console.error).toHaveBeenCalledWith("Failed to list secrets");
  });
});
