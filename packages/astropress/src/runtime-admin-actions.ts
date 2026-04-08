import { getCmsConfig } from "./config";
import { hashPassword } from "./crypto-utils";
import { createD1AdminMutationStore } from "./d1-admin-store";
import { loadLocalAdminStore } from "./local-runtime-modules";
import { deleteRuntimeMediaObject, storeRuntimeMediaObject } from "./runtime-media-storage";
import type { Actor, ContentOverride } from "./persistence-types";
import { defaultSiteSettings, type SiteSettings } from "./site-settings";
import { getCloudflareBindings } from "./runtime-env";
import { normalizeTranslationState, translationStates, type TranslationState } from "./translation-state";

type ContentStatus = "draft" | "review" | "published" | "archived";

interface PageRecord {
  slug: string;
  legacyUrl: string;
  title: string;
  sourceHtmlPath: string;
  updatedAt: string;
  body?: string;
  summary?: string;
  seoTitle?: string;
  metaDescription?: string;
  status?: ContentStatus;
}

function getPageRecords() {
  return getCmsConfig().seedPages as unknown as PageRecord[];
}

function getD1(locals?: App.Locals | null) {
  return getCloudflareBindings(locals).DB;
}

async function getCustomContentEntries(db: NonNullable<ReturnType<typeof getD1>>) {
  const rows = (
    await db
      .prepare(
        `
          SELECT slug, legacy_url, title, kind, source_html_path, updated_at, body, summary, seo_title, meta_description
          FROM content_entries
          ORDER BY datetime(updated_at) DESC, slug ASC
        `,
      )
      .all<{
        slug: string;
        legacy_url: string;
        title: string;
        kind: string;
        source_html_path: string;
        updated_at: string;
        body: string | null;
        summary: string | null;
        seo_title: string | null;
        meta_description: string | null;
      }>()
  ).results;

  return rows.map((row) => ({
    slug: row.slug,
    legacyUrl: row.legacy_url,
    title: row.title,
    sourceHtmlPath: row.source_html_path,
    updatedAt: row.updated_at,
    body: row.body ?? "",
    summary: row.summary ?? "",
    seoTitle: row.seo_title ?? row.title,
    metaDescription: row.meta_description ?? row.summary ?? "",
    status: "draft" as ContentStatus,
    kind: row.kind,
  }));
}

async function findPageRecord(slug: string, locals?: App.Locals | null) {
  const db = getD1(locals);
  /* v8 ignore next 3 */
  if (!db) {
    return getPageRecords().find((entry) => entry.slug === slug || entry.legacyUrl === `/${slug}`) ?? null;
  }

  const customEntries = await getCustomContentEntries(db);
  return [...getPageRecords(), ...customEntries].find((entry) => entry.slug === slug || entry.legacyUrl === `/${slug}`) ?? null;
}

