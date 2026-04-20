import type { ContentRecord } from "../persistence-types";
import { type PageRecord, parseIdList } from "./utils";

export type ContentStatus = "draft" | "review" | "published" | "archived";

export interface ContentEntryRow {
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
	og_title: string | null;
	og_description: string | null;
	og_image: string | null;
}

export interface ContentOverrideRow {
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
	metadata: string | null;
}

export interface RevisionRow {
	id: string;
	slug: string;
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
	source: "imported" | "reviewed";
	created_at: string;
	created_by: string | null;
}

export function mapContentEntryRow(row: ContentEntryRow): PageRecord {
	return {
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
	};
}

export function pageRecordToContentRecord(
	pageRecord: PageRecord,
): ContentRecord {
	return {
		...pageRecord,
		status: pageRecord.status ?? "published",
		seoTitle: pageRecord.seoTitle ?? pageRecord.title,
		metaDescription: pageRecord.metaDescription ?? pageRecord.summary ?? "",
	};
}

export function mapPersistedOverrideRow(row: ContentOverrideRow | undefined) {
	if (!row) {
		return null;
	}

	let metadata: Record<string, unknown> | undefined;
	if (row.metadata) {
		try {
			metadata = JSON.parse(row.metadata) as Record<string, unknown>;
		} catch {
			metadata = undefined;
		}
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
		metadata,
	};
}

export function mapRevisionRow(row: RevisionRow) {
	return {
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
	};
}
