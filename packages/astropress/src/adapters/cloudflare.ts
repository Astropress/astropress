import { createD1AdminReadStore } from "../d1-admin-store";
import type { D1DatabaseLike } from "../d1-database";
import {
	type AstropressPlatformAdapter,
	type AuthStore,
	type ContentStoreRecord,
	type DeployTarget,
	type GitSyncAdapter,
	type ImportSource,
	type MediaAssetRecord,
	type PreviewSession,
	type RevisionRecord,
	assertProviderContract,
	normalizeProviderCapabilities,
} from "../platform-contracts";
import {
	cloudflareActorEmail,
	listTranslationRecords,
	nowIso,
	saveD1Revision,
	toContentStoreRecord,
	toRedirectRecord,
	toTranslationRecord,
} from "./adapter-record-helpers.js";
import {
	type AstropressCloudflareSeedUser,
	createD1CloudflareAuthStore,
	createDisabledCloudflareAuthStore,
	createFallbackCloudflareAuthStore,
} from "./cloudflare-auth.js";
import {
	SQL_UPSERT_MEDIA,
	SQL_UPSERT_REDIRECT,
	SQL_UPSERT_SETTINGS,
	SQL_UPSERT_TRANSLATION,
	savePageOrPost,
} from "./cloudflare-helpers.js";

export interface AstropressCloudflareAdapterOptions {
	db?: D1DatabaseLike;
	auth?: AuthStore;
	users?: AstropressCloudflareSeedUser[];
	/** WARNING: Enables an in-memory auth store backed by plaintext password comparison. Do NOT set this to true in any deployed or internet-accessible environment. */
	allowInsecureFallbackAuth?: boolean;
	gitSync?: GitSyncAdapter;
	deploy?: DeployTarget;
	importer?: ImportSource;
	preview?: PreviewSession;
}

const CF_CAPS = {
	name: "cloudflare" as const,
	staticPublishing: true,
	hostedAdmin: true,
	previewEnvironments: true,
	serverRuntime: true,
	database: true,
	objectStorage: true,
	gitSync: true,
};
const SQL_CF_SOFT_DELETE_REDIRECT =
	"UPDATE redirect_rules SET deleted_at = CURRENT_TIMESTAMP WHERE source_path = ? AND deleted_at IS NULL";
const SQL_CF_SOFT_DELETE_MEDIA =
	"UPDATE media_assets SET deleted_at = CURRENT_TIMESTAMP WHERE id = ?";

async function saveCloudflareRecord(
	db: D1DatabaseLike,
	readStore: ReturnType<typeof createD1AdminReadStore>,
	record: {
		slug?: string;
		id: string;
		kind: string;
		title?: string;
		body?: string | null;
		status?: string;
		metadata?: Record<string, unknown> | null;
	},
) {
	const slug = record.slug || record.id;
	if (record.kind === "redirect") {
		const targetPath = String(record.metadata?.targetPath ?? "").trim();
		const statusCode = Number(record.metadata?.statusCode) === 302 ? 302 : 301;
		await db
			.prepare(SQL_UPSERT_REDIRECT)
			.bind(slug, targetPath, statusCode, cloudflareActorEmail())
			.run();
		return toRedirectRecord({ sourcePath: slug, targetPath, statusCode });
	}
	if (record.kind === "settings") {
		const current = await readStore.settings.getSettings();
		const next = { ...current, ...(record.metadata ?? {}) };
		await db
			.prepare(SQL_UPSERT_SETTINGS)
			.bind(
				next.siteTitle,
				next.siteTagline,
				next.donationUrl,
				next.newsletterEnabled ? 1 : 0,
				next.commentsDefaultPolicy,
				next.adminSlug,
				nowIso(),
				cloudflareActorEmail(),
			)
			.run();
		return {
			id: "site-settings",
			kind: "settings" as const,
			slug: "site-settings",
			status: "published" as const,
			title: next.siteTitle,
			metadata: next,
		};
	}
	if (record.kind === "translation") {
		const state = String(record.metadata?.state ?? "not_started");
		const updatedAt = nowIso();
		const updatedBy = cloudflareActorEmail();
		await db
			.prepare(SQL_UPSERT_TRANSLATION)
			.bind(slug, state, updatedAt, updatedBy)
			.run();
		return toTranslationRecord(slug, state, updatedAt, updatedBy);
	}
	if (record.kind === "page" || record.kind === "post") {
		return savePageOrPost(db, readStore, record);
	}
	throw new Error(
		`Cloudflare content store does not support saving ${record.kind} records yet.`,
	);
}

function resolveAuth(
	options: AstropressCloudflareAdapterOptions,
	db?: D1DatabaseLike,
) {
	if (options.auth) return options.auth;
	if (options.allowInsecureFallbackAuth && options.users)
		return createFallbackCloudflareAuthStore(options.users);
	return db
		? createD1CloudflareAuthStore(db)
		: createDisabledCloudflareAuthStore();
}

