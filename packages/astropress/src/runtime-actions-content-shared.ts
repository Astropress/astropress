import { getAdminDb } from "./admin-store-dispatch";
import { getCmsConfig, peekCmsConfig, validateContentFields } from "./config";
import type { D1DatabaseLike } from "./d1-database";
import type { ContentOverride } from "./persistence-types";

export type ContentStatus = "draft" | "review" | "published" | "archived";

const SQL_UPSERT_BASELINE_OVERRIDE = `
  INSERT INTO content_overrides (
    slug, title, status, body, seo_title, meta_description, excerpt, og_title,
    og_description, og_image, canonical_url_override, robots_directive, updated_at, updated_by
  ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, ?)
  ON CONFLICT(slug) DO NOTHING
`;
const SQL_CHECK_IMPORTED_REVISION =
	"SELECT id FROM content_revisions WHERE slug = ? AND source = 'imported' LIMIT 1";
const SQL_INSERT_BASELINE_REVISION = `
  INSERT INTO content_revisions (
    id, slug, title, status, body, seo_title, meta_description, excerpt,
    og_title, og_description, og_image, author_ids, category_ids, tag_ids,
    canonical_url_override, robots_directive, source, created_at, created_by
  ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'imported', ?, ?)
`;

export interface PageRecord {
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
	templateKey?: string;
}

export function getPageRecords() {
	return getCmsConfig().seedPages as unknown as PageRecord[];
}

export async function getCustomContentEntries(db: D1DatabaseLike) {
	const rows = (
		await db
			.prepare(
				`
          SELECT slug, legacy_url, title, kind, template_key, source_html_path, updated_at, body, summary, seo_title, meta_description
          FROM content_entries
          ORDER BY datetime(updated_at) DESC, slug ASC
        `,
			)
			.all<{
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
			}>()
	).results;

	return rows.map((row) => ({
		slug: row.slug,
		legacyUrl: row.legacy_url,
		title: row.title,
		templateKey: row.template_key,
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

export async function findPageRecord(slug: string, locals?: App.Locals | null) {
	const db = getAdminDb(locals);
	/* v8 ignore next 3 */
	if (!db) {
		return (
			getPageRecords().find(
				(entry) => entry.slug === slug || entry.legacyUrl === `/${slug}`,
			) ?? null
		);
	}

	const customEntries = await getCustomContentEntries(db);
	return (
		[...getPageRecords(), ...customEntries].find(
			(entry) => entry.slug === slug || entry.legacyUrl === `/${slug}`,
		) ?? null
	);
}

export function normalizeContentStatus(input?: string | null): ContentStatus {
	if (
		input === "draft" ||
		input === "review" ||
		input === "archived" ||
		input === "published"
	) {
		return input;
	}
	return "published";
}

export async function replaceD1ContentAssignments(
	db: D1DatabaseLike,
	slug: string,
	input: { authorIds: number[]; categoryIds: number[]; tagIds: number[] },
) {
	await db
		.prepare("DELETE FROM content_authors WHERE slug = ?")
		.bind(slug)
		.run();
	await db
		.prepare("DELETE FROM content_categories WHERE slug = ?")
		.bind(slug)
		.run();
	await db.prepare("DELETE FROM content_tags WHERE slug = ?").bind(slug).run();

	for (const authorId of input.authorIds) {
		await db
			.prepare(
				"INSERT OR IGNORE INTO content_authors (slug, author_id) VALUES (?, ?)",
			)
			.bind(slug, authorId)
			.run();
	}
	for (const categoryId of input.categoryIds) {
		await db
			.prepare(
				"INSERT OR IGNORE INTO content_categories (slug, category_id) VALUES (?, ?)",
			)
			.bind(slug, categoryId)
			.run();
	}
	for (const tagId of input.tagIds) {
		await db
			.prepare(
				"INSERT OR IGNORE INTO content_tags (slug, tag_id) VALUES (?, ?)",
			)
			.bind(slug, tagId)
			.run();
	}
}

/** Extract baseline field values from a page record into a flat tuple for SQL binding. */
function baselineFields(pageRecord: PageRecord) {
	const status = pageRecord.status ?? "published";
	const body = pageRecord.body ?? null;
	const seoTitle = pageRecord.seoTitle ?? pageRecord.title;
	const metaDesc = pageRecord.metaDescription ?? pageRecord.summary ?? "";
	const excerpt = pageRecord.summary ?? null;
	return { status, body, seoTitle, metaDesc, excerpt };
}

export async function ensureD1BaselineRevision(
	db: D1DatabaseLike,
	pageRecord: PageRecord,
) {
	const f = baselineFields(pageRecord);
	await db
		.prepare(SQL_UPSERT_BASELINE_OVERRIDE)
		.bind(
			pageRecord.slug,
			pageRecord.title,
			f.status,
			f.body,
			f.seoTitle,
			f.metaDesc,
			f.excerpt,
			null,
			null,
			null,
			null,
			null,
			"seed-import",
		)
		.run();

	const existing = await db
		.prepare(SQL_CHECK_IMPORTED_REVISION)
		.bind(pageRecord.slug)
		.first<{ id: string }>();

	/* v8 ignore next 3 */
	if (existing) {
		return;
	}

	await db
		.prepare(SQL_INSERT_BASELINE_REVISION)
		.bind(
			`revision-${crypto.randomUUID()}`,
			pageRecord.slug,
			pageRecord.title,
			f.status,
			f.body,
			f.seoTitle,
			f.metaDesc,
			f.excerpt,
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

export function mapContentState(
	pageRecord: PageRecord,
	override: ContentOverride,
) {
	return {
		...pageRecord,
		...override,
	};
}

export function validateContentTypeFields(
	templateKey: string | undefined,
	metadata: Record<string, unknown>,
): string | null {
	const contentTypeDefinition = peekCmsConfig()?.contentTypes?.find(
		(ct) => ct.key === templateKey,
	);
	if (contentTypeDefinition) {
		return validateContentFields(contentTypeDefinition, metadata) ?? null;
	}
	return null;
}
