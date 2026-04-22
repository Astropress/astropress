import { parseIdList } from "./admin-normalizers";
import { getCmsConfig } from "./config";
import type { D1AdminReadStore } from "./d1-admin-store";
import type { D1DatabaseLike } from "./d1-database";
import {
	type PageRecord,
	getD1ContentAssignmentIds,
	mapPersistedOverride,
	mergeContentOverride,
} from "./d1-store-content-helpers";
import type { ContentRecord, ContentRevision } from "./persistence-types";

type ContentStatus = "draft" | "review" | "published" | "archived";

function getPageRecords() {
	return getCmsConfig().seedPages as unknown as PageRecord[];
}

async function getCustomContentEntries(db: D1DatabaseLike) {
	const rows = (
		await db
			.prepare(
				`
          SELECT slug, legacy_url, title, kind, template_key, source_html_path, updated_at, body, summary,
                 seo_title, meta_description, og_title, og_description, og_image
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
				og_title: string | null;
				og_description: string | null;
				og_image: string | null;
			}>()
	).results;

	return rows.map((row) => ({
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
		status: "draft" as ContentStatus,
	}));
}

async function getAllContentRecords(db: D1DatabaseLike) {
	return [...getPageRecords(), ...(await getCustomContentEntries(db))];
}

async function findPageRecord(db: D1DatabaseLike, slug: string) {
	const records = await getAllContentRecords(db);
	return (
		records.find(
			(entry) => entry.slug === slug || entry.legacyUrl === `/${slug}`,
		) ?? null
	);
}

async function getPersistedContentOverride(db: D1DatabaseLike, slug: string) {
	const row = await db
		.prepare(
			`
        SELECT title, status, scheduled_at, body, seo_title, meta_description, excerpt, og_title, og_description, og_image,
               canonical_url_override, robots_directive
        FROM content_overrides
        WHERE slug = ?
        LIMIT 1
      `,
		)
		.bind(slug)
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
			canonical_url_override: string | null;
			robots_directive: string | null;
		}>();

	return mapPersistedOverride(row);
}

export interface D1SchedulingRecord {
	id: string;
	slug: string;
	title: string;
	scheduledAt: string;
}

export function createD1SchedulingPart(db: D1DatabaseLike) {
	return {
		async schedulePublish(id: string, scheduledAt: string): Promise<void> {
			await db
				.prepare(
					"UPDATE content_overrides SET scheduled_at = ?, status = 'draft' WHERE slug = ?",
				)
				.bind(scheduledAt, id)
				.run();
			await db
				.prepare(
					`INSERT INTO content_overrides (slug, scheduled_at, status, title, seo_title, meta_description, updated_at, updated_by)
           SELECT ce.slug, ?, 'draft', ce.title, ce.title, '', CURRENT_TIMESTAMP, 'scheduler'
           FROM content_entries ce WHERE ce.slug = ?
           AND NOT EXISTS (SELECT 1 FROM content_overrides co WHERE co.slug = ?)`,
				)
				.bind(scheduledAt, id, id)
				.run();
		},

		async listScheduled(): Promise<D1SchedulingRecord[]> {
			const now = new Date().toISOString();
			const rows = (
				await db
					.prepare(
						`SELECT co.slug AS id, co.slug, COALESCE(co.title, ce.title, co.slug) AS title, co.scheduled_at
             FROM content_overrides co
             LEFT JOIN content_entries ce ON ce.slug = co.slug
             WHERE co.scheduled_at IS NOT NULL AND co.scheduled_at > ?
             ORDER BY co.scheduled_at ASC`,
					)
					.bind(now)
					.all<{
						id: string;
						slug: string;
						title: string;
						scheduled_at: string;
					}>()
			).results;
			return rows.map((r) => ({
				id: r.slug,
				slug: r.slug,
				title: r.title,
				scheduledAt: r.scheduled_at,
			}));
		},

		async cancelScheduledPublish(id: string): Promise<void> {
			await db
				.prepare(
					"UPDATE content_overrides SET scheduled_at = NULL WHERE slug = ?",
				)
				.bind(id)
				.run();
		},

		async runScheduledPublishes(): Promise<number> {
			const now = new Date().toISOString();
			const result = await db
				.prepare(
					`UPDATE content_overrides SET status = 'published', scheduled_at = NULL
           WHERE scheduled_at IS NOT NULL AND scheduled_at <= ?`,
				)
				.bind(now)
				.run();
			return result.meta?.changes ?? 0;
		},
	};
}

export function createD1ContentReadPart(
	db: D1DatabaseLike,
): D1AdminReadStore["content"] {
	return {
		async listContentStates() {
			const records = await getAllContentRecords(db);
			const states = await Promise.all(
				records.map(async (record) => this.getContentState(record.slug)),
			);
			return states.filter(
				(record): record is NonNullable<(typeof states)[number]> =>
					Boolean(record),
			);
		},
		async getContentState(slug: string): Promise<ContentRecord | null> {
			const pageRecord = await findPageRecord(db, slug);
			if (!pageRecord) {
				return null;
			}

			const override = await getPersistedContentOverride(db, pageRecord.slug);
			const assignments = await getD1ContentAssignmentIds(db, pageRecord.slug);
			return mergeContentOverride(pageRecord, override, assignments);
		},
		async getContentRevisions(slug: string): Promise<ContentRevision[] | null> {
			const pageRecord = await findPageRecord(db, slug);
			if (!pageRecord) {
				return null;
			}

			const rows = (
				await db
					.prepare(
						`
              SELECT id, slug, title, status, scheduled_at, body, seo_title, meta_description, excerpt, og_title,
                     og_description, og_image, author_ids, category_ids, tag_ids, canonical_url_override, robots_directive, revision_note, source, created_at, created_by
              FROM content_revisions
              WHERE slug = ?
              ORDER BY datetime(created_at) DESC, id DESC
            `,
					)
					.bind(pageRecord.slug)
					.all<{
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
						source: "imported" | "reviewed";
						created_at: string;
						revision_note: string | null;
						created_by: string | null;
					}>()
			).results;

			return rows.map((row) => ({
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
			}));
		},
	};
}

export async function searchD1ContentStates(
	db: D1DatabaseLike,
	query: string,
): Promise<ContentRecord[]> {
	const results = await db
		.prepare(
			"SELECT co.* FROM content_overrides co WHERE co.rowid IN (SELECT rowid FROM content_fts(?) ORDER BY rank)",
		)
		.bind(query)
		.all<Record<string, unknown>>();
	return (results.results ?? []) as unknown as ContentRecord[];
}
