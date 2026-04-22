import { parseIdList } from "./admin-normalizers";
import { withLocalStoreFallback } from "./admin-store-dispatch";
import { recordD1Audit } from "./d1-audit";
import type { Actor } from "./persistence-types";
import {
	SQL_SELECT_REVISION,
	UPSERT_CONTENT_OVERRIDE_NO_META_SQL,
	insertContentRevision,
} from "./runtime-actions-content-helpers";
import {
	ensureD1BaselineRevision,
	findPageRecord,
	replaceD1ContentAssignments,
} from "./runtime-actions-content-shared";
import type { RevisionRow } from "./runtime-actions-content-types";

export async function restoreRuntimeRevision(
	slug: string,
	revisionId: string,
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

			await ensureD1BaselineRevision(db, pageRecord);

			const revision = await db
				.prepare(SQL_SELECT_REVISION)
				.bind(pageRecord.slug, revisionId)
				.first<RevisionRow>();

			if (!revision) {
				return { ok: false as const, error: "Revision not found." };
			}

			await db
				.prepare(UPSERT_CONTENT_OVERRIDE_NO_META_SQL)
				.bind(
					pageRecord.slug,
					revision.title,
					revision.status,
					revision.body,
					revision.seo_title,
					revision.meta_description,
					revision.excerpt,
					revision.og_title,
					revision.og_description,
					revision.og_image,
					revision.scheduled_at,
					revision.canonical_url_override,
					revision.robots_directive,
					actor.email,
				)
				.run();

			await replaceD1ContentAssignments(db, pageRecord.slug, {
				authorIds: parseIdList(revision.author_ids),
				categoryIds: parseIdList(revision.category_ids),
				tagIds: parseIdList(revision.tag_ids),
			});

			const revSeo = {
				excerpt: revision.excerpt,
				ogTitle: revision.og_title,
				ogDescription: revision.og_description,
				ogImage: revision.og_image,
				canonicalUrlOverride: revision.canonical_url_override,
				robotsDirective: revision.robots_directive,
			};
			await insertContentRevision(db, pageRecord.slug, {
				title: revision.title,
				status: revision.status,
				scheduledAt: revision.scheduled_at,
				body: revision.body ?? "",
				seoTitle: revision.seo_title,
				metaDescription: revision.meta_description,
				seo: revSeo,
				authorIds: revision.author_ids ?? "[]",
				categoryIds: revision.category_ids ?? "[]",
				tagIds: revision.tag_ids ?? "[]",
				revisionNote: revision.revision_note,
				actor,
			});

			await recordD1Audit(
				locals,
				actor,
				"content.restore",
				"content",
				pageRecord.slug,
				`Restored revision ${revisionId} for ${slug}.`,
			);
			return { ok: true as const };
		},
		/* v8 ignore next 1 */
		(localStore) => localStore.restoreRevision(slug, revisionId, actor),
	);
}
