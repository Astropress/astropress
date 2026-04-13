/**
 * Upgrade path E2E tests — verifies schema migration, compat layer, and rollback round-trips.
 *
 * All tests are fully in-process: DatabaseSync + real schema SQL, no CLI invocations.
 */

import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { DatabaseSync } from "node:sqlite";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { mkdtempSync, rmSync } from "node:fs";

import {
  runAstropressMigrations,
  rollbackAstropressLastMigration,
  checkSchemaVersionAhead,
} from "../src/sqlite-bootstrap.js";
import { ensureLegacySchemaCompatibility, getTableColumns } from "../src/sqlite-schema-compat.js";
import { makeDb } from "./helpers/make-db.js";

// Minimal v0.0.1 schema — mirrors what a real pre-upgrade backup would contain
const V001_SCHEMA = `
  CREATE TABLE IF NOT EXISTS content_entries (
    slug TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    kind TEXT NOT NULL DEFAULT 'post'
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
    mime_type TEXT NOT NULL
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
    role TEXT NOT NULL DEFAULT 'editor'
  );
`;

let tempDir: string;

beforeEach(() => {
  tempDir = mkdtempSync(join(tmpdir(), "astropress-upgrade-"));
});

afterEach(() => {
  rmSync(tempDir, { recursive: true, force: true });
});

describe("compat upgrade: old schema → current schema", () => {
  it("ensureLegacySchemaCompatibility adds metadata and scheduled_at to v0.0.1 schema", () => {
    const db = new DatabaseSync(":memory:");
    db.exec(V001_SCHEMA);

    const overrideCols = getTableColumns(db, "content_overrides");
    expect(overrideCols).not.toContain("metadata");

    ensureLegacySchemaCompatibility(db);

    const colsAfter = getTableColumns(db, "content_overrides");
    expect(colsAfter).toContain("metadata");
    expect(colsAfter).toContain("scheduled_at");
    db.close();
  });

  it("content rows survive the compat upgrade", () => {
    const db = new DatabaseSync(":memory:");
    db.exec(V001_SCHEMA);

    db.prepare(
      `INSERT INTO content_overrides (slug, title, status, updated_by)
       VALUES ('surviving-post', 'Surviving Post', 'published', 'admin@example.com')`,
    ).run();

    ensureLegacySchemaCompatibility(db);

    const row = db
      .prepare("SELECT slug, title FROM content_overrides WHERE slug = 'surviving-post'")
      .get() as { slug: string; title: string } | undefined;

    expect(row?.slug).toBe("surviving-post");
    expect(row?.title).toBe("Surviving Post");
    db.close();
  });
});

describe("migration runner", () => {
  it("applies pending migrations and records them in schema_migrations", () => {
    const db = makeDb();

    const migrationsDir = join(tempDir, "migrations");
    mkdirSync(migrationsDir);
    writeFileSync(
      join(migrationsDir, "0001_add_test_column.sql"),
      "ALTER TABLE content_overrides ADD COLUMN upgrade_test_col TEXT;",
    );
    writeFileSync(
      join(migrationsDir, "0001_add_test_column.down.sql"),
      "-- cannot drop column in SQLite",
    );

    const result = runAstropressMigrations(db, migrationsDir);
    expect(result.applied).toContain("0001_add_test_column.sql");

    const cols = getTableColumns(db, "content_overrides");
    expect(cols).toContain("upgrade_test_col");
    db.close();
  });

  it("rollbackAstropressLastMigration removes the last migration record", () => {
    const db = makeDb();

    const migrationsDir = join(tempDir, "migrations");
    mkdirSync(migrationsDir);
    writeFileSync(
      join(migrationsDir, "0001_rollback_test.sql"),
      "ALTER TABLE content_overrides ADD COLUMN rollback_test_col TEXT;",
    );
    writeFileSync(
      join(migrationsDir, "0001_rollback_test.down.sql"),
      "-- rollback: column removal not supported in SQLite without table rebuild",
    );

    runAstropressMigrations(db, migrationsDir);

    const beforeCount = (db.prepare("SELECT COUNT(*) as c FROM schema_migrations").get() as { c: number }).c;
    const rolledBack = rollbackAstropressLastMigration(db);
    const afterCount = (db.prepare("SELECT COUNT(*) as c FROM schema_migrations").get() as { c: number }).c;

    expect(rolledBack).toBe("0001_rollback_test.sql");
    expect(afterCount).toBe(beforeCount - 1);
    db.close();
  });
});

describe("checkSchemaVersionAhead", () => {
  it("returns isAhead:true when DB has more migrations than the baseline", () => {
    const db = makeDb();

    const migrationsDir = join(tempDir, "migrations");
    mkdirSync(migrationsDir);
    for (let i = 1; i <= 5; i++) {
      writeFileSync(
        join(migrationsDir, `000${i}_migration.sql`),
        `ALTER TABLE content_overrides ADD COLUMN extra_col_${i} TEXT;`,
      );
    }

    runAstropressMigrations(db, migrationsDir);

    const result = checkSchemaVersionAhead(db, 1);
    expect(result).not.toBeNull();
    expect(result!.isAhead).toBe(true);
    expect(result!.dbCount).toBeGreaterThan(1);
    db.close();
  });

  it("returns isAhead:false on a fresh schema with no extra migrations", () => {
    const db = makeDb();

    // No migrations applied — baseline is 1 (framework migration)
    const result = checkSchemaVersionAhead(db, 1);
    expect(result).not.toBeNull();
    // The fresh schema has 0 rows in schema_migrations (framework uses ensureLegacySchemaCompatibility, not migrations table)
    expect(result!.isAhead).toBe(false);
    db.close();
  });
});
