import { mapPersistedOverrideRow as mapPersistedOverrideRowCommon } from "../persistence-commons";
import type { ContentRecord } from "../persistence-types";
import {
	type AstropressSqliteDatabaseLike,
	type PageRecord,
	parseIdList,
	serializeIdList,
} from "./utils";

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
	const mapped = mapPersistedOverrideRowCommon(row ?? null);
	if (!mapped) return null;
	// Preserve the prior shape where `metadata` is always present (possibly undefined).
	return { ...mapped, metadata: mapped.metadata };
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

/* ── SQL constants, RevisionInput, and baseline helpers ── */

export {
	SQL_LIST_REVISIONS_FOR_SLUG,
	type RevisionInput,
	buildBaselineOverrideParams,
	buildBaselineRevisionParams,
	ensureBaselineRevisionImpl,
} from "./content-sql";
import {
	type RevisionInput,
	SQL_INSERT_ENTRY,
	SQL_INSERT_REVISION_CONTENT,
	SQL_UPSERT_OVERRIDE,
} from "./content-sql";

export function queryCustomContentEntries(
	getDb: () => AstropressSqliteDatabaseLike,
) {
	return getDb()
		.prepare(
			`
        SELECT slug, legacy_url, title, kind, template_key, source_html_path, updated_at, body, summary,
               seo_title, meta_description, og_title, og_description, og_image
        FROM content_entries
        ORDER BY datetime(updated_at) DESC, slug ASC
      `,
		)
		.all() as ContentEntryRow[];
}

export function queryContentAssignmentIds(
	getDb: () => AstropressSqliteDatabaseLike,
	slug: string,
) {
	const db = getDb();
	const authorIds = (
		db
			.prepare(
				"SELECT author_id FROM content_authors WHERE slug = ? ORDER BY author_id ASC",
			)
			.all(slug) as Array<{ author_id: number }>
	).map((row) => row.author_id);
	const categoryIds = (
		db
			.prepare(
				"SELECT category_id FROM content_categories WHERE slug = ? ORDER BY category_id ASC",
			)
			.all(slug) as Array<{ category_id: number }>
	).map((row) => row.category_id);
	const tagIds = (
		db
			.prepare(
				"SELECT tag_id FROM content_tags WHERE slug = ? ORDER BY tag_id ASC",
			)
			.all(slug) as Array<{ tag_id: number }>
	).map((row) => row.tag_id);
	return { authorIds, categoryIds, tagIds };
}

export function replaceAssignments(
	getDb: () => AstropressSqliteDatabaseLike,
	slug: string,
	input: { authorIds?: number[]; categoryIds?: number[]; tagIds?: number[] },
) {
	const db = getDb();
	db.prepare("DELETE FROM content_authors WHERE slug = ?").run(slug);
	db.prepare("DELETE FROM content_categories WHERE slug = ?").run(slug);
	db.prepare("DELETE FROM content_tags WHERE slug = ?").run(slug);

	for (const authorId of input.authorIds ?? []) {
		db.prepare(
			"INSERT OR IGNORE INTO content_authors (slug, author_id) VALUES (?, ?)",
		).run(slug, authorId);
	}
	for (const categoryId of input.categoryIds ?? []) {
		db.prepare(
			"INSERT OR IGNORE INTO content_categories (slug, category_id) VALUES (?, ?)",
		).run(slug, categoryId);
	}
	for (const tagId of input.tagIds ?? []) {
		db.prepare(
			"INSERT OR IGNORE INTO content_tags (slug, tag_id) VALUES (?, ?)",
		).run(slug, tagId);
	}
}

export function upsertOverride(
	getDb: () => AstropressSqliteDatabaseLike,
	slug: string,
	override: {
		title: string;
		status: string;
		body?: string | null;
		seoTitle: string;
		metaDescription: string;
		excerpt?: string | null;
		ogTitle?: string | null;
		ogDescription?: string | null;
		ogImage?: string | null;
		scheduledAt?: string | null;
		canonicalUrlOverride?: string | null;
		robotsDirective?: string | null;
		metadata?: Record<string, unknown> | null;
	},
	actor: { email: string },
) {
	getDb()
		.prepare(SQL_UPSERT_OVERRIDE)
		.run(
			slug,
			override.title,
			override.status,
			override.body ?? null,
			override.seoTitle,
			override.metaDescription,
			override.excerpt ?? null,
			override.ogTitle ?? null,
			override.ogDescription ?? null,
			override.ogImage ?? null,
			override.scheduledAt ?? null,
			override.canonicalUrlOverride ?? null,
			override.robotsDirective ?? null,
			override.metadata ? JSON.stringify(override.metadata) : null,
			actor.email,
		);
}

export function insertRevision(
	getDb: () => AstropressSqliteDatabaseLike,
	randomId: () => string,
	slug: string,
	revision: RevisionInput,
	actor: { email: string },
) {
	getDb()
		.prepare(SQL_INSERT_REVISION_CONTENT)
		.run(
			`revision-${randomId()}`,
			slug,
			revision.title,
			revision.status,
			revision.scheduledAt ?? null,
			revision.body ?? null,
			revision.seoTitle,
			revision.metaDescription,
			revision.excerpt ?? null,
			revision.ogTitle ?? null,
			revision.ogDescription ?? null,
			revision.ogImage ?? null,
			serializeIdList(revision.authorIds),
			serializeIdList(revision.categoryIds),
			serializeIdList(revision.tagIds),
			revision.canonicalUrlOverride ?? null,
			revision.robotsDirective ?? null,
			revision.revisionNote ?? null,
			actor.email,
		);
}

export function tryInsertContentEntry(
	getDb: () => AstropressSqliteDatabaseLike,
	entry: {
		slug: string;
		legacyUrl: string;
		title: string;
		body: string;
		summary: string;
		seoTitle: string;
		metaDescription: string;
		ogTitle?: string | null;
		ogDescription?: string | null;
		ogImage?: string | null;
	},
): boolean {
	try {
		getDb()
			.prepare(SQL_INSERT_ENTRY)
			.run(
				entry.slug,
				entry.legacyUrl,
				entry.title,
				`runtime://content/${entry.slug}`,
				entry.body,
				entry.summary,
				entry.seoTitle,
				entry.metaDescription,
				entry.ogTitle ?? null,
				entry.ogDescription ?? null,
				entry.ogImage ?? null,
			);
		return true;
	} catch {
		return false;
	}
}
