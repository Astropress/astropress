import type { D1DatabaseLike } from "./d1-database";
import type { ContentOverride, ContentRecord } from "./persistence-types";

type ContentStatus = "draft" | "review" | "published" | "archived";

export interface PageRecord {
	slug: string;
	legacyUrl: string;
	title: string;
	templateKey: string;
	listingItems: unknown[];
	paginationLinks: unknown[];
	sourceHtmlPath: string;
	updatedAt: string;
	body?: string;
	summary?: string;
	seoTitle?: string;
	metaDescription?: string;
	ogTitle?: string;
	ogDescription?: string;
	ogImage?: string;
	canonicalUrlOverride?: string;
	robotsDirective?: string;
	kind?: string;
	status?: ContentStatus;
}

export function mapPersistedOverride(
	row: {
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
	} | null,
): ContentOverride | null {
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

export async function getD1ContentAssignmentIds(
	db: D1DatabaseLike,
	slug: string,
) {
	const [authorRows, categoryRows, tagRows] = await Promise.all([
		db
			.prepare(
				"SELECT author_id FROM content_authors WHERE slug = ? ORDER BY author_id ASC",
			)
			.bind(slug)
			.all<{ author_id: number }>(),
		db
			.prepare(
				"SELECT category_id FROM content_categories WHERE slug = ? ORDER BY category_id ASC",
			)
			.bind(slug)
			.all<{ category_id: number }>(),
		db
			.prepare(
				"SELECT tag_id FROM content_tags WHERE slug = ? ORDER BY tag_id ASC",
			)
			.bind(slug)
			.all<{ tag_id: number }>(),
	]);

	return {
		authorIds: authorRows.results.map((row) => row.author_id),
		categoryIds: categoryRows.results.map((row) => row.category_id),
		tagIds: tagRows.results.map((row) => row.tag_id),
	};
}

export function mergeContentOverride(
	pageRecord: PageRecord,
	override: ContentOverride | null,
	assignments: { authorIds: number[]; categoryIds: number[]; tagIds: number[] },
): ContentRecord {
	return {
		...pageRecord,
		title: override?.title ?? pageRecord.title,
		status: override?.status ?? pageRecord.status ?? "published",
		scheduledAt: override?.scheduledAt,
		body: override?.body ?? pageRecord.body,
		authorIds: assignments.authorIds,
		categoryIds: assignments.categoryIds,
		tagIds: assignments.tagIds,
		seoTitle: override?.seoTitle ?? pageRecord.seoTitle ?? pageRecord.title,
		metaDescription:
			override?.metaDescription ??
			pageRecord.metaDescription ??
			pageRecord.summary ??
			"",
		excerpt: override?.excerpt ?? pageRecord.summary,
		ogTitle: override?.ogTitle,
		ogDescription: override?.ogDescription,
		ogImage: override?.ogImage,
		canonicalUrlOverride: override?.canonicalUrlOverride,
		robotsDirective: override?.robotsDirective,
	};
}
