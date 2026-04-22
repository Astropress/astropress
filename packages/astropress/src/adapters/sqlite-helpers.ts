import type {
	ContentStoreRecord,
	MediaAssetRecord,
} from "../platform-contracts";
import type { createAstropressSqliteAdminRuntime } from "../sqlite-admin-runtime";
import type { AstropressSqliteSeedToolkit } from "../sqlite-bootstrap";
import {
	toContentStoreRecord,
	toRedirectRecord,
} from "./adapter-record-helpers.js";

export const SQL_UPSERT_MEDIA =
	"INSERT INTO media_assets (id, source_url, local_path, mime_type, file_size, alt_text, title, uploaded_at, uploaded_by, deleted_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, NULL) ON CONFLICT(id) DO UPDATE SET source_url = excluded.source_url, local_path = excluded.local_path, mime_type = excluded.mime_type, file_size = excluded.file_size, alt_text = excluded.alt_text, title = excluded.title, deleted_at = NULL";
export const SQL_INSERT_REVISION = `INSERT INTO content_revisions (id, slug, source, title, status, scheduled_at, body, seo_title, meta_description, excerpt, og_title, og_description, og_image, author_ids, category_ids, tag_ids, canonical_url_override, robots_directive, revision_note, created_at, created_by) VALUES (?, ?, 'reviewed', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`;
export const SQL_LIST_TRANSLATIONS =
	"SELECT route, state, updated_at, updated_by FROM translation_overrides ORDER BY route ASC";

export type SqliteAdminRuntime = ReturnType<
	typeof createAstropressSqliteAdminRuntime
>;
export type SqliteActor = { email: string; role: "admin"; name: string };

export function listSqliteContentRecords(
	runtime: SqliteAdminRuntime,
	ensureDatabase: () => ReturnType<
		AstropressSqliteSeedToolkit["openSeedDatabase"]
	>,
	kind: ContentStoreRecord["kind"] | undefined,
): ContentStoreRecord[] {
	const records: ContentStoreRecord[] = [];
	if (!kind || kind === "page" || kind === "post") {
		for (const record of runtime.sqliteAdminStore.content.listContentStates()) {
			const mapped = toContentStoreRecord(record);
			if (!kind || mapped.kind === kind) records.push(mapped);
		}
	}
	if (!kind || kind === "redirect") {
		records.push(
			...runtime.sqliteAdminStore.redirects
				.getRedirectRules()
				.map((rule) => toRedirectRecord(rule)),
		);
	}
	if (!kind || kind === "comment") {
		records.push(
			...runtime.sqliteAdminStore.comments.getComments().map((comment) => ({
				id: comment.id,
				kind: "comment" as const,
				slug: comment.id,
				status: comment.status === "approved" ? "published" : "draft",
				title: comment.author,
				body: comment.body ?? null,
				metadata: {
					route: comment.route,
					email: comment.email ?? null,
					policy: comment.policy,
					submittedAt: comment.submittedAt ?? null,
				},
			})),
		);
	}
	if (!kind || kind === "user") {
		records.push(
			...runtime.sqliteAdminStore.users.listAdminUsers().map((user) => ({
				id: String(user.id),
				kind: "user" as const,
				slug: user.email,
				status: user.active ? "published" : "archived",
				title: user.name,
				metadata: {
					email: user.email,
					role: user.role,
					createdAt: user.createdAt,
					userStatus: user.status,
				},
			})),
		);
	}
	if (!kind || kind === "settings") {
		const settings = runtime.sqliteAdminStore.settings.getSettings();
		records.push({
			id: "site-settings",
			kind: "settings",
			slug: "site-settings",
			status: "published",
			title: settings.siteTitle,
			metadata: settings,
		});
	}
	if (!kind || kind === "translation") {
		const rows = ensureDatabase()
			.prepare(SQL_LIST_TRANSLATIONS)
			.all() as Array<{
			route: string;
			state: string;
			updated_at: string;
			updated_by: string;
		}>;
		records.push(
			...rows.map((row) => ({
				id: row.route,
				kind: "translation" as const,
				slug: row.route,
				status: row.state === "published" ? "published" : "draft",
				title: row.route,
				metadata: {
					state: row.state,
					updatedAt: row.updated_at,
					updatedBy: row.updated_by,
				},
			})),
		);
	}
	if (!kind || kind === "media") {
		records.push(
			...runtime.sqliteAdminStore.media.listMediaAssets().map((asset) => ({
				id: asset.id,
				kind: "media" as const,
				slug: asset.id,
				status: "published" as const,
				title: asset.title || asset.id,
				metadata: {
					sourceUrl: asset.sourceUrl,
					localPath: asset.localPath,
					mimeType: asset.mimeType,
					altText: asset.altText,
					uploadedAt: asset.uploadedAt,
				},
			})),
		);
	}
	return records;
}

