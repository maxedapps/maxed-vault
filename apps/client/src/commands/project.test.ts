import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cmdProjectCreate, cmdProjectLs } from "./project";

vi.mock("../config", () => ({
  getServerUrl: () => "http://vault.internal",
}));

describe("project commands", () => {
  const originalExit = process.exit;

  beforeEach(() => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    vi.spyOn(console, "log").mockImplementation(() => undefined);
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
    process.exit = originalExit;
  });

  it("creates a project", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ name: "infographics", created: true }), { status: 201 }),
    );
    vi.stubGlobal("fetch", fetchMock);

    await cmdProjectCreate("infographics");

    expect(fetchMock).toHaveBeenCalledWith("http://vault.internal/projects", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: "infographics" }),
    });
    expect(console.error).toHaveBeenCalledWith("Created project infographics");
  });

  it("lists projects", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ projects: ["alpha", "infographics"] }), { status: 200 }),
      ),
    );

    await cmdProjectLs();

    expect(console.log).toHaveBeenCalledWith("alpha");
    expect(console.log).toHaveBeenCalledWith("infographics");
  });
});
