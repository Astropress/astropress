import { pbkdf2Sync, randomBytes } from "node:crypto";
import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { defaultSiteSettings } from "./site-settings";
import { getCmsConfig } from "./config";

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

export interface MediaSeedRecord {
  id: string;
  sourceUrl?: string;
  localPath?: string;
  r2Key?: string;
}

export interface RedirectRuleSeed {
  sourcePath: string;
  targetPath: string;
  statusCode: 301 | 302;
}

export interface SeededComment {
  id: string;
  author: string;
  email?: string;
  body?: string;
  route: string;
  status: "pending" | "approved" | "rejected";
  policy: "legacy-readonly" | "disabled" | "open-moderated";
  submittedAt?: string;
}

export interface BootstrapUserSeed {
  email: string;
  password: string;
  role: AdminRole;
  name: string;
}

export interface SystemRouteSeed {
  groupId: string;
  variantId: string;
  path: string;
  title: string;
  summary?: string;
  bodyHtml?: string;
  renderStrategy: "structured_sections" | "generated_text" | "generated_xml";
  settingsJson?: string;
  metaDescription?: string;
  robotsDirective?: string;
}

export interface ArchiveSeedRecord {
  legacyUrl: string;
  title: string;
  summary?: string;
  seoTitle?: string;
  metaDescription?: string;
  canonicalUrlOverride?: string;
  robotsDirective?: string;
}

export interface MarketingRouteSeedRecord {
  path: string;
  title: string;
  summary?: string;
  seoTitle?: string;
  metaDescription?: string;
  canonicalUrlOverride?: string;
  robotsDirective?: string;
  ogImage?: string;
  templateKey: string;
  alternateLinks?: Array<{ hreflang: string; href: string }>;
  sections: Record<string, unknown> | null;
}

export interface SiteSettingsSeed {
  siteTitle: string;
  siteTagline: string;
  donationUrl: string;
  newsletterEnabled: boolean;
  commentsDefaultPolicy: (typeof defaultSiteSettings)["commentsDefaultPolicy"];
}

export interface SeedDatabaseOptions {
  db?: SqliteDatabaseLike;
  dbPath?: string;
  reset?: boolean;
  workspaceRoot?: string;
}

export interface SeedSummary {
  bootstrapUsers: number;
  mediaAssets: number;
  redirectRules: number;
  comments: number;
  siteSettings: number;
  systemRoutes: number;
  archiveRoutes: number;
  marketingRoutes: number;
}

export const defaultSeedImportTables = [
  "admin_users",
  "media_assets",
  "redirect_rules",
  "comments",
  "site_settings",
  "cms_route_groups",
  "cms_route_variants",
  "cms_route_aliases",
  "cms_route_revisions",
] as const;

export interface SeedImportStatement<TableName extends string = (typeof defaultSeedImportTables)[number]> {
  table: TableName;
  statements: string[];
  sql: string;
}

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
  if (existsSync(primaryPath)) {
    return primaryPath;
  }

  return fileURLToPath(new URL("../sqlite-schema.sql", import.meta.url));
}

export function readAstropressSqliteSchemaSql() {
  return readFileSync(resolveAstropressSqliteSchemaPath(), "utf8");
}

/**
 * Run incremental SQL migrations from a directory against a live SQLite database.
 *
 * Migration files must be named with a numeric prefix (e.g. `0001_add_column.sql`,
 * `0002_create_index.sql`). They are applied in lexicographic order. Applied migrations
 * are recorded in `schema_migrations` so they are never re-run.
 *
 * @example
 * ```ts
 * import { runAstropressMigrations } from "astropress/sqlite-bootstrap";
 * runAstropressMigrations(db, "./migrations");
 * ```
 */
