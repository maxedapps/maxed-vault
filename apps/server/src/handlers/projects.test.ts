import { describe, expect, it } from "vitest";
import { handleCreateProject, handleGetProject, handleListProjects, isValidProjectName } from "./projects";
import { FakeDb } from "../test-utils/fake-db";

function createContext() {
  return { db: new FakeDb(), masterKey: {} as CryptoKey } as never;
}

describe("isValidProjectName", () => {
  it("accepts lowercase slug names and rejects invalid forms", () => {
    expect(isValidProjectName("alpha")).toBe(true);
    expect(isValidProjectName("alpha-2")).toBe(true);
    expect(isValidProjectName("Alpha")).toBe(false);
    expect(isValidProjectName("alpha_beta")).toBe(false);
    expect(isValidProjectName("alpha--beta")).toBe(false);
  });
});

describe("project handlers", () => {
  it("returns 400 for missing or invalid body name", async () => {
    const ctx = createContext();
    const missingNameReq = new Request("http://vault.local/projects", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    });
    const malformedReq = new Request("http://vault.local/projects", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "{not-json",
    });

    const missingNameRes = await handleCreateProject(missingNameReq, ctx);
    const malformedRes = await handleCreateProject(malformedReq, ctx);

    expect(missingNameRes.status).toBe(400);
    await expect(missingNameRes.json()).resolves.toEqual({
      error: "Body must contain a string 'name'",
    });
    expect(malformedRes.status).toBe(400);
    await expect(malformedRes.json()).resolves.toEqual({
      error: "Body must contain a string 'name'",
    });
  });

  it("returns 400 for invalid project slug", async () => {
    const ctx = createContext();
    const req = new Request("http://vault.local/projects", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: "InvalidName" }),
    });

    const res = await handleCreateProject(req, ctx);

    expect(res.status).toBe(400);
    await expect(res.json()).resolves.toEqual({
      error: "Invalid project name. Use lowercase slug format",
    });
  });

  it("creates a project and rejects duplicates", async () => {
    const ctx = createContext();
    const createReq = new Request("http://vault.local/projects", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: "infographics" }),
    });
    const duplicateReq = new Request("http://vault.local/projects", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: "infographics" }),
    });

    const createRes = await handleCreateProject(createReq, ctx);
    const duplicateRes = await handleCreateProject(duplicateReq, ctx);

    expect(createRes.status).toBe(201);
    await expect(createRes.json()).resolves.toEqual({ name: "infographics", created: true });
    expect(duplicateRes.status).toBe(409);
    await expect(duplicateRes.json()).resolves.toEqual({ error: "Project already exists" });
  });

  it("lists projects in alphabetical order", async () => {
    const ctx = createContext();
    ctx.db.query("INSERT INTO projects (name) VALUES (?1)").run("zeta");
    ctx.db.query("INSERT INTO projects (name) VALUES (?1)").run("alpha");
    ctx.db.query("INSERT INTO projects (name) VALUES (?1)").run("kilo");

    const res = handleListProjects(ctx);

    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual({ projects: ["alpha", "kilo", "zeta"] });
  });

  it("gets one project by slug", async () => {
    const ctx = createContext();
    ctx.db.query("INSERT INTO projects (name) VALUES (?1)").run("infographics");

    const foundRes = handleGetProject("infographics", ctx);
    const missingRes = handleGetProject("missing", ctx);

    expect(foundRes.status).toBe(200);
    await expect(foundRes.json()).resolves.toEqual({ name: "infographics" });
    expect(missingRes.status).toBe(404);
    await expect(missingRes.json()).resolves.toEqual({ error: "Project not found" });
  });
});
