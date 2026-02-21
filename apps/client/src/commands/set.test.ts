import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cmdSet } from "./set";

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

function createTtyBunInput(input: string) {
  const releaseLock = vi.fn();
  const read = vi.fn().mockResolvedValue({ value: new TextEncoder().encode(input) });
  const getReader = vi.fn().mockReturnValue({ read, releaseLock });

  return {
    stdin: {
      isTTY: () => true,
      stream: () => ({ getReader }),
    },
  };
}

describe("cmdSet", () => {
  const originalExit = process.exit;

  beforeEach(() => {
    vaultFetchMock.mockReset();
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    vi.spyOn(process.stderr, "write").mockImplementation(() => true);
  });

  afterEach(() => {
    process.exit = originalExit;
  });

  it("uses piped stdin when not attached to a TTY", async () => {
    vi.stubGlobal("Bun", {
      stdin: {
        isTTY: () => false,
        text: vi.fn().mockResolvedValue("abc123\n"),
      },
    });
    vaultFetchMock.mockResolvedValue(new Response(JSON.stringify({ created: true }), { status: 201 }));

    await cmdSet("infographics", "WEBHOOK_SECRET");

    expect(vaultFetchMock).toHaveBeenCalledWith("/projects/infographics/secrets/WEBHOOK_SECRET", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ value: "abc123" }),
    });
    expect(console.error).toHaveBeenCalledWith("Created infographics/WEBHOOK_SECRET");
  });

  it("uses a reader prompt when stdin is a TTY", async () => {
    vi.stubGlobal("Bun", createTtyBunInput("typed-secret\n"));
    vaultFetchMock.mockResolvedValue(new Response(JSON.stringify({ created: false }), { status: 200 }));

    await cmdSet("infographics", "WEBHOOK_SECRET");

    expect(process.stderr.write).toHaveBeenCalledWith("Enter secret value: ");
    expect(vaultFetchMock).toHaveBeenCalledWith("/projects/infographics/secrets/WEBHOOK_SECRET", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ value: "typed-secret" }),
    });
    expect(console.error).toHaveBeenCalledWith("Updated infographics/WEBHOOK_SECRET");
  });

  it("fails when no value is provided", async () => {
    vi.stubGlobal("Bun", {
      stdin: {
        isTTY: () => false,
        text: vi.fn().mockResolvedValue(" \n"),
      },
    });
    process.exit = vi.fn((code: number) => {
      throw new ExitError(code);
    }) as never;

    await expect(cmdSet("infographics", "TOKEN")).rejects.toThrowError(ExitError);
    expect(console.error).toHaveBeenCalledWith("No value provided");
    expect(process.exit).toHaveBeenCalledWith(1);
    expect(vaultFetchMock).not.toHaveBeenCalled();
  });

  it("prints API error and exits when request fails", async () => {
    vi.stubGlobal("Bun", {
      stdin: {
        isTTY: () => false,
        text: vi.fn().mockResolvedValue("abc123\n"),
      },
    });
    vaultFetchMock.mockResolvedValue(
      new Response(JSON.stringify({ error: "Project not found" }), { status: 404 }),
    );
    process.exit = vi.fn((code: number) => {
      throw new ExitError(code);
    }) as never;

    await expect(cmdSet("missing", "TOKEN")).rejects.toThrowError(ExitError);
    expect(console.error).toHaveBeenCalledWith("Project not found");
    expect(process.exit).toHaveBeenCalledWith(1);
  });
});