export function runAstropressMigrations(
  db: SqliteDatabaseLike,
  migrationsDir: string,
): { applied: string[]; skipped: string[] } {
  const applied: string[] = [];
  const skipped: string[] = [];

  // Ensure the migrations table exists (it should, but guard defensively).
  db.exec(`CREATE TABLE IF NOT EXISTS schema_migrations (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL UNIQUE,
    applied_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  )`);

  const alreadyApplied = new Set(
    (db.prepare(`SELECT name FROM schema_migrations`).all() as Array<{ name: string }>).map(
      (r) => r.name,
    ),
  );

  if (!existsSync(migrationsDir)) {
    return { applied, skipped };
  }

  const migrationFiles = readdirSync(migrationsDir)
    .filter((f) => f.endsWith(".sql"))
    .sort();

  for (const file of migrationFiles) {
    if (alreadyApplied.has(file)) {
      skipped.push(file);
      continue;
    }
    const sql = readFileSync(path.join(migrationsDir, file), "utf8");
    db.exec(sql);
    db.prepare(`INSERT INTO schema_migrations (name) VALUES (?)`).run(file);
    applied.push(file);
  }

  return { applied, skipped };
}

function hashPasswordSync(password: string, iterations = 100_000) {
  const salt = randomBytes(32);
  const derived = pbkdf2Sync(password, salt, iterations, 64, "sha256");
  return `${iterations}$${salt.toString("base64")}$${derived.toString("base64")}`;
}

function guessMimeType(pathname: string) {
  const lower = pathname.toLowerCase();
  if (lower.endsWith(".png")) return "image/png";
  if (lower.endsWith(".webp")) return "image/webp";
  if (lower.endsWith(".gif")) return "image/gif";
  return "image/jpeg";
}

function toSqlLiteral(value: unknown): string {
  if (value === null || value === undefined) {
    return "NULL";
  }

  if (typeof value === "number" || typeof value === "bigint") {
    return String(value);
  }

  if (typeof value === "boolean") {
    return value ? "1" : "0";
  }

  if (value instanceof Uint8Array) {
    return `X'${Buffer.from(value).toString("hex")}'`;
  }

  return `'${String(value).replaceAll("'", "''")}'`;
}

function buildTableImportStatements(db: SqliteDatabaseLike, table: string) {
  const columns = (
    db.prepare(`PRAGMA table_info(${table})`).all() as Array<{
      name: string;
    }>
  ).map((column) => column.name);

  if (columns.length === 0) {
    return [] as string[];
  }

  const rows = db.prepare(`SELECT * FROM ${table}`).all() as Array<Record<string, unknown>>;
  const statements = [`DELETE FROM ${table};`];

  for (const row of rows) {
    const serializedValues = columns.map((column) => toSqlLiteral(row[column]));
    statements.push(`INSERT INTO ${table} (${columns.join(", ")}) VALUES (${serializedValues.join(", ")});`);
  }

  return statements;
}

function buildTableImportSql(db: SqliteDatabaseLike, table: string) {
  return buildTableImportStatements(db, table).join("\n");
}

function getTableColumns(db: SqliteDatabaseLike, table: string) {
  return (
    db.prepare(`PRAGMA table_info(${table})`).all() as Array<{
      name: string;
    }>
  ).map((column) => column.name);
}

function getTableSql(db: SqliteDatabaseLike, table: string) {
  return (
    db.prepare("SELECT sql FROM sqlite_master WHERE type = 'table' AND name = ?").get(table) as
      | {
          sql: string | null;
        }
      | undefined
  )?.sql;
}

