import type { D1DatabaseLike } from "./d1-database";
import {
	type ContentStatus,
	type PersistedOverrideRow,
	mapPersistedOverrideRow,
} from "./persistence-commons";
import type { ContentOverride, ContentRecord } from "./persistence-types";

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
	row: PersistedOverrideRow | null,
): ContentOverride | null {
	const mapped = mapPersistedOverrideRow(row);
	if (!mapped) return null;
	// D1 schema lacks the metadata column; strip it to keep the return type identical.
	const { metadata: _metadata, ...rest } = mapped;
	return rest;
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
