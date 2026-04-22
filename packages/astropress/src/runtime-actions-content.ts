import { serializeIdList, slugifyContent } from "./admin-normalizers";
import { withLocalStoreFallback } from "./admin-store-dispatch";
import { purgeCdnCache } from "./cache-purge";
import { dispatchPluginContentEvent, getCmsConfig } from "./config";
import { recordD1Audit } from "./d1-audit";
import type { Actor } from "./persistence-types";
import {
	type ContentStatus,
	SQL_INSERT_CONTENT_ENTRY,
	SQL_INSERT_CREATE_OVERRIDE,
	UPSERT_CONTENT_OVERRIDE_SQL,
	cleanIdList,
	detectConflict,
	insertContentRevision,
	normalizeLegacyUrl,
	normalizeScheduledAt,
	normalizeSeoFields,
	nullsToUndefined,
	serializeMetadata,
	trimOrNull,
} from "./runtime-actions-content-helpers";
import {
	ensureD1BaselineRevision,
	findPageRecord,
	mapContentState,
	normalizeContentStatus,
	replaceD1ContentAssignments,
	validateContentTypeFields,
} from "./runtime-actions-content-shared";
import type { SaveContentInput } from "./runtime-actions-content-types";

export async function saveRuntimeContentState(
	slug: string,
	input: SaveContentInput,
	actor: Actor,
	locals?: App.Locals | null,
) {
	return withLocalStoreFallback(
		locals,
		async (db) => {
			const pageRecord = await findPageRecord(slug, locals);
			if (!pageRecord) {
				return {
					ok: false as const,
					error: "The selected content record could not be found.",
				};
			}

			const title = input.title.trim();
			const seoTitle = input.seoTitle.trim();
			const metaDescription = input.metaDescription.trim();
			const status: ContentStatus = normalizeContentStatus(input.status);
			const body = input.body?.trim() || pageRecord.body || "";
			const scheduledAt = normalizeScheduledAt(input.scheduledAt);
			const revisionNote = trimOrNull(input.revisionNote);
			const authorIds = cleanIdList(input.authorIds);
			const categoryIds = cleanIdList(input.categoryIds);
			const tagIds = cleanIdList(input.tagIds);

			if (!title || !seoTitle || !metaDescription) {
				return {
					ok: false as const,
					error: "Title, SEO title, and meta description are required.",
				};
			}

			await ensureD1BaselineRevision(db, pageRecord);

			if (input.lastKnownUpdatedAt) {
				const conflict = await detectConflict(
					db,
					pageRecord.slug,
					input.lastKnownUpdatedAt,
				);
				if (conflict) return conflict;
			}

			// Content type field validation
			const metadata = input.metadata ?? {};
			const fieldError = validateContentTypeFields(
				pageRecord.templateKey,
				metadata,
			);
			if (fieldError) {
				return { ok: false as const, error: fieldError };
			}
			const metadataJson = serializeMetadata(metadata);
			const seo = normalizeSeoFields(input);

			await db
				.prepare(UPSERT_CONTENT_OVERRIDE_SQL)
				.bind(
					pageRecord.slug,
					title,
					status,
					body,
					seoTitle,
					metaDescription,
					seo.excerpt,
					seo.ogTitle,
					seo.ogDescription,
					seo.ogImage,
					scheduledAt,
					seo.canonicalUrlOverride,
					seo.robotsDirective,
					metadataJson,
					actor.email,
				)
				.run();

			await replaceD1ContentAssignments(db, pageRecord.slug, {
				authorIds,
				categoryIds,
				tagIds,
			});

			await insertContentRevision(db, pageRecord.slug, {
				title,
				status,
				scheduledAt,
				body,
				seoTitle,
				metaDescription,
				seo,
				authorIds: serializeIdList(authorIds),
				categoryIds: serializeIdList(categoryIds),
				tagIds: serializeIdList(tagIds),
				revisionNote,
				actor,
			});

			await recordD1Audit(
				locals,
				actor,
				"content.update",
				"content",
				pageRecord.slug,
				`Updated reviewed metadata for ${pageRecord.legacyUrl}.`,
			);

			const pluginEvent = {
				slug: pageRecord.slug,
				kind: "post",
				status,
				actor: actor.email,
			};
			await dispatchPluginContentEvent("onContentSave", pluginEvent);
			if (status === "published") {
				await dispatchPluginContentEvent("onContentPublish", pluginEvent);
				// Fire CDN purge asynchronously — failure must not block the publish response
				void purgeCdnCache(pageRecord.slug, getCmsConfig());
			}

			return {
				ok: true as const,
				state: mapContentState(pageRecord, {
					title,
					status,
					scheduledAt: scheduledAt ?? undefined,
					body,
					authorIds,
					categoryIds,
					tagIds,
					seoTitle,
					metaDescription,
					...nullsToUndefined(seo),
				}),
			};
		},
		/* v8 ignore next 1 */
		(localStore) => localStore.saveContentState(slug, input, actor),
	);
}

