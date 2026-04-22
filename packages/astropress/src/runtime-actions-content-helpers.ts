import type { Actor } from "./persistence-types";

type D1Like = import("./d1-database").D1DatabaseLike;

export type ContentStatus = "draft" | "review" | "published" | "archived";

export const SQL_DETECT_CONFLICT =
	"SELECT updated_at FROM content_overrides WHERE slug = ?";

export const INSERT_REVISION_SQL = `INSERT INTO content_revisions (id, slug, title, status, scheduled_at, body, seo_title, meta_description, excerpt, og_title, og_description, og_image, author_ids, category_ids, tag_ids, canonical_url_override, robots_directive, revision_note, source, created_by) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'reviewed', ?)`;
export const UPSERT_CONTENT_OVERRIDE_SQL =
	"INSERT INTO content_overrides (slug, title, status, body, seo_title, meta_description, excerpt, og_title, og_description, og_image, scheduled_at, canonical_url_override, robots_directive, metadata, updated_at, updated_by) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, ?) ON CONFLICT(slug) DO UPDATE SET title = excluded.title, status = excluded.status, body = excluded.body, seo_title = excluded.seo_title, meta_description = excluded.meta_description, excerpt = excluded.excerpt, og_title = excluded.og_title, og_description = excluded.og_description, og_image = excluded.og_image, scheduled_at = excluded.scheduled_at, canonical_url_override = excluded.canonical_url_override, robots_directive = excluded.robots_directive, metadata = excluded.metadata, updated_at = CURRENT_TIMESTAMP, updated_by = excluded.updated_by";
export const UPSERT_CONTENT_OVERRIDE_NO_META_SQL =
	"INSERT INTO content_overrides (slug, title, status, body, seo_title, meta_description, excerpt, og_title, og_description, og_image, scheduled_at, canonical_url_override, robots_directive, updated_at, updated_by) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, ?) ON CONFLICT(slug) DO UPDATE SET title = excluded.title, status = excluded.status, body = excluded.body, seo_title = excluded.seo_title, meta_description = excluded.meta_description, excerpt = excluded.excerpt, og_title = excluded.og_title, og_description = excluded.og_description, og_image = excluded.og_image, scheduled_at = excluded.scheduled_at, canonical_url_override = excluded.canonical_url_override, robots_directive = excluded.robots_directive, updated_at = CURRENT_TIMESTAMP, updated_by = excluded.updated_by";
export const SQL_INSERT_CONTENT_ENTRY = `INSERT INTO content_entries (slug, legacy_url, title, kind, template_key, source_html_path, updated_at, body, summary, seo_title, meta_description, og_title, og_description, og_image) VALUES (?, ?, ?, 'post', 'content', ?, CURRENT_TIMESTAMP, ?, ?, ?, ?, ?, ?, ?)`;
export const SQL_INSERT_CREATE_OVERRIDE =
	"INSERT INTO content_overrides (slug, title, status, body, seo_title, meta_description, excerpt, og_title, og_description, og_image, canonical_url_override, robots_directive, updated_at, updated_by) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, ?)";
export const SQL_SELECT_REVISION =
	"SELECT title, status, scheduled_at, body, seo_title, meta_description, excerpt, og_title, og_description, og_image, author_ids, category_ids, tag_ids, canonical_url_override, robots_directive, revision_note FROM content_revisions WHERE slug = ? AND id = ? LIMIT 1";

export function trimOrNull(value: string | undefined | null): string | null {
	return value?.trim() || null;
}

export function cleanIdList(ids: number[] | undefined): number[] {
	return [
		...new Set(
			(ids ?? []).filter((entry) => Number.isInteger(entry) && entry > 0),
		),
	];
}

export function normalizeSeoFields(input: {
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

export function normalizeScheduledAt(value: string | undefined): string | null {
	const trimmed = value?.trim();
	return trimmed ? new Date(value as string).toISOString() : null;
}

export function normalizeLegacyUrl(
	legacyUrl: string | undefined,
	slug: string,
): string {
	const raw = legacyUrl?.trim() || `/${slug}`;
	return raw.startsWith("/") ? raw : `/${raw}`;
}

export function serializeMetadata(
	metadata: Record<string, unknown>,
): string | null {
	return Object.keys(metadata).length > 0 ? JSON.stringify(metadata) : null;
}

export function nullsToUndefined<T extends Record<string, unknown>>(
	obj: T,
): { [K in keyof T]: Exclude<T[K], null> | undefined } {
	const result = {} as Record<string, unknown>;
	for (const [key, value] of Object.entries(obj)) {
		result[key] = value ?? undefined;
	}
	return result as { [K in keyof T]: Exclude<T[K], null> | undefined };
}

export async function detectConflict(
	db: D1Like,
	slug: string,
	lastKnownUpdatedAt: string,
) {
	const row = await db
		.prepare(SQL_DETECT_CONFLICT)
		.bind(slug)
		.first<{ updated_at: string }>();
	if (row && row.updated_at !== lastKnownUpdatedAt) {
		return {
			ok: false as const,
			error:
				"This record was modified by another editor after you opened it. Reload to see the latest version.",
			conflict: true as const,
		};
	}
	return null;
}

export async function insertContentRevision(
	db: D1Like,
	slug: string,
	r: {
		title: string;
		status: string;
		scheduledAt?: string | null;
		body: string;
		seoTitle: string;
		metaDescription: string;
		seo: ReturnType<typeof normalizeSeoFields>;
		authorIds: string;
		categoryIds: string;
		tagIds: string;
		revisionNote: string | null;
		actor: Actor;
	},
) {
	await db
		.prepare(INSERT_REVISION_SQL)
		.bind(
			`revision-${crypto.randomUUID()}`,
			slug,
			r.title,
			r.status,
			r.scheduledAt ?? null,
			r.body,
			r.seoTitle,
			r.metaDescription,
			r.seo.excerpt,
			r.seo.ogTitle,
			r.seo.ogDescription,
			r.seo.ogImage,
			r.authorIds,
			r.categoryIds,
			r.tagIds,
			r.seo.canonicalUrlOverride,
			r.seo.robotsDirective,
			r.revisionNote,
			r.actor.email,
		)
		.run();
}
