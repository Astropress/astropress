import type { D1DatabaseLike } from "../d1-database";
import {
	normalizeContentStatus as normalizeContentStatusCommon,
	toContentStoreRecord as toContentStoreRecordCommon,
	toRedirectRecord as toRedirectRecordCommon,
} from "../persistence-commons";
import type { ContentStoreRecord, RevisionRecord } from "../platform-contracts";

import { SQL_D1_INSERT_REVISION, SQL_LIST_TRANSLATIONS } from "./adapter-record-helpers-data.js";

export const FULL_STACK_CAPABILITIES = {
	hostedAdmin: true,
	previewEnvironments: true,
	serverRuntime: true,
	database: true,
	objectStorage: true,
	gitSync: true,
} as const;

export function mapContentRecordKind(record: { kind?: string | null }): ContentStoreRecord["kind"] {
	return record.kind === "post" ? "post" : "page";
}

export function nowIso() {
	return new Date().toISOString();
}

export function cloudflareActorEmail() {
	return "admin@example.com";
}

export function normalizeContentStatus(
	// Accepts any raw status string (revision snapshots, row values); delegates
	// to the commons normaliser which collapses unknowns to a valid status.
	status: string | null | undefined,
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
): ContentStoreRecord {
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
	// audit-boundary: opaque-passthrough -- module-boundary value; narrowed at consumer
	const snapshot = revision.snapshot as Record<string, unknown>;
	const title = String(snapshot.title ?? revision.recordId);
	const status = normalizeContentStatus(snapshot.status as string);
	const seoTitle = String(snapshot.seoTitle ?? snapshot.title ?? revision.recordId);
	const metaDescription = String(snapshot.metaDescription ?? snapshot.title ?? revision.recordId);
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
