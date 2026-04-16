import { describe, it, expect, beforeEach } from "vitest";
import { runD1Migrations, rollbackD1LastMigration } from "../src/d1-migrate-ops.js";
import type { D1DatabaseLike, D1PreparedStatement, D1Result } from "../src/d1-database.js";
import path from "node:path";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";

// ── Minimal D1 mock backed by an in-memory SQLite ──────────────────────────

import { DatabaseSync } from "node:sqlite";

function createMockD1(db: DatabaseSync): D1DatabaseLike {
  const prepared = (query: string): D1PreparedStatement => {
    let boundArgs: unknown[] = [];
    const stmt: D1PreparedStatement = {
      bind(...values) {
        boundArgs = values;
        return stmt;
      },
      async first<T>() {
        const s = db.prepare(query);
        const row = s.get(...boundArgs) as T | undefined;
        return row ?? null;
      },
      async all<T>() {
        const s = db.prepare(query);
        const results = s.all(...boundArgs) as T[];
        return { success: true, results, meta: {} } satisfies D1Result<T>;
      },
      async run<T>() {
        const s = db.prepare(query);
        s.run(...boundArgs);
        return { success: true, results: [] as T[], meta: {} } satisfies D1Result<T>;
      },
    };
    return stmt;
  };

  return {
    prepare: (query: string) => prepared(query),
    async batch(statements) {
      // Execute each statement sequentially (SQLite can't truly batch, but semantics match)
      const results: D1Result[] = [];
      for (const stmt of statements) {
        results.push(await stmt.run());
      }
      return results;
    },
  };
}

// ── Helpers ─────────────────────────────────────────────────────────────────

function makeMigrationsDir(files: Record<string, string>): string {
  const dir = mkdtempSync(path.join(tmpdir(), "d1-migrate-test-"));
  for (const [name, content] of Object.entries(files)) {
    writeFileSync(path.join(dir, name), content, "utf8");
  }
  return dir;
}

// ── Tests ────────────────────────────────────────────────────────────────────

describe("runD1Migrations", () => {
  let db: DatabaseSync;
  let d1: D1DatabaseLike;

  beforeEach(() => {
    db = new DatabaseSync(":memory:");
    d1 = createMockD1(db);
  });

  it("applies a pending migration and records it in schema_migrations", async () => {
    const dir = makeMigrationsDir({
      "0001_create_posts.sql": "CREATE TABLE posts (id INTEGER PRIMARY KEY, title TEXT NOT NULL)",
    });

    const report = await runD1Migrations({ db: d1, migrationsDir: dir });

    expect(report.applied).toEqual(["0001_create_posts.sql"]);
    expect(report.skipped).toEqual([]);
    expect(report.dryRun).toBe(false);

    // Table was actually created
    const row = db.prepare("SELECT name FROM schema_migrations WHERE name = ?").get("0001_create_posts.sql") as { name: string } | undefined;
    expect(row?.name).toBe("0001_create_posts.sql");
  });

  it("skips already-applied migrations", async () => {
    const dir = makeMigrationsDir({
      "0001_create_posts.sql": "CREATE TABLE posts (id INTEGER PRIMARY KEY)",
    });

    await runD1Migrations({ db: d1, migrationsDir: dir });
    const second = await runD1Migrations({ db: d1, migrationsDir: dir });

    expect(second.applied).toEqual([]);
    expect(second.skipped).toEqual(["0001_create_posts.sql"]);
  });

  it("applies migrations in lexicographic order", async () => {
    const dir = makeMigrationsDir({
      "0002_add_status.sql": "ALTER TABLE posts ADD COLUMN status TEXT DEFAULT 'draft'",
      "0001_create_posts.sql": "CREATE TABLE posts (id INTEGER PRIMARY KEY, title TEXT)",
    });

    const report = await runD1Migrations({ db: d1, migrationsDir: dir });

    expect(report.applied).toEqual(["0001_create_posts.sql", "0002_add_status.sql"]);
  });

  it("dry-run mode reports what would be applied without writing", async () => {
    const dir = makeMigrationsDir({
      "0001_create_posts.sql": "CREATE TABLE posts (id INTEGER PRIMARY KEY)",
    });

    const report = await runD1Migrations({ db: d1, migrationsDir: dir, dryRun: true });

    expect(report.applied).toEqual(["0001_create_posts.sql"]);
    expect(report.dryRun).toBe(true);

    // Table was NOT created — dry-run means no writes
    expect(() => db.prepare("SELECT * FROM posts").all()).toThrow();
  });

  it("stores rollback_sql from companion .down.sql file", async () => {
    const dir = makeMigrationsDir({
      "0001_create_posts.sql": "CREATE TABLE posts (id INTEGER PRIMARY KEY)",
      "0001_create_posts.down.sql": "DROP TABLE posts",
    });

    await runD1Migrations({ db: d1, migrationsDir: dir });

    const row = db
      .prepare("SELECT rollback_sql FROM schema_migrations WHERE name = ?")
      .get("0001_create_posts.sql") as { rollback_sql: string } | undefined;
    expect(row?.rollback_sql?.trim()).toBe("DROP TABLE posts");
  });

  it("returns empty report when migrationsDir does not exist", async () => {
    const report = await runD1Migrations({ db: d1, migrationsDir: "/nonexistent/path/xyz" });
    expect(report.applied).toEqual([]);
    expect(report.skipped).toEqual([]);
  });
});