export function resolveMetaString(
	meta: Record<string, unknown> | null | undefined,
	key: string,
): string | undefined {
	return typeof meta?.[key] === "string" ? (meta[key] as string) : undefined;
}

export function resolveSqliteStatus(
	status: string | undefined,
): "archived" | "draft" | "published" {
	return status === "archived"
		? "archived"
		: status === "draft"
			? "draft"
			: "published";
}

export function saveSqlitePageOrPost(
	runtime: SqliteAdminRuntime,
	slug: string,
	record: ContentStoreRecord,
	actor: SqliteActor,
): ContentStoreRecord {
	const existing = runtime.sqliteAdminStore.content.getContentState(slug);
	const seoTitle = String(record.metadata?.seoTitle ?? record.title ?? slug);
	const metaDescription = String(
		record.metadata?.metaDescription ?? record.title ?? slug,
	);
	if (existing) {
		const result = runtime.sqliteAdminStore.content.saveContentState(
			slug,
			{
				title: record.title ?? existing.title,
				body: record.body ?? existing.body ?? "",
				status: resolveSqliteStatus(record.status),
				seoTitle,
				metaDescription,
				excerpt: String(record.metadata?.summary ?? existing.summary ?? ""),
				ogTitle: resolveMetaString(record.metadata, "ogTitle"),
				ogDescription: resolveMetaString(record.metadata, "ogDescription"),
				ogImage: resolveMetaString(record.metadata, "ogImage"),
				canonicalUrlOverride: resolveMetaString(
					record.metadata,
					"canonicalUrlOverride",
				),
				robotsDirective: resolveMetaString(record.metadata, "robotsDirective"),
			},
			actor,
		);
		if (!result.ok) throw new Error(result.error);
		return toContentStoreRecord(result.state);
	}
	const result = runtime.sqliteAdminStore.content.createContentRecord(
		{
			title: record.title ?? slug,
			slug,
			legacyUrl: resolveMetaString(record.metadata, "legacyUrl") ?? `/${slug}`,
			body: record.body ?? "",
			summary: String(record.metadata?.summary ?? ""),
			status: resolveSqliteStatus(record.status),
			seoTitle,
			metaDescription,
			ogTitle: resolveMetaString(record.metadata, "ogTitle"),
			ogDescription: resolveMetaString(record.metadata, "ogDescription"),
			ogImage: resolveMetaString(record.metadata, "ogImage"),
		},
		actor,
	);
	if (!result.ok) throw new Error(result.error);
	return toContentStoreRecord(result.state);
}

export function saveSqliteContentRecord(
	runtime: SqliteAdminRuntime,
	record: ContentStoreRecord,
	actor: SqliteActor,
): ContentStoreRecord {
	const slug = record.slug || record.id;
	if (record.kind === "redirect") {
		const targetPath = String(record.metadata?.targetPath ?? "").trim();
		const statusCode = Number(record.metadata?.statusCode) === 302 ? 302 : 301;
		const result = runtime.sqliteAdminStore.redirects.createRedirectRule(
			{ sourcePath: slug, targetPath, statusCode },
			actor,
		);
		if (!result.ok) throw new Error(result.error);
		return toRedirectRecord({ sourcePath: slug, targetPath, statusCode });
	}
	if (record.kind === "settings") {
		const current = runtime.sqliteAdminStore.settings.getSettings();
		const next = { ...current, ...(record.metadata ?? {}) };
		const result = runtime.sqliteAdminStore.settings.saveSettings(next, actor);
		if (!result.ok) throw new Error(result.error);
		return {
			id: "site-settings",
			kind: "settings",
			slug: "site-settings",
			status: "published",
			title: next.siteTitle,
			metadata: next,
		};
	}
	if (record.kind === "translation") {
		const state = String(record.metadata?.state ?? "not_started");
		runtime.sqliteAdminStore.translations.updateTranslationState(
			slug,
			state,
			actor,
		);
		return {
			id: slug,
			kind: "translation",
			slug,
			status: state === "published" ? "published" : "draft",
			title: slug,
			metadata: { state },
		};
	}
	if (record.kind === "page" || record.kind === "post") {
		return saveSqlitePageOrPost(runtime, slug, record, actor);
	}
	throw new Error(
		`SQLite content store does not support saving ${record.kind} records yet.`,
	);
}

