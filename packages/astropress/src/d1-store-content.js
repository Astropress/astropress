import { getCmsConfig } from "./config.js";
import { parseIdList } from "./admin-normalizers.js";

function getPageRecords() {
  return getCmsConfig().seedPages;
}

async function getCustomContentEntries(db) {
  const rows = (
    await db
      .prepare(
        `
          SELECT slug, legacy_url, title, kind, template_key, source_html_path, updated_at, body, summary,
                 seo_title, meta_description, og_title, og_description, og_image
          FROM content_entries
          ORDER BY datetime(updated_at) DESC, slug ASC
        `,
      )
      .all()
  ).results;

  return rows.map((row) => ({
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
  }));
}

async function getAllContentRecords(db) {
  return [...getPageRecords(), ...(await getCustomContentEntries(db))];
}

async function findPageRecord(db, slug) {
  const records = await getAllContentRecords(db);
  return records.find((entry) => entry.slug === slug || entry.legacyUrl === `/${slug}`) ?? null;
}

function mapPersistedOverride(row) {
  if (!row) {
    return null;
  }

  return {
    title: row.title,
    status: row.status,
    scheduledAt: row.scheduled_at ?? undefined,
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

async function getD1ContentAssignmentIds(db, slug) {
  const [authorRows, categoryRows, tagRows] = await Promise.all([
    db.prepare("SELECT author_id FROM content_authors WHERE slug = ? ORDER BY author_id ASC").bind(slug).all(),
    db.prepare("SELECT category_id FROM content_categories WHERE slug = ? ORDER BY category_id ASC").bind(slug).all(),
    db.prepare("SELECT tag_id FROM content_tags WHERE slug = ? ORDER BY tag_id ASC").bind(slug).all(),
  ]);

  return {
    authorIds: authorRows.results.map((row) => row.author_id),
    categoryIds: categoryRows.results.map((row) => row.category_id),
    tagIds: tagRows.results.map((row) => row.tag_id),
  };
}

async function getPersistedContentOverride(db, slug) {
  const row = await db
    .prepare(
      `
        SELECT title, status, scheduled_at, body, seo_title, meta_description, excerpt, og_title, og_description, og_image,
               canonical_url_override, robots_directive
        FROM content_overrides
        WHERE slug = ?
        LIMIT 1
      `,
    )
    .bind(slug)
    .first();

  return mapPersistedOverride(row);
}

export function createD1SchedulingPart(db) {
  return {
    async schedulePublish(id, scheduledAt) {
      await db
        .prepare("UPDATE content_overrides SET scheduled_at = ?, status = 'draft' WHERE slug = ?")
        .bind(scheduledAt, id)
        .run();
      await db
        .prepare(
          `INSERT INTO content_overrides (slug, scheduled_at, status, title, seo_title, meta_description, updated_at, updated_by)
           SELECT ce.slug, ?, 'draft', ce.title, ce.title, '', CURRENT_TIMESTAMP, 'scheduler'
           FROM content_entries ce WHERE ce.slug = ?
           AND NOT EXISTS (SELECT 1 FROM content_overrides co WHERE co.slug = ?)`,
        )
        .bind(scheduledAt, id, id)
        .run();
    },

    async listScheduled() {
      const now = new Date().toISOString();
      const rows = (
        await db
          .prepare(
            `SELECT co.slug AS id, co.slug, COALESCE(co.title, ce.title, co.slug) AS title, co.scheduled_at
             FROM content_overrides co
             LEFT JOIN content_entries ce ON ce.slug = co.slug
             WHERE co.scheduled_at IS NOT NULL AND co.scheduled_at > ?
             ORDER BY co.scheduled_at ASC`,
          )
          .bind(now)
          .all()
      ).results;
      return rows.map((r) => ({ id: r.slug, slug: r.slug, title: r.title, scheduledAt: r.scheduled_at }));
    },

    async cancelScheduledPublish(id) {
      await db.prepare("UPDATE content_overrides SET scheduled_at = NULL WHERE slug = ?").bind(id).run();
    },

    async runScheduledPublishes() {
      const now = new Date().toISOString();
      const result = await db
        .prepare(
          `UPDATE content_overrides SET status = 'published', scheduled_at = NULL
           WHERE scheduled_at IS NOT NULL AND scheduled_at <= ?`,
        )
        .bind(now)
        .run();
      return result.meta?.changes ?? 0;
    },
  };
}

export function createD1ContentReadPart(db) {
  return {
    async listContentStates() {
      const records = await getAllContentRecords(db);
      const states = await Promise.all(records.map(async (record) => this.getContentState(record.slug)));
      return states.filter((record) => Boolean(record));
    },
    async getContentState(slug) {
      const pageRecord = await findPageRecord(db, slug);
      if (!pageRecord) {
        return null;
      }

      const override = await getPersistedContentOverride(db, pageRecord.slug);
      const assignments = await getD1ContentAssignmentIds(db, pageRecord.slug);
      return {
        ...pageRecord,
        title: override?.title ?? pageRecord.title,
        status: override?.status ?? (pageRecord.status ?? "published"),
        scheduledAt: override?.scheduledAt,
        body: override?.body ?? pageRecord.body,
        authorIds: assignments.authorIds,
        categoryIds: assignments.categoryIds,
        tagIds: assignments.tagIds,
        seoTitle: override?.seoTitle ?? pageRecord.seoTitle ?? pageRecord.title,
        metaDescription: override?.metaDescription ?? pageRecord.metaDescription ?? pageRecord.summary ?? "",
        excerpt: override?.excerpt ?? pageRecord.summary,
        ogTitle: override?.ogTitle,
        ogDescription: override?.ogDescription,
        ogImage: override?.ogImage,
        canonicalUrlOverride: override?.canonicalUrlOverride,
        robotsDirective: override?.robotsDirective,
      };
    },
    async getContentRevisions(slug) {
      const pageRecord = await findPageRecord(db, slug);
      if (!pageRecord) {
        return null;
      }

      const rows = (
        await db
          .prepare(
            `
              SELECT id, slug, title, status, scheduled_at, body, seo_title, meta_description, excerpt, og_title,
                     og_description, og_image, author_ids, category_ids, tag_ids, canonical_url_override, robots_directive, revision_note, source, created_at, created_by
              FROM content_revisions
              WHERE slug = ?
              ORDER BY datetime(created_at) DESC, id DESC
            `,
          )
          .bind(pageRecord.slug)
          .all()
      ).results;

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
    },
  };
}

export async function searchD1ContentStates(db, query) {
  const results = await db
    .prepare(`SELECT co.* FROM content_overrides co WHERE co.rowid IN (SELECT rowid FROM content_fts(?) ORDER BY rank)`)
    .bind(query)
    .all();
  return (results.results ?? []);
}
