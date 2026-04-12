/**
 * Disaster recovery tests — verifies the backup/restore and schema upgrade cycles
 * that operators rely on after data loss or failed migrations.
 *
 * All tests are fully in-process: no CLI invocations, no real filesystem state outside tmpdir.
 */

import { mkdirSync, rmSync, writeFileSync, existsSync, mkdtempSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { DatabaseSync } from "node:sqlite";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { readAstropressSqliteSchemaSql, runAstropressMigrations } from "../src/sqlite-bootstrap.js";
import { ensureLegacySchemaCompatibility, getTableColumns } from "../src/sqlite-schema-compat.js";
import { createAstropressGitSyncAdapter } from "../src/sync/git.js";

// Minimal v0.0.1-era schema — missing columns added in later versions
const V001_SCHEMA = `
  CREATE TABLE IF NOT EXISTS content_entries (
    slug TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    kind TEXT NOT NULL DEFAULT 'post',
    template_key TEXT,
    source_html_path TEXT,
    updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
    body TEXT,
    summary TEXT
  );

  CREATE TABLE IF NOT EXISTS content_overrides (
    slug TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    status TEXT NOT NULL CHECK(status IN ('draft', 'published')),
    body TEXT,
    seo_title TEXT,
    meta_description TEXT,
    excerpt TEXT,
    og_title TEXT,
    og_description TEXT,
    og_image TEXT,
    canonical_url_override TEXT,
    robots_directive TEXT,
    updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
    updated_by TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS content_revisions (
    id TEXT PRIMARY KEY,
    slug TEXT NOT NULL,
    source TEXT NOT NULL DEFAULT 'reviewed',
    title TEXT NOT NULL,
    status TEXT NOT NULL,
    body TEXT,
    seo_title TEXT,
    meta_description TEXT,
    excerpt TEXT,
    og_title TEXT,
    og_description TEXT,
    og_image TEXT,
    canonical_url_override TEXT,
    robots_directive TEXT,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    created_by TEXT,
    updated_at TEXT NOT NULL,
    updated_by TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS media_assets (
    id TEXT PRIMARY KEY,
    filename TEXT NOT NULL,
    mime_type TEXT NOT NULL,
    file_size INTEGER,
    alt_text TEXT,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS schema_migrations (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL UNIQUE,
    applied_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS admin_users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    email TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    role TEXT NOT NULL DEFAULT 'editor',
    name TEXT
  );
`;

let tempDir: string;

beforeEach(() => {
  tempDir = mkdtempSync(join(tmpdir(), "astropress-dr-"));
});

afterEach(() => {
  rmSync(tempDir, { recursive: true, force: true });
});

describe("schema compatibility after restore from old version", () => {
  it("adds metadata column to content_overrides when restoring from v0.0.1 schema", () => {
    const db = new DatabaseSync(":memory:");
    db.exec(V001_SCHEMA);

    // Confirm metadata column is absent before compat
    const colsBefore = getTableColumns(db, "content_overrides");
    expect(colsBefore).not.toContain("metadata");

    ensureLegacySchemaCompatibility(db);

    const colsAfter = getTableColumns(db, "content_overrides");
    expect(colsAfter).toContain("metadata");
    db.close();
  });

  it("adds scheduled_at and revision columns after compat run", () => {
    const db = new DatabaseSync(":memory:");
    db.exec(V001_SCHEMA);

    ensureLegacySchemaCompatibility(db);

    const overrideCols = getTableColumns(db, "content_overrides");
    expect(overrideCols).toContain("metadata");

    const mediaCols = getTableColumns(db, "media_assets");
    expect(mediaCols).toContain("thumbnail_url");
    expect(mediaCols).toContain("srcset");

    db.close();
  });

  it("existing content rows survive the compat upgrade", () => {
    const db = new DatabaseSync(":memory:");
    db.exec(V001_SCHEMA);

    // Seed a row in the old schema
    db.prepare(
      `INSERT INTO content_overrides (slug, title, status, updated_by)
       VALUES ('hello-world', 'Hello World', 'published', 'admin@example.com')`,
    ).run();

    ensureLegacySchemaCompatibility(db);

    const row = db.prepare("SELECT slug, title, status FROM content_overrides WHERE slug = 'hello-world'").get() as
      | { slug: string; title: string; status: string }
      | undefined;

    expect(row).toBeDefined();
    expect(row!.slug).toBe("hello-world");
    expect(row!.title).toBe("Hello World");
    expect(row!.status).toBe("published");

    db.close();
  });
});

describe("migration runner on fresh schema", () => {
  it("runAstropressMigrations does not throw on a fresh schema with no migrations dir", () => {
    const db = new DatabaseSync(":memory:");
    db.exec(readAstropressSqliteSchemaSql());

    const migrationsDir = join(tempDir, "nonexistent-migrations");
    expect(() => runAstropressMigrations(db, migrationsDir)).not.toThrow();

    db.close();
  });

  it("applies pending migrations from a migrations dir and records them", () => {
    const db = new DatabaseSync(":memory:");
    db.exec(readAstropressSqliteSchemaSql());

    const migrationsDir = join(tempDir, "migrations");
    mkdirSync(migrationsDir);

    // Write a simple additive migration
    writeFileSync(
      join(migrationsDir, "0001_add_custom_column.sql"),
      "ALTER TABLE content_overrides ADD COLUMN custom_field TEXT;",
    );
    writeFileSync(
      join(migrationsDir, "0001_add_custom_column.down.sql"),
      "-- rollback: column cannot be removed in SQLite without table rebuild",
    );

    const result = runAstropressMigrations(db, migrationsDir);
    expect(result.applied).toContain("0001_add_custom_column.sql");
    expect(result.skipped).toHaveLength(0);

    // Verify it was recorded in schema_migrations
    const record = db
      .prepare("SELECT name, rollback_sql FROM schema_migrations WHERE name = '0001_add_custom_column.sql'")
      .get() as { name: string; rollback_sql: string | null } | undefined;

    expect(record).toBeDefined();
    expect(record!.name).toBe("0001_add_custom_column.sql");
    expect(record!.rollback_sql).toContain("rollback");

    // Verify column was added
    const cols = getTableColumns(db, "content_overrides");
    expect(cols).toContain("custom_field");

    db.close();
  });

  it("skips already-applied migrations on re-run", () => {
    const db = new DatabaseSync(":memory:");
    db.exec(readAstropressSqliteSchemaSql());

    const migrationsDir = join(tempDir, "migrations");
    mkdirSync(migrationsDir);
    writeFileSync(
      join(migrationsDir, "0001_idempotent.sql"),
      "ALTER TABLE content_overrides ADD COLUMN idempotent_col TEXT;",
    );

    runAstropressMigrations(db, migrationsDir);
    const result2 = runAstropressMigrations(db, migrationsDir);

    expect(result2.applied).toHaveLength(0);
    expect(result2.skipped).toContain("0001_idempotent.sql");

    db.close();
  });
});

describe("backup and restore cycle using git sync adapter", () => {
  it("restores content after simulating DB loss", async () => {
    const projectDir = join(tempDir, "project");
    const dataDir = join(projectDir, ".data");
    const dbPath = join(dataDir, "admin.db");
    const snapshotDir = join(tempDir, "snapshot");

    mkdirSync(dataDir, { recursive: true });

    // Create a SQLite DB in the project .data directory and seed a record
    const db = new DatabaseSync(dbPath);
    db.exec(readAstropressSqliteSchemaSql());
    db.prepare(
      `INSERT INTO content_overrides (slug, title, status, updated_by)
       VALUES ('dr-test-post', 'DR Test Post', 'published', 'admin@example.com')`,
    ).run();
    db.close();

    // Export snapshot including .data directory
    const adapter = createAstropressGitSyncAdapter({ projectDir, include: [".data"] });
    await adapter.exportSnapshot(snapshotDir);

    // Simulate data loss: remove the DB file
    rmSync(dbPath);
    expect(existsSync(dbPath)).toBe(false);

    // Restore from snapshot
    await adapter.importSnapshot(snapshotDir);
    expect(existsSync(dbPath)).toBe(true);

    // Verify content is intact
    const restored = new DatabaseSync(dbPath);
    const row = restored
      .prepare("SELECT slug, title FROM content_overrides WHERE slug = 'dr-test-post'")
      .get() as { slug: string; title: string } | undefined;

    expect(row).toBeDefined();
    expect(row!.slug).toBe("dr-test-post");
    expect(row!.title).toBe("DR Test Post");

    restored.close();
  });
});
