import { createAstropressContentRepository } from "../content-repository-factory";
import { createSqliteSubmissionStore } from "./content-submissions";
import {
  getSeedPageRecords,
  normalizeContentStatus,
  parseIdList,
  serializeIdList,
  slugifyTerm,
  normalizePath,
  type AstropressSqliteDatabaseLike,
  type PageRecord,
} from "./utils";
import { recordAudit } from "./audit-log";
import type { ContentRecord, SessionUser, Actor } from "../persistence-types";

type ContentStatus = "draft" | "review" | "published" | "archived";
const SQL_UPSERT_OVERRIDE = `INSERT INTO content_overrides (slug, title, status, body, seo_title, meta_description, excerpt, og_title, og_description, og_image, scheduled_at, canonical_url_override, robots_directive, metadata, updated_at, updated_by) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, ?) ON CONFLICT(slug) DO UPDATE SET title = excluded.title, status = excluded.status, body = excluded.body, seo_title = excluded.seo_title, meta_description = excluded.meta_description, excerpt = excluded.excerpt, og_title = excluded.og_title, og_description = excluded.og_description, og_image = excluded.og_image, scheduled_at = excluded.scheduled_at, canonical_url_override = excluded.canonical_url_override, robots_directive = excluded.robots_directive, metadata = excluded.metadata, updated_at = CURRENT_TIMESTAMP, updated_by = excluded.updated_by`;
const SQL_INSERT_REVISION = `INSERT INTO content_revisions (id, slug, title, status, scheduled_at, body, seo_title, meta_description, excerpt, og_title, og_description, og_image, author_ids, category_ids, tag_ids, canonical_url_override, robots_directive, revision_note, source, created_by) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'reviewed', ?)`;
const SQL_INSERT_ENTRY = `INSERT INTO content_entries (slug, legacy_url, title, kind, template_key, source_html_path, updated_at, body, summary, seo_title, meta_description, og_title, og_description, og_image) VALUES (?, ?, ?, 'post', 'content', ?, CURRENT_TIMESTAMP, ?, ?, ?, ?, ?, ?, ?)`;
const SQL_LIST_REVISIONS = `SELECT id, slug, title, status, scheduled_at, body, seo_title, meta_description, excerpt, og_title, og_description, og_image, author_ids, category_ids, tag_ids, canonical_url_override, robots_directive, revision_note, source, created_at, created_by FROM content_revisions WHERE slug = ? ORDER BY datetime(created_at) DESC, id DESC`;
const SQL_INSERT_BASELINE_OVERRIDE = `INSERT INTO content_overrides (slug, title, status, body, seo_title, meta_description, excerpt, og_title, og_description, og_image, scheduled_at, canonical_url_override, robots_directive, updated_at, updated_by) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, ?) ON CONFLICT(slug) DO NOTHING`;
const SQL_INSERT_BASELINE_REVISION = `INSERT INTO content_revisions (id, slug, title, status, scheduled_at, body, seo_title, meta_description, excerpt, og_title, og_description, og_image, canonical_url_override, robots_directive, revision_note, source, created_at, created_by) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'imported', ?, ?)`;
type RevisionInput = {
  title: string; status: string; scheduledAt?: string | null; body?: string | null;
  seoTitle: string; metaDescription: string; excerpt?: string | null;
  ogTitle?: string | null; ogDescription?: string | null; ogImage?: string | null;
  authorIds?: number[]; categoryIds?: number[]; tagIds?: number[];
  canonicalUrlOverride?: string | null; robotsDirective?: string | null; revisionNote?: string | null;
};
type RevisionRow = {
  id: string; slug: string; title: string; status: ContentStatus; scheduled_at: string | null;
  body: string | null; seo_title: string; meta_description: string; excerpt: string | null;
  og_title: string | null; og_description: string | null; og_image: string | null;
  author_ids: string | null; category_ids: string | null; tag_ids: string | null;
  canonical_url_override: string | null; robots_directive: string | null;
  revision_note: string | null; source: "imported" | "reviewed"; created_at: string; created_by: string | null;
};

type OverrideRow = {
  title: string;
  status: ContentStatus;
  scheduled_at: string | null;
  body: string | null;
  seo_title: string;
  meta_description: string;
  excerpt: string | null;
  og_title: string | null;
  og_description: string | null;
  og_image: string | null;
  canonical_url_override: string | null;
  robots_directive: string | null;
  metadata: string | null;
};

