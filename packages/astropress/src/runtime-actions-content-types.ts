import type { ContentStatus } from "./persistence-types";

export interface SaveContentInput {
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
	lastKnownUpdatedAt?: string;
	metadata?: Record<string, unknown>;
}

export interface RevisionRow {
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
}
