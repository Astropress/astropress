import { getCmsConfig, dispatchPluginContentEvent } from "./config";
import { purgeCdnCache } from "./cache-purge";
import type { Actor } from "./persistence-types";
import { withLocalStoreFallback } from "./admin-store-dispatch";
import { parseIdList, serializeIdList, slugifyContent } from "./admin-normalizers";
import { recordD1Audit } from "./d1-audit";
import {
  type ContentStatus,
  type PageRecord,
  findPageRecord,
  normalizeContentStatus,
  replaceD1ContentAssignments,
  ensureD1BaselineRevision,
  mapContentState,
  validateContentTypeFields,
} from "./runtime-actions-content-shared";

type D1Like = import("./d1-database").D1DatabaseLike;

interface SaveContentInput {
  title: string; status: string; scheduledAt?: string; body?: string;
  authorIds?: number[]; categoryIds?: number[]; tagIds?: number[];
  seoTitle: string; metaDescription: string; excerpt?: string;
  ogTitle?: string; ogDescription?: string; ogImage?: string;
  canonicalUrlOverride?: string; robotsDirective?: string; revisionNote?: string;
  lastKnownUpdatedAt?: string; metadata?: Record<string, unknown>;
}

interface RevisionRow {
  title: string; status: ContentStatus; scheduled_at: string | null; body: string | null;
  seo_title: string; meta_description: string; excerpt: string | null;
  og_title: string | null; og_description: string | null; og_image: string | null;
  author_ids: string | null; category_ids: string | null; tag_ids: string | null;
  canonical_url_override: string | null; robots_directive: string | null; revision_note: string | null;
}

const SQL_DETECT_CONFLICT = "SELECT updated_at FROM content_overrides WHERE slug = ?";

const INSERT_REVISION_SQL = `INSERT INTO content_revisions (id, slug, title, status, scheduled_at, body, seo_title, meta_description, excerpt, og_title, og_description, og_image, author_ids, category_ids, tag_ids, canonical_url_override, robots_directive, revision_note, source, created_by) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'reviewed', ?)`;
const UPSERT_CONTENT_OVERRIDE_SQL = `INSERT INTO content_overrides (slug, title, status, body, seo_title, meta_description, excerpt, og_title, og_description, og_image, scheduled_at, canonical_url_override, robots_directive, metadata, updated_at, updated_by) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, ?) ON CONFLICT(slug) DO UPDATE SET title = excluded.title, status = excluded.status, body = excluded.body, seo_title = excluded.seo_title, meta_description = excluded.meta_description, excerpt = excluded.excerpt, og_title = excluded.og_title, og_description = excluded.og_description, og_image = excluded.og_image, scheduled_at = excluded.scheduled_at, canonical_url_override = excluded.canonical_url_override, robots_directive = excluded.robots_directive, metadata = excluded.metadata, updated_at = CURRENT_TIMESTAMP, updated_by = excluded.updated_by`;
const UPSERT_CONTENT_OVERRIDE_NO_META_SQL = `INSERT INTO content_overrides (slug, title, status, body, seo_title, meta_description, excerpt, og_title, og_description, og_image, scheduled_at, canonical_url_override, robots_directive, updated_at, updated_by) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, ?) ON CONFLICT(slug) DO UPDATE SET title = excluded.title, status = excluded.status, body = excluded.body, seo_title = excluded.seo_title, meta_description = excluded.meta_description, excerpt = excluded.excerpt, og_title = excluded.og_title, og_description = excluded.og_description, og_image = excluded.og_image, scheduled_at = excluded.scheduled_at, canonical_url_override = excluded.canonical_url_override, robots_directive = excluded.robots_directive, updated_at = CURRENT_TIMESTAMP, updated_by = excluded.updated_by`;
const SQL_INSERT_CONTENT_ENTRY = `INSERT INTO content_entries (slug, legacy_url, title, kind, template_key, source_html_path, updated_at, body, summary, seo_title, meta_description, og_title, og_description, og_image) VALUES (?, ?, ?, 'post', 'content', ?, CURRENT_TIMESTAMP, ?, ?, ?, ?, ?, ?, ?)`;
const SQL_INSERT_CREATE_OVERRIDE = `INSERT INTO content_overrides (slug, title, status, body, seo_title, meta_description, excerpt, og_title, og_description, og_image, canonical_url_override, robots_directive, updated_at, updated_by) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, ?)`;
const SQL_SELECT_REVISION = `SELECT title, status, scheduled_at, body, seo_title, meta_description, excerpt, og_title, og_description, og_image, author_ids, category_ids, tag_ids, canonical_url_override, robots_directive, revision_note FROM content_revisions WHERE slug = ? AND id = ? LIMIT 1`;

