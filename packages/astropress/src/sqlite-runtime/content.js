import { createAstropressContentRepository } from "../content-repository-factory.js";
import { createAstropressSubmissionRepository } from "../submission-repository-factory.js";
import {
  getSeedPageRecords,
  normalizeContentStatus,
  parseIdList,
  serializeIdList,
  slugifyTerm,
  normalizePath,
} from "./utils.js";

function createSqliteContentStore(getDb, randomId) {
  function recordAudit(actor, action, summary, resourceType, resourceId) {
    getDb().prepare(`
          INSERT INTO audit_events (user_email, action, resource_type, resource_id, summary)
          VALUES (?, ?, ?, ?, ?)
        `).run(actor.email, action, resourceType, resourceId, summary);
  }

  function getCustomContentEntries() {
    return getDb().prepare(`
          SELECT slug, legacy_url, title, kind, template_key, source_html_path, updated_at, body, summary,
                 seo_title, meta_description, og_title, og_description, og_image
          FROM content_entries
          ORDER BY datetime(updated_at) DESC, slug ASC
        `).all();
  }

  function mapCustomContentEntry(row) {
    return {
      slug: row.slug,
      legacyUrl: row.legacy_url,
      title: row.title,
      templateKey: row.template_key,
      listingItems: [],
      paginationLinks: [],
      sourceHtmlPath: row.source_html_path,
      updatedAt: row.updated_at,
    /* v8 ignore next 4 */
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

  function getAllContentRecords() {
    return [...getSeedPageRecords(), ...getCustomContentEntries().map((row) => mapCustomContentEntry(row))];
  }

  function toContentRecord(pageRecord) {
    return {
      ...pageRecord,
    /* v8 ignore next 3 */
      status: pageRecord.status ?? "published",
      seoTitle: pageRecord.seoTitle ?? pageRecord.title,
      metaDescription: pageRecord.metaDescription ?? pageRecord.summary ?? "",
    };
  }

  function findPageRecord(slug) {
    return getAllContentRecords().find((entry) => entry.slug === slug || entry.legacyUrl === `/${slug}`) ?? null;
  }

  function getContentAssignmentIds(slug) {
    const db = getDb();
    const authorIds = db.prepare("SELECT author_id FROM content_authors WHERE slug = ? ORDER BY author_id ASC").all(slug).map((row) => row.author_id);
    const categoryIds = db.prepare("SELECT category_id FROM content_categories WHERE slug = ? ORDER BY category_id ASC").all(slug).map((row) => row.category_id);
    const tagIds = db.prepare("SELECT tag_id FROM content_tags WHERE slug = ? ORDER BY tag_id ASC").all(slug).map((row) => row.tag_id);
    return { authorIds, categoryIds, tagIds };
  }

  function replaceContentAssignments(slug, input) {
    const db = getDb();
    db.prepare("DELETE FROM content_authors WHERE slug = ?").run(slug);
    db.prepare("DELETE FROM content_categories WHERE slug = ?").run(slug);
    db.prepare("DELETE FROM content_tags WHERE slug = ?").run(slug);
      /* v8 ignore next 9 */
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

  function mapPersistedOverride(row) {
    if (!row) {
      return null;
    }
    return {
      title: row.title,
      status: row.status,
      scheduledAt: row.scheduled_at ?? undefined,
      /* v8 ignore next 1 */
      body: row.body ?? undefined,
      seoTitle: row.seo_title,
      metaDescription: row.meta_description,
      excerpt: row.excerpt ?? undefined,
      ogTitle: row.og_title ?? undefined,
      ogDescription: row.og_description ?? undefined,
      ogImage: row.og_image ?? undefined,
      canonicalUrlOverride: row.canonical_url_override ?? undefined,
      robotsDirective: row.robots_directive ?? undefined,
    };
  }

  function getPersistedContentOverride(slug) {
    const row = getDb().prepare(`
          SELECT title, status, body, seo_title, meta_description, excerpt, og_title, og_description, og_image,
                 scheduled_at, canonical_url_override, robots_directive
          FROM content_overrides
          WHERE slug = ?
          LIMIT 1
        `).get(slug);
    return mapPersistedOverride(row);
  }

  function ensureBaselineRevision(pageRecord) {
    const db = getDb();
    db.prepare(`
        INSERT INTO content_overrides (
          slug, title, status, body, seo_title, meta_description, excerpt, og_title,
          og_description, og_image, scheduled_at, canonical_url_override, robots_directive, updated_at, updated_by
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, ?)
        ON CONFLICT(slug) DO NOTHING
      /* v8 ignore next 1 */
      `).run(pageRecord.slug, pageRecord.title, pageRecord.status ?? "published", pageRecord.body ?? null, pageRecord.seoTitle ?? pageRecord.title, pageRecord.metaDescription ?? pageRecord.summary ?? "", pageRecord.summary ?? null, null, null, null, null, null, null, "seed-import");
    const existing = db.prepare("SELECT id FROM content_revisions WHERE slug = ? AND source = 'imported' LIMIT 1").get(pageRecord.slug);
    if (existing) {
      return;
    }
    db.prepare(`
        INSERT INTO content_revisions (
          id, slug, title, status, scheduled_at, body, seo_title, meta_description, excerpt,
          og_title, og_description, og_image, canonical_url_override, robots_directive, revision_note, source, created_at, created_by
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'imported', ?, ?)
      /* v8 ignore next 1 */
      `).run(`revision-${randomId()}`, pageRecord.slug, pageRecord.title, pageRecord.status ?? "published", null, pageRecord.body ?? null, pageRecord.seoTitle ?? pageRecord.title, pageRecord.metaDescription ?? pageRecord.summary ?? "", pageRecord.summary ?? null, null, null, null, null, null, null, "imported-baseline", "seed-import");
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
      return getContentAssignmentIds(slug);
    },
    ensureBaselineRevision(record) {
      ensureBaselineRevision(record);
    },
    listPersistedRevisions(slug) {
      const rows = getDb().prepare(`
            SELECT id, slug, title, status, scheduled_at, body, seo_title, meta_description, excerpt, og_title,
                   og_description, og_image, author_ids, category_ids, tag_ids, canonical_url_override, robots_directive, revision_note, source, created_at, created_by
            FROM content_revisions
            WHERE slug = ?
            ORDER BY datetime(created_at) DESC, id DESC
          `).all(slug);
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
      /* v8 ignore next 1 */
        createdBy: row.created_by ?? undefined,
      }));
    },
    getPersistedRevision(slug, revisionId) {
      return this.listPersistedRevisions(slug).find((revision) => revision.id === revisionId) ?? null;
    },
    upsertContentOverride(slug, override, actor) {
      getDb().prepare(`
            INSERT INTO content_overrides (
              slug, title, status, body, seo_title, meta_description, excerpt, og_title,
              og_description, og_image, scheduled_at, canonical_url_override, robots_directive, updated_at, updated_by
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, ?)
            ON CONFLICT(slug) DO UPDATE SET
              title = excluded.title,
              status = excluded.status,
              body = excluded.body,
              seo_title = excluded.seo_title,
              meta_description = excluded.meta_description,
              excerpt = excluded.excerpt,
              og_title = excluded.og_title,
              og_description = excluded.og_description,
              og_image = excluded.og_image,
              scheduled_at = excluded.scheduled_at,
              canonical_url_override = excluded.canonical_url_override,
              robots_directive = excluded.robots_directive,
              updated_at = CURRENT_TIMESTAMP,
              updated_by = excluded.updated_by
          /* v8 ignore next 1 */
          `).run(slug, override.title, override.status, override.body ?? null, override.seoTitle, override.metaDescription, override.excerpt ?? null, override.ogTitle ?? null, override.ogDescription ?? null, override.ogImage ?? null, override.scheduledAt ?? null, override.canonicalUrlOverride ?? null, override.robotsDirective ?? null, actor.email);
    },
    replaceContentAssignments(slug, assignments) {
      replaceContentAssignments(slug, assignments);
    },
    insertReviewedRevision(slug, revision, actor) {
      getDb().prepare(`
            INSERT INTO content_revisions (
              id, slug, title, status, scheduled_at, body, seo_title, meta_description, excerpt,
              og_title, og_description, og_image, author_ids, category_ids, tag_ids, canonical_url_override, robots_directive, revision_note, source, created_by
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'reviewed', ?)
          /* v8 ignore next 1 */
          `).run(`revision-${randomId()}`, slug, revision.title, revision.status, revision.scheduledAt ?? null, revision.body ?? null, revision.seoTitle, revision.metaDescription, revision.excerpt ?? null, revision.ogTitle ?? null, revision.ogDescription ?? null, revision.ogImage ?? null, serializeIdList(revision.authorIds), serializeIdList(revision.categoryIds), serializeIdList(revision.tagIds), revision.canonicalUrlOverride ?? null, revision.robotsDirective ?? null, revision.revisionNote ?? null, actor.email);
    },
    insertContentEntry(entry) {
      try {
        getDb().prepare(`
              INSERT INTO content_entries (
                slug, legacy_url, title, kind, template_key, source_html_path, updated_at, body, summary,
                seo_title, meta_description, og_title, og_description, og_image
              ) VALUES (?, ?, ?, 'post', 'content', ?, CURRENT_TIMESTAMP, ?, ?, ?, ?, ?, ?, ?)
            `).run(entry.slug, entry.legacyUrl, entry.title, `runtime://content/${entry.slug}`, entry.body, entry.summary, entry.seoTitle, entry.metaDescription, entry.ogTitle ?? null, entry.ogDescription ?? null, entry.ogImage ?? null);
        return true;
      /* v8 ignore next 3 */
      } catch {
        return false;
      }
    },
    recordContentAudit({ actor, action, summary, targetId }) {
      recordAudit(actor, action, summary, "content", targetId);
    },
  });

  function getContactSubmissions() {
    const rows = getDb().prepare(`
          SELECT id, name, email, message, submitted_at
          FROM contact_submissions
          ORDER BY datetime(submitted_at) DESC, id DESC
        `).all();
    return rows.map((row) => ({
      id: row.id,
      name: row.name,
      email: row.email,
      message: row.message,
      submittedAt: row.submitted_at,
    }));
  }

  const sqliteSubmissionRepository = createAstropressSubmissionRepository({
    getContactSubmissions,
    insertContactSubmission(submission) {
      getDb().prepare(`
            INSERT INTO contact_submissions (id, name, email, message, submitted_at)
            VALUES (?, ?, ?, ?, ?)
          `).run(submission.id, submission.name, submission.email, submission.message, submission.submittedAt);
    },
  });

  return { sqliteContentRepository, sqliteSubmissionRepository };
}

export { createSqliteContentStore };
