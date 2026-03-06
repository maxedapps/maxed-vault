import { beforeAll, describe, expect, it } from "vitest";
import { deriveMasterKey, generateSalt } from "../crypto";
import {
  handleDeleteSecret,
  handleGetSecret,
  handleGetProjectEnv,
  handleListSecrets,
  handleSetSecret,
} from "./secrets";
import { FakeDb } from "../test-utils/fake-db";

let masterKey: CryptoKey;

beforeAll(async () => {
  masterKey = await deriveMasterKey("test-passphrase", generateSalt());
});

function createContext() {
  return { db: new FakeDb(), masterKey } as never;
}

function insertProject(ctx: { db: FakeDb }, name: string): void {
  ctx.db.query("INSERT INTO projects (name) VALUES (?1)").run(name);
}

async function putSecret(
  ctx: { db: FakeDb; masterKey: CryptoKey },
  project: string,
  name: string,
  value: string,
): Promise<Response> {
  return handleSetSecret(
    new Request("http://vault.local/put", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ value }),
    }),
    project,
    name,
    ctx,
  );
}

describe("secret handlers", () => {
  it("returns project-not-found across all handlers when project is missing", async () => {
    const ctx = createContext();
    const listRes = handleListSecrets("missing", new URL("http://vault.local/?prefix=A"), ctx);
    const envRes = await handleGetProjectEnv("missing", ctx);
    const getRes = await handleGetSecret("missing", "TOKEN", ctx);
    const setRes = await putSecret(ctx, "missing", "TOKEN", "value");
    const deleteRes = handleDeleteSecret("missing", "TOKEN", ctx);

    expect(listRes.status).toBe(404);
    await expect(listRes.json()).resolves.toEqual({ error: "Project not found" });
    expect(envRes.status).toBe(404);
    await expect(envRes.json()).resolves.toEqual({ error: "Project not found" });
    expect(getRes.status).toBe(404);
    await expect(getRes.json()).resolves.toEqual({ error: "Project not found" });
    expect(setRes.status).toBe(404);
    await expect(setRes.json()).resolves.toEqual({ error: "Project not found" });
    expect(deleteRes.status).toBe(404);
    await expect(deleteRes.json()).resolves.toEqual({ error: "Project not found" });
  });

  it("filters listed secret names by prefix", async () => {
    const ctx = createContext();
    insertProject(ctx, "infographics");
    await putSecret(ctx, "infographics", "APP_KEY", "a");
    await putSecret(ctx, "infographics", "APP_TOKEN", "b");
    await putSecret(ctx, "infographics", "DB_PASS", "c");

    const res = handleListSecrets(
      "infographics",
      new URL("http://vault.local/projects/infographics/secrets?prefix=APP"),
      ctx,
    );

    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual({
      project: "infographics",
      names: ["APP_KEY", "APP_TOKEN"],
    });
  });

  it("returns decrypted secrets for env export", async () => {
    const ctx = createContext();
    insertProject(ctx, "infographics");
    await putSecret(ctx, "infographics", "TOKEN", "secret-token");
    await putSecret(ctx, "infographics", "WEBHOOK_SECRET", "whs-123");

    const res = await handleGetProjectEnv("infographics", ctx);

    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual({
      project: "infographics",
      secrets: [
        { name: "TOKEN", value: "secret-token" },
        { name: "WEBHOOK_SECRET", value: "whs-123" },
      ],
    });
  });

  it("gets a secret value and returns 404 when missing", async () => {
    const ctx = createContext();
    insertProject(ctx, "infographics");
    await putSecret(ctx, "infographics", "TOKEN", "secret-token");

    const foundRes = await handleGetSecret("infographics", "TOKEN", ctx);
    const missingRes = await handleGetSecret("infographics", "UNKNOWN", ctx);
    const found = (await foundRes.json()) as {
      project: string;
      name: string;
      value: string;
      updated_at: string;
    };

    expect(foundRes.status).toBe(200);
    expect(found.project).toBe("infographics");
    expect(found.name).toBe("TOKEN");
    expect(found.value).toBe("secret-token");
    expect(found.updated_at).toEqual(expect.any(String));

    expect(missingRes.status).toBe(404);
    await expect(missingRes.json()).resolves.toEqual({ error: "Secret not found" });
  });

  it("rejects invalid secret names on set", async () => {
    const ctx = createContext();
    insertProject(ctx, "infographics");

    const res = await putSecret(ctx, "infographics", "bad-key", "secret-token");

    expect(res.status).toBe(400);
    await expect(res.json()).resolves.toEqual({
      error:
        "Invalid secret name. Use environment-variable-safe format: letters/underscores, then letters/digits/underscores",
    });
  });

  it("creates and then updates a secret", async () => {
    const ctx = createContext();
    insertProject(ctx, "infographics");

    const createRes = await putSecret(ctx, "infographics", "TOKEN", "v1");
    const updateRes = await putSecret(ctx, "infographics", "TOKEN", "v2");
    const getRes = await handleGetSecret("infographics", "TOKEN", ctx);

    expect(createRes.status).toBe(201);
    await expect(createRes.json()).resolves.toEqual({
      project: "infographics",
      name: "TOKEN",
      created: true,
    });

    expect(updateRes.status).toBe(200);
    await expect(updateRes.json()).resolves.toEqual({
      project: "infographics",
      name: "TOKEN",
      created: false,
    });

    await expect(getRes.json()).resolves.toEqual({
      project: "infographics",
      name: "TOKEN",
      value: "v2",
      updated_at: expect.any(String),
    });
  });

  it("deletes a secret and returns not-found when deleting again", async () => {
    const ctx = createContext();
    insertProject(ctx, "infographics");
    await putSecret(ctx, "infographics", "TOKEN", "secret-token");

    const deleteRes = handleDeleteSecret("infographics", "TOKEN", ctx);
    const missingRes = handleDeleteSecret("infographics", "TOKEN", ctx);

    expect(deleteRes.status).toBe(200);
    await expect(deleteRes.json()).resolves.toEqual({
      project: "infographics",
      name: "TOKEN",
      deleted: true,
    });

    expect(missingRes.status).toBe(404);
    await expect(missingRes.json()).resolves.toEqual({ error: "Secret not found" });
  });
});