function queryCustomContentEntries(getDb: () => AstropressSqliteDatabaseLike) {
  return getDb()
    .prepare(
      `
        SELECT slug, legacy_url, title, kind, template_key, source_html_path, updated_at, body, summary,
               seo_title, meta_description, og_title, og_description, og_image
        FROM content_entries
        ORDER BY datetime(updated_at) DESC, slug ASC
      `,
    )
    .all() as Array<{
    slug: string;
    legacy_url: string;
    title: string;
    kind: string;
    template_key: string;
    source_html_path: string;
    updated_at: string;
    body: string | null;
    summary: string | null;
    seo_title: string | null;
    meta_description: string | null;
    og_title: string | null;
    og_description: string | null;
    og_image: string | null;
  }>;
}

function mapCustomEntry(row: ReturnType<typeof queryCustomContentEntries>[number]): PageRecord {
  return {
    slug: row.slug,
    legacyUrl: row.legacy_url,
    title: row.title,
    templateKey: row.template_key,
    listingItems: [],
    paginationLinks: [],
    sourceHtmlPath: row.source_html_path,
    updatedAt: row.updated_at,
    body: row.body ?? "",
    summary: row.summary ?? "",
    seoTitle: row.seo_title ?? row.title,
    metaDescription: row.meta_description ?? row.summary ?? "",
    ogTitle: row.og_title ?? undefined,
    ogDescription: row.og_description ?? undefined,
    ogImage: row.og_image ?? undefined,
    kind: row.kind,
    status: "draft",
  };
}

function mapOverrideRow(row: OverrideRow | undefined) {
  if (!row) return null;
  let metadata: Record<string, unknown> | undefined;
  if (row.metadata) { try { metadata = JSON.parse(row.metadata) as Record<string, unknown>; } catch { metadata = undefined; } }
  return {
    title: row.title, status: row.status, scheduledAt: row.scheduled_at ?? undefined,
    body: row.body ?? undefined, seoTitle: row.seo_title, metaDescription: row.meta_description,
    excerpt: row.excerpt ?? undefined, ogTitle: row.og_title ?? undefined,
    ogDescription: row.og_description ?? undefined, ogImage: row.og_image ?? undefined,
    canonicalUrlOverride: row.canonical_url_override ?? undefined,
    robotsDirective: row.robots_directive ?? undefined, metadata,
  };
}

function queryContentAssignmentIds(getDb: () => AstropressSqliteDatabaseLike, slug: string) {
  const db = getDb();
  const authorIds = (
    db.prepare("SELECT author_id FROM content_authors WHERE slug = ? ORDER BY author_id ASC").all(slug) as Array<{ author_id: number }>
  ).map((row) => row.author_id);
  const categoryIds = (
    db.prepare("SELECT category_id FROM content_categories WHERE slug = ? ORDER BY category_id ASC").all(slug) as Array<{ category_id: number }>
  ).map((row) => row.category_id);
  const tagIds = (
    db.prepare("SELECT tag_id FROM content_tags WHERE slug = ? ORDER BY tag_id ASC").all(slug) as Array<{ tag_id: number }>
  ).map((row) => row.tag_id);
  return { authorIds, categoryIds, tagIds };
}

function replaceAssignments(
  getDb: () => AstropressSqliteDatabaseLike,
  slug: string,
  input: { authorIds?: number[]; categoryIds?: number[]; tagIds?: number[] },
) {
  const db = getDb();
  db.prepare("DELETE FROM content_authors WHERE slug = ?").run(slug);
  db.prepare("DELETE FROM content_categories WHERE slug = ?").run(slug);
  db.prepare("DELETE FROM content_tags WHERE slug = ?").run(slug);

  for (const authorId of input.authorIds ?? []) {
    db.prepare("INSERT OR IGNORE INTO content_authors (slug, author_id) VALUES (?, ?)").run(slug, authorId);
  }
  for (const categoryId of input.categoryIds ?? []) {
    db.prepare("INSERT OR IGNORE INTO content_categories (slug, category_id) VALUES (?, ?)").run(slug, categoryId);
  }
  for (const tagId of input.tagIds ?? []) {
    db.prepare("INSERT OR IGNORE INTO content_tags (slug, tag_id) VALUES (?, ?)").run(slug, tagId);
  }
}