function slugifyContent(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function normalizeEmail(value: string) {
  return value.trim().toLowerCase();
}

function normalizeContentStatus(input?: string | null): ContentStatus {
  if (input === "draft" || input === "review" || input === "archived" || input === "published") {
    return input;
  }
  return "published";
}

function serializeIdList(values: number[]) {
  return JSON.stringify(
    values.filter((entry) => Number.isInteger(entry) && entry > 0).sort((a, b) => a - b),
  );
}

function parseIdList(value: string | null | undefined) {
  if (!value) {
    return [] as number[];
  }

  try {
    const parsed = JSON.parse(value) as unknown;
    if (!Array.isArray(parsed)) {
      return [];
    }
    return parsed
      .map((entry) => Number(entry))
      .filter((entry) => Number.isInteger(entry) && entry > 0);
  } catch {
    return [];
  }
}

async function replaceD1ContentAssignments(
  db: NonNullable<ReturnType<typeof getD1>>,
  slug: string,
  input: { authorIds: number[]; categoryIds: number[]; tagIds: number[] },
) {
  await db.prepare("DELETE FROM content_authors WHERE slug = ?").bind(slug).run();
  await db.prepare("DELETE FROM content_categories WHERE slug = ?").bind(slug).run();
  await db.prepare("DELETE FROM content_tags WHERE slug = ?").bind(slug).run();

  for (const authorId of input.authorIds) {
    await db.prepare("INSERT OR IGNORE INTO content_authors (slug, author_id) VALUES (?, ?)").bind(slug, authorId).run();
  }
  for (const categoryId of input.categoryIds) {
    await db.prepare("INSERT OR IGNORE INTO content_categories (slug, category_id) VALUES (?, ?)").bind(slug, categoryId).run();
  }
  for (const tagId of input.tagIds) {
    await db.prepare("INSERT OR IGNORE INTO content_tags (slug, tag_id) VALUES (?, ?)").bind(slug, tagId).run();
  }
}

function normalizePath(value: string) {
  const trimmed = value.trim();
  if (!trimmed) {
    return "";
  }

  // Reject protocol-relative URLs (//evil.example/…) — open redirect vector
  if (trimmed.startsWith("//")) {
    return "";
  }

  return trimmed.startsWith("/") ? trimmed : `/${trimmed}`;
}

async function recordD1Audit(
  locals: App.Locals | null | undefined,
  actor: Actor,
  action: string,
  resourceType: string,
  resourceId: string,
  summary: string,
) {
  const db = getD1(locals);
  /* v8 ignore next 3 */
  if (!db) {
    return;
  }

  await db
    .prepare(
      `
        INSERT INTO audit_events (user_email, action, resource_type, resource_id, summary)
        VALUES (?, ?, ?, ?, ?)
      `,
    )
    .bind(actor.email, action, resourceType, resourceId, summary)
    .run();
}

async function hashOpaqueToken(token: string) {
  const encoded = new TextEncoder().encode(token);
  const digest = await crypto.subtle.digest("SHA-256", encoded);
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

export async function updateRuntimeTranslationState(route: string, state: string, actor: Actor, locals?: App.Locals | null) {
  const db = getD1(locals);
  /* v8 ignore next 4 */
  if (!db) {
    const localAdminStore = await loadLocalAdminStore();
    return localAdminStore.updateTranslationState(route, state, actor);
  }

  const normalizedState = normalizeTranslationState(state, "__invalid__" as TranslationState);
  if (!(translationStates as readonly string[]).includes(normalizedState)) {
    return { ok: false as const, error: `Invalid translation state. Must be one of: ${translationStates.join(", ")}` };
  }

  await db
    .prepare(
      `
        INSERT INTO translation_overrides (route, state, updated_at, updated_by)
        VALUES (?, ?, CURRENT_TIMESTAMP, ?)
        ON CONFLICT(route) DO UPDATE SET
          state = excluded.state,
          updated_at = CURRENT_TIMESTAMP,
          updated_by = excluded.updated_by
      `,
    )
    .bind(route, normalizedState, actor.email)
    .run();

  await recordD1Audit(locals, actor, "translation.update", "content", route, `Updated translation state for ${route} to ${normalizedState}.`);
  return { ok: true as const };
}

export async function createRuntimeRedirectRule(
  input: { sourcePath: string; targetPath: string; statusCode: number },
  actor: Actor,
  locals?: App.Locals | null,
) {
  const db = getD1(locals);
  /* v8 ignore next 4 */
  if (!db) {
    const localAdminStore = await loadLocalAdminStore();
    return localAdminStore.createRedirectRule(input, actor);
  }

  const sourcePath = normalizePath(input.sourcePath);
  const targetPath = normalizePath(input.targetPath);
  const statusCode = input.statusCode === 302 ? 302 : 301;

  if (!sourcePath || !targetPath) {
    return { ok: false as const, error: "Both legacy and target paths are required." };
  }

  if (sourcePath === targetPath) {
    return { ok: false as const, error: "Legacy and target paths must be different." };
  }

  const existing = await db
    .prepare("SELECT deleted_at FROM redirect_rules WHERE source_path = ? LIMIT 1")
    .bind(sourcePath)
    .first<{ deleted_at: string | null }>();

  if (existing && existing.deleted_at === null) {
    return { ok: false as const, error: "That legacy path already has a reviewed redirect rule." };
  }

  await db
    .prepare(
      `
        INSERT INTO redirect_rules (source_path, target_path, status_code, created_by, deleted_at)
        VALUES (?, ?, ?, ?, NULL)
        ON CONFLICT(source_path) DO UPDATE SET
          target_path = excluded.target_path,
          status_code = excluded.status_code,
          created_by = excluded.created_by,
          deleted_at = NULL
      `,
    )
    .bind(sourcePath, targetPath, statusCode, actor.email)
    .run();

  await recordD1Audit(
    locals,
    actor,
    "redirect.create",
    "redirect",
    sourcePath,
    `Created redirect ${sourcePath} -> ${targetPath} (${statusCode}).`,
  );

  return { ok: true as const, rule: { sourcePath, targetPath, statusCode } };
}

export async function deleteRuntimeRedirectRule(sourcePath: string, actor: Actor, locals?: App.Locals | null) {
  const db = getD1(locals);
  /* v8 ignore next 4 */
  if (!db) {
    const localAdminStore = await loadLocalAdminStore();
    return localAdminStore.deleteRedirectRule(sourcePath, actor);
  }

  const normalizedSourcePath = normalizePath(sourcePath);
  const result = await db
    .prepare("UPDATE redirect_rules SET deleted_at = CURRENT_TIMESTAMP WHERE source_path = ? AND deleted_at IS NULL")
    .bind(normalizedSourcePath)
    .run();

  /* v8 ignore next 4 */
  if (!result.success) {
    return { ok: false as const };
  }

  const row = await db
    .prepare("SELECT deleted_at FROM redirect_rules WHERE source_path = ? LIMIT 1")
    .bind(normalizedSourcePath)
    .first<{ deleted_at: string | null }>();

  if (!row?.deleted_at) {
    return { ok: false as const };
  }

  await recordD1Audit(locals, actor, "redirect.delete", "redirect", normalizedSourcePath, `Deleted redirect ${normalizedSourcePath}.`);
  return { ok: true as const };
}

export async function moderateRuntimeComment(
  commentId: string,
  nextStatus: "pending" | "approved" | "rejected",
  actor: Actor,
  locals?: App.Locals | null,
) {
  const db = getD1(locals);
  /* v8 ignore next 4 */
  if (!db) {
    const localAdminStore = await loadLocalAdminStore();
    return localAdminStore.moderateComment(commentId, nextStatus, actor);
  }

  const comment = await db.prepare("SELECT route FROM comments WHERE id = ? LIMIT 1").bind(commentId).first<{ route: string }>();
  if (!comment) {
    return { ok: false as const, error: "The selected comment record could not be found." };
  }

  await db.prepare("UPDATE comments SET status = ? WHERE id = ?").bind(nextStatus, commentId).run();
  await recordD1Audit(locals, actor, "comment.moderate", "comment", commentId, `Marked ${comment.route} as ${nextStatus}.`);
  return { ok: true as const };
}

export async function saveRuntimeSettings(partial: Partial<SiteSettings>, actor: Actor, locals?: App.Locals | null) {
  const db = getD1(locals);
  /* v8 ignore next 4 */
  if (!db) {
    const localAdminStore = await loadLocalAdminStore();
    return localAdminStore.saveSettings(partial, actor);
  }

  const currentRow = await db
    .prepare(
      `
        SELECT site_title, site_tagline, donation_url, newsletter_enabled, comments_default_policy, admin_slug
        FROM site_settings
        WHERE id = 1
        LIMIT 1
      `,
    )
    .first<{
      site_title: string;
      site_tagline: string;
      donation_url: string;
      newsletter_enabled: number;
      comments_default_policy: SiteSettings["commentsDefaultPolicy"];
      admin_slug: string;
    }>();

  const current: SiteSettings = currentRow
    ? {
        siteTitle: currentRow.site_title,
        siteTagline: currentRow.site_tagline,
        donationUrl: currentRow.donation_url,
        newsletterEnabled: currentRow.newsletter_enabled === 1,
        commentsDefaultPolicy: currentRow.comments_default_policy,
        adminSlug: currentRow.admin_slug,
      }
    : { ...defaultSiteSettings };

  const updated: SiteSettings = {
    siteTitle: partial.siteTitle ?? current.siteTitle,
    siteTagline: partial.siteTagline ?? current.siteTagline,
    donationUrl: partial.donationUrl ?? current.donationUrl,
    newsletterEnabled: partial.newsletterEnabled ?? current.newsletterEnabled,
    commentsDefaultPolicy: partial.commentsDefaultPolicy ?? current.commentsDefaultPolicy,
    adminSlug: partial.adminSlug ?? current.adminSlug,
  };

  await db
    .prepare(
      `
        INSERT INTO site_settings (
          id, site_title, site_tagline, donation_url, newsletter_enabled, comments_default_policy, admin_slug, updated_at, updated_by
        ) VALUES (?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, ?)
        ON CONFLICT(id) DO UPDATE SET
          site_title = excluded.site_title,
          site_tagline = excluded.site_tagline,
          donation_url = excluded.donation_url,
          newsletter_enabled = excluded.newsletter_enabled,
          comments_default_policy = excluded.comments_default_policy,
          admin_slug = excluded.admin_slug,
          updated_at = CURRENT_TIMESTAMP,
          updated_by = excluded.updated_by
      `,
    )
    .bind(
      1,
      updated.siteTitle,
      updated.siteTagline,
      updated.donationUrl,
      updated.newsletterEnabled ? 1 : 0,
      updated.commentsDefaultPolicy,
      updated.adminSlug,
      actor.email,
    )
    .run();

  await recordD1Audit(locals, actor, "settings.update", "auth", "site-settings", "Updated site settings.");
  return { ok: true as const, settings: updated };
}

async function ensureD1BaselineRevision(db: NonNullable<ReturnType<typeof getD1>>, pageRecord: PageRecord) {
  await db
    .prepare(
      `
        INSERT INTO content_overrides (
          slug, title, status, body, seo_title, meta_description, excerpt, og_title,
          og_description, og_image, canonical_url_override, robots_directive, updated_at, updated_by
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, ?)
        ON CONFLICT(slug) DO NOTHING
      `,
    )
    .bind(
      pageRecord.slug,
      pageRecord.title,
      pageRecord.status ?? "published",
      pageRecord.body ?? null,
      pageRecord.seoTitle ?? pageRecord.title,
      pageRecord.metaDescription ?? pageRecord.summary ?? "",
      pageRecord.summary ?? null,
      null,
      null,
      null,
      null,
      null,
      "seed-import",
    )
    .run();

  const existing = await db
    .prepare("SELECT id FROM content_revisions WHERE slug = ? AND source = 'imported' LIMIT 1")
    .bind(pageRecord.slug)
    .first<{ id: string }>();

  /* v8 ignore next 3 */
  if (existing) {
    return;
  }

  await db
    .prepare(
      `
        INSERT INTO content_revisions (
          id, slug, title, status, body, seo_title, meta_description, excerpt,
          og_title, og_description, og_image, author_ids, category_ids, tag_ids, canonical_url_override, robots_directive, source, created_at, created_by
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'imported', ?, ?)
      `,
    )
    .bind(
      `revision-${crypto.randomUUID()}`,
      pageRecord.slug,
      pageRecord.title,
      pageRecord.status ?? "published",
      pageRecord.body ?? null,
      pageRecord.seoTitle ?? pageRecord.title,
      pageRecord.metaDescription ?? pageRecord.summary ?? "",
      pageRecord.summary ?? null,
      null,
      null,
      null,
      "[]",
      "[]",
      "[]",
      null,
      null,
      "imported-baseline",
      "seed-import",
    )
    .run();
}

function mapContentState(pageRecord: PageRecord, override: ContentOverride) {
  return {
    ...pageRecord,
    ...override,
  };
}

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
  },
  actor: Actor,
  locals?: App.Locals | null,
) {
  const db = getD1(locals);
  /* v8 ignore next 4 */
  if (!db) {
    const localAdminStore = await loadLocalAdminStore();
    return localAdminStore.saveContentState(slug, input, actor);
  }

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
  const db = getD1(locals);
  /* v8 ignore next 4 */
  if (!db) {
    const localAdminStore = await loadLocalAdminStore();
    return localAdminStore.createContentRecord(input, actor);
  }

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

  if (await findPageRecord(slug, locals) || await findPageRecord(legacyUrl.replace(/^\//, ""), locals)) {
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
}

export async function restoreRuntimeRevision(slug: string, revisionId: string, actor: Actor, locals?: App.Locals | null) {
  const db = getD1(locals);
  /* v8 ignore next 4 */
  if (!db) {
    const localAdminStore = await loadLocalAdminStore();
    return localAdminStore.restoreRevision(slug, revisionId, actor);
  }

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
}

async function getD1InviteToken(rawToken: string, locals?: App.Locals | null) {
  const db = getD1(locals);
  if (!db || !rawToken.trim()) {
    return null;
  }

  const row = await db
    .prepare(
      `
        SELECT i.id, i.user_id, i.expires_at, i.accepted_at,
               u.email, u.name, u.role, u.active
        FROM user_invites i
        JOIN admin_users u ON u.id = i.user_id
        WHERE i.token_hash = ?
        LIMIT 1
      `,
    )
    .bind(await hashOpaqueToken(rawToken))
    .first<{
      id: string;
      user_id: number;
      expires_at: string;
      accepted_at: string | null;
      email: string;
      name: string;
      role: "admin" | "editor";
      active: number;
    }>();

  if (!row || row.accepted_at || row.active !== 1 || Date.parse(row.expires_at) < Date.now()) {
    return null;
  }

  return row;
}

async function getD1PasswordResetToken(rawToken: string, locals?: App.Locals | null) {
  const db = getD1(locals);
  if (!db || !rawToken.trim()) {
    return null;
  }

  const row = await db
    .prepare(
      `
        SELECT t.id, t.user_id, t.expires_at, t.consumed_at,
               u.email, u.name, u.role, u.active
        FROM password_reset_tokens t
        JOIN admin_users u ON u.id = t.user_id
        WHERE t.token_hash = ?
        LIMIT 1
      `,
    )
    .bind(await hashOpaqueToken(rawToken))
    .first<{
      id: string;
      user_id: number;
      expires_at: string;
      consumed_at: string | null;
      email: string;
      name: string;
      role: "admin" | "editor";
      active: number;
    }>();

  if (!row || row.consumed_at || row.active !== 1 || Date.parse(row.expires_at) < Date.now()) {
    return null;
  }

  return row;
}

export async function inviteRuntimeAdminUser(
  input: { name: string; email: string; role: string },
  actor: Actor,
  locals?: App.Locals | null,
) {
  const db = getD1(locals);
  /* v8 ignore next 4 */
  if (!db) {
    const localAdminStore = await loadLocalAdminStore();
    return localAdminStore.inviteAdminUser(input, actor);
  }

  const name = input.name.trim();
  const email = normalizeEmail(input.email);
  const role = input.role === "admin" ? "admin" : input.role === "editor" ? "editor" : "";

  if (!name || !email || !role) {
    return { ok: false as const, error: "Name, email, and role are required." };
  }

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return { ok: false as const, error: "Enter a valid email address." };
  }

  const existing = await db.prepare("SELECT id FROM admin_users WHERE email = ? LIMIT 1").bind(email).first<{ id: number }>();
  if (existing) {
    return { ok: false as const, error: "That email address already belongs to an admin user." };
  }

  await db
    .prepare(
      `
        INSERT INTO admin_users (email, password_hash, role, name, active)
        VALUES (?, ?, ?, ?, 1)
      `,
    )
    .bind(email, await hashPassword(crypto.randomUUID()), role, name)
    .run();

  const user = await db.prepare("SELECT id FROM admin_users WHERE email = ? LIMIT 1").bind(email).first<{ id: number }>();
  /* v8 ignore next 3 */
  if (!user) {
    return { ok: false as const, error: "The invited user could not be created." };
  }

  const rawToken = crypto.randomUUID();
  const inviteId = `invite-${crypto.randomUUID()}`;
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();

  await db
    .prepare(
      `
        INSERT INTO user_invites (id, user_id, token_hash, expires_at, invited_by)
        VALUES (?, ?, ?, ?, ?)
      `,
    )
    .bind(inviteId, user.id, await hashOpaqueToken(rawToken), expiresAt, actor.email)
    .run();

  await recordD1Audit(locals, actor, "user.invite", "auth", email, `Invited ${email} as an ${role} user.`);
  return { ok: true as const, inviteUrl: `/ap-admin/accept-invite?token=${encodeURIComponent(rawToken)}` };
}

export async function getRuntimeInviteRequest(rawToken: string, locals?: App.Locals | null) {
  const db = getD1(locals);
  /* v8 ignore next 4 */
  if (!db) {
    const localAdminStore = await loadLocalAdminStore();
    return localAdminStore.getInviteRequest(rawToken);
  }

  const row = await getD1InviteToken(rawToken, locals);
  if (!row) {
    return null;
  }

  return {
    email: row.email,
    name: row.name,
    role: row.role,
    expiresAt: row.expires_at,
  };
}

export async function consumeRuntimeInviteToken(rawToken: string, password: string, locals?: App.Locals | null) {
  const db = getD1(locals);
  /* v8 ignore next 4 */
  if (!db) {
    const localAdminStore = await loadLocalAdminStore();
    return localAdminStore.consumeInviteToken(rawToken, password);
  }

  const trimmedPassword = password.trim();
  if (trimmedPassword.length < 12) {
    return { ok: false as const, error: "Password must be at least 12 characters." };
  }

  const row = await getD1InviteToken(rawToken, locals);
  /* v8 ignore next 3 */
  if (!row) {
    return { ok: false as const, error: "That invitation link is invalid or has expired." };
  }

  await db.prepare("UPDATE admin_users SET password_hash = ? WHERE id = ?").bind(await hashPassword(trimmedPassword), row.user_id).run();
  await db
    .prepare(
      `
        UPDATE user_invites
        SET accepted_at = CURRENT_TIMESTAMP
        WHERE user_id = ?
          AND accepted_at IS NULL
      `,
    )
    .bind(row.user_id)
    .run();

  await recordD1Audit(
    locals,
    { email: row.email, role: row.role, name: row.name },
    "auth.invite_accept",
    "auth",
    row.email,
    `${row.email} accepted an admin invitation.`,
  );

  return {
    ok: true as const,
    user: {
      email: row.email,
      role: row.role,
      name: row.name,
    },
  };
}

export async function createRuntimePasswordResetToken(email: string, actor?: Actor | null, locals?: App.Locals | null) {
  const db = getD1(locals);
  /* v8 ignore next 4 */
  if (!db) {
    const localAdminStore = await loadLocalAdminStore();
    return localAdminStore.createPasswordResetToken(email, actor ?? null);
  }

  const normalizedEmail = normalizeEmail(email);
  if (!normalizedEmail) {
    return { ok: false as const, error: "Email is required." };
  }

  const user = await db
    .prepare(
      `
        SELECT id, email, role, name
        FROM admin_users
        WHERE email = ?
          AND active = 1
        LIMIT 1
      `,
    )
    .bind(normalizedEmail)
    .first<{ id: number; email: string; role: "admin" | "editor"; name: string }>();

  if (!user) {
    return actor ? { ok: false as const, error: "That admin user could not be found." } : { ok: true as const, resetUrl: null as string | null };
  }

  await db
    .prepare(
      `
        UPDATE password_reset_tokens
        SET consumed_at = CURRENT_TIMESTAMP
        WHERE user_id = ?
          AND consumed_at IS NULL
      `,
    )
    .bind(user.id)
    .run();

  const rawToken = crypto.randomUUID();
  const tokenId = `reset-${crypto.randomUUID()}`;
  const expiresAt = new Date(Date.now() + 60 * 60 * 1000).toISOString();

  await db
    .prepare(
      `
        INSERT INTO password_reset_tokens (id, user_id, token_hash, expires_at, requested_by)
        VALUES (?, ?, ?, ?, ?)
      `,
    )
    .bind(tokenId, user.id, await hashOpaqueToken(rawToken), expiresAt, actor?.email ?? null)
    .run();

  if (actor) {
    await recordD1Audit(
      locals,
      actor,
      "auth.password_reset_issue",
      "auth",
      normalizedEmail,
      `Issued a password reset link for ${normalizedEmail}.`,
    );
  }

  return { ok: true as const, resetUrl: `/ap-admin/reset-password?token=${encodeURIComponent(rawToken)}` };
}

export async function getRuntimePasswordResetRequest(rawToken: string, locals?: App.Locals | null) {
  const db = getD1(locals);
  /* v8 ignore next 4 */
  if (!db) {
    const localAdminStore = await loadLocalAdminStore();
    return localAdminStore.getPasswordResetRequest(rawToken);
  }

  const row = await getD1PasswordResetToken(rawToken, locals);
  if (!row) {
    return null;
  }

  return {
    email: row.email,
    name: row.name,
    role: row.role,
    expiresAt: row.expires_at,
  };
}

export async function consumeRuntimePasswordResetToken(rawToken: string, password: string, locals?: App.Locals | null) {
  const db = getD1(locals);
  /* v8 ignore next 4 */
  if (!db) {
    const localAdminStore = await loadLocalAdminStore();
    return localAdminStore.consumePasswordResetToken(rawToken, password);
  }

  const trimmedPassword = password.trim();
  if (trimmedPassword.length < 12) {
    return { ok: false as const, error: "Password must be at least 12 characters." };
  }

  const row = await getD1PasswordResetToken(rawToken, locals);
  if (!row) {
    return { ok: false as const, error: "That password reset link is invalid or has expired." };
  }

  await db.prepare("UPDATE admin_users SET password_hash = ? WHERE id = ?").bind(await hashPassword(trimmedPassword), row.user_id).run();
  await db.prepare("UPDATE password_reset_tokens SET consumed_at = CURRENT_TIMESTAMP WHERE id = ?").bind(row.id).run();
  await db
    .prepare(
      `
        UPDATE admin_sessions
        SET revoked_at = CURRENT_TIMESTAMP
        WHERE user_id = ?
          AND revoked_at IS NULL
      `,
    )
    .bind(row.user_id)
    .run();

  await recordD1Audit(
    locals,
    { email: row.email, role: row.role, name: row.name },
    "auth.password_reset_complete",
    "auth",
    row.email,
    `${row.email} completed a password reset.`,
  );

  return {
    ok: true as const,
    user: {
      email: row.email,
      role: row.role,
      name: row.name,
    },
  };
}

export async function suspendRuntimeAdminUser(email: string, actor: Actor, locals?: App.Locals | null) {
  const db = getD1(locals);
  /* v8 ignore next 4 */
  if (!db) {
    const localAdminStore = await loadLocalAdminStore();
    return localAdminStore.suspendAdminUser(email, actor);
  }

  const normalizedEmail = normalizeEmail(email);
  if (!normalizedEmail) {
    return { ok: false as const, error: "Email is required." };
  }

  if (normalizedEmail === actor.email.toLowerCase()) {
    return { ok: false as const, error: "You cannot suspend the account you are currently using." };
  }

  const target = await db.prepare("SELECT id FROM admin_users WHERE email = ? AND active = 1 LIMIT 1").bind(normalizedEmail).first<{ id: number }>();
  if (!target) {
    return { ok: false as const, error: "That admin user could not be suspended." };
  }

  await db.prepare("UPDATE admin_users SET active = 0 WHERE id = ?").bind(target.id).run();
  await db
    .prepare(
      `
        UPDATE admin_sessions
        SET revoked_at = CURRENT_TIMESTAMP
        WHERE user_id = ?
          AND revoked_at IS NULL
      `,
    )
    .bind(target.id)
    .run();

  await recordD1Audit(locals, actor, "user.suspend", "auth", normalizedEmail, `Suspended ${normalizedEmail}.`);
  return { ok: true as const };
}

export async function unsuspendRuntimeAdminUser(email: string, actor: Actor, locals?: App.Locals | null) {
  const db = getD1(locals);
  /* v8 ignore next 4 */
  if (!db) {
    const localAdminStore = await loadLocalAdminStore();
    return localAdminStore.unsuspendAdminUser(email, actor);
  }

  const normalizedEmail = normalizeEmail(email);
  if (!normalizedEmail) {
    return { ok: false as const, error: "Email is required." };
  }

  const target = await db.prepare("SELECT id FROM admin_users WHERE email = ? AND active = 0 LIMIT 1").bind(normalizedEmail).first<{ id: number }>();
  if (!target) {
    return { ok: false as const, error: "That admin user could not be restored." };
  }

  await db.prepare("UPDATE admin_users SET active = 1 WHERE id = ?").bind(target.id).run();
  await recordD1Audit(locals, actor, "user.restore", "auth", normalizedEmail, `Restored ${normalizedEmail}.`);
  return { ok: true as const };
}

export async function updateRuntimeMediaAsset(
  input: {
    id: string;
    title?: string;
    altText?: string;
  },
  actor: Actor,
  locals?: App.Locals | null,
) {
  const db = getD1(locals);
  /* v8 ignore next 4 */
  if (!db) {
    const localAdminStore = await loadLocalAdminStore();
    return localAdminStore.updateMediaAsset(input, actor);
  }

  const id = input.id.trim();
  if (!id) {
    return { ok: false as const, error: "Media asset id is required." };
  }

  const existing = await db
    .prepare("SELECT id FROM media_assets WHERE id = ? AND deleted_at IS NULL LIMIT 1")
    .bind(id)
    .first<{ id: string }>();

  if (!existing) {
    return { ok: false as const, error: "The selected media asset could not be updated." };
  }

  await db
    .prepare("UPDATE media_assets SET title = ?, alt_text = ? WHERE id = ? AND deleted_at IS NULL")
    .bind(input.title?.trim() ?? "", input.altText?.trim() ?? "", id)
    .run();

  await recordD1Audit(locals, actor, "media.update", "content", id, `Updated media metadata for ${id}.`);
  return { ok: true as const };
}

export async function createRuntimeMediaAsset(
  input: {
    filename: string;
    bytes: Uint8Array;
    mimeType: string;
    title?: string;
    altText?: string;
  },
  actor: Actor,
  locals?: App.Locals | null,
) {
  const db = getD1(locals);
  /* v8 ignore next 4 */
  if (!db) {
    const localAdminStore = await loadLocalAdminStore();
    return localAdminStore.createMediaAsset(input, actor);
  }

  const stored = await storeRuntimeMediaObject(input, locals);
  if (!stored.ok) {
    return stored;
  }

  await db
    .prepare(
      `
        INSERT INTO media_assets (
          id, source_url, local_path, r2_key, mime_type, file_size, alt_text, title, uploaded_by
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `,
    )
    .bind(
      stored.asset.id,
      null,
      stored.asset.publicPath,
      stored.asset.r2Key,
      stored.asset.mimeType,
      stored.asset.fileSize,
      stored.asset.altText,
      stored.asset.title,
      actor.email,
    )
    .run();

  await recordD1Audit(locals, actor, "media.upload", "content", stored.asset.id, `Uploaded media asset ${stored.asset.storedFilename}.`);
  return { ok: true as const, id: stored.asset.id };
}

export async function deleteRuntimeMediaAsset(id: string, actor: Actor, locals?: App.Locals | null) {
  const db = getD1(locals);
  /* v8 ignore next 4 */
  if (!db) {
    const localAdminStore = await loadLocalAdminStore();
    return localAdminStore.deleteMediaAsset(id, actor);
  }

  const assetId = id.trim();
  if (!assetId) {
    return { ok: false as const, error: "Media asset id is required." };
  }

  const existing = await db
    .prepare("SELECT id FROM media_assets WHERE id = ? AND deleted_at IS NULL LIMIT 1")
    .bind(assetId)
    .first<{ id: string }>();

  if (!existing) {
    return { ok: false as const, error: "The selected media asset could not be deleted." };
  }

  await db.prepare("UPDATE media_assets SET deleted_at = CURRENT_TIMESTAMP WHERE id = ?").bind(assetId).run();
  const row = await db
    .prepare("SELECT local_path, r2_key FROM media_assets WHERE id = ? LIMIT 1")
    .bind(assetId)
    .first<{ local_path: string | null; r2_key: string | null }>();
  await deleteRuntimeMediaObject(
    {
      localPath: row?.local_path,
      r2Key: row?.r2_key,
    },
    locals,
  );

  await recordD1Audit(locals, actor, "media.delete", "content", assetId, `Deleted media asset ${assetId}.`);
  return { ok: true as const };
}

export async function createRuntimeAuthor(input: { name: string; slug?: string; bio?: string }, actor: Actor, locals?: App.Locals | null) {
  const db = getD1(locals);
  /* v8 ignore next 4 */
  if (!db) {
    const localAdminStore = await loadLocalAdminStore();
    return localAdminStore.createAuthor(input, actor);
  }

  const result = await createD1AdminMutationStore(db).authors.createAuthor(input);
  /* v8 ignore next 4 */

  if (!result.ok) {
    return result;
  }

  await recordD1Audit(locals, actor, "author.create", "content", input.slug ?? input.name, `Created author ${input.name.trim()}.`);
  return result;
}

export async function updateRuntimeAuthor(
  input: { id: number; name: string; slug?: string; bio?: string },
  actor: Actor,
  locals?: App.Locals | null,
) {
  const db = getD1(locals);
  /* v8 ignore next 4 */
  if (!db) {
    const localAdminStore = await loadLocalAdminStore();
    return localAdminStore.updateAuthor(input, actor);
  }

  const result = await createD1AdminMutationStore(db).authors.updateAuthor(input);
  /* v8 ignore next 4 */

  if (!result.ok) {
    return result;
  }

  await recordD1Audit(locals, actor, "author.update", "content", String(input.id), `Updated author ${input.name.trim()}.`);
  return result;
}

export async function deleteRuntimeAuthor(id: number, actor: Actor, locals?: App.Locals | null) {
  const db = getD1(locals);
  /* v8 ignore next 4 */
  if (!db) {
    const localAdminStore = await loadLocalAdminStore();
    return localAdminStore.deleteAuthor(id, actor);
  }

  const result = await createD1AdminMutationStore(db).authors.deleteAuthor(id);
  /* v8 ignore next 4 */

  if (!result.ok) {
    return result;
  }

  await recordD1Audit(locals, actor, "author.delete", "content", String(id), `Deleted author ${id}.`);
  return result;
}

export async function createRuntimeCategory(
  input: { name: string; slug?: string; description?: string },
  actor: Actor,
  locals?: App.Locals | null,
) {
  const db = getD1(locals);
  /* v8 ignore next 4 */
  if (!db) {
    const localAdminStore = await loadLocalAdminStore();
    return localAdminStore.createCategory(input, actor);
  }

  const result = await createD1AdminMutationStore(db).taxonomies.createCategory(input);
  /* v8 ignore next 4 */

  if (!result.ok) {
    return result;
  }

  await recordD1Audit(locals, actor, "category.create", "content", input.slug ?? input.name, `Created category ${input.name.trim()}.`);
  return result;
}

export async function updateRuntimeCategory(
  input: { id: number; name: string; slug?: string; description?: string },
  actor: Actor,
  locals?: App.Locals | null,
) {
  const db = getD1(locals);
  /* v8 ignore next 4 */
  if (!db) {
    const localAdminStore = await loadLocalAdminStore();
    return localAdminStore.updateCategory(input, actor);
  }

  const result = await createD1AdminMutationStore(db).taxonomies.updateCategory(input);
  /* v8 ignore next 4 */

  if (!result.ok) {
    return result;
  }

  await recordD1Audit(locals, actor, "category.update", "content", String(input.id), `Updated category ${input.name.trim()}.`);
  return result;
}

export async function deleteRuntimeCategory(id: number, actor: Actor, locals?: App.Locals | null) {
  const db = getD1(locals);
  /* v8 ignore next 4 */
  if (!db) {
    const localAdminStore = await loadLocalAdminStore();
    return localAdminStore.deleteCategory(id, actor);
  }

  const result = await createD1AdminMutationStore(db).taxonomies.deleteCategory(id);
  /* v8 ignore next 4 */

  if (!result.ok) {
    return result;
  }

  await recordD1Audit(locals, actor, "category.delete", "content", String(id), `Deleted category ${id}.`);
  return result;
}

export async function createRuntimeTag(input: { name: string; slug?: string; description?: string }, actor: Actor, locals?: App.Locals | null) {
  const db = getD1(locals);
  /* v8 ignore next 4 */
  if (!db) {
    const localAdminStore = await loadLocalAdminStore();
    return localAdminStore.createTag(input, actor);
  }

  const result = await createD1AdminMutationStore(db).taxonomies.createTag(input);
  /* v8 ignore next 4 */

  if (!result.ok) {
    return result;
  }

  await recordD1Audit(locals, actor, "tag.create", "content", input.slug ?? input.name, `Created tag ${input.name.trim()}.`);
  return result;
}

export async function updateRuntimeTag(
  input: { id: number; name: string; slug?: string; description?: string },
  actor: Actor,
  locals?: App.Locals | null,
) {
  const db = getD1(locals);
  /* v8 ignore next 4 */
  if (!db) {
    const localAdminStore = await loadLocalAdminStore();
    return localAdminStore.updateTag(input, actor);
  }

  const result = await createD1AdminMutationStore(db).taxonomies.updateTag(input);
  /* v8 ignore next 4 */

  if (!result.ok) {
    return result;
  }

  await recordD1Audit(locals, actor, "tag.update", "content", String(input.id), `Updated tag ${input.name.trim()}.`);
  return result;
}

export async function deleteRuntimeTag(id: number, actor: Actor, locals?: App.Locals | null) {
  const db = getD1(locals);
  /* v8 ignore next 4 */
  if (!db) {
    const localAdminStore = await loadLocalAdminStore();
    return localAdminStore.deleteTag(id, actor);
  }

  const result = await createD1AdminMutationStore(db).taxonomies.deleteTag(id);
  /* v8 ignore next 4 */

  if (!result.ok) {
    return result;
  }

  await recordD1Audit(locals, actor, "tag.delete", "content", String(id), `Deleted tag ${id}.`);
  return result;
}
