import type { D1DatabaseLike } from "../d1-database";
import {
	normalizeContentStatus as normalizeContentStatusCommon,
	toContentStoreRecord as toContentStoreRecordCommon,
	toRedirectRecord as toRedirectRecordCommon,
} from "../persistence-commons";
import type { ContentStoreRecord, RevisionRecord } from "../platform-contracts";

const SQL_LIST_TRANSLATIONS =
	"SELECT route, state, updated_at, updated_by FROM translation_overrides ORDER BY route ASC";
const SQL_D1_INSERT_REVISION = `INSERT INTO content_revisions (id, slug, source, title, status, scheduled_at, body, seo_title, meta_description, excerpt, og_title, og_description, og_image, author_ids, category_ids, tag_ids, canonical_url_override, robots_directive, revision_note, created_at, created_by) VALUES (?, ?, 'reviewed', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`;

export const FULL_STACK_CAPABILITIES = {
	hostedAdmin: true,
	previewEnvironments: true,
	serverRuntime: true,
	database: true,
	objectStorage: true,
	gitSync: true,
} as const;

export function mapContentRecordKind(record: {
	kind?: string | null;
}): ContentStoreRecord["kind"] {
	return record.kind === "post" ? "post" : "page";
}

export function nowIso() {
	return new Date().toISOString();
}

export function cloudflareActorEmail() {
	return "admin@example.com";
}

export function normalizeContentStatus(
	status: ContentStoreRecord["status"],
): "draft" | "published" | "archived" {
	// Adapter writes ContentStoreRecord whose status lacks "review"; collapse
	// anything unknown to "published" via commons.
	const normalized = normalizeContentStatusCommon(status);
	return normalized === "review" ? "draft" : normalized;
}

export const toContentStoreRecord = toContentStoreRecordCommon as (
	record: Parameters<typeof toContentStoreRecordCommon>[0],
) => ContentStoreRecord;

export const toRedirectRecord = toRedirectRecordCommon;

export function toTranslationRecord(
	route: string,
	state: string,
	updatedAt: string,
	updatedBy: string,
) {
	return {
		id: route,
		kind: "translation" as const,
		slug: route,
		status: state === "published" ? "published" : "draft",
		title: route,
		metadata: { state, updatedAt, updatedBy },
	};
}

export async function listTranslationRecords(db: D1DatabaseLike) {
	const rows = (
		await db.prepare(SQL_LIST_TRANSLATIONS).all<{
			route: string;
			state: string;
			updated_at: string;
			updated_by: string;
		}>()
	).results;

	return rows.map((row) =>
		toTranslationRecord(row.route, row.state, row.updated_at, row.updated_by),
	);
}

function buildRevisionBindParams(revision: RevisionRecord, actorEmail: string) {
	const snapshot = revision.snapshot as Record<string, unknown>;
	const title = String(snapshot.title ?? revision.recordId);
	const status = normalizeContentStatus(snapshot.status as string);
	const seoTitle = String(
		snapshot.seoTitle ?? snapshot.title ?? revision.recordId,
	);
	const metaDescription = String(
		snapshot.metaDescription ?? snapshot.title ?? revision.recordId,
	);
	return [
		revision.id,
		revision.recordId,
		title,
		status,
		snapshot.scheduledAt ?? null,
		snapshot.body ?? null,
		seoTitle,
		metaDescription,
		snapshot.excerpt ?? null,
		snapshot.ogTitle ?? null,
		snapshot.ogDescription ?? null,
		snapshot.ogImage ?? null,
		JSON.stringify(snapshot.authorIds ?? []),
		JSON.stringify(snapshot.categoryIds ?? []),
		JSON.stringify(snapshot.tagIds ?? []),
		snapshot.canonicalUrlOverride ?? null,
		snapshot.robotsDirective ?? null,
		revision.summary ?? null,
		revision.createdAt,
		revision.actorId ?? actorEmail,
	];
}

export async function saveD1Revision(
	db: D1DatabaseLike,
	revision: RevisionRecord,
	actorEmail: string,
) {
	const params = buildRevisionBindParams(revision, actorEmail);
	await db
		.prepare(SQL_D1_INSERT_REVISION)
		.bind(...params)
		.run();
}