function mapRevisionRows(rows: RevisionRow[]) {
  return rows.map((row) => ({
    id: row.id,
    slug: row.slug,
    title: row.title,
    status: row.status,
    scheduledAt: row.scheduled_at ?? undefined,
    body: row.body ?? undefined,
    authorIds: parseIdList(row.author_ids),
    categoryIds: parseIdList(row.category_ids),
    tagIds: parseIdList(row.tag_ids),
    seoTitle: row.seo_title,
    metaDescription: row.meta_description,
    excerpt: row.excerpt ?? undefined,
    ogTitle: row.og_title ?? undefined,
    ogDescription: row.og_description ?? undefined,
    ogImage: row.og_image ?? undefined,
    canonicalUrlOverride: row.canonical_url_override ?? undefined,
    robotsDirective: row.robots_directive ?? undefined,
    source: row.source,
    createdAt: row.created_at,
    revisionNote: row.revision_note ?? undefined,
    createdBy: row.created_by ?? undefined,
  }));
}

function upsertOverride(
  getDb: () => AstropressSqliteDatabaseLike,
  slug: string,
  override: { title: string; status: string; body?: string | null; seoTitle: string; metaDescription: string; excerpt?: string | null; ogTitle?: string | null; ogDescription?: string | null; ogImage?: string | null; scheduledAt?: string | null; canonicalUrlOverride?: string | null; robotsDirective?: string | null; metadata?: Record<string, unknown> | null },
  actor: { email: string },
) {
  getDb()
    .prepare(SQL_UPSERT_OVERRIDE)
    .run(
      slug,
      override.title,
      override.status,
      override.body ?? null,
      override.seoTitle,
      override.metaDescription,
      override.excerpt ?? null,
      override.ogTitle ?? null,
      override.ogDescription ?? null,
      override.ogImage ?? null,
      override.scheduledAt ?? null,
      override.canonicalUrlOverride ?? null,
      override.robotsDirective ?? null,
      override.metadata ? JSON.stringify(override.metadata) : null,
      actor.email,
    );
}

function insertRevision(
  getDb: () => AstropressSqliteDatabaseLike, randomId: () => string,
  slug: string, revision: RevisionInput, actor: { email: string },
) {
  getDb()
    .prepare(SQL_INSERT_REVISION)
    .run(
      `revision-${randomId()}`,
      slug,
      revision.title,
      revision.status,
      revision.scheduledAt ?? null,
      revision.body ?? null,
      revision.seoTitle,
      revision.metaDescription,
      revision.excerpt ?? null,
      revision.ogTitle ?? null,
      revision.ogDescription ?? null,
      revision.ogImage ?? null,
      serializeIdList(revision.authorIds),
      serializeIdList(revision.categoryIds),
      serializeIdList(revision.tagIds),
      revision.canonicalUrlOverride ?? null,
      revision.robotsDirective ?? null,
      revision.revisionNote ?? null,
      actor.email,
    );
}

function tryInsertContentEntry(
  getDb: () => AstropressSqliteDatabaseLike,
  entry: { slug: string; legacyUrl: string; title: string; body: string; summary: string; seoTitle: string; metaDescription: string; ogTitle?: string | null; ogDescription?: string | null; ogImage?: string | null },
): boolean {
  try {
    getDb()
      .prepare(SQL_INSERT_ENTRY)
      .run(
        entry.slug,
        entry.legacyUrl,
        entry.title,
        `runtime://content/${entry.slug}`,
        entry.body,
        entry.summary,
        entry.seoTitle,
        entry.metaDescription,
        entry.ogTitle ?? null,
        entry.ogDescription ?? null,
        entry.ogImage ?? null,
      );
    return true;
  } catch {
    return false;
  }
}

function buildBaselineOverrideParams(pageRecord: PageRecord) {
  return [
    pageRecord.slug,
    pageRecord.title,
    pageRecord.status ?? "published",
    pageRecord.body ?? null,
    pageRecord.seoTitle ?? pageRecord.title,
    pageRecord.metaDescription ?? pageRecord.summary ?? "",
    pageRecord.summary ?? null,
    null, null, null, null, null, null,
    "seed-import",
  ];
}

