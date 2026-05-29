import type { D1DatabaseLike } from "../d1-database";
import type { ContentStoreRecord } from "../platform-contracts";
import {
	cloudflareActorEmail,
	normalizeContentStatus,
	nowIso,
	saveD1Revision,
	toContentStoreRecord,
} from "./adapter-record-helpers.js";

import {
	SQL_INSERT_CONTENT,
	SQL_UPSERT_MEDIA,
	SQL_UPSERT_OVERRIDE,
	SQL_UPSERT_REDIRECT,
	SQL_UPSERT_SETTINGS,
	SQL_UPSERT_TRANSLATION,
} from "./cloudflare-helpers-data.js";

// Re-export so existing `from "./cloudflare-helpers"` importers stay unaffected.
export {
	SQL_INSERT_CONTENT,
	SQL_UPSERT_MEDIA,
	SQL_UPSERT_OVERRIDE,
	SQL_UPSERT_REDIRECT,
	SQL_UPSERT_SETTINGS,
	SQL_UPSERT_TRANSLATION,
};

interface ContentStateRow {
	title?: string;
	body?: string | null;
	summary?: string | null;
	ogTitle?: string | null;
	ogDescription?: string | null;
	ogImage?: string | null;
	canonicalUrlOverride?: string | null;
	robotsDirective?: string | null;
}

interface ReadStore {
	content: {
		listContentStates(): Promise<unknown[]>;
		getContentState(slug: string): Promise<ContentStateRow | null>;
		getContentRevisions(id: string): Promise<unknown[] | null>;
	};
	redirects: { getRedirectRules(): Promise<unknown[]> };
	comments: { getComments(): Promise<unknown[]> };
	users: { listAdminUsers(): Promise<unknown[]> };
	settings: { getSettings(): Promise<unknown> };
	media: { listMediaAssets(): Promise<unknown[]> };
}

function resolveMetaString(
	// audit-boundary: opaque-passthrough -- driver row-shape mirror; values narrowed at consumer
	meta: Record<string, unknown> | null | undefined,
	key: string,
	fallback: string | null,
): string | null {
	return typeof meta?.[key] === "string" ? (meta[key] as string) : fallback;
}

function resolveContentFields(
	record: {
		title?: string | null;
		body?: string | null;
		// audit-boundary: opaque-passthrough -- driver row-shape mirror; values narrowed at consumer
		metadata?: Record<string, unknown> | null;
	},
	existing: ContentStateRow | null | undefined,
	slug: string,
) {
	const title = record.title ?? existing?.title ?? slug;
	const body = record.body ?? existing?.body ?? "";
	const summary = String(record.metadata?.summary ?? existing?.summary ?? "");
	const seoTitle = String(record.metadata?.seoTitle ?? title);
	const metaDescription = String(record.metadata?.metaDescription ?? title);
	const ogTitle = resolveMetaString(record.metadata, "ogTitle", existing?.ogTitle ?? null);
	const ogDescription = resolveMetaString(
		record.metadata,
		"ogDescription",
		existing?.ogDescription ?? null,
	);
	const ogImage = resolveMetaString(record.metadata, "ogImage", existing?.ogImage ?? null);
	const canonicalUrlOverride = resolveMetaString(
		record.metadata,
		"canonicalUrlOverride",
		existing?.canonicalUrlOverride ?? null,
	);
	const robotsDirective = resolveMetaString(
		record.metadata,
		"robotsDirective",
		existing?.robotsDirective ?? null,
	);
	return {
		title,
		body,
		summary,
		seoTitle,
		metaDescription,
		ogTitle,
		ogDescription,
		ogImage,
		canonicalUrlOverride,
		robotsDirective,
	};
}

export async function savePageOrPost(
	db: D1DatabaseLike,
	readStore: ReadStore,
	record: {
		slug?: string;
		id: string;
		kind: string;
		title?: string | null;
		body?: string | null;
		status?: string;
		// audit-boundary: opaque-passthrough -- driver row-shape mirror; values narrowed at consumer
		metadata?: Record<string, unknown> | null;
	},
): Promise<ContentStoreRecord> {
	const slug = record.slug || record.id;
	const existing = await readStore.content.getContentState(slug);
	const f = resolveContentFields(record, existing, slug);
	const status = normalizeContentStatus(record.status);

	if (!existing) {
		const legacyUrl = resolveMetaString(record.metadata, "legacyUrl", `/${slug}`) ?? `/${slug}`;
		const templateKey = resolveMetaString(record.metadata, "templateKey", "content") ?? "content";
		await db
			.prepare(SQL_INSERT_CONTENT)
			.bind(
				slug,
				legacyUrl,
				f.title,
				record.kind,
				templateKey,
				`runtime://content/${slug}`,
				nowIso(),
				f.body,
				f.summary,
				f.seoTitle,
				f.metaDescription,
				f.ogTitle,
				f.ogDescription,
				f.ogImage,
			)
			.run();
	}

	await db
		.prepare(SQL_UPSERT_OVERRIDE)
		.bind(
			slug,
			f.title,
			status,
			f.body,
			f.seoTitle,
			f.metaDescription,
			f.summary,
			f.ogTitle,
			f.ogDescription,
			f.ogImage,
			f.canonicalUrlOverride,
			f.robotsDirective,
			nowIso(),
			cloudflareActorEmail(),
		)
		.run();

	await saveD1Revision(
		db,
		{
			id: `cloudflare-${crypto.randomUUID()}`,
			recordId: slug,
			createdAt: nowIso(),
			actorId: cloudflareActorEmail(),
			snapshot: {
				title: f.title,
				status,
				body: f.body,
				seoTitle: f.seoTitle,
				metaDescription: f.metaDescription,
				excerpt: f.summary,
				ogTitle: f.ogTitle,
				ogDescription: f.ogDescription,
				ogImage: f.ogImage,
				canonicalUrlOverride: f.canonicalUrlOverride,
				robotsDirective: f.robotsDirective,
			},
		},
		cloudflareActorEmail(),
	);

	const saved = await readStore.content.getContentState(slug);
	if (!saved) throw new Error(`Cloudflare adapter failed to persist content record ${slug}.`);
	// getContentState's row types `status` as a plain string; toContentStoreRecord
	// normalises it. Same content-state data, divergent status type only.
	return toContentStoreRecord(saved as Parameters<typeof toContentStoreRecord>[0]);
}
