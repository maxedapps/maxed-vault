import { describe, expect, it, vi } from "vitest";

const databaseCtorMock = vi.hoisted(() =>
  vi.fn(function MockDatabase(this: { exec: ReturnType<typeof vi.fn> }) {
    this.exec = execMock;
  }),
);
const execMock = vi.hoisted(() => vi.fn());

vi.mock("bun:sqlite", () => ({
  Database: databaseCtorMock,
}));

describe("initDatabase", () => {
  it("constructs sqlite DB with expected pragmas and schema", async () => {
    databaseCtorMock.mockReset();
    databaseCtorMock.mockImplementation(function MockDatabase(this: { exec: ReturnType<typeof vi.fn> }) {
      this.exec = execMock;
    });
    execMock.mockReset();

    const { initDatabase } = await import("./db");
    const db = initDatabase("/tmp/maxedvault-test.db");

    expect(db).toBeDefined();
    expect(databaseCtorMock).toHaveBeenCalledWith("/tmp/maxedvault-test.db", { create: true });
    expect(execMock).toHaveBeenCalledTimes(3);
    expect(execMock).toHaveBeenNthCalledWith(1, "PRAGMA journal_mode = WAL");
    expect(execMock).toHaveBeenNthCalledWith(2, "PRAGMA foreign_keys = ON");

    const schema = execMock.mock.calls[2]?.[0] as string;
    expect(schema).toContain("CREATE TABLE IF NOT EXISTS projects");
    expect(schema).toContain("CREATE TABLE IF NOT EXISTS secrets");
    expect(schema).toContain("CREATE INDEX IF NOT EXISTS idx_projects_name");
    expect(schema).toContain("CREATE INDEX IF NOT EXISTS idx_secrets_project_name");
  });
});