function trimOrNull(value: string | undefined | null): string | null {
  return value?.trim() || null;
}

function cleanIdList(ids: number[] | undefined): number[] {
  return [...new Set((ids ?? []).filter((entry) => Number.isInteger(entry) && entry > 0))];
}

function normalizeSeoFields(input: {
  excerpt?: string;
  ogTitle?: string;
  ogDescription?: string;
  ogImage?: string;
  canonicalUrlOverride?: string;
  robotsDirective?: string;
}) {
  return {
    excerpt: trimOrNull(input.excerpt),
    ogTitle: trimOrNull(input.ogTitle),
    ogDescription: trimOrNull(input.ogDescription),
    ogImage: trimOrNull(input.ogImage),
    canonicalUrlOverride: trimOrNull(input.canonicalUrlOverride),
    robotsDirective: trimOrNull(input.robotsDirective),
  };
}

function normalizeScheduledAt(value: string | undefined): string | null {
  const trimmed = value?.trim();
  return trimmed ? new Date(value!).toISOString() : null;
}

function normalizeLegacyUrl(legacyUrl: string | undefined, slug: string): string {
  const raw = legacyUrl?.trim() || `/${slug}`;
  return raw.startsWith("/") ? raw : `/${raw}`;
}

function serializeMetadata(metadata: Record<string, unknown>): string | null {
  return Object.keys(metadata).length > 0 ? JSON.stringify(metadata) : null;
}

function nullsToUndefined<T extends Record<string, unknown>>(obj: T): { [K in keyof T]: Exclude<T[K], null> | undefined } {
  const result = {} as Record<string, unknown>;
  for (const [key, value] of Object.entries(obj)) {
    result[key] = value ?? undefined;
  }
  return result as { [K in keyof T]: Exclude<T[K], null> | undefined };
}

async function detectConflict(db: D1Like, slug: string, lastKnownUpdatedAt: string) {
  const row = await db.prepare(SQL_DETECT_CONFLICT).bind(slug).first<{ updated_at: string }>();
  if (row && row.updated_at !== lastKnownUpdatedAt) {
    return { ok: false as const, error: "This record was modified by another editor after you opened it. Reload to see the latest version.", conflict: true as const };
  }
  return null;
}

async function insertContentRevision(db: D1Like, slug: string, r: {
  title: string; status: string; scheduledAt?: string | null; body: string;
  seoTitle: string; metaDescription: string;
  seo: ReturnType<typeof normalizeSeoFields>;
  authorIds: string; categoryIds: string; tagIds: string;
  revisionNote: string | null; actor: Actor;
}) {
  await db.prepare(INSERT_REVISION_SQL).bind(
    `revision-${crypto.randomUUID()}`, slug, r.title, r.status, r.scheduledAt ?? null,
    r.body, r.seoTitle, r.metaDescription, r.seo.excerpt, r.seo.ogTitle, r.seo.ogDescription,
    r.seo.ogImage, r.authorIds, r.categoryIds, r.tagIds,
    r.seo.canonicalUrlOverride, r.seo.robotsDirective, r.revisionNote, r.actor.email,
  ).run();
}