function buildBaselineRevisionParams(randomId: () => string, pageRecord: PageRecord) {
  return [
    `revision-${randomId()}`,
    pageRecord.slug,
    pageRecord.title,
    pageRecord.status ?? "published",
    null,
    pageRecord.body ?? null,
    pageRecord.seoTitle ?? pageRecord.title,
    pageRecord.metaDescription ?? pageRecord.summary ?? "",
    pageRecord.summary ?? null,
    null, null, null, null, null, null,
    "imported-baseline",
    "seed-import",
  ];
}

function ensureBaselineRevisionImpl(getDb: () => AstropressSqliteDatabaseLike, randomId: () => string, pageRecord: PageRecord) {
  const db = getDb();
  db.prepare(SQL_INSERT_BASELINE_OVERRIDE).run(...buildBaselineOverrideParams(pageRecord));
  const existing = db
    .prepare("SELECT id FROM content_revisions WHERE slug = ? AND source = 'imported' LIMIT 1")
    .get(pageRecord.slug) as { id: string } | undefined;
  if (existing) return;
  db.prepare(SQL_INSERT_BASELINE_REVISION).run(...buildBaselineRevisionParams(randomId, pageRecord));
}

export function createSqliteContentStore(getDb: () => AstropressSqliteDatabaseLike, randomId: () => string) {

  function getCustomContentEntries() {
    return queryCustomContentEntries(getDb);
  }

  function getAllContentRecords() {
    return [...getSeedPageRecords(), ...getCustomContentEntries().map((row) => mapCustomEntry(row))];
  }

  function toContentRecord(pageRecord: PageRecord): ContentRecord {
    return {
      ...pageRecord,
      status: pageRecord.status ?? "published",
      seoTitle: pageRecord.seoTitle ?? pageRecord.title,
      metaDescription: pageRecord.metaDescription ?? pageRecord.summary ?? "",
    };
  }

  function findPageRecord(slug: string) {
    return getAllContentRecords().find((entry) => entry.slug === slug || entry.legacyUrl === `/${slug}`) ?? null;
  }

  function getPersistedContentOverride(slug: string) {
    const row = getDb()
      .prepare(
        `
          SELECT title, status, body, seo_title, meta_description, excerpt, og_title, og_description, og_image,
                 scheduled_at, canonical_url_override, robots_directive, metadata
          FROM content_overrides
          WHERE slug = ?
          LIMIT 1
        `,
      )
      .get(slug) as OverrideRow | undefined;

    return mapOverrideRow(row);
  }

  function ensureBaselineRevision(pageRecord: PageRecord) {
    ensureBaselineRevisionImpl(getDb, randomId, pageRecord);
  }

  const sqliteContentRepository = createAstropressContentRepository({
    normalizePath,
    slugifyTerm,
    normalizeContentStatus,
    findContentRecord(slug) {
      const record = findPageRecord(slug);
      return record ? toContentRecord(record) : null;
    },
    listContentRecords() {
      return getAllContentRecords().map((record) => toContentRecord(record));
    },
    getPersistedOverride: getPersistedContentOverride,
    getContentAssignments(slug) {
      return queryContentAssignmentIds(getDb, slug);
    },
    ensureBaselineRevision(record) {
      ensureBaselineRevision(record as PageRecord);
    },
    listPersistedRevisions(slug) {
      const rows = getDb().prepare(SQL_LIST_REVISIONS).all(slug) as RevisionRow[];
      return mapRevisionRows(rows);
    },
    getPersistedRevision(slug, revisionId) {
      return this.listPersistedRevisions(slug).find((revision) => revision.id === revisionId) ?? null;
    },
    upsertContentOverride(slug, override, actor) {
      upsertOverride(getDb, slug, override, actor);
    },
    replaceContentAssignments(slug, assignments) {
      replaceAssignments(getDb, slug, assignments);
    },
    insertReviewedRevision(slug, revision, actor) {
      insertRevision(getDb, randomId, slug, revision, actor);
    },
    insertContentEntry(entry) {
      return tryInsertContentEntry(getDb, entry);
    },
    recordContentAudit({ actor, action, summary, targetId }) {
      recordAudit(getDb(), actor, action, summary, "content", targetId);
    },
  });
  const { sqliteSubmissionRepository, sqliteSchedulingRepository } = createSqliteSubmissionStore(getDb);
  return { sqliteContentRepository, sqliteSubmissionRepository, sqliteSchedulingRepository };
}
