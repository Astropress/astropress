import type { D1DatabaseLike } from "../d1-database";
import type { ContentStoreRecord } from "../platform-contracts";
import {
	cloudflareActorEmail,
	normalizeContentStatus,
	nowIso,
	saveD1Revision,
	toContentStoreRecord,
} from "./adapter-record-helpers.js";

export const SQL_UPSERT_REDIRECT =
	"INSERT INTO redirect_rules (source_path, target_path, status_code, created_by, deleted_at) VALUES (?, ?, ?, ?, NULL) ON CONFLICT(source_path) DO UPDATE SET target_path = excluded.target_path, status_code = excluded.status_code, created_by = excluded.created_by, deleted_at = NULL";
export const SQL_UPSERT_SETTINGS =
	"INSERT INTO site_settings (id, site_title, site_tagline, donation_url, newsletter_enabled, comments_default_policy, admin_slug, updated_at, updated_by) VALUES (1, ?, ?, ?, ?, ?, ?, ?, ?) ON CONFLICT(id) DO UPDATE SET site_title = excluded.site_title, site_tagline = excluded.site_tagline, donation_url = excluded.donation_url, newsletter_enabled = excluded.newsletter_enabled, comments_default_policy = excluded.comments_default_policy, admin_slug = excluded.admin_slug, updated_at = excluded.updated_at, updated_by = excluded.updated_by";
export const SQL_UPSERT_TRANSLATION =
	"INSERT INTO translation_overrides (route, state, updated_at, updated_by) VALUES (?, ?, ?, ?) ON CONFLICT(route) DO UPDATE SET state = excluded.state, updated_at = excluded.updated_at, updated_by = excluded.updated_by";
export const SQL_INSERT_CONTENT =
	"INSERT INTO content_entries (slug, legacy_url, title, kind, template_key, source_html_path, updated_at, body, summary, seo_title, meta_description, og_title, og_description, og_image) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)";
export const SQL_UPSERT_OVERRIDE =
	"INSERT INTO content_overrides (slug, title, status, scheduled_at, body, seo_title, meta_description, excerpt, og_title, og_description, og_image, canonical_url_override, robots_directive, updated_at, updated_by) VALUES (?, ?, ?, NULL, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?) ON CONFLICT(slug) DO UPDATE SET title = excluded.title, status = excluded.status, body = excluded.body, seo_title = excluded.seo_title, meta_description = excluded.meta_description, excerpt = excluded.excerpt, og_title = excluded.og_title, og_description = excluded.og_description, og_image = excluded.og_image, canonical_url_override = excluded.canonical_url_override, robots_directive = excluded.robots_directive, updated_at = excluded.updated_at, updated_by = excluded.updated_by";
export const SQL_UPSERT_MEDIA =
	"INSERT INTO media_assets (id, source_url, local_path, mime_type, file_size, alt_text, title, uploaded_at, uploaded_by, deleted_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, NULL) ON CONFLICT(id) DO UPDATE SET source_url = excluded.source_url, local_path = excluded.local_path, mime_type = excluded.mime_type, file_size = excluded.file_size, alt_text = excluded.alt_text, title = excluded.title, deleted_at = NULL";

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
	meta: Record<string, unknown> | null | undefined,
	key: string,
	fallback: string | null,
): string | null {
	return typeof meta?.[key] === "string" ? (meta[key] as string) : fallback;
}

function resolveContentFields(
	record: {
		title?: string;
		body?: string | null;
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
	const ogTitle = resolveMetaString(
		record.metadata,
		"ogTitle",
		existing?.ogTitle ?? null,
	);
	const ogDescription = resolveMetaString(
		record.metadata,
		"ogDescription",
		existing?.ogDescription ?? null,
	);
	const ogImage = resolveMetaString(
		record.metadata,
		"ogImage",
		existing?.ogImage ?? null,
	);
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
		title?: string;
		body?: string | null;
		status?: string;
		metadata?: Record<string, unknown> | null;
	},
): Promise<ContentStoreRecord> {
	const slug = record.slug || record.id;
	const existing = await readStore.content.getContentState(slug);
	const f = resolveContentFields(record, existing, slug);
	const status = normalizeContentStatus(record.status);

	if (!existing) {
		const legacyUrl =
			resolveMetaString(record.metadata, "legacyUrl", `/${slug}`) ?? `/${slug}`;
		const templateKey =
			resolveMetaString(record.metadata, "templateKey", "content") ?? "content";
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
	if (!saved)
		throw new Error(
			`Cloudflare adapter failed to persist content record ${slug}.`,
		);
	return toContentStoreRecord(saved);
}
