// stryker-disable-file: data-only — pure SQL DDL string constants for legacy schema
// compatibility migrations. The conditional dispatch (`opts.hasX ? "..." : "..."`) lives
// in sqlite-schema-compat.ts and is mutation-tested there. The strings here are arbitrary
// SQL bytes — pinning every keystroke is not a useful exercise; integration tests in
// disaster-recovery / upgrade-path-e2e exercise the whole migration end-to-end.

export const REBUILD_OVERRIDES_HEAD = `
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
      `;

export const REBUILD_OVERRIDES_TAIL = `,
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
      `;

export const REBUILD_REVISIONS_MID_BEFORE_AUTHORS = `,
      body,
      seo_title,
      meta_description,
      excerpt,
      og_title,
      og_description,
      og_image,
      `;

export const REBUILD_REVISIONS_MID_AFTER_TAGS = `,
      canonical_url_override,
      robots_directive,
      `;

export const REBUILD_REVISIONS_FOOTER = `,
      created_at,
      created_by
    FROM content_revisions;

    DROP TABLE content_revisions;
    ALTER TABLE content_revisions__migrated RENAME TO content_revisions;
    CREATE INDEX IF NOT EXISTS idx_content_revisions_slug ON content_revisions(slug);
    CREATE INDEX IF NOT EXISTS idx_content_revisions_created_at ON content_revisions(created_at DESC);

    PRAGMA foreign_keys = ON;
  `;

export const FTS5_INDEX_DDL = `
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
  `;

export const CONTENT_LOCKS_DDL = `
      CREATE TABLE IF NOT EXISTS content_locks (
        slug TEXT PRIMARY KEY,
        locked_by_email TEXT NOT NULL,
        locked_by_name TEXT NOT NULL,
        lock_token TEXT NOT NULL,
        expires_at TEXT NOT NULL,
        acquired_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
      );
      CREATE INDEX IF NOT EXISTS idx_content_locks_expires_at ON content_locks(expires_at);
    `;

export const ADMIN_USERS_DROP_ROLE_HEAD = `
      PRAGMA foreign_keys = OFF;
      CREATE TABLE admin_users__migrated (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        email TEXT NOT NULL UNIQUE,
        password_hash TEXT NOT NULL,
        is_admin INTEGER NOT NULL DEFAULT 0,
        name TEXT NOT NULL,
        active INTEGER NOT NULL DEFAULT 1,
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
      );
      INSERT INTO admin_users__migrated (id, email, password_hash, is_admin, name, active, created_at)
        SELECT id, email, password_hash,
               CASE WHEN is_admin = 1 OR role = 'admin' THEN 1 ELSE 0 END,
               `;

export const ADMIN_USERS_DROP_ROLE_TAIL = `
        FROM admin_users;
      DROP TABLE admin_users;
      ALTER TABLE admin_users__migrated RENAME TO admin_users;
      PRAGMA foreign_keys = ON;
    `;