export async function saveRuntimeContentState(
  slug: string, input: SaveContentInput, actor: Actor, locals?: App.Locals | null,
) {
  return withLocalStoreFallback(
    locals,
    async (db) => {
      const pageRecord = await findPageRecord(slug, locals);
      if (!pageRecord) {
        return { ok: false as const, error: "The selected content record could not be found." };
      }

      const title = input.title.trim();
      const seoTitle = input.seoTitle.trim();
      const metaDescription = input.metaDescription.trim();
      const status: ContentStatus = normalizeContentStatus(input.status);
      const body = input.body?.trim() || pageRecord.body || "";
      const scheduledAt = normalizeScheduledAt(input.scheduledAt);
      const revisionNote = trimOrNull(input.revisionNote);
      const authorIds = cleanIdList(input.authorIds);
      const categoryIds = cleanIdList(input.categoryIds);
      const tagIds = cleanIdList(input.tagIds);

      if (!title || !seoTitle || !metaDescription) {
        return { ok: false as const, error: "Title, SEO title, and meta description are required." };
      }

      await ensureD1BaselineRevision(db, pageRecord);

      if (input.lastKnownUpdatedAt) {
        const conflict = await detectConflict(db, pageRecord.slug, input.lastKnownUpdatedAt);
        if (conflict) return conflict;
      }

      // Content type field validation
      const metadata = input.metadata ?? {};
      const fieldError = validateContentTypeFields(pageRecord.templateKey, metadata);
      if (fieldError) {
        return { ok: false as const, error: fieldError };
      }
      const metadataJson = serializeMetadata(metadata);
      const seo = normalizeSeoFields(input);

      await db.prepare(UPSERT_CONTENT_OVERRIDE_SQL).bind(
        pageRecord.slug, title, status, body, seoTitle, metaDescription,
        seo.excerpt, seo.ogTitle, seo.ogDescription, seo.ogImage, scheduledAt,
        seo.canonicalUrlOverride, seo.robotsDirective, metadataJson, actor.email,
      ).run();

      await replaceD1ContentAssignments(db, pageRecord.slug, { authorIds, categoryIds, tagIds });

      await insertContentRevision(db, pageRecord.slug, {
        title, status, scheduledAt, body, seoTitle, metaDescription, seo,
        authorIds: serializeIdList(authorIds), categoryIds: serializeIdList(categoryIds),
        tagIds: serializeIdList(tagIds), revisionNote, actor,
      });

      await recordD1Audit(locals, actor, "content.update", "content", pageRecord.slug, `Updated reviewed metadata for ${pageRecord.legacyUrl}.`);

      const pluginEvent = { slug: pageRecord.slug, kind: "post", status, actor: actor.email };
      await dispatchPluginContentEvent("onContentSave", pluginEvent);
      if (status === "published") {
        await dispatchPluginContentEvent("onContentPublish", pluginEvent);
        // Fire CDN purge asynchronously — failure must not block the publish response
        void purgeCdnCache(pageRecord.slug, getCmsConfig());
      }

      return {
        ok: true as const,
        state: mapContentState(pageRecord, {
          title,
          status,
          scheduledAt: scheduledAt ?? undefined,
          body,
          authorIds,
          categoryIds,
          tagIds,
          seoTitle,
          metaDescription,
          ...nullsToUndefined(seo),
        }),
      };
    },
    /* v8 ignore next 1 */
    (localStore) => localStore.saveContentState(slug, input, actor),
  );
}