function rebuildContentTablesForCompatibility(
  db: SqliteDatabaseLike,
  options: {
    hasRevisionAuthorIds: boolean;
    hasRevisionCategoryIds: boolean;
    hasRevisionTagIds: boolean;
    hasOverrideScheduledAt: boolean;
    hasRevisionScheduledAt: boolean;
    hasRevisionNote: boolean;
  },
) {
  const authorIdsSelect = options.hasRevisionAuthorIds ? "COALESCE(author_ids, '[]')" : "'[]'";
  const categoryIdsSelect = options.hasRevisionCategoryIds ? "COALESCE(category_ids, '[]')" : "'[]'";
  const tagIdsSelect = options.hasRevisionTagIds ? "COALESCE(tag_ids, '[]')" : "'[]'";
  const overrideScheduledAtSelect = options.hasOverrideScheduledAt ? "scheduled_at" : "NULL";
  const revisionScheduledAtSelect = options.hasRevisionScheduledAt ? "scheduled_at" : "NULL";
  const revisionNoteSelect = options.hasRevisionNote ? "revision_note" : "NULL";

  db.exec(`
    PRAGMA foreign_keys = OFF;

    CREATE TABLE IF NOT EXISTS content_overrides__migrated (
      slug TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      status TEXT NOT NULL CHECK(status IN ('draft', 'review', 'published', 'archived')),
      scheduled_at TEXT,
      body TEXT,
      seo_title TEXT,
      meta_description TEXT,
      excerpt TEXT,
      og_title TEXT,
      og_description TEXT,
      og_image TEXT,
      canonical_url_override TEXT,
      robots_directive TEXT,
      metadata TEXT,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
      updated_by TEXT NOT NULL
    );

    INSERT INTO content_overrides__migrated (
      slug, title, status, scheduled_at, body, seo_title, meta_description, excerpt, og_title,
      og_description, og_image, canonical_url_override, robots_directive, metadata, updated_at, updated_by
    )
    SELECT
      slug,
      title,
      CASE
        WHEN status IN ('draft', 'review', 'published', 'archived') THEN status
        ELSE 'draft'
      END,
      ${overrideScheduledAtSelect},
      body,
      seo_title,
      meta_description,
      excerpt,
      og_title,
      og_description,
      og_image,
      canonical_url_override,
      robots_directive,
      NULL,
      updated_at,
      updated_by
    FROM content_overrides;

    DROP TABLE content_overrides;
    ALTER TABLE content_overrides__migrated RENAME TO content_overrides;
    CREATE INDEX IF NOT EXISTS idx_content_overrides_updated_at ON content_overrides(updated_at DESC);

    CREATE TABLE IF NOT EXISTS content_revisions__migrated (
      id TEXT PRIMARY KEY,
      slug TEXT NOT NULL,
      source TEXT NOT NULL CHECK(source IN ('imported', 'reviewed')),
      title TEXT NOT NULL,
      status TEXT NOT NULL CHECK(status IN ('draft', 'review', 'published', 'archived')),
      scheduled_at TEXT,
      body TEXT,
      seo_title TEXT,
      meta_description TEXT,
      excerpt TEXT,
      og_title TEXT,
      og_description TEXT,
      og_image TEXT,
      author_ids TEXT,
      category_ids TEXT,
      tag_ids TEXT,
      canonical_url_override TEXT,
      robots_directive TEXT,
      revision_note TEXT,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      created_by TEXT,
      FOREIGN KEY(slug) REFERENCES content_overrides(slug) ON DELETE CASCADE
    );

    INSERT INTO content_revisions__migrated (
      id, slug, source, title, status, scheduled_at, body, seo_title, meta_description, excerpt,
      og_title, og_description, og_image, author_ids, category_ids, tag_ids,
      canonical_url_override, robots_directive, revision_note, created_at, created_by
    )
    SELECT
      id,
      slug,
      source,
      title,
      CASE
        WHEN status IN ('draft', 'review', 'published', 'archived') THEN status
        ELSE 'draft'
      END,
      ${revisionScheduledAtSelect},
      body,
      seo_title,
      meta_description,
      excerpt,
      og_title,
      og_description,
      og_image,
      ${authorIdsSelect},
      ${categoryIdsSelect},
      ${tagIdsSelect},
      canonical_url_override,
      robots_directive,
      ${revisionNoteSelect},
      created_at,
      created_by
    FROM content_revisions;

    DROP TABLE content_revisions;
    ALTER TABLE content_revisions__migrated RENAME TO content_revisions;
    CREATE INDEX IF NOT EXISTS idx_content_revisions_slug ON content_revisions(slug);
    CREATE INDEX IF NOT EXISTS idx_content_revisions_created_at ON content_revisions(created_at DESC);

    PRAGMA foreign_keys = ON;
  `);
}

