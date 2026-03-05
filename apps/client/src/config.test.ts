import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

class ExitError extends Error {
  code: number;

  constructor(code: number) {
    super(`exit:${code}`);
    this.code = code;
  }
}

const fsMock = vi.hoisted(() => ({
  mkdirSync: vi.fn(),
  chmodSync: vi.fn(),
  readFileSync: vi.fn(),
}));
const homedirMock = vi.hoisted(() => vi.fn(() => "/home/tester"));
const bunWriteMock = vi.hoisted(() => vi.fn().mockResolvedValue(undefined));

vi.mock("fs", () => fsMock);
vi.mock("os", () => ({ homedir: homedirMock }));

describe("config", () => {
  const originalExit = process.exit;

  beforeEach(() => {
    vi.resetModules();
    fsMock.mkdirSync.mockReset();
    fsMock.chmodSync.mockReset();
    fsMock.readFileSync.mockReset();
    homedirMock.mockClear();
    bunWriteMock.mockClear().mockResolvedValue(undefined);
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    vi.stubGlobal("Bun", { write: bunWriteMock });
  });

  afterEach(() => {
    process.exit = originalExit;
  });

  it("loads config from disk when JSON is valid", async () => {
    fsMock.readFileSync.mockReturnValue('{"server":"http://vault.internal"}');
    const { loadConfig } = await import("./config");

    expect(loadConfig()).toEqual({ server: "http://vault.internal" });
    expect(fsMock.readFileSync).toHaveBeenCalledWith(
      "/home/tester/.maxedvault/config.json",
      "utf-8",
    );
  });

  it("returns null when config cannot be read", async () => {
    fsMock.readFileSync.mockImplementation(() => {
      throw new Error("missing");
    });
    const { loadConfig } = await import("./config");

    expect(loadConfig()).toBeNull();
  });

  it("saves config with strict file permissions", async () => {
    const { saveConfig } = await import("./config");

    await saveConfig("http://vault.internal/");

    expect(fsMock.mkdirSync).toHaveBeenCalledWith("/home/tester/.maxedvault", {
      recursive: true,
      mode: 0o700,
    });
    expect(bunWriteMock).toHaveBeenCalledWith(
      "/home/tester/.maxedvault/config.json",
      JSON.stringify({ server: "http://vault.internal/" }, null, 2),
    );
    expect(fsMock.chmodSync).toHaveBeenCalledWith("/home/tester/.maxedvault/config.json", 0o600);
  });

  it("returns normalized server URL without trailing slashes", async () => {
    fsMock.readFileSync.mockReturnValue('{"server":"http://vault.internal///"}');
    const { getServerUrl } = await import("./config");

    expect(getServerUrl()).toBe("http://vault.internal");
  });

  it("prints guidance and exits when server config is missing", async () => {
    fsMock.readFileSync.mockImplementation(() => {
      throw new Error("missing");
    });
    process.exit = vi.fn((code: number) => {
      throw new ExitError(code);
    }) as never;
    const { getServerUrl } = await import("./config");

    expect(() => getServerUrl()).toThrowError(ExitError);
    expect(console.error).toHaveBeenCalledWith("Not configured. Run: maxedvault init");
    expect(process.exit).toHaveBeenCalledWith(1);
  });
});