export async function createRuntimeContentRecord(
  input: {
    title: string;
    slug: string;
    legacyUrl?: string;
    status: string;
    body?: string;
    summary?: string;
    seoTitle: string;
    metaDescription: string;
    excerpt?: string;
    ogTitle?: string;
    ogDescription?: string;
    ogImage?: string;
    canonicalUrlOverride?: string;
    robotsDirective?: string;
  },
  actor: Actor,
  locals?: App.Locals | null,
) {
  return withLocalStoreFallback(
    locals,
    async (db) => {
      const title = input.title.trim();
      const slug = slugifyContent(input.slug);
      const legacyUrl = normalizeLegacyUrl(input.legacyUrl, slug);
      const seoTitle = input.seoTitle.trim() || title;
      const metaDescription = input.metaDescription.trim();
      const status = normalizeContentStatus(input.status);
      const body = input.body?.trim() || "";
      const summary = input.summary?.trim() || "";
      const seo = normalizeSeoFields(input);

      if (!title || !slug || !metaDescription) {
        return { ok: false as const, error: "Title, slug, and meta description are required." };
      }

      if ((await findPageRecord(slug, locals)) || (await findPageRecord(legacyUrl.replace(/^\//, ""), locals))) {
        return { ok: false as const, error: "That slug is already in use." };
      }

      try {
        await db.prepare(SQL_INSERT_CONTENT_ENTRY).bind(
          slug, legacyUrl, title, `runtime://content/${slug}`, body, summary,
          seoTitle, metaDescription, seo.ogTitle, seo.ogDescription, seo.ogImage,
        ).run();
      /* v8 ignore next 3 */
      } catch {
        return { ok: false as const, error: "That slug or route is already in use." };
      }

      const createSeo = { ...seo, excerpt: seo.excerpt || summary || null };

      await db.prepare(SQL_INSERT_CREATE_OVERRIDE).bind(
        slug, title, status, body, seoTitle, metaDescription, createSeo.excerpt,
        createSeo.ogTitle, createSeo.ogDescription, createSeo.ogImage,
        createSeo.canonicalUrlOverride, createSeo.robotsDirective, actor.email,
      ).run();

      await insertContentRevision(db, slug, {
        title, status, body, seoTitle, metaDescription, seo: createSeo,
        authorIds: "[]", categoryIds: "[]", tagIds: "[]",
        revisionNote: "Created new post.", actor,
      });

      await recordD1Audit(locals, actor, "content.create", "content", slug, `Created post ${legacyUrl}.`);

      return {
        ok: true as const,
        state: {
          slug,
          legacyUrl,
          title,
          status,
          body,
          seoTitle,
          metaDescription,
        },
      };
    },
    /* v8 ignore next 1 */
    (localStore) => localStore.createContentRecord(input, actor),
  );
}

export async function restoreRuntimeRevision(slug: string, revisionId: string, actor: Actor, locals?: App.Locals | null) {
  return withLocalStoreFallback(
    locals,
    async (db) => {
      const pageRecord = await findPageRecord(slug, locals);
      if (!pageRecord) {
        return { ok: false as const, error: "The selected content record could not be found." };
      }

      await ensureD1BaselineRevision(db, pageRecord);

      const revision = await db.prepare(SQL_SELECT_REVISION).bind(pageRecord.slug, revisionId).first<RevisionRow>();

      if (!revision) {
        return { ok: false as const, error: "Revision not found." };
      }

      await db.prepare(UPSERT_CONTENT_OVERRIDE_NO_META_SQL).bind(
        pageRecord.slug, revision.title, revision.status, revision.body,
        revision.seo_title, revision.meta_description, revision.excerpt,
        revision.og_title, revision.og_description, revision.og_image, revision.scheduled_at,
        revision.canonical_url_override, revision.robots_directive, actor.email,
      ).run();

      await replaceD1ContentAssignments(db, pageRecord.slug, {
        authorIds: parseIdList(revision.author_ids),
        categoryIds: parseIdList(revision.category_ids),
        tagIds: parseIdList(revision.tag_ids),
      });

      const revSeo = {
        excerpt: revision.excerpt, ogTitle: revision.og_title,
        ogDescription: revision.og_description, ogImage: revision.og_image,
        canonicalUrlOverride: revision.canonical_url_override,
        robotsDirective: revision.robots_directive,
      };
      await insertContentRevision(db, pageRecord.slug, {
        title: revision.title, status: revision.status,
        scheduledAt: revision.scheduled_at, body: revision.body ?? "",
        seoTitle: revision.seo_title, metaDescription: revision.meta_description,
        seo: revSeo, authorIds: revision.author_ids ?? "[]",
        categoryIds: revision.category_ids ?? "[]", tagIds: revision.tag_ids ?? "[]",
        revisionNote: revision.revision_note, actor,
      });

      await recordD1Audit(locals, actor, "content.restore", "content", pageRecord.slug, `Restored revision ${revisionId} for ${slug}.`);
      return { ok: true as const };
    },
    /* v8 ignore next 1 */
    (localStore) => localStore.restoreRevision(slug, revisionId, actor),
  );
}
