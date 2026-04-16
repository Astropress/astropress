import { existsSync, mkdirSync, rmSync } from "node:fs";
import { readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { readdirSync } from "node:fs";
import { defaultSiteSettings } from "./site-settings";
import { ensureLegacySchemaCompatibility } from "./sqlite-schema-compat.js";
import { buildTableImportStatements, buildTableImportSql } from "./sqlite-seed-helpers.js";
import {
  seedBootstrapUsers,
  seedMediaAssets,
  seedRedirects,
  seedComments,
  seedSiteSettings,
  seedSystemRoutes,
  seedArchiveRoutes,
  seedMarketingRoutes,
} from "./sqlite-bootstrap-seeders.js";

export interface SqliteStatementLike {
  run(...params: unknown[]): { changes?: number | bigint };
  get(...params: unknown[]): unknown;
  all(...params: unknown[]): unknown[];
}

export interface SqliteDatabaseLike {
  exec(sql: string): void;
  prepare(sql: string): SqliteStatementLike;
  close(): void;
}

type SqliteDatabaseConstructor = new (filename: string) => SqliteDatabaseLike;

export type AdminRole = "admin" | "editor";

export interface MediaSeedRecord { id: string; sourceUrl?: string; localPath?: string; r2Key?: string }
export interface RedirectRuleSeed { sourcePath: string; targetPath: string; statusCode: 301 | 302 }

export interface SeededComment {
  id: string; author: string; email?: string; body?: string; route: string;
  status: "pending" | "approved" | "rejected";
  policy: "legacy-readonly" | "disabled" | "open-moderated";
  submittedAt?: string;
}

export interface BootstrapUserSeed { email: string; password: string; role: AdminRole; name: string }

export interface SystemRouteSeed {
  groupId: string; variantId: string; path: string; title: string;
  summary?: string; bodyHtml?: string;
  renderStrategy: "structured_sections" | "generated_text" | "generated_xml";
  settingsJson?: string; metaDescription?: string; robotsDirective?: string;
}

export interface ArchiveSeedRecord {
  legacyUrl: string; title: string; summary?: string; seoTitle?: string;
  metaDescription?: string; canonicalUrlOverride?: string; robotsDirective?: string;
}

export interface MarketingRouteSeedRecord {
  path: string; title: string; summary?: string; seoTitle?: string;
  metaDescription?: string; canonicalUrlOverride?: string; robotsDirective?: string;
  ogImage?: string; templateKey: string;
  alternateLinks?: Array<{ hreflang: string; href: string }>;
  sections: Record<string, unknown> | null;
}

export interface SiteSettingsSeed {
  siteTitle: string; siteTagline: string; donationUrl: string;
  newsletterEnabled: boolean;
  commentsDefaultPolicy: (typeof defaultSiteSettings)["commentsDefaultPolicy"];
}

export interface SeedDatabaseOptions { db?: SqliteDatabaseLike; dbPath?: string; reset?: boolean; workspaceRoot?: string }

export interface SeedSummary {
  bootstrapUsers: number; mediaAssets: number; redirectRules: number; comments: number;
  siteSettings: number; systemRoutes: number; archiveRoutes: number; marketingRoutes: number;
}

export const defaultSeedImportTables = [
  "admin_users", "media_assets", "redirect_rules", "comments", "site_settings",
  "cms_route_groups", "cms_route_variants", "cms_route_aliases", "cms_route_revisions",
] as const;

export interface SeedImportStatement<TableName extends string = (typeof defaultSeedImportTables)[number]> { table: TableName; statements: string[]; sql: string }

export interface AstropressSqliteSeedToolkitOptions<TableName extends string = (typeof defaultSeedImportTables)[number]> {
  readSchemaSql(): string;
  loadBootstrapUsers(): BootstrapUserSeed[];
  loadMediaSeeds(workspaceRoot: string): MediaSeedRecord[];
  redirectRules: RedirectRuleSeed[];
  comments: SeededComment[];
  systemRoutes: SystemRouteSeed[];
  archiveRoutes: ArchiveSeedRecord[];
  marketingRoutes: MarketingRouteSeedRecord[];
  siteSettings: SiteSettingsSeed;
  seedImportTables?: readonly TableName[];
  getDefaultAdminDbPath?(workspaceRoot?: string): string;
}

export interface AstropressSqliteSeedToolkit<TableName extends string = (typeof defaultSeedImportTables)[number]> {
  getDefaultAdminDbPath(workspaceRoot?: string): string;
  applyCommittedSchema(db: SqliteDatabaseLike): void;
  openSeedDatabase(dbPath: string): SqliteDatabaseLike;
  seedDatabase(options?: SeedDatabaseOptions): SeedSummary;
  buildSeedImportSql(workspaceRoot?: string): string;
  buildSeedImportStatements(workspaceRoot?: string, seededDb?: SqliteDatabaseLike): SeedImportStatement<TableName>[];
}

async function loadSqliteDatabase(): Promise<SqliteDatabaseConstructor> {
  if ("Bun" in globalThis) {
    const module = await import("bun:sqlite");
    return module.Database as unknown as SqliteDatabaseConstructor;
  }
  const module = await import("node:sqlite");
  return module.DatabaseSync as unknown as SqliteDatabaseConstructor;
}

const SqliteDatabase = await loadSqliteDatabase();

function defaultAdminDbPath(workspaceRoot = process.cwd()) {
  return path.join(workspaceRoot, ".data", "admin.sqlite");
}

export function resolveAstropressSqliteSchemaPath() {
  const primaryPath = fileURLToPath(new URL("./sqlite-schema.sql", import.meta.url));
  if (existsSync(primaryPath)) return primaryPath;
  return fileURLToPath(new URL("../sqlite-schema.sql", import.meta.url));
}

export function readAstropressSqliteSchemaSql() {
  return readFileSync(resolveAstropressSqliteSchemaPath(), "utf8");
}

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
    (db.prepare(`PRAGMA table_info(schema_migrations)`).all() as Array<{ name: string }>).map((r) => r.name),
  );
  if (!migrationCols.has("rollback_sql")) {
    db.exec("ALTER TABLE schema_migrations ADD COLUMN rollback_sql TEXT");
  }

  const alreadyApplied = new Set(
    (db.prepare(`SELECT name FROM schema_migrations`).all() as Array<{ name: string }>).map((r) => r.name),
  );

  if (!existsSync(migrationsDir)) return { applied, skipped };

  for (const file of readdirSync(migrationsDir).filter((f) => f.endsWith(".sql")).sort()) {
    if (alreadyApplied.has(file)) {
      skipped.push(file);
      continue;
    }
    const sql = readFileSync(path.join(migrationsDir, file), "utf8");
    db.exec(sql);

    const downFilePath = path.join(migrationsDir, file.replace(/\.sql$/, ".down.sql"));
    const rollbackSql = existsSync(downFilePath) ? readFileSync(downFilePath, "utf8") : null;
    db.prepare(`INSERT INTO schema_migrations (name, rollback_sql) VALUES (?, ?)`).run(file, rollbackSql);
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
    const row = db.prepare(`SELECT COUNT(*) as count FROM schema_migrations`).get() as { count: number } | undefined;
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
export function rollbackAstropressLastMigration(db: SqliteDatabaseLike): string | null {
  const last = db
    .prepare(`SELECT name, rollback_sql FROM schema_migrations ORDER BY id DESC LIMIT 1`)
    .get() as { name: string; rollback_sql: string | null } | undefined;

  if (!last) return null;
  if (last.rollback_sql) {
    db.exec(last.rollback_sql);
  }
  db.prepare(`DELETE FROM schema_migrations WHERE name = ?`).run(last.name);
  return last.name;
}

export type AstropressRollbackStatus = "no_migrations" | "no_rollback_sql" | "dry_run" | "rolled_back";

export interface AstropressRollbackResult {
  migrationName: string | null;
  status: AstropressRollbackStatus;
  dryRun: boolean;
}

export function rollbackAstropressLastMigrationWithOptions(
  db: SqliteDatabaseLike,
  options: { dryRun?: boolean } = {},
): AstropressRollbackResult {
  const dryRun = options.dryRun ?? false;
  const row = db
    .prepare(`SELECT name, rollback_sql FROM schema_migrations ORDER BY id DESC LIMIT 1`)
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
  db.prepare(`DELETE FROM schema_migrations WHERE name = ?`).run(row.name);
  return { migrationName: row.name, status: "rolled_back", dryRun: false };
}

export function createAstropressSqliteSeedToolkit<TableName extends string = (typeof defaultSeedImportTables)[number]>(
  options: AstropressSqliteSeedToolkitOptions<TableName>,
): AstropressSqliteSeedToolkit<TableName> {
  const seedImportTables = [...(options.seedImportTables ?? defaultSeedImportTables)] as TableName[];

  function getDefaultAdminDbPath(workspaceRoot = process.cwd()) {
    return options.getDefaultAdminDbPath?.(workspaceRoot) ?? defaultAdminDbPath(workspaceRoot);
  }

  function applyCommittedSchema(db: SqliteDatabaseLike) {
    db.exec(options.readSchemaSql());
    ensureLegacySchemaCompatibility(db);
    try {
      db.prepare(`INSERT OR IGNORE INTO schema_migrations (name) VALUES ('baseline-schema')`).run();
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

    if (seedOptions.reset && dbPath !== ":memory:") rmSync(dbPath, { force: true });
    if (ownsConnection && dbPath !== ":memory:") mkdirSync(path.dirname(dbPath), { recursive: true });

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
      throw new Error(`Database seeding failed: ${error instanceof Error ? error.message : String(error)}`);
    } finally {
      if (ownsConnection) db.close();
    }
  }

  function buildSeedImportSql(workspaceRoot = process.cwd()) {
    const tempPath = path.join(tmpdir(), `astropress-seed-${Date.now()}-${Math.random().toString(36).slice(2)}.sqlite`);
    try {
      seedDatabase({ dbPath: tempPath, reset: true, workspaceRoot });
      const db = openSeedDatabase(tempPath);
      try {
        const tableSql = buildSeedImportStatements(workspaceRoot, db).map((s) => s.sql);
        return ["BEGIN TRANSACTION;", ...tableSql, "COMMIT;"].join("\n\n");
      } finally {
        db.close();
      }
    } finally {
      rmSync(tempPath, { force: true });
    }
  }

  function buildSeedImportStatements(workspaceRoot = process.cwd(), seededDb?: SqliteDatabaseLike) {
    const tempPath = path.join(tmpdir(), `astropress-seed-${Date.now()}-${Math.random().toString(36).slice(2)}.sqlite`);
    const db = seededDb ?? (() => {
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
        { email: "admin@example.com", password: "password", role: "admin" as const, name: "Admin" },
        { email: "editor@example.com", password: "password", role: "editor" as const, name: "Editor" },
      ];
    },
    loadMediaSeeds() { return []; },
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
