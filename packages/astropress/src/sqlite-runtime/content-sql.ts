import { SQL_INSERT_BASELINE_OVERRIDE, SQL_INSERT_BASELINE_REVISION } from "./content-sql-data";
import type { AstropressSqliteDatabaseLike, PageRecord } from "./utils";

export {
	SQL_INSERT_BASELINE_OVERRIDE,
	SQL_INSERT_BASELINE_REVISION,
	SQL_INSERT_ENTRY,
	SQL_INSERT_REVISION_CONTENT,
	SQL_LIST_REVISIONS_FOR_SLUG,
	SQL_UPSERT_OVERRIDE,
} from "./content-sql-data";

export type RevisionInput = {
	title: string;
	status: string;
	scheduledAt?: string | null;
	body?: string | null;
	seoTitle: string;
	metaDescription: string;
	excerpt?: string | null;
	ogTitle?: string | null;
	ogDescription?: string | null;
	ogImage?: string | null;
	authorIds?: number[];
	categoryIds?: number[];
	tagIds?: number[];
	canonicalUrlOverride?: string | null;
	robotsDirective?: string | null;
	revisionNote?: string | null;
};

export function buildBaselineOverrideParams(pageRecord: PageRecord) {
	return [
		pageRecord.slug,
		pageRecord.title,
		pageRecord.status ?? "published",
		pageRecord.body ?? null,
		pageRecord.seoTitle ?? pageRecord.title,
		pageRecord.metaDescription ?? pageRecord.summary ?? "",
		pageRecord.summary ?? null,
		null,
		null,
		null,
		null,
		null,
		null,
		"seed-import",
	];
}

export function buildBaselineRevisionParams(randomId: () => string, pageRecord: PageRecord) {
	return [
		`revision-${randomId()}`,
		pageRecord.slug,
		pageRecord.title,
		pageRecord.status ?? "published",
		null,
		pageRecord.body ?? null,
		pageRecord.seoTitle ?? pageRecord.title,
		pageRecord.metaDescription ?? pageRecord.summary ?? "",
		pageRecord.summary ?? null,
		null,
		null,
		null,
		null,
		null,
		null,
		"imported-baseline",
		"seed-import",
	];
}

export function ensureBaselineRevisionImpl(
	getDb: () => AstropressSqliteDatabaseLike,
	randomId: () => string,
	pageRecord: PageRecord,
) {
	const db = getDb();
	db.prepare(SQL_INSERT_BASELINE_OVERRIDE).run(...buildBaselineOverrideParams(pageRecord));
	const existing = db
		.prepare("SELECT id FROM content_revisions WHERE slug = ? AND source = 'imported' LIMIT 1")
		.get(pageRecord.slug) as { id: string } | undefined;
	if (existing) return;
	db.prepare(SQL_INSERT_BASELINE_REVISION).run(
		...buildBaselineRevisionParams(randomId, pageRecord),
	);
}