export function deleteSqliteContentRecord(
	runtime: SqliteAdminRuntime,
	existing: ContentStoreRecord,
	actor: SqliteActor,
) {
	if (existing.kind === "redirect") {
		runtime.sqliteAdminStore.redirects.deleteRedirectRule(existing.slug, actor);
		return;
	}
	if (existing.kind === "page" || existing.kind === "post") {
		runtime.sqliteAdminStore.content.saveContentState(
			existing.slug,
			{
				title: existing.title ?? existing.slug,
				status: "archived",
				body: existing.body ?? "",
				seoTitle: String(
					existing.metadata?.seoTitle ?? existing.title ?? existing.slug,
				),
				metaDescription: String(
					existing.metadata?.metaDescription ?? existing.title ?? existing.slug,
				),
			},
			actor,
		);
		return;
	}
	throw new Error(
		`SQLite content store does not support deleting ${existing.kind} records yet.`,
	);
}

export function snapshotField(
	snapshot: Record<string, unknown>,
	key: string,
	fallback: unknown = null,
) {
	return snapshot[key] ?? fallback;
}

export function buildRevisionParams(
	snapshot: Record<string, unknown>,
	revision: {
		id: string;
		recordId: string;
		summary?: string | null;
		createdAt: string;
		actorId?: string | null;
	},
	actorEmail: string,
) {
	const title = String(snapshot.title ?? revision.recordId);
	return [
		revision.id,
		revision.recordId,
		title,
		resolveSqliteStatus(snapshot.status as string),
		snapshotField(snapshot, "scheduledAt"),
		snapshotField(snapshot, "body"),
		String(snapshot.seoTitle ?? snapshot.title ?? revision.recordId),
		String(snapshot.metaDescription ?? snapshot.title ?? revision.recordId),
		snapshotField(snapshot, "excerpt"),
		snapshotField(snapshot, "ogTitle"),
		snapshotField(snapshot, "ogDescription"),
		snapshotField(snapshot, "ogImage"),
		JSON.stringify(snapshot.authorIds ?? []),
		JSON.stringify(snapshot.categoryIds ?? []),
		JSON.stringify(snapshot.tagIds ?? []),
		snapshotField(snapshot, "canonicalUrlOverride"),
		snapshotField(snapshot, "robotsDirective"),
		revision.summary ?? null,
		revision.createdAt,
		revision.actorId ?? actorEmail,
	];
}

export function appendSqliteRevision(
	ensureDatabase: () => ReturnType<
		AstropressSqliteSeedToolkit["openSeedDatabase"]
	>,
	revision: {
		id: string;
		recordId: string;
		snapshot: Record<string, unknown>;
		summary?: string | null;
		createdAt: string;
		actorId?: string | null;
	},
	actorEmail: string,
) {
	ensureDatabase()
		.prepare(SQL_INSERT_REVISION)
		.run(...buildRevisionParams(revision.snapshot, revision, actorEmail));
}

export function getSqliteMedia(runtime: SqliteAdminRuntime, id: string) {
	const asset = runtime.sqliteAdminStore.media
		.listMediaAssets()
		.find((entry) => entry.id === id);
	if (!asset) return null;
	return {
		id: asset.id,
		filename: asset.title || asset.id,
		mimeType: asset.mimeType ?? "application/octet-stream",
		publicUrl: asset.sourceUrl ?? asset.localPath,
		metadata: { altText: asset.altText, uploadedAt: asset.uploadedAt },
	};
}

export function putSqliteMedia(
	ensureDatabase: () => ReturnType<
		AstropressSqliteSeedToolkit["openSeedDatabase"]
	>,
	asset: MediaAssetRecord,
	actorEmail: string,
) {
	ensureDatabase()
		.prepare(SQL_UPSERT_MEDIA)
		.run(
			asset.id,
			asset.publicUrl ?? null,
			asset.publicUrl ?? `/media/${asset.filename}`,
			asset.mimeType,
			asset.bytes?.byteLength ?? null,
			String(asset.metadata?.altText ?? ""),
			String(asset.metadata?.title ?? asset.filename),
			new Date().toISOString(),
			actorEmail,
		);
}
