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

export async function saveRuntimeContentState(
  slug: string,
  input: {
    title: string;
    status: string;
    scheduledAt?: string;
    body?: string;
    authorIds?: number[];
    categoryIds?: number[];
    tagIds?: number[];
    seoTitle: string;
    metaDescription: string;
    excerpt?: string;
    ogTitle?: string;
    ogDescription?: string;
    ogImage?: string;
    canonicalUrlOverride?: string;
    robotsDirective?: string;
    revisionNote?: string;
    /** ISO timestamp from when the editor loaded the record. Used for optimistic conflict detection. */
    lastKnownUpdatedAt?: string;
    /** Custom field values for the content type. Validated against `contentTypes` in `registerCms()`. */
    metadata?: Record<string, unknown>;
  },
  actor: Actor,
  locals?: App.Locals | null,
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
      const scheduledAt = input.scheduledAt?.trim() ? new Date(input.scheduledAt).toISOString() : null;
      const revisionNote = input.revisionNote?.trim() || null;
      const authorIds = [...new Set((input.authorIds ?? []).filter((entry) => Number.isInteger(entry) && entry > 0))];
      const categoryIds = [...new Set((input.categoryIds ?? []).filter((entry) => Number.isInteger(entry) && entry > 0))];
      const tagIds = [...new Set((input.tagIds ?? []).filter((entry) => Number.isInteger(entry) && entry > 0))];

      if (!title || !seoTitle || !metaDescription) {
        return { ok: false as const, error: "Title, SEO title, and meta description are required." };
      }

      await ensureD1BaselineRevision(db, pageRecord);

      if (input.lastKnownUpdatedAt) {
        const currentOverride = await db
          .prepare("SELECT updated_at FROM content_overrides WHERE slug = ?")
          .bind(pageRecord.slug)
          .first<{ updated_at: string }>();
        if (currentOverride && currentOverride.updated_at !== input.lastKnownUpdatedAt) {
          return {
            ok: false as const,
            error: "This record was modified by another editor after you opened it. Reload to see the latest version.",
            conflict: true as const,
          };
        }
      }

      // Content type field validation
      const metadata = input.metadata ?? {};
      const fieldError = validateContentTypeFields(pageRecord.templateKey, metadata);
      if (fieldError) {
        return { ok: false as const, error: fieldError };
      }
      const metadataJson = Object.keys(metadata).length > 0 ? JSON.stringify(metadata) : null;

      const excerpt = input.excerpt?.trim() ?? null;
      const ogTitle = input.ogTitle?.trim() ?? null;
      const ogDescription = input.ogDescription?.trim() ?? null;
      const ogImage = input.ogImage?.trim() ?? null;
      const canonicalUrlOverride = input.canonicalUrlOverride?.trim() ?? null;
      const robotsDirective = input.robotsDirective?.trim() ?? null;

      await db
        .prepare(
          `
            INSERT INTO content_overrides (
              slug, title, status, body, seo_title, meta_description, excerpt, og_title,
              og_description, og_image, scheduled_at, canonical_url_override, robots_directive, metadata, updated_at, updated_by
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, ?)
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
              metadata = excluded.metadata,
              updated_at = CURRENT_TIMESTAMP,
              updated_by = excluded.updated_by
          `,
        )
        .bind(
          pageRecord.slug,
          title,
          status,
          body,
          seoTitle,
          metaDescription,
          excerpt,
          ogTitle,
          ogDescription,
          ogImage,
          scheduledAt,
          canonicalUrlOverride,
          robotsDirective,
          metadataJson,
          actor.email,
        )
        .run();

      await replaceD1ContentAssignments(db, pageRecord.slug, { authorIds, categoryIds, tagIds });

      await db
        .prepare(
          `
            INSERT INTO content_revisions (
              id, slug, title, status, scheduled_at, body, seo_title, meta_description, excerpt,
              og_title, og_description, og_image, author_ids, category_ids, tag_ids, canonical_url_override, robots_directive, revision_note, source, created_by
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'reviewed', ?)
          `,
        )
        .bind(
          `revision-${crypto.randomUUID()}`,
          pageRecord.slug,
          title,
          status,
          scheduledAt,
          body,
          seoTitle,
          metaDescription,
          excerpt,
          ogTitle,
          ogDescription,
          ogImage,
          serializeIdList(authorIds),
          serializeIdList(categoryIds),
          serializeIdList(tagIds),
          canonicalUrlOverride,
          robotsDirective,
          revisionNote,
          actor.email,
        )
        .run();

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
          excerpt: excerpt ?? undefined,
          ogTitle: ogTitle ?? undefined,
          ogDescription: ogDescription ?? undefined,
          ogImage: ogImage ?? undefined,
          canonicalUrlOverride: canonicalUrlOverride ?? undefined,
          robotsDirective: robotsDirective ?? undefined,
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
      const rawLegacyUrl = input.legacyUrl?.trim() || `/${slug}`;
      const legacyUrl = rawLegacyUrl.startsWith("/") ? rawLegacyUrl : `/${rawLegacyUrl}`;
      const seoTitle = input.seoTitle.trim() || title;
      const metaDescription = input.metaDescription.trim();
      const status = normalizeContentStatus(input.status);
      const body = input.body?.trim() || "";
      const summary = input.summary?.trim() || "";

      if (!title || !slug || !metaDescription) {
        return { ok: false as const, error: "Title, slug, and meta description are required." };
      }

      if ((await findPageRecord(slug, locals)) || (await findPageRecord(legacyUrl.replace(/^\//, ""), locals))) {
        return { ok: false as const, error: "That slug is already in use." };
      }

      try {
        await db
          .prepare(
            `
              INSERT INTO content_entries (
                slug, legacy_url, title, kind, template_key, source_html_path, updated_at, body, summary,
                seo_title, meta_description, og_title, og_description, og_image
              ) VALUES (?, ?, ?, 'post', 'content', ?, CURRENT_TIMESTAMP, ?, ?, ?, ?, ?, ?, ?)
            `,
          )
          .bind(
            slug,
            legacyUrl,
            title,
            `runtime://content/${slug}`,
            body,
            summary,
            seoTitle,
            metaDescription,
            input.ogTitle?.trim() ?? null,
            input.ogDescription?.trim() ?? null,
            input.ogImage?.trim() ?? null,
          )
          .run();
      /* v8 ignore next 3 */
      } catch {
        return { ok: false as const, error: "That slug or route is already in use." };
      }

      await db
        .prepare(
          `
            INSERT INTO content_overrides (
              slug, title, status, body, seo_title, meta_description, excerpt, og_title,
              og_description, og_image, canonical_url_override, robots_directive, updated_at, updated_by
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, ?)
          `,
        )
        .bind(
          slug,
          title,
          status,
          body,
          seoTitle,
          metaDescription,
          (input.excerpt?.trim() ?? summary) || null,
          input.ogTitle?.trim() ?? null,
          input.ogDescription?.trim() ?? null,
          input.ogImage?.trim() ?? null,
          input.canonicalUrlOverride?.trim() ?? null,
          input.robotsDirective?.trim() ?? null,
          actor.email,
        )
        .run();

      await db
        .prepare(
          `
            INSERT INTO content_revisions (
              id, slug, title, status, body, seo_title, meta_description, excerpt,
              og_title, og_description, og_image, canonical_url_override, robots_directive, revision_note, source, created_by
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'reviewed', ?)
          `,
        )
        .bind(
          `revision-${crypto.randomUUID()}`,
          slug,
          title,
          status,
          body,
          seoTitle,
          metaDescription,
          (input.excerpt?.trim() ?? summary) || null,
          input.ogTitle?.trim() ?? null,
          input.ogDescription?.trim() ?? null,
          input.ogImage?.trim() ?? null,
          input.canonicalUrlOverride?.trim() ?? null,
          input.robotsDirective?.trim() ?? null,
          "Created new post.",
          actor.email,
        )
        .run();

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

      const revision = await db
        .prepare(
          `
            SELECT title, status, scheduled_at, body, seo_title, meta_description, excerpt, og_title,
                   og_description, og_image, author_ids, category_ids, tag_ids, canonical_url_override, robots_directive, revision_note
            FROM content_revisions
            WHERE slug = ? AND id = ?
            LIMIT 1
          `,
        )
        .bind(pageRecord.slug, revisionId)
        .first<{
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
          author_ids: string | null;
          category_ids: string | null;
          tag_ids: string | null;
          canonical_url_override: string | null;
          robots_directive: string | null;
          revision_note: string | null;
        }>();

      if (!revision) {
        return { ok: false as const, error: "Revision not found." };
      }

      await db
        .prepare(
          `
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
          `,
        )
        .bind(
          pageRecord.slug,
          revision.title,
          revision.status,
          revision.body,
          revision.seo_title,
          revision.meta_description,
          revision.excerpt,
          revision.og_title,
          revision.og_description,
          revision.og_image,
          revision.scheduled_at,
          revision.canonical_url_override,
          revision.robots_directive,
          actor.email,
        )
        .run();

      await replaceD1ContentAssignments(db, pageRecord.slug, {
        authorIds: parseIdList(revision.author_ids),
        categoryIds: parseIdList(revision.category_ids),
        tagIds: parseIdList(revision.tag_ids),
      });

      await db
        .prepare(
          `
            INSERT INTO content_revisions (
              id, slug, title, status, scheduled_at, body, seo_title, meta_description, excerpt,
              og_title, og_description, og_image, author_ids, category_ids, tag_ids, canonical_url_override, robots_directive, revision_note, source, created_by
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'reviewed', ?)
          `,
        )
        .bind(
          `revision-${crypto.randomUUID()}`,
          pageRecord.slug,
          revision.title,
          revision.status,
          revision.scheduled_at,
          revision.body,
          revision.seo_title,
          revision.meta_description,
          revision.excerpt,
          revision.og_title,
          revision.og_description,
          revision.og_image,
          revision.author_ids,
          revision.category_ids,
          revision.tag_ids,
          revision.canonical_url_override,
          revision.robots_directive,
          revision.revision_note,
          actor.email,
        )
        .run();

      await recordD1Audit(locals, actor, "content.restore", "content", pageRecord.slug, `Restored revision ${revisionId} for ${slug}.`);
      return { ok: true as const };
    },
    /* v8 ignore next 1 */
    (localStore) => localStore.restoreRevision(slug, revisionId, actor),
  );
}