async function listCloudflareContentRecords(
	db: D1DatabaseLike,
	readStore: ReturnType<typeof createD1AdminReadStore>,
	kind: ContentStoreRecord["kind"] | undefined,
): Promise<ContentStoreRecord[]> {
	const records: ContentStoreRecord[] = [];
	if (!kind || kind === "page" || kind === "post") {
		for (const record of await readStore.content.listContentStates()) {
			const mapped = toContentStoreRecord(record);
			if (!kind || mapped.kind === kind) records.push(mapped);
		}
	}
	if (!kind || kind === "redirect") {
		records.push(
			...(await readStore.redirects.getRedirectRules()).map((rule) =>
				toRedirectRecord(rule),
			),
		);
	}
	if (!kind || kind === "comment") {
		records.push(
			...(await readStore.comments.getComments()).map((comment) => ({
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
			...(await readStore.users.listAdminUsers()).map((user) => ({
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
		const settings = await readStore.settings.getSettings();
		records.push({
			id: "site-settings",
			kind: "settings",
			slug: "site-settings",
			status: "published",
			title: settings.siteTitle,
			metadata: settings,
		});
	}
	if (!kind || kind === "media") {
		records.push(
			...(await readStore.media.listMediaAssets()).map((asset) => ({
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
	if (!kind || kind === "translation") {
		records.push(...(await listTranslationRecords(db)));
	}
	return records;
}

export function createAstropressCloudflareAdapter(
	options: AstropressCloudflareAdapterOptions = {},
): AstropressPlatformAdapter {
	if (!options.db) {
		return assertProviderContract({
			capabilities: normalizeProviderCapabilities(CF_CAPS),
			content: {
				async list() {
					return [];
				},
				async get() {
					return null;
				},
				async save(record) {
					return record;
				},
				async delete() {},
			},
			media: {
				async put(asset) {
					return asset;
				},
				async get() {
					return null;
				},
				async delete() {},
			},
			revisions: {
				async list() {
					return [];
				},
				async append(revision) {
					return revision;
				},
			},
			auth: resolveAuth(options),
			gitSync: options.gitSync,
			deploy: options.deploy,
			importer: options.importer,
			preview: options.preview,
		});
	}

	const readStore = createD1AdminReadStore(options.db);
	const db = options.db;
	return assertProviderContract({
		capabilities: normalizeProviderCapabilities(CF_CAPS),
		auth: resolveAuth(options, db),
		content: {
			async list(kind) {
				return listCloudflareContentRecords(db, readStore, kind);
			},
			async get(id) {
				const normalizedId = id.trim();
				if (!normalizedId) return null;
				const all = await this.list();
				return (
					all.find(
						(record) =>
							record.id === normalizedId || record.slug === normalizedId,
					) ?? null
				);
			},
			async save(record) {
				return saveCloudflareRecord(db, readStore, record);
			},
			async delete(id) {
				const existing = await this.get(id);
				if (!existing) return;
				if (existing.kind === "redirect") {
					await db
						.prepare(SQL_CF_SOFT_DELETE_REDIRECT)
						.bind(existing.slug)
						.run();
					return;
				}
				if (existing.kind === "page" || existing.kind === "post") {
					await this.save({ ...existing, status: "archived" });
					return;
				}
				if (existing.kind === "media") {
					await db.prepare(SQL_CF_SOFT_DELETE_MEDIA).bind(existing.id).run();
					return;
				}
			},
		},
		media: {
			async put(asset: MediaAssetRecord) {
				await db
					.prepare(SQL_UPSERT_MEDIA)
					.bind(
						asset.id,
						asset.publicUrl ?? null,
						asset.publicUrl ?? `/media/${asset.filename}`,
						asset.mimeType,
						asset.bytes?.byteLength ?? null,
						String(asset.metadata?.altText ?? ""),
						String(asset.metadata?.title ?? asset.filename),
						nowIso(),
						cloudflareActorEmail(),
					)
					.run();
				return asset;
			},
			async get(id) {
				const asset = (await readStore.media.listMediaAssets()).find(
					(entry) => entry.id === id,
				);
				if (!asset) return null;
				return {
					id: asset.id,
					filename: asset.title || asset.id,
					mimeType: asset.mimeType ?? "application/octet-stream",
					publicUrl: asset.sourceUrl ?? asset.localPath,
					metadata: { altText: asset.altText, uploadedAt: asset.uploadedAt },
				};
			},
			async delete(id) {
				await db.prepare(SQL_CF_SOFT_DELETE_MEDIA).bind(id).run();
			},
		},
		revisions: {
			async list(recordId) {
				return (
					(await readStore.content.getContentRevisions(recordId)) ?? []
				).map(
					(revision): RevisionRecord => ({
						id: revision.id,
						recordId: revision.slug,
						createdAt: revision.createdAt,
						actorId: revision.createdBy ?? null,
						summary: revision.revisionNote ?? null,
						snapshot: revision as unknown as Record<string, unknown>,
					}),
				);
			},
			async append(revision) {
				await saveD1Revision(db, revision, cloudflareActorEmail());
				return revision;
			},
		},
		gitSync: options.gitSync,
		deploy: options.deploy,
		importer: options.importer,
		preview: options.preview,
	});
}
