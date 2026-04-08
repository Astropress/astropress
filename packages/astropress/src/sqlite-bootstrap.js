import { createRequire } from "node:module";
var __require = /* @__PURE__ */ createRequire(import.meta.url);

// packages/astropress/src/sqlite-bootstrap.ts
import { pbkdf2Sync, randomBytes } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

// packages/astropress/src/site-settings.ts
var defaultSiteSettings = {
  siteTitle: "",
  siteTagline: "",
  donationUrl: "",
  newsletterEnabled: false,
  commentsDefaultPolicy: "legacy-readonly",
  adminSlug: "ap-admin"
};

// packages/astropress/src/sqlite-bootstrap.ts
var defaultSeedImportTables = [
  "admin_users",
  "media_assets",
  "redirect_rules",
  "comments",
  "site_settings",
  "cms_route_groups",
  "cms_route_variants",
  "cms_route_aliases",
  "cms_route_revisions"
];
async function loadSqliteDatabase() {
  if ("Bun" in globalThis) {
    const module2 = await import("bun:sqlite");
    return module2.Database;
  }
  const module = await import("node:sqlite");
  return module.DatabaseSync;
}
var SqliteDatabase = await loadSqliteDatabase();
function defaultAdminDbPath(workspaceRoot = process.cwd()) {
  return path.join(workspaceRoot, ".data", "admin.sqlite");
}
function resolveAstropressSqliteSchemaPath() {
  const primaryPath = fileURLToPath(new URL("./sqlite-schema.sql", import.meta.url));
  if (existsSync(primaryPath)) {
    return primaryPath;
  }
  return fileURLToPath(new URL("../sqlite-schema.sql", import.meta.url));
}
function readAstropressSqliteSchemaSql() {
  return readFileSync(resolveAstropressSqliteSchemaPath(), "utf8");
}
function hashPasswordSync(password, iterations = 1e5) {
  const salt = randomBytes(32);
  const derived = pbkdf2Sync(password, salt, iterations, 64, "sha256");
  return `${iterations}$${salt.toString("base64")}$${derived.toString("base64")}`;
}
function guessMimeType(pathname) {
  const lower = pathname.toLowerCase();
  if (lower.endsWith(".png"))
    return "image/png";
  if (lower.endsWith(".webp"))
    return "image/webp";
  if (lower.endsWith(".gif"))
    return "image/gif";
  return "image/jpeg";
}
function toSqlLiteral(value) {
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
function buildTableImportStatements(db, table) {
  const columns = db.prepare(`PRAGMA table_info(${table})`).all().map((column) => column.name);
  if (columns.length === 0) {
    return [];
  }
  const rows = db.prepare(`SELECT * FROM ${table}`).all();
  const statements = [`DELETE FROM ${table};`];
  for (const row of rows) {
    const serializedValues = columns.map((column) => toSqlLiteral(row[column]));
    statements.push(`INSERT INTO ${table} (${columns.join(", ")}) VALUES (${serializedValues.join(", ")});`);
  }
  return statements;
}
function buildTableImportSql(db, table) {
  return buildTableImportStatements(db, table).join(`
`);
}
function getTableColumns(db, table) {
  return db.prepare(`PRAGMA table_info(${table})`).all().map((column) => column.name);
}
function getTableSql(db, table) {
  return db.prepare("SELECT sql FROM sqlite_master WHERE type = 'table' AND name = ?").get(table)?.sql;
}
function rebuildContentTablesForCompatibility(db, options) {
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
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
      updated_by TEXT NOT NULL
    );

    INSERT INTO content_overrides__migrated (
      slug, title, status, scheduled_at, body, seo_title, meta_description, excerpt, og_title,
      og_description, og_image, canonical_url_override, robots_directive, updated_at, updated_by
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
function ensureLegacySchemaCompatibility(db) {
  const revisionColumns = new Set(getTableColumns(db, "content_revisions"));
  const overrideColumns = new Set(getTableColumns(db, "content_overrides"));
  const needsRevisionColumns = !revisionColumns.has("author_ids") || !revisionColumns.has("category_ids") || !revisionColumns.has("tag_ids") || !revisionColumns.has("scheduled_at") || !revisionColumns.has("revision_note");
  const needsOverrideColumns = !overrideColumns.has("scheduled_at");
  const overrideSql = getTableSql(db, "content_overrides") ?? "";
  const revisionSql = getTableSql(db, "content_revisions") ?? "";
  const needsExpandedStatuses = !overrideSql.includes("'review'") || !overrideSql.includes("'archived'") || !revisionSql.includes("'review'") || !revisionSql.includes("'archived'");
  if (!needsRevisionColumns && !needsOverrideColumns && !needsExpandedStatuses) {
    return;
  }
  rebuildContentTablesForCompatibility(db, {
    hasRevisionAuthorIds: revisionColumns.has("author_ids"),
    hasRevisionCategoryIds: revisionColumns.has("category_ids"),
    hasRevisionTagIds: revisionColumns.has("tag_ids"),
    hasOverrideScheduledAt: overrideColumns.has("scheduled_at"),
    hasRevisionScheduledAt: revisionColumns.has("scheduled_at"),
    hasRevisionNote: revisionColumns.has("revision_note")
  });
}
function createAstropressSqliteSeedToolkit(options) {
  const seedImportTables = [...options.seedImportTables ?? defaultSeedImportTables];
  function getDefaultAdminDbPath(workspaceRoot = process.cwd()) {
    return options.getDefaultAdminDbPath?.(workspaceRoot) ?? defaultAdminDbPath(workspaceRoot);
  }
  function applyCommittedSchema(db) {
    db.exec(options.readSchemaSql());
    ensureLegacySchemaCompatibility(db);
  }
  function openSeedDatabase(dbPath) {
    return new SqliteDatabase(dbPath);
  }
  function seedBootstrapUsers(db) {
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
      const result = upsert.run(user.email.toLowerCase(), hashPasswordSync(user.password), user.role, user.name);
      count += result.changes ?? 1;
    }
    return count;
  }
  function seedMediaAssets(db, workspaceRoot) {
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
      const result = insert.run(asset.id, asset.sourceUrl ?? null, asset.localPath ?? `/images/legacy/${asset.id}`, asset.r2Key ?? null, guessMimeType(asset.localPath ?? asset.sourceUrl ?? asset.id), null, "", asset.id, "seed-import");
      count += result.changes ?? 1;
    }
    return count;
  }
  function seedRedirects(db) {
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
      const result = insert.run(rule.sourcePath, rule.targetPath, rule.statusCode, "seed-import");
      count += result.changes ?? 1;
    }
    return count;
  }
  function seedComments(db) {
    const insert = db.prepare(`
      INSERT INTO comments (id, author, email, body, route, status, policy, submitted_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, COALESCE(?, CURRENT_TIMESTAMP))
      ON CONFLICT(id) DO NOTHING
    `);
    let count = 0;
    for (const comment of options.comments) {
      const result = insert.run(comment.id, comment.author, comment.email ?? null, comment.body ?? null, comment.route, comment.status, comment.policy, comment.submittedAt ?? null);
      count += result.changes ?? 0;
    }
    return count;
  }
  function seedSiteSettings(db) {
    const result = db.prepare(`
          INSERT INTO site_settings (
            id, site_title, site_tagline, donation_url, newsletter_enabled, comments_default_policy, updated_by
          ) VALUES (?, ?, ?, ?, ?, ?, ?)
          ON CONFLICT(id) DO NOTHING
        `).run(1, options.siteSettings.siteTitle, options.siteSettings.siteTagline, options.siteSettings.donationUrl, options.siteSettings.newsletterEnabled ? 1 : 0, options.siteSettings.commentsDefaultPolicy, "seed-import");
    return result.changes ?? 0;
  }
  function seedSystemRoutes(db) {
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
      const result = insertVariant.run(route.variantId, route.groupId, route.path, route.title, route.summary ?? null, route.bodyHtml ?? null, route.settingsJson ?? null, route.title, route.metaDescription ?? route.summary ?? route.title, route.robotsDirective ?? null, "seed-import");
      count += result.changes ?? 1;
      insertRevision.run(`revision:${route.variantId}:seed`, route.variantId, route.path, JSON.stringify({
        path: route.path,
        title: route.title,
        summary: route.summary ?? "",
        bodyHtml: route.bodyHtml ?? "",
        settings: route.settingsJson ? JSON.parse(route.settingsJson) : null,
        renderStrategy: route.renderStrategy
      }), "Imported baseline", "seed-import");
    }
    return count;
  }
  function seedArchiveRoutes(db) {
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
      const result = insertVariant.run(variantId, groupId, archive.legacyUrl, archive.title, archive.summary ?? null, archive.seoTitle ?? archive.title, archive.metaDescription ?? archive.summary ?? "", archive.canonicalUrlOverride ?? null, archive.robotsDirective ?? null, "seed-import");
      count += result.changes ?? 1;
    }
    return count;
  }
  function seedMarketingRoutes(db) {
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
      const locale = page.path.startsWith("/es/") ? "es" : "en";
      const baseId = page.path.replace(/^\//, "").replaceAll("/", ":");
      const groupId = `page:${baseId}`;
      const variantId = `variant:page:${baseId}:${locale}`;
      insertGroup.run(groupId, locale, page.path);
      const result = insertVariant.run(variantId, groupId, locale, page.path, page.title, page.summary, JSON.stringify(page.sections), JSON.stringify({ templateKey: page.templateKey, alternateLinks: page.alternateLinks ?? [] }), page.seoTitle, page.metaDescription, page.ogImage ?? null, page.canonicalUrlOverride ?? null, page.robotsDirective ?? null, "seed-import");
      count += result.changes ?? 1;
    }
    return count;
  }
  function seedDatabase(seedOptions = {}) {
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
        marketingRoutes: seedMarketingRoutes(db)
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
        return ["BEGIN TRANSACTION;", ...tableSql, "COMMIT;"].join(`

`);
      } finally {
        db.close();
      }
    } finally {
      rmSync(tempPath, { force: true });
    }
  }
  function buildSeedImportStatements(workspaceRoot = process.cwd(), seededDb) {
    const tempPath = path.join(tmpdir(), `astropress-seed-${Date.now()}-${Math.random().toString(36).slice(2)}.sqlite`);
    const db = seededDb ?? (() => {
      seedDatabase({ dbPath: tempPath, reset: true, workspaceRoot });
      return openSeedDatabase(tempPath);
    })();
    try {
      return seedImportTables.map((table) => ({
        table,
        statements: buildTableImportStatements(db, table),
        sql: buildTableImportSql(db, table)
      })).filter((statement) => statement.sql.length > 0);
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
    buildSeedImportStatements
  };
}
function createDefaultAstropressSqliteSeedToolkit() {
  return createAstropressSqliteSeedToolkit({
    readSchemaSql: readAstropressSqliteSchemaSql,
    loadBootstrapUsers() {
      return [
        {
          email: "admin@example.com",
          password: "password",
          role: "admin",
          name: "Admin"
        },
        {
          email: "editor@example.com",
          password: "password",
          role: "editor",
          name: "Editor"
        }
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
      commentsDefaultPolicy: defaultSiteSettings.commentsDefaultPolicy
    }
  });
}
export {
  resolveAstropressSqliteSchemaPath,
  readAstropressSqliteSchemaSql,
  defaultSeedImportTables,
  createDefaultAstropressSqliteSeedToolkit,
  createAstropressSqliteSeedToolkit
};
