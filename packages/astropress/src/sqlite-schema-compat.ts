import type { SqliteDatabaseLike } from "./sqlite-bootstrap.js";

export function getTableColumns(db: SqliteDatabaseLike, table: string) {
  return (
    db.prepare(`PRAGMA table_info(${table})`).all() as Array<{ name: string }>
  ).map((column) => column.name);
}

export function getTableSql(db: SqliteDatabaseLike, table: string) {
  return (
    db.prepare("SELECT sql FROM sqlite_master WHERE type = 'table' AND name = ?").get(table) as
      | { sql: string | null }
      | undefined
  )?.sql;
}

export function rebuildContentTablesForCompatibility(
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

export function ensureFts5SearchIndex(db: SqliteDatabaseLike) {
  const existing = (
    db.prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'content_fts'").get() as
      | { name: string }
      | undefined
  );
  if (existing) {
    return;
  }

  db.exec(`
    CREATE VIRTUAL TABLE content_fts USING fts5(
      slug UNINDEXED, title, body,
      content='content_overrides', content_rowid='rowid'
    );

    INSERT INTO content_fts(rowid, slug, title, body)
    SELECT rowid, slug, title, COALESCE(body, '') FROM content_overrides;

    CREATE TRIGGER content_fts_ai AFTER INSERT ON content_overrides BEGIN
      INSERT INTO content_fts(rowid, slug, title, body)
      VALUES (new.rowid, new.slug, new.title, COALESCE(new.body, ''));
    END;

    CREATE TRIGGER content_fts_au AFTER UPDATE ON content_overrides BEGIN
      INSERT INTO content_fts(content_fts, rowid, slug, title, body)
      VALUES ('delete', old.rowid, old.slug, old.title, COALESCE(old.body, ''));
      INSERT INTO content_fts(rowid, slug, title, body)
      VALUES (new.rowid, new.slug, new.title, COALESCE(new.body, ''));
    END;

    CREATE TRIGGER content_fts_ad AFTER DELETE ON content_overrides BEGIN
      INSERT INTO content_fts(content_fts, rowid, slug, title, body)
      VALUES ('delete', old.rowid, old.slug, old.title, COALESCE(old.body, ''));
    END;
  `);
}

export function ensureLegacySchemaCompatibility(db: SqliteDatabaseLike) {
  const revisionColumns = new Set(getTableColumns(db, "content_revisions"));
  const overrideColumns = new Set(getTableColumns(db, "content_overrides"));
  const needsRevisionColumns =
    !revisionColumns.has("author_ids") ||
    !revisionColumns.has("category_ids") ||
    !revisionColumns.has("tag_ids") ||
    !revisionColumns.has("scheduled_at") ||
    !revisionColumns.has("revision_note");
  const needsOverrideColumns = !overrideColumns.has("scheduled_at");

  if (!overrideColumns.has("metadata")) {
    db.exec("ALTER TABLE content_overrides ADD COLUMN metadata TEXT");
  }

  const mediaColumns = new Set(getTableColumns(db, "media_assets"));
  if (!mediaColumns.has("thumbnail_url")) {
    db.exec("ALTER TABLE media_assets ADD COLUMN thumbnail_url TEXT");
  }
  if (!mediaColumns.has("srcset")) {
    db.exec("ALTER TABLE media_assets ADD COLUMN srcset TEXT");
  }

  const migrationColumns = new Set(getTableColumns(db, "schema_migrations"));
  if (!migrationColumns.has("rollback_sql")) {
    db.exec("ALTER TABLE schema_migrations ADD COLUMN rollback_sql TEXT");
  }

  const contentLocksExists = getTableSql(db, "content_locks");
  if (!contentLocksExists) {
    db.exec(`
      CREATE TABLE IF NOT EXISTS content_locks (
        slug TEXT PRIMARY KEY,
        locked_by_email TEXT NOT NULL,
        locked_by_name TEXT NOT NULL,
        lock_token TEXT NOT NULL,
        expires_at TEXT NOT NULL,
        acquired_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
      );
      CREATE INDEX IF NOT EXISTS idx_content_locks_expires_at ON content_locks(expires_at);
    `);
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
