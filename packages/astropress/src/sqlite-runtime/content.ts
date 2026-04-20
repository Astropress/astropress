import { createAstropressContentRepository } from "../content-repository-factory";
import type { ContentRecord } from "../persistence-types";
import { recordAudit } from "./audit-log";
import {
	type ContentEntryRow,
	type RevisionInput,
	type RevisionRow,
	SQL_LIST_REVISIONS_FOR_SLUG,
	buildBaselineOverrideParams,
	buildBaselineRevisionParams,
	ensureBaselineRevisionImpl,
	insertRevision,
	mapContentEntryRow,
	mapPersistedOverrideRow,
	mapRevisionRow,
	pageRecordToContentRecord,
	queryContentAssignmentIds,
	queryCustomContentEntries,
	replaceAssignments,
	tryInsertContentEntry,
	upsertOverride,
} from "./content-helpers";
import { createSqliteSubmissionStore } from "./content-submissions";
import {
	type AstropressSqliteDatabaseLike,
	type PageRecord,
	getSeedPageRecords,
	normalizeContentStatus,
	normalizePath,
	slugifyTerm,
} from "./utils";

export function createSqliteContentStore(
	getDb: () => AstropressSqliteDatabaseLike,
	randomId: () => string,
) {
	function getCustomContentEntries() {
		return queryCustomContentEntries(getDb);
	}

	function getAllContentRecords() {
		return [
			...getSeedPageRecords(),
			...getCustomContentEntries().map((row) => mapContentEntryRow(row)),
		];
	}

	function findPageRecord(slug: string) {
		return (
			getAllContentRecords().find(
				(entry) => entry.slug === slug || entry.legacyUrl === `/${slug}`,
			) ?? null
		);
	}

	function getPersistedContentOverride(slug: string) {
		const row = getDb()
			.prepare(
				`
          SELECT title, status, body, seo_title, meta_description, excerpt, og_title, og_description, og_image,
                 scheduled_at, canonical_url_override, robots_directive, metadata
          FROM content_overrides
          WHERE slug = ?
          LIMIT 1
        `,
			)
			.get(slug) as Parameters<typeof mapPersistedOverrideRow>[0];

		return mapPersistedOverrideRow(row);
	}

	function ensureBaselineRevision(pageRecord: PageRecord) {
		ensureBaselineRevisionImpl(getDb, randomId, pageRecord);
	}

	const sqliteContentRepository = createAstropressContentRepository({
		normalizePath,
		slugifyTerm,
		normalizeContentStatus,
		findContentRecord(slug) {
			const record = findPageRecord(slug);
			return record ? pageRecordToContentRecord(record) : null;
		},
		listContentRecords() {
			return getAllContentRecords().map((record) =>
				pageRecordToContentRecord(record),
			);
		},
		getPersistedOverride: getPersistedContentOverride,
		getContentAssignments(slug) {
			return queryContentAssignmentIds(getDb, slug);
		},
		ensureBaselineRevision(record) {
			ensureBaselineRevision(record as PageRecord);
		},
		listPersistedRevisions(slug) {
			const rows = getDb()
				.prepare(SQL_LIST_REVISIONS_FOR_SLUG)
				.all(slug) as RevisionRow[];
			return rows.map(mapRevisionRow);
		},
		getPersistedRevision(slug, revisionId) {
			return (
				this.listPersistedRevisions(slug).find(
					(revision) => revision.id === revisionId,
				) ?? null
			);
		},
		upsertContentOverride(slug, override, actor) {
			upsertOverride(getDb, slug, override, actor);
		},
		replaceContentAssignments(slug, assignments) {
			replaceAssignments(getDb, slug, assignments);
		},
		insertReviewedRevision(slug, revision, actor) {
			insertRevision(getDb, randomId, slug, revision, actor);
		},
		insertContentEntry(entry) {
			return tryInsertContentEntry(getDb, entry);
		},
		recordContentAudit({ actor, action, summary, targetId }) {
			recordAudit(getDb(), actor, action, summary, "content", targetId);
		},
	});
	const { sqliteSubmissionRepository, sqliteSchedulingRepository } =
		createSqliteSubmissionStore(getDb);
	return {
		sqliteContentRepository,
		sqliteSubmissionRepository,
		sqliteSchedulingRepository,
	};
}
