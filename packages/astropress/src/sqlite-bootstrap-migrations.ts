import { existsSync, readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import type {
	AstropressRollbackResult,
	SqliteDatabaseLike,
} from "./sqlite-bootstrap-helpers";

/**
 * Run incremental SQL migrations from a directory against a live SQLite database.
 *
 * Migration files must be named with a numeric prefix (e.g. `0001_add_column.sql`).
 * They are applied in lexicographic order. Applied migrations are recorded in
 * `schema_migrations` so they are never re-run.
 */
export function runAstropressMigrations(
	db: SqliteDatabaseLike,
	migrationsDir: string,
): { applied: string[]; skipped: string[] } {
	const applied: string[] = [];
	const skipped: string[] = [];

	db.exec(`CREATE TABLE IF NOT EXISTS schema_migrations (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL UNIQUE,
    applied_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    rollback_sql TEXT
  )`);

	const migrationCols = new Set(
		(
			db.prepare("PRAGMA table_info(schema_migrations)").all() as Array<{
				name: string;
			}>
		).map((r) => r.name),
	);
	if (!migrationCols.has("rollback_sql")) {
		db.exec("ALTER TABLE schema_migrations ADD COLUMN rollback_sql TEXT");
	}

	const alreadyApplied = new Set(
		(
			db.prepare("SELECT name FROM schema_migrations").all() as Array<{
				name: string;
			}>
		).map((r) => r.name),
	);

	if (!existsSync(migrationsDir)) return { applied, skipped };

	for (const file of readdirSync(migrationsDir)
		.filter((f) => f.endsWith(".sql"))
		.sort()) {
		if (alreadyApplied.has(file)) {
			skipped.push(file);
			continue;
		}
		const sql = readFileSync(path.join(migrationsDir, file), "utf8");
		db.exec(sql);

		const downFilePath = path.join(
			migrationsDir,
			file.replace(/\.sql$/, ".down.sql"),
		);
		const rollbackSql = existsSync(downFilePath)
			? readFileSync(downFilePath, "utf8")
			: null;
		db.prepare(
			"INSERT INTO schema_migrations (name, rollback_sql) VALUES (?, ?)",
		).run(file, rollbackSql);
		applied.push(file);
	}

	return { applied, skipped };
}

/**
 * The number of framework-owned migrations Astropress applies during bootstrapping.
 * Used by `checkSchemaVersionAhead` to detect host-app migrations.
 */
export const ASTROPRESS_FRAMEWORK_MIGRATION_BASELINE = 1;

/**
 * Checks whether the database `schema_migrations` table has more entries than the
 * framework's known baseline.
 */
export function checkSchemaVersionAhead(
	db: SqliteDatabaseLike,
	frameworkBaseline = ASTROPRESS_FRAMEWORK_MIGRATION_BASELINE,
): { isAhead: boolean; dbCount: number; frameworkCount: number } | null {
	try {
		const row = db
			.prepare("SELECT COUNT(*) as count FROM schema_migrations")
			.get() as { count: number } | undefined;
		if (!row) return null;
		return {
			isAhead: row.count > frameworkBaseline,
			dbCount: row.count,
			frameworkCount: frameworkBaseline,
		};
	} catch {
		return null;
	}
}

/**
 * Rolls back the most recently applied migration by executing its `rollback_sql` and
 * removing its record from `schema_migrations`. Returns the name of the rolled-back
 * migration, or `null` if there are no applied migrations or the last one has no rollback SQL.
 */
export function rollbackAstropressLastMigration(
	db: SqliteDatabaseLike,
): string | null {
	const last = db
		.prepare(
			"SELECT name, rollback_sql FROM schema_migrations ORDER BY id DESC LIMIT 1",
		)
		.get() as { name: string; rollback_sql: string | null } | undefined;

	if (!last) return null;
	if (last.rollback_sql) {
		db.exec(last.rollback_sql);
	}
	db.prepare("DELETE FROM schema_migrations WHERE name = ?").run(last.name);
	return last.name;
}

export function rollbackAstropressLastMigrationWithOptions(
	db: SqliteDatabaseLike,
	options: { dryRun?: boolean } = {},
): AstropressRollbackResult {
	const dryRun = options.dryRun ?? false;
	const row = db
		.prepare(
			"SELECT name, rollback_sql FROM schema_migrations ORDER BY id DESC LIMIT 1",
		)
		.get() as { name: string; rollback_sql: string | null } | undefined;

	if (!row) {
		return { migrationName: null, status: "no_migrations", dryRun };
	}
	if (!row.rollback_sql) {
		return { migrationName: row.name, status: "no_rollback_sql", dryRun };
	}
	if (dryRun) {
		return { migrationName: row.name, status: "dry_run", dryRun: true };
	}

	db.exec(row.rollback_sql);
	db.prepare("DELETE FROM schema_migrations WHERE name = ?").run(row.name);
	return { migrationName: row.name, status: "rolled_back", dryRun: false };
}