describe("rollbackD1LastMigration", () => {
  let db: DatabaseSync;
  let d1: D1DatabaseLike;

  beforeEach(() => {
    db = new DatabaseSync(":memory:");
    d1 = createMockD1(db);
  });

  it("rolls back the last migration using its rollback_sql", async () => {
    const dir = makeMigrationsDir({
      "0001_create_posts.sql": "CREATE TABLE posts (id INTEGER PRIMARY KEY, title TEXT)",
      "0001_create_posts.down.sql": "DROP TABLE posts",
    });

    await runD1Migrations({ db: d1, migrationsDir: dir });

    // Verify table exists before rollback
    expect(() => db.prepare("SELECT * FROM posts").all()).not.toThrow();

    const report = await rollbackD1LastMigration(d1);

    expect(report.migrationName).toBe("0001_create_posts.sql");
    expect(report.status).toBe("rolled_back");
    expect(report.dryRun).toBe(false);

    // Table was dropped
    expect(() => db.prepare("SELECT * FROM posts").all()).toThrow();
    // Migration record removed
    const row = db.prepare("SELECT * FROM schema_migrations").all();
    expect(row).toHaveLength(0);
  });

  it("returns no_rollback_sql when last migration has no .down.sql", async () => {
    const dir = makeMigrationsDir({
      "0001_create_posts.sql": "CREATE TABLE posts (id INTEGER PRIMARY KEY)",
    });
    await runD1Migrations({ db: d1, migrationsDir: dir });

    const report = await rollbackD1LastMigration(d1);

    expect(report.status).toBe("no_rollback_sql");
    expect(report.migrationName).toBe("0001_create_posts.sql");
  });

  it("returns no_migrations when schema_migrations is empty", async () => {
    // Bootstrap table so prepare succeeds, but leave it empty
    const dir = makeMigrationsDir({});
    await runD1Migrations({ db: d1, migrationsDir: dir });

    const report = await rollbackD1LastMigration(d1);
    expect(report.status).toBe("no_migrations");
  });

  it("dry-run returns the migration name without applying rollback", async () => {
    const dir = makeMigrationsDir({
      "0001_create_posts.sql": "CREATE TABLE posts (id INTEGER PRIMARY KEY)",
      "0001_create_posts.down.sql": "DROP TABLE posts",
    });
    await runD1Migrations({ db: d1, migrationsDir: dir });

    const report = await rollbackD1LastMigration(d1, { dryRun: true });

    expect(report.status).toBe("dry_run");
    expect(report.dryRun).toBe(true);
    // Table still exists — rollback was not applied
    expect(() => db.prepare("SELECT * FROM posts").all()).not.toThrow();
  });

  it("re-enables re-apply after successful rollback", async () => {
    const dir = makeMigrationsDir({
      "0001_create_posts.sql": "CREATE TABLE posts (id INTEGER PRIMARY KEY, title TEXT)",
      "0001_create_posts.down.sql": "DROP TABLE posts",
    });

    await runD1Migrations({ db: d1, migrationsDir: dir });
    await rollbackD1LastMigration(d1);

    // Applying again should work
    const second = await runD1Migrations({ db: d1, migrationsDir: dir });
    expect(second.applied).toEqual(["0001_create_posts.sql"]);
  });
});

describe("D1 migration report shape matches SQLite report shape", () => {
  it("runD1Migrations returns { migrationsDir, applied, skipped, dryRun }", async () => {
    const db = new DatabaseSync(":memory:");
    const d1 = createMockD1(db);
    const report = await runD1Migrations({ db: d1, migrationsDir: "/nonexistent" });
    expect(report).toMatchObject({
      migrationsDir: expect.any(String),
      applied: expect.any(Array),
      skipped: expect.any(Array),
      dryRun: expect.any(Boolean),
    });
  });
});