export async function createRuntimeContentRecord(
	input: {
		title: string;
		slug: string;
		legacyUrl?: string;
		status: string;
		body?: string;
		summary?: string;
		seoTitle: string;
		metaDescription: string;
		excerpt?: string;
		ogTitle?: string;
		ogDescription?: string;
		ogImage?: string;
		canonicalUrlOverride?: string;
		robotsDirective?: string;
	},
	actor: Actor,
	locals?: App.Locals | null,
) {
	return withLocalStoreFallback(
		locals,
		async (db) => {
			const title = input.title.trim();
			const slug = slugifyContent(input.slug);
			const legacyUrl = normalizeLegacyUrl(input.legacyUrl, slug);
			const seoTitle = input.seoTitle.trim() || title;
			const metaDescription = input.metaDescription.trim();
			const status = normalizeContentStatus(input.status);
			const body = input.body?.trim() || "";
			const summary = input.summary?.trim() || "";
			const seo = normalizeSeoFields(input);

			if (!title || !slug || !metaDescription) {
				return {
					ok: false as const,
					error: "Title, slug, and meta description are required.",
				};
			}

			if (
				(await findPageRecord(slug, locals)) ||
				(await findPageRecord(legacyUrl.replace(/^\//, ""), locals))
			) {
				return { ok: false as const, error: "That slug is already in use." };
			}

			try {
				await db
					.prepare(SQL_INSERT_CONTENT_ENTRY)
					.bind(
						slug,
						legacyUrl,
						title,
						`runtime://content/${slug}`,
						body,
						summary,
						seoTitle,
						metaDescription,
						seo.ogTitle,
						seo.ogDescription,
						seo.ogImage,
					)
					.run();
				/* v8 ignore next 3 */
			} catch {
				return {
					ok: false as const,
					error: "That slug or route is already in use.",
				};
			}

			const createSeo = { ...seo, excerpt: seo.excerpt || summary || null };

			await db
				.prepare(SQL_INSERT_CREATE_OVERRIDE)
				.bind(
					slug,
					title,
					status,
					body,
					seoTitle,
					metaDescription,
					createSeo.excerpt,
					createSeo.ogTitle,
					createSeo.ogDescription,
					createSeo.ogImage,
					createSeo.canonicalUrlOverride,
					createSeo.robotsDirective,
					actor.email,
				)
				.run();

			await insertContentRevision(db, slug, {
				title,
				status,
				body,
				seoTitle,
				metaDescription,
				seo: createSeo,
				authorIds: "[]",
				categoryIds: "[]",
				tagIds: "[]",
				revisionNote: "Created new post.",
				actor,
			});

			await recordD1Audit(
				locals,
				actor,
				"content.create",
				"content",
				slug,
				`Created post ${legacyUrl}.`,
			);

			return {
				ok: true as const,
				state: {
					slug,
					legacyUrl,
					title,
					status,
					body,
					seoTitle,
					metaDescription,
				},
			};
		},
		/* v8 ignore next 1 */
		(localStore) => localStore.createContentRecord(input, actor),
	);
}

// delegates content.restore audit action
export { restoreRuntimeRevision } from "./runtime-actions-content-restore";
