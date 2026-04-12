import { existsSync, readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import type { D1DatabaseLike } from "./d1-database.js";

export interface D1MigrateInput {
  db: D1DatabaseLike;
  migrationsDir: string;
  dryRun?: boolean;
}

export interface D1MigrateReport {
  migrationsDir: string;
  applied: string[];
  skipped: string[];
  dryRun: boolean;
}

export type D1RollbackStatus = "rolled_back" | "no_rollback_sql" | "no_migrations" | "dry_run";

export interface D1RollbackReport {
  migrationName: string | null;
  status: D1RollbackStatus;
  dryRun: boolean;
}

/**
 * Split a SQL string into individual statements by top-level semicolons.
 * Skips empty segments and SQL comment-only segments.
 */
function splitSqlStatements(sql: string): string[] {
  return sql
    .split(";")
    .map((s) => s.trim())
    .filter((s) => s.length > 0 && !s.startsWith("--") && !/^\/\*/.test(s));
}

/**
 * Ensures the `schema_migrations` table exists in D1 and returns the set of
 * already-applied migration names.
 */
async function bootstrapD1MigrationsTable(db: D1DatabaseLike): Promise<Set<string>> {
  await db.batch([
    db.prepare(`CREATE TABLE IF NOT EXISTS schema_migrations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE,
      applied_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      rollback_sql TEXT
    )`),
  ]);

  const result = await db.prepare("SELECT name FROM schema_migrations").all<{ name: string }>();
  return new Set(result.results.map((r) => r.name));
}

/**
 * Applies pending schema migrations to a Cloudflare D1 database.
 *
 * Migration files must be named with a numeric prefix (e.g. `0001_add_column.sql`).
 * They are applied in lexicographic order. Applied migrations are recorded in
 * `schema_migrations` so they are never re-run.
 *
 * Companion `.down.sql` files are read alongside each migration and stored as
 * `rollback_sql` in `schema_migrations`, enabling `rollbackD1LastMigration`.
 *
 * In `dryRun` mode no writes are performed — the function returns what would have
 * been applied.
 */
export async function runD1Migrations(input: D1MigrateInput): Promise<D1MigrateReport> {
  const { db, migrationsDir, dryRun = false } = input;
  const applied: string[] = [];
  const skipped: string[] = [];

  if (!existsSync(migrationsDir)) {
    return { migrationsDir, applied, skipped, dryRun };
  }

  const migrationFiles = readdirSync(migrationsDir)
    .filter((f) => f.endsWith(".sql") && !f.endsWith(".down.sql"))
    .sort();

  if (migrationFiles.length === 0) {
    return { migrationsDir, applied, skipped, dryRun };
  }

  const alreadyApplied = await bootstrapD1MigrationsTable(db);

  for (const file of migrationFiles) {
    if (alreadyApplied.has(file)) {
      skipped.push(file);
      continue;
    }

    const sql = readFileSync(path.join(migrationsDir, file), "utf8");
    const statements = splitSqlStatements(sql);

    const downFilePath = path.join(migrationsDir, file.replace(/\.sql$/, ".down.sql"));
    const rollbackSql = existsSync(downFilePath) ? readFileSync(downFilePath, "utf8") : null;

    if (!dryRun) {
      const batch = [
        ...statements.map((stmt) => db.prepare(stmt)),
        db.prepare("INSERT INTO schema_migrations (name, rollback_sql) VALUES (?, ?)").bind(file, rollbackSql),
      ];
      await db.batch(batch);
    }

    applied.push(file);
  }

  return { migrationsDir, applied, skipped, dryRun };
}

/**
 * Rolls back the most recently applied D1 migration using its stored `rollback_sql`.
 *
 * Executes the rollback SQL as a batch and removes the migration record. If the
 * last migration has no rollback SQL, returns `status: "no_rollback_sql"` without
 * modifying the database.
 */
export async function rollbackD1LastMigration(
  db: D1DatabaseLike,
  { dryRun = false }: { dryRun?: boolean } = {},
): Promise<D1RollbackReport> {
  let last: { name: string; rollback_sql: string | null } | null = null;

  try {
    last = await db
      .prepare("SELECT name, rollback_sql FROM schema_migrations ORDER BY id DESC LIMIT 1")
      .first<{ name: string; rollback_sql: string | null }>();
  } catch {
    return { migrationName: null, status: "no_migrations", dryRun };
  }

  if (!last) return { migrationName: null, status: "no_migrations", dryRun };
  if (!last.rollback_sql) return { migrationName: last.name, status: "no_rollback_sql", dryRun };

  if (dryRun) return { migrationName: last.name, status: "dry_run", dryRun: true };

  const rollbackStatements = splitSqlStatements(last.rollback_sql);
  await db.batch([
    ...rollbackStatements.map((stmt) => db.prepare(stmt)),
    db.prepare("DELETE FROM schema_migrations WHERE name = ?").bind(last.name),
  ]);

  return { migrationName: last.name, status: "rolled_back", dryRun: false };
}
