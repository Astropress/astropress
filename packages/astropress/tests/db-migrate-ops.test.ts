import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { DatabaseSync } from "node:sqlite";

import { describe, expect, it } from "vitest";

import { runAstropressDbMigrationsForCli } from "../src/db-migrate-ops.js";
import { readAstropressSqliteSchemaSql } from "../src/sqlite-bootstrap.js";

describe("db-migrate-ops", () => {
  function setupDb(dir: string): string {
    const dbPath = join(dir, "admin.sqlite");
    const db = new DatabaseSync(dbPath);
    db.exec(readAstropressSqliteSchemaSql());
    db.close();
    return dbPath;
  }

  it("applies migrations and returns applied/skipped lists", () => {
    const dir = mkdtempSync(join(tmpdir(), "astropress-db-migrate-"));
    const migrationsDir = join(dir, "migrations");
    mkdirSync(migrationsDir);
    writeFileSync(join(migrationsDir, "0001_add_feature.sql"), "CREATE TABLE IF NOT EXISTS feature_flags (id INTEGER PRIMARY KEY);");
    writeFileSync(join(migrationsDir, "0002_add_index.sql"), "CREATE INDEX IF NOT EXISTS idx_content_slug ON ap_content_records (slug);");

    const dbPath = setupDb(dir);
    const report = runAstropressDbMigrationsForCli({ dbPath, migrationsDir });

    expect(report.applied).toEqual(["0001_add_feature.sql", "0002_add_index.sql"]);
    expect(report.skipped).toEqual([]);
    expect(report.dryRun).toBe(false);

    // Re-running skips already-applied migrations
    const report2 = runAstropressDbMigrationsForCli({ dbPath, migrationsDir });
    expect(report2.applied).toEqual([]);
    expect(report2.skipped).toEqual(["0001_add_feature.sql", "0002_add_index.sql"]);

    rmSync(dir, { recursive: true });
  });

  it("dry-run does not write to the real database", () => {
    const dir = mkdtempSync(join(tmpdir(), "astropress-db-migrate-dry-"));
    const migrationsDir = join(dir, "migrations");
    mkdirSync(migrationsDir);
    writeFileSync(join(migrationsDir, "0001_dry.sql"), "CREATE TABLE IF NOT EXISTS dry_table (id INTEGER PRIMARY KEY);");

    const dbPath = setupDb(dir);
    const report = runAstropressDbMigrationsForCli({ dbPath, migrationsDir, dryRun: true });

    expect(report.applied).toEqual(["0001_dry.sql"]);
    expect(report.dryRun).toBe(true);

    // Real DB should NOT have the migration recorded (dry-run uses in-memory DB)
    const db = new DatabaseSync(dbPath);
    const rows = db.prepare("SELECT name FROM schema_migrations WHERE name = '0001_dry.sql'").all();
    db.close();
    expect(rows).toHaveLength(0);

    rmSync(dir, { recursive: true });
  });

  it("returns empty applied/skipped when migrations directory does not exist", () => {
    const dir = mkdtempSync(join(tmpdir(), "astropress-db-migrate-empty-"));
    const dbPath = setupDb(dir);
    const report = runAstropressDbMigrationsForCli({ dbPath, migrationsDir: join(dir, "no-such-dir") });

    expect(report.applied).toEqual([]);
    expect(report.skipped).toEqual([]);

    rmSync(dir, { recursive: true });
  });
});
