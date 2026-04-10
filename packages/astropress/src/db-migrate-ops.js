import { DatabaseSync } from "node:sqlite";
import { readAstropressSqliteSchemaSql, runAstropressMigrations } from "./sqlite-bootstrap.js";

export function runAstropressDbMigrationsForCli(input) {
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
