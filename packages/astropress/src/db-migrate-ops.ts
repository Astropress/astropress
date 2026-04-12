import { DatabaseSync } from "node:sqlite";
import { readAstropressSqliteSchemaSql, runAstropressMigrations, rollbackAstropressLastMigrationWithOptions } from "./sqlite-bootstrap.js";

export interface AstropressDbMigrateInput {
  dbPath: string;
  migrationsDir: string;
  dryRun?: boolean;
}

export interface AstropressDbMigrateReport {
  dbPath: string;
  migrationsDir: string;
  applied: string[];
  skipped: string[];
  dryRun: boolean;
}

export function runAstropressDbMigrationsForCli(
  input: AstropressDbMigrateInput,
): AstropressDbMigrateReport {
  const { dbPath, migrationsDir, dryRun = false } = input;

  if (dryRun) {
    // In dry-run mode, use an in-memory DB to simulate the migration without touching the real DB
    const memDb = new DatabaseSync(":memory:");
    memDb.exec(readAstropressSqliteSchemaSql());
    const result = runAstropressMigrations(memDb, migrationsDir);
    memDb.close();
    return { dbPath, migrationsDir, ...result, dryRun: true };
  }

  const db = new DatabaseSync(dbPath);
  const result = runAstropressMigrations(db, migrationsDir);
  db.close();
  return { dbPath, migrationsDir, ...result, dryRun: false };
}

export interface AstropressDbRollbackInput {
  dbPath: string;
  dryRun?: boolean;
}

export type AstropressDbRollbackStatus =
  | "rolled_back"
  | "no_rollback_sql"
  | "no_migrations"
  | "dry_run";

export interface AstropressDbRollbackReport {
  dbPath: string;
  migrationName: string | null;
  status: AstropressDbRollbackStatus;
  dryRun: boolean;
}

/**
 * Rolls back the last applied schema migration using its stored `rollback_sql`.
 *
 * Reads the most recently applied migration from `schema_migrations`, executes
 * its `rollback_sql`, then deletes the migration record. If no `rollback_sql`
 * was stored (i.e. the migration has no companion `.down.sql` file), returns
 * `status: "no_rollback_sql"` without modifying the database.
 */
export function rollbackAstropressLastMigration(
  input: AstropressDbRollbackInput,
): AstropressDbRollbackReport {
  const { dbPath, dryRun = false } = input;

  const db = new DatabaseSync(dbPath);

  try {
    const result = rollbackAstropressLastMigrationWithOptions(db, { dryRun });
    return { dbPath, ...result };
  } finally {
    db.close();
  }
}
