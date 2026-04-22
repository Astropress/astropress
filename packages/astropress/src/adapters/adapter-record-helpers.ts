import type { D1DatabaseLike } from "../d1-database";
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

export function normalizeContentStatus(status: ContentStoreRecord["status"]) {
	return status === "archived"
		? "archived"
		: status === "draft"
			? "draft"
			: "published";
}

export function toContentStoreRecord(record: {
	slug: string;
	kind?: string | null;
	title: string;
	body?: string;
	status: "draft" | "review" | "published" | "archived";
	seoTitle: string;
	metaDescription: string;
	updatedAt: string;
	legacyUrl: string;
	templateKey: string;
	summary?: string;
}) {
	return {
		id: record.slug,
		kind: mapContentRecordKind(record),
		slug: record.slug,
		status: record.status === "review" ? "draft" : record.status,
		title: record.title,
		body: record.body ?? null,
		metadata: {
			seoTitle: record.seoTitle,
			metaDescription: record.metaDescription,
			updatedAt: record.updatedAt,
			legacyUrl: record.legacyUrl,
			templateKey: record.templateKey,
			summary: record.summary ?? "",
		},
	} satisfies ContentStoreRecord;
}

export function toRedirectRecord(rule: {
	sourcePath: string;
	targetPath: string;
	statusCode: 301 | 302;
}) {
	return {
		id: rule.sourcePath,
		kind: "redirect" as const,
		slug: rule.sourcePath,
		status: "published" as const,
		title: rule.sourcePath,
		metadata: { targetPath: rule.targetPath, statusCode: rule.statusCode },
	};
}

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