function ensureLegacySchemaCompatibility(db: SqliteDatabaseLike) {
  const revisionColumns = new Set(getTableColumns(db, "content_revisions"));
  const overrideColumns = new Set(getTableColumns(db, "content_overrides"));
  const needsRevisionColumns =
    !revisionColumns.has("author_ids") ||
    !revisionColumns.has("category_ids") ||
    !revisionColumns.has("tag_ids") ||
    !revisionColumns.has("scheduled_at") ||
    !revisionColumns.has("revision_note");
  const needsOverrideColumns = !overrideColumns.has("scheduled_at");
  // metadata column: added via safe ADD COLUMN (no rebuild required for nullable column)
  if (!overrideColumns.has("metadata")) {
    db.exec("ALTER TABLE content_overrides ADD COLUMN metadata TEXT");
  }

  const overrideSql = getTableSql(db, "content_overrides") ?? "";
  const revisionSql = getTableSql(db, "content_revisions") ?? "";
  const needsExpandedStatuses =
    !overrideSql.includes("'review'") ||
    !overrideSql.includes("'archived'") ||
    !revisionSql.includes("'review'") ||
    !revisionSql.includes("'archived'");

  if (!needsRevisionColumns && !needsOverrideColumns && !needsExpandedStatuses) {
    return;
  }

  rebuildContentTablesForCompatibility(db, {
    hasRevisionAuthorIds: revisionColumns.has("author_ids"),
    hasRevisionCategoryIds: revisionColumns.has("category_ids"),
    hasRevisionTagIds: revisionColumns.has("tag_ids"),
    hasOverrideScheduledAt: overrideColumns.has("scheduled_at"),
    hasRevisionScheduledAt: revisionColumns.has("scheduled_at"),
    hasRevisionNote: revisionColumns.has("revision_note"),
  });
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
    // Record the baseline schema application in the migrations table so that
    // future migration runners can determine what has already been applied.
    try {
      db.prepare(
        `INSERT OR IGNORE INTO schema_migrations (name) VALUES ('baseline-schema')`,
      ).run();
    } catch {
      // Silently skip if schema_migrations table is missing (non-standard setup).
    }
  }

  function openSeedDatabase(dbPath: string) {
    return new SqliteDatabase(dbPath);
  }

  function seedBootstrapUsers(db: SqliteDatabaseLike) {
    const upsert = db.prepare(`
      INSERT INTO admin_users (email, password_hash, role, name, active)
      VALUES (?, ?, ?, ?, 1)
      ON CONFLICT(email) DO UPDATE SET
        password_hash = excluded.password_hash,
        role = excluded.role,
        name = excluded.name,
        active = 1
    `);

    let count = 0;
    for (const user of options.loadBootstrapUsers()) {
      const result = upsert.run(user.email.toLowerCase(), hashPasswordSync(user.password), user.role, user.name) as {
        changes?: number;
      };
      count += result.changes ?? 1;
    }
    return count;
  }

  function seedMediaAssets(db: SqliteDatabaseLike, workspaceRoot: string) {
    const insert = db.prepare(`
      INSERT INTO media_assets (
        id, source_url, local_path, r2_key, mime_type, file_size, alt_text, title, uploaded_by
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        source_url = excluded.source_url,
        local_path = excluded.local_path,
        r2_key = excluded.r2_key,
        mime_type = excluded.mime_type,
        uploaded_by = excluded.uploaded_by,
        deleted_at = NULL
    `);

    let count = 0;
    for (const asset of options.loadMediaSeeds(workspaceRoot)) {
      const result = insert.run(
        asset.id,
        asset.sourceUrl ?? null,
        asset.localPath ?? `/images/legacy/${asset.id}`,
        asset.r2Key ?? null,
        guessMimeType(asset.localPath ?? asset.sourceUrl ?? asset.id),
        null,
        "",
        asset.id,
        "seed-import",
      ) as { changes?: number };
      count += result.changes ?? 1;
    }
    return count;
  }

  function seedRedirects(db: SqliteDatabaseLike) {
    const insert = db.prepare(`
      INSERT INTO redirect_rules (source_path, target_path, status_code, created_by, deleted_at)
      VALUES (?, ?, ?, ?, NULL)
      ON CONFLICT(source_path) DO UPDATE SET
        target_path = excluded.target_path,
        status_code = excluded.status_code,
        created_by = excluded.created_by,
        deleted_at = NULL
    `);

    let count = 0;
    for (const rule of options.redirectRules) {
      const result = insert.run(rule.sourcePath, rule.targetPath, rule.statusCode, "seed-import") as { changes?: number };
      count += result.changes ?? 1;
    }
    return count;
  }

  function seedComments(db: SqliteDatabaseLike) {
    const insert = db.prepare(`
      INSERT INTO comments (id, author, email, body, route, status, policy, submitted_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, COALESCE(?, CURRENT_TIMESTAMP))
      ON CONFLICT(id) DO NOTHING
    `);

    let count = 0;
    for (const comment of options.comments) {
      const result = insert.run(
        comment.id,
        comment.author,
        comment.email ?? null,
        comment.body ?? null,
        comment.route,
        comment.status,
        comment.policy,
        comment.submittedAt ?? null,
      ) as { changes?: number };
      count += result.changes ?? 0;
    }
    return count;
  }

  function seedSiteSettings(db: SqliteDatabaseLike) {
    const result = db
      .prepare(
        `
          INSERT INTO site_settings (
            id, site_title, site_tagline, donation_url, newsletter_enabled, comments_default_policy, updated_by
          ) VALUES (?, ?, ?, ?, ?, ?, ?)
          ON CONFLICT(id) DO NOTHING
        `,
      )
      .run(
        1,
        options.siteSettings.siteTitle,
        options.siteSettings.siteTagline,
        options.siteSettings.donationUrl,
        options.siteSettings.newsletterEnabled ? 1 : 0,
        options.siteSettings.commentsDefaultPolicy,
        "seed-import",
      ) as { changes?: number };

    return result.changes ?? 0;
  }

  function seedSystemRoutes(db: SqliteDatabaseLike) {
    const insertGroup = db.prepare(`
      INSERT INTO cms_route_groups (id, kind, render_strategy, canonical_locale, canonical_path)
      VALUES (?, 'system', ?, 'en', ?)
      ON CONFLICT(id) DO UPDATE SET
        render_strategy = excluded.render_strategy,
        canonical_path = excluded.canonical_path,
        updated_at = CURRENT_TIMESTAMP
    `);
    const insertVariant = db.prepare(`
      INSERT INTO cms_route_variants (
        id, group_id, locale, path, status, title, summary, body_html, sections_json, settings_json,
        seo_title, meta_description, og_title, og_description, og_image, canonical_url_override,
        robots_directive, updated_at, updated_by
      ) VALUES (?, ?, 'en', ?, 'published', ?, ?, ?, NULL, ?, ?, ?, NULL, NULL, NULL, NULL, ?, CURRENT_TIMESTAMP, ?)
      ON CONFLICT(id) DO UPDATE SET
        path = excluded.path,
        title = excluded.title,
        summary = excluded.summary,
        body_html = excluded.body_html,
        settings_json = excluded.settings_json,
        seo_title = excluded.seo_title,
        meta_description = excluded.meta_description,
        robots_directive = excluded.robots_directive,
        updated_at = CURRENT_TIMESTAMP,
        updated_by = excluded.updated_by
    `);
    const insertRevision = db.prepare(`
      INSERT INTO cms_route_revisions (id, variant_id, route_path, locale, snapshot_json, revision_note, created_by)
      VALUES (?, ?, ?, 'en', ?, ?, ?)
      ON CONFLICT(id) DO NOTHING
    `);

    let count = 0;
    for (const route of options.systemRoutes) {
      insertGroup.run(route.groupId, route.renderStrategy, route.path);
      const result = insertVariant.run(
        route.variantId,
        route.groupId,
        route.path,
        route.title,
        route.summary ?? null,
        route.bodyHtml ?? null,
        route.settingsJson ?? null,
        route.title,
        route.metaDescription ?? route.summary ?? route.title,
        route.robotsDirective ?? null,
        "seed-import",
      ) as { changes?: number };
      count += result.changes ?? 1;
      insertRevision.run(
        `revision:${route.variantId}:seed`,
        route.variantId,
        route.path,
        JSON.stringify({
          path: route.path,
          title: route.title,
          summary: route.summary ?? "",
          bodyHtml: route.bodyHtml ?? "",
          settings: route.settingsJson ? JSON.parse(route.settingsJson) : null,
          renderStrategy: route.renderStrategy,
        }),
        "Imported baseline",
        "seed-import",
      );
    }

    return count;
  }

  function seedArchiveRoutes(db: SqliteDatabaseLike) {
    const insertGroup = db.prepare(`
      INSERT INTO cms_route_groups (id, kind, render_strategy, canonical_locale, canonical_path)
      VALUES (?, 'archive', 'archive_listing', 'en', ?)
      ON CONFLICT(id) DO UPDATE SET
        canonical_path = excluded.canonical_path,
        updated_at = CURRENT_TIMESTAMP
    `);
    const insertVariant = db.prepare(`
      INSERT INTO cms_route_variants (
        id, group_id, locale, path, status, title, summary, body_html, sections_json, settings_json,
        seo_title, meta_description, og_title, og_description, og_image, canonical_url_override,
        robots_directive, updated_at, updated_by
      ) VALUES (?, ?, 'en', ?, 'published', ?, ?, NULL, NULL, NULL, ?, ?, NULL, NULL, NULL, ?, ?, CURRENT_TIMESTAMP, ?)
      ON CONFLICT(id) DO UPDATE SET
        title = excluded.title,
        summary = excluded.summary,
        seo_title = excluded.seo_title,
        meta_description = excluded.meta_description,
        canonical_url_override = excluded.canonical_url_override,
        robots_directive = excluded.robots_directive,
        updated_at = CURRENT_TIMESTAMP,
        updated_by = excluded.updated_by
    `);

    let count = 0;
    for (const archive of options.archiveRoutes) {
      const baseId = archive.legacyUrl.replace(/^\//, "").replaceAll("/", ":") || "root";
      const groupId = `archive:${baseId}`;
      const variantId = `variant:archive:${baseId}:en`;
      insertGroup.run(groupId, archive.legacyUrl);
      const result = insertVariant.run(
        variantId,
        groupId,
        archive.legacyUrl,
        archive.title,
        archive.summary ?? null,
        archive.seoTitle ?? archive.title,
        archive.metaDescription ?? archive.summary ?? "",
        archive.canonicalUrlOverride ?? null,
        archive.robotsDirective ?? null,
        "seed-import",
      ) as { changes?: number };
      count += result.changes ?? 1;
    }

    return count;
  }

  function seedMarketingRoutes(db: SqliteDatabaseLike) {
    const insertGroup = db.prepare(`
      INSERT INTO cms_route_groups (id, kind, render_strategy, canonical_locale, canonical_path)
      VALUES (?, 'page', 'structured_sections', ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        canonical_locale = excluded.canonical_locale,
        canonical_path = excluded.canonical_path,
        updated_at = CURRENT_TIMESTAMP
    `);
    const insertVariant = db.prepare(`
      INSERT INTO cms_route_variants (
        id, group_id, locale, path, status, title, summary, body_html, sections_json, settings_json,
        seo_title, meta_description, og_title, og_description, og_image, canonical_url_override,
        robots_directive, updated_at, updated_by
      ) VALUES (?, ?, ?, ?, 'published', ?, ?, NULL, ?, ?, ?, ?, NULL, NULL, ?, ?, ?, CURRENT_TIMESTAMP, ?)
      ON CONFLICT(id) DO UPDATE SET
        title = excluded.title,
        summary = excluded.summary,
        sections_json = excluded.sections_json,
        settings_json = excluded.settings_json,
        seo_title = excluded.seo_title,
        meta_description = excluded.meta_description,
        og_image = excluded.og_image,
        canonical_url_override = excluded.canonical_url_override,
        robots_directive = excluded.robots_directive,
        updated_at = CURRENT_TIMESTAMP,
        updated_by = excluded.updated_by
    `);

    let count = 0;
    for (const page of options.marketingRoutes) {
      let configLocales: readonly string[];
      try { configLocales = getCmsConfig().locales ?? ["en", "es"]; } catch { configLocales = ["en", "es"]; }
      const locale = configLocales.find((l) => page.path.startsWith(`/${l}/`)) ?? (configLocales[0] ?? "en");
      const baseId = page.path.replace(/^\//, "").replaceAll("/", ":");
      const groupId = `page:${baseId}`;
      const variantId = `variant:page:${baseId}:${locale}`;
      insertGroup.run(groupId, locale, page.path);
      const result = insertVariant.run(
        variantId,
        groupId,
        locale,
        page.path,
        page.title,
        page.summary,
        JSON.stringify(page.sections),
        JSON.stringify({ templateKey: page.templateKey, alternateLinks: page.alternateLinks ?? [] }),
        page.seoTitle,
        page.metaDescription,
        page.ogImage ?? null,
        page.canonicalUrlOverride ?? null,
        page.robotsDirective ?? null,
        "seed-import",
      ) as { changes?: number };
      count += result.changes ?? 1;
    }

    return count;
  }

  function seedDatabase(seedOptions: SeedDatabaseOptions = {}): SeedSummary {
    const workspaceRoot = seedOptions.workspaceRoot ?? process.cwd();
    const dbPath = seedOptions.dbPath ?? getDefaultAdminDbPath(workspaceRoot);
    const ownsConnection = !seedOptions.db;

    if (seedOptions.reset && dbPath !== ":memory:") {
      rmSync(dbPath, { force: true });
    }

    if (ownsConnection && dbPath !== ":memory:") {
      mkdirSync(path.dirname(dbPath), { recursive: true });
    }

    const db = seedOptions.db ?? openSeedDatabase(dbPath);

    try {
      applyCommittedSchema(db);
      return {
        bootstrapUsers: seedBootstrapUsers(db),
        mediaAssets: seedMediaAssets(db, workspaceRoot),
        redirectRules: seedRedirects(db),
        comments: seedComments(db),
        siteSettings: seedSiteSettings(db),
        systemRoutes: seedSystemRoutes(db),
        archiveRoutes: seedArchiveRoutes(db),
        marketingRoutes: seedMarketingRoutes(db),
      };
    } catch (error) {
      throw new Error(`Database seeding failed: ${error instanceof Error ? error.message : String(error)}`);
    } finally {
      if (ownsConnection) {
        db.close();
      }
    }
  }

  function buildSeedImportSql(workspaceRoot = process.cwd()) {
    const tempPath = path.join(tmpdir(), `astropress-seed-${Date.now()}-${Math.random().toString(36).slice(2)}.sqlite`);

    try {
      seedDatabase({ dbPath: tempPath, reset: true, workspaceRoot });
      const db = openSeedDatabase(tempPath);

      try {
        const tableSql = buildSeedImportStatements(workspaceRoot, db).map((statement) => statement.sql);
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
        .filter((statement): statement is SeedImportStatement<TableName> => statement.sql.length > 0);
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
