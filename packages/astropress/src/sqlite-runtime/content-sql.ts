import type { AstropressSqliteDatabaseLike, PageRecord } from "./utils";

export const SQL_UPSERT_OVERRIDE =
	"INSERT INTO content_overrides (slug, title, status, body, seo_title, meta_description, excerpt, og_title, og_description, og_image, scheduled_at, canonical_url_override, robots_directive, metadata, updated_at, updated_by) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, ?) ON CONFLICT(slug) DO UPDATE SET title = excluded.title, status = excluded.status, body = excluded.body, seo_title = excluded.seo_title, meta_description = excluded.meta_description, excerpt = excluded.excerpt, og_title = excluded.og_title, og_description = excluded.og_description, og_image = excluded.og_image, scheduled_at = excluded.scheduled_at, canonical_url_override = excluded.canonical_url_override, robots_directive = excluded.robots_directive, metadata = excluded.metadata, updated_at = CURRENT_TIMESTAMP, updated_by = excluded.updated_by";
export const SQL_INSERT_REVISION_CONTENT = `INSERT INTO content_revisions (id, slug, title, status, scheduled_at, body, seo_title, meta_description, excerpt, og_title, og_description, og_image, author_ids, category_ids, tag_ids, canonical_url_override, robots_directive, revision_note, source, created_by) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'reviewed', ?)`;
export const SQL_INSERT_ENTRY = `INSERT INTO content_entries (slug, legacy_url, title, kind, template_key, source_html_path, updated_at, body, summary, seo_title, meta_description, og_title, og_description, og_image) VALUES (?, ?, ?, 'post', 'content', ?, CURRENT_TIMESTAMP, ?, ?, ?, ?, ?, ?, ?)`;
export const SQL_LIST_REVISIONS_FOR_SLUG =
	"SELECT id, slug, title, status, scheduled_at, body, seo_title, meta_description, excerpt, og_title, og_description, og_image, author_ids, category_ids, tag_ids, canonical_url_override, robots_directive, revision_note, source, created_at, created_by FROM content_revisions WHERE slug = ? ORDER BY datetime(created_at) DESC, id DESC";
export const SQL_INSERT_BASELINE_OVERRIDE =
	"INSERT INTO content_overrides (slug, title, status, body, seo_title, meta_description, excerpt, og_title, og_description, og_image, scheduled_at, canonical_url_override, robots_directive, updated_at, updated_by) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, ?) ON CONFLICT(slug) DO NOTHING";
export const SQL_INSERT_BASELINE_REVISION = `INSERT INTO content_revisions (id, slug, title, status, scheduled_at, body, seo_title, meta_description, excerpt, og_title, og_description, og_image, canonical_url_override, robots_directive, revision_note, source, created_at, created_by) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'imported', ?, ?)`;

export type RevisionInput = {
	title: string;
	status: string;
	scheduledAt?: string | null;
	body?: string | null;
	seoTitle: string;
	metaDescription: string;
	excerpt?: string | null;
	ogTitle?: string | null;
	ogDescription?: string | null;
	ogImage?: string | null;
	authorIds?: number[];
	categoryIds?: number[];
	tagIds?: number[];
	canonicalUrlOverride?: string | null;
	robotsDirective?: string | null;
	revisionNote?: string | null;
};

export function buildBaselineOverrideParams(pageRecord: PageRecord) {
	return [
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
		null,
		"seed-import",
	];
}

export function buildBaselineRevisionParams(
	randomId: () => string,
	pageRecord: PageRecord,
) {
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
		null,
		null,
		null,
		null,
		null,
		null,
		"imported-baseline",
		"seed-import",
	];
}

export function ensureBaselineRevisionImpl(
	getDb: () => AstropressSqliteDatabaseLike,
	randomId: () => string,
	pageRecord: PageRecord,
) {
	const db = getDb();
	db.prepare(SQL_INSERT_BASELINE_OVERRIDE).run(
		...buildBaselineOverrideParams(pageRecord),
	);
	const existing = db
		.prepare(
			"SELECT id FROM content_revisions WHERE slug = ? AND source = 'imported' LIMIT 1",
		)
		.get(pageRecord.slug) as { id: string } | undefined;
	if (existing) return;
	db.prepare(SQL_INSERT_BASELINE_REVISION).run(
		...buildBaselineRevisionParams(randomId, pageRecord),
	);
}
