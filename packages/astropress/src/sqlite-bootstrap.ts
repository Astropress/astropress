import { existsSync, mkdirSync, rmSync } from "node:fs";
import { readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { defaultSiteSettings } from "./site-settings";
import {
	type AdminRole,
	type ArchiveSeedRecord,
	type AstropressRollbackResult,
	type AstropressRollbackStatus,
	type AstropressSqliteSeedToolkit,
	type AstropressSqliteSeedToolkitOptions,
	type BootstrapUserSeed,
	type MarketingRouteSeedRecord,
	type MediaSeedRecord,
	type RedirectRuleSeed,
	type SeedDatabaseOptions,
	type SeedImportStatement,
	type SeedSummary,
	type SeededComment,
	type SiteSettingsSeed,
	type SqliteDatabaseConstructor,
	type SqliteDatabaseLike,
	type SqliteStatementLike,
	type SystemRouteSeed,
	defaultSeedImportTables,
	loadSqliteDatabase,
} from "./sqlite-bootstrap-helpers";
import {
	seedArchiveRoutes,
	seedBootstrapUsers,
	seedComments,
	seedMarketingRoutes,
	seedMediaAssets,
	seedRedirects,
	seedSiteSettings,
	seedSystemRoutes,
} from "./sqlite-bootstrap-seeders.js";
import { ensureLegacySchemaCompatibility } from "./sqlite-schema-compat.js";
import {
	buildTableImportSql,
	buildTableImportStatements,
} from "./sqlite-seed-helpers.js";

export type {
	AdminRole,
	ArchiveSeedRecord,
	AstropressRollbackResult,
	AstropressRollbackStatus,
	AstropressSqliteSeedToolkit,
	AstropressSqliteSeedToolkitOptions,
	BootstrapUserSeed,
	MarketingRouteSeedRecord,
	MediaSeedRecord,
	RedirectRuleSeed,
	SeededComment,
	SeedDatabaseOptions,
	SeedImportStatement,
	SeedSummary,
	SiteSettingsSeed,
	SqliteDatabaseLike,
	SqliteStatementLike,
	SystemRouteSeed,
};

export { defaultSeedImportTables };

const SqliteDatabase = await loadSqliteDatabase();

function defaultAdminDbPath(workspaceRoot = process.cwd()) {
	return path.join(workspaceRoot, ".data", "admin.sqlite");
}

export function resolveAstropressSqliteSchemaPath() {
	const primaryPath = fileURLToPath(
		new URL("./sqlite-schema.sql", import.meta.url),
	);
	if (existsSync(primaryPath)) return primaryPath;
	return fileURLToPath(new URL("../sqlite-schema.sql", import.meta.url));
}

export function readAstropressSqliteSchemaSql() {
	return readFileSync(resolveAstropressSqliteSchemaPath(), "utf8");
}

export {
	ASTROPRESS_FRAMEWORK_MIGRATION_BASELINE,
	checkSchemaVersionAhead,
	rollbackAstropressLastMigration,
	rollbackAstropressLastMigrationWithOptions,
	runAstropressMigrations,
} from "./sqlite-bootstrap-migrations";

export function createAstropressSqliteSeedToolkit<
	TableName extends string = (typeof defaultSeedImportTables)[number],
>(
	options: AstropressSqliteSeedToolkitOptions<TableName>,
): AstropressSqliteSeedToolkit<TableName> {
	const seedImportTables = [
		...(options.seedImportTables ?? defaultSeedImportTables),
	] as TableName[];

	function getDefaultAdminDbPath(workspaceRoot = process.cwd()) {
		return (
			options.getDefaultAdminDbPath?.(workspaceRoot) ??
			defaultAdminDbPath(workspaceRoot)
		);
	}

	function applyCommittedSchema(db: SqliteDatabaseLike) {
		db.exec(options.readSchemaSql());
		ensureLegacySchemaCompatibility(db);
		try {
			db.prepare(
				`INSERT OR IGNORE INTO schema_migrations (name) VALUES ('baseline-schema')`,
			).run();
		} catch {
			// Non-standard setup without schema_migrations table.
		}
	}

	function openSeedDatabase(dbPath: string) {
		const db = new SqliteDatabase(dbPath);
		if (dbPath !== ":memory:") {
			// journal_mode requires prepare().get() (not exec) to take effect in both bun:sqlite and node:sqlite
			db.prepare("PRAGMA journal_mode = WAL").get();
			db.prepare("PRAGMA synchronous = NORMAL").get();
		}
		db.prepare("PRAGMA foreign_keys = ON").get();
		return db;
	}

	function seedDatabase(seedOptions: SeedDatabaseOptions = {}): SeedSummary {
		const workspaceRoot = seedOptions.workspaceRoot ?? process.cwd();
		const dbPath = seedOptions.dbPath ?? getDefaultAdminDbPath(workspaceRoot);
		const ownsConnection = !seedOptions.db;

		if (seedOptions.reset && dbPath !== ":memory:")
			rmSync(dbPath, { force: true });
		if (ownsConnection && dbPath !== ":memory:")
			mkdirSync(path.dirname(dbPath), { recursive: true });

		const db = seedOptions.db ?? openSeedDatabase(dbPath);
		try {
			applyCommittedSchema(db);
			return {
				bootstrapUsers: seedBootstrapUsers(options, db),
				mediaAssets: seedMediaAssets(options, db, workspaceRoot),
				redirectRules: seedRedirects(options, db),
				comments: seedComments(options, db),
				siteSettings: seedSiteSettings(options, db),
				systemRoutes: seedSystemRoutes(options, db),
				archiveRoutes: seedArchiveRoutes(options, db),
				marketingRoutes: seedMarketingRoutes(options, db),
			};
		} catch (error) {
			throw new Error(
				`Database seeding failed: ${error instanceof Error ? error.message : String(error)}`,
			);
		} finally {
			if (ownsConnection) db.close();
		}
	}

	function buildSeedImportSql(workspaceRoot = process.cwd()) {
		const tempPath = path.join(
			tmpdir(),
			`astropress-seed-${Date.now()}-${Math.random().toString(36).slice(2)}.sqlite`,
		);
		try {
			seedDatabase({ dbPath: tempPath, reset: true, workspaceRoot });
			const db = openSeedDatabase(tempPath);
			try {
				const tableSql = buildSeedImportStatements(workspaceRoot, db).map(
					(s) => s.sql,
				);
				return ["BEGIN TRANSACTION;", ...tableSql, "COMMIT;"].join("\n\n");
			} finally {
				db.close();
			}
		} finally {
			rmSync(tempPath, { force: true });
		}
	}

	function buildSeedImportStatements(
		workspaceRoot = process.cwd(),
		seededDb?: SqliteDatabaseLike,
	) {
		const tempPath = path.join(
			tmpdir(),
			`astropress-seed-${Date.now()}-${Math.random().toString(36).slice(2)}.sqlite`,
		);
		const db =
			seededDb ??
			(() => {
				seedDatabase({ dbPath: tempPath, reset: true, workspaceRoot });
				return openSeedDatabase(tempPath);
			})();
		try {
			return seedImportTables
				.map((table) => ({
					table,
					statements: buildTableImportStatements(db, table),
					sql: buildTableImportSql(db, table),
				}))
				.filter((s): s is SeedImportStatement<TableName> => s.sql.length > 0);
		} finally {
			if (!seededDb) {
				db.close();
				rmSync(tempPath, { force: true });
			}
		}
	}

	return {
		getDefaultAdminDbPath,
		applyCommittedSchema,
		openSeedDatabase,
		seedDatabase,
		buildSeedImportSql,
		buildSeedImportStatements,
	};
}

export function createDefaultAstropressSqliteSeedToolkit() {
	return createAstropressSqliteSeedToolkit({
		readSchemaSql: readAstropressSqliteSchemaSql,
		loadBootstrapUsers() {
			return [
				{
					email: "admin@example.com",
					password: "password",
					role: "admin" as const,
					name: "Admin",
				},
				{
					email: "editor@example.com",
					password: "password",
					role: "editor" as const,
					name: "Editor",
				},
			];
		},
		loadMediaSeeds() {
			return [];
		},
		redirectRules: [],
		comments: [],
		systemRoutes: [],
		archiveRoutes: [],
		marketingRoutes: [],
		siteSettings: {
			siteTitle: "Astropress",
			siteTagline: "Low-carbon publishing",
			donationUrl: "https://example.com/donate",
			newsletterEnabled: false,
			commentsDefaultPolicy: defaultSiteSettings.commentsDefaultPolicy,
		},
	});
}
