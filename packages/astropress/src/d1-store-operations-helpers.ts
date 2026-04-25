import type { D1DatabaseLike } from "./d1-database";
import {
	type PersistedAdminUserRow,
	type PersistedAuditEventRow,
	SQL_LIST_ADMIN_USERS_WITH_INVITE,
	SQL_LIST_AUDIT_EVENTS,
	deriveAdminUserStatus,
	mapPersistedAdminUserRow,
	mapPersistedAuditEvent,
} from "./persistence-commons";
import type {
	AuditEvent,
	CommentRecord,
	CommentStatus,
	ContactSubmission,
	ManagedAdminUser,
	MediaAsset,
	RedirectRule,
	TestimonialSource,
	TestimonialStatus,
	TestimonialSubmission,
	TestimonialSubmissionInput,
} from "./persistence-types";
import type { SiteSettings } from "./site-settings";

export { deriveAdminUserStatus };

export type CommentPolicy = "legacy-readonly" | "disabled" | "open-moderated";

export type AuditEventRow = PersistedAuditEventRow;

export type AdminUserRow = PersistedAdminUserRow;

export type CommentRow = {
	id: string;
	author: string;
	email: string | null;
	body: string | null;
	route: string;
	status: CommentStatus;
	policy: CommentPolicy;
	submitted_at: string;
};

export type TestimonialRow = {
	id: string;
	name: string;
	email: string;
	company: string | null;
	role: string | null;
	before_state: string | null;
	transformation: string | null;
	specific_result: string | null;
	consent_to_publish: number;
	status: string;
	source: string;
	submitted_at: string;
	approved_at: string | null;
};

export type MediaRow = {
	id: string;
	source_url: string | null;
	local_path: string;
	r2_key: string | null;
	mime_type: string | null;
	width: number | null;
	height: number | null;
	file_size: number | null;
	alt_text: string | null;
	title: string | null;
	uploaded_at: string;
	uploaded_by: string | null;
};

export type SettingsRow = {
	site_title: string;
	site_tagline: string;
	donation_url: string;
	newsletter_enabled: number;
	comments_default_policy: SiteSettings["commentsDefaultPolicy"];
	admin_slug: string;
};

/* ── Constants ── */

export const SQL_AUDIT_EVENTS = SQL_LIST_AUDIT_EVENTS;
export const SQL_ADMIN_USERS = SQL_LIST_ADMIN_USERS_WITH_INVITE;

export const SQL_REDIRECT_RULES = `SELECT source_path, target_path, status_code FROM redirect_rules
   WHERE deleted_at IS NULL ORDER BY source_path ASC`;

export const SQL_COMMENTS = `SELECT id, author, email, body, route, status, policy, submitted_at FROM comments
   ORDER BY CASE status WHEN 'pending' THEN 0 WHEN 'approved' THEN 1 ELSE 2 END,
     datetime(submitted_at) DESC, id DESC`;

export const SQL_CONTACT_SUBMISSIONS = `SELECT id, name, email, message, submitted_at FROM contact_submissions
   ORDER BY datetime(submitted_at) DESC, id DESC`;

export const SQL_TESTIMONIALS = `SELECT id, name, email, company, role, before_state, transformation,
          specific_result, consent_to_publish, status, source, submitted_at, approved_at
   FROM testimonial_submissions WHERE (? IS NULL OR status = ?)
   ORDER BY submitted_at DESC, id DESC`;

export const SQL_TRANSLATION_STATE =
	"SELECT state FROM translation_overrides WHERE route = ? LIMIT 1";

export const SQL_SITE_SETTINGS = `SELECT site_title, site_tagline, donation_url, newsletter_enabled,
          comments_default_policy, admin_slug
   FROM site_settings WHERE id = 1 LIMIT 1`;

export const SQL_MEDIA_ASSETS = `SELECT id, source_url, local_path, r2_key, mime_type, width, height,
          file_size, alt_text, title, uploaded_at, uploaded_by
   FROM media_assets WHERE deleted_at IS NULL
   ORDER BY datetime(uploaded_at) DESC, id DESC`;

export const TESTIMONIAL_INSERT_SQL = `INSERT INTO testimonial_submissions
     (id, name, email, company, role, before_state, transformation,
      specific_result, consent_to_publish, status, source, submitted_at)
   VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending', ?, ?)`;

export const CONTACT_INSERT_SQL = `INSERT INTO contact_submissions (id, name, email, message, submitted_at)
   VALUES (?, ?, ?, ?, ?)`;

export const COMMENT_INSERT_SQL = `INSERT INTO comments (id, author, email, body, route, status, policy, submitted_at)
   VALUES (?, ?, ?, ?, ?, ?, ?, ?)`;

/* ── Row-mapping helpers ── */

export function mapAuditEventRow(row: AuditEventRow): AuditEvent {
	return mapPersistedAuditEvent({ row, idPrefix: "d1-audit-" });
}

export const deriveUserStatus = deriveAdminUserStatus;

export const mapAdminUserRow = mapPersistedAdminUserRow;

export function mapCommentRow(row: CommentRow): CommentRecord {
	return {
		id: row.id,
		author: row.author,
		email: row.email ?? undefined,
		body: row.body ?? undefined,
		route: row.route,
		status: row.status,
		policy: row.policy,
		submittedAt: row.submitted_at,
	};
}

export function mapTestimonialRow(row: TestimonialRow): TestimonialSubmission {
	return {
		id: row.id,
		name: row.name,
		email: row.email,
		company: row.company ?? undefined,
		role: row.role ?? undefined,
		beforeState: row.before_state ?? undefined,
		transformation: row.transformation ?? undefined,
		specificResult: row.specific_result ?? undefined,
		consentToPublish: row.consent_to_publish === 1,
		status: row.status as TestimonialStatus,
		source: row.source as TestimonialSource,
		submittedAt: row.submitted_at,
		approvedAt: row.approved_at ?? undefined,
	};
}

export function mapSettingsRow(row: SettingsRow): SiteSettings {
	return {
		siteTitle: row.site_title,
		siteTagline: row.site_tagline,
		donationUrl: row.donation_url,
		newsletterEnabled: row.newsletter_enabled === 1,
		commentsDefaultPolicy: row.comments_default_policy,
		adminSlug: row.admin_slug ?? "ap-admin",
	};
}

export function mapMediaRow(row: MediaRow): MediaAsset {
	return {
		id: row.id,
		sourceUrl: row.source_url,
		localPath: row.local_path,
		r2Key: row.r2_key,
		mimeType: row.mime_type,
		width: row.width,
		height: row.height,
		fileSize: row.file_size,
		altText: row.alt_text ?? "",
		title: row.title ?? "",
		uploadedAt: row.uploaded_at,
		uploadedBy: row.uploaded_by ?? "",
	};
}

export function mapContactRow(row: {
	id: string;
	name: string;
	email: string;
	message: string;
	submitted_at: string;
}): ContactSubmission {
	return {
		id: row.id,
		name: row.name,
		email: row.email,
		message: row.message,
		submittedAt: row.submitted_at,
	};
}

export function mapRedirectRow(row: {
	source_path: string;
	target_path: string;
	status_code: 301 | 302;
}): RedirectRule {
	return {
		sourcePath: row.source_path,
		targetPath: row.target_path,
		statusCode: row.status_code,
	};
}

/* ── Bind-param helpers ── */

export function testimonialInputBindParams(
	id: string,
	input: TestimonialSubmissionInput,
) {
	return [
		id,
		input.name,
		input.email,
		input.company ?? null,
		input.role ?? null,
		input.beforeState ?? null,
		input.transformation ?? null,
		input.specificResult ?? null,
		input.consentToPublish ? 1 : 0,
		input.source,
		input.submittedAt,
	] as const;
}

export function buildCommentBindParams(
	comment: CommentRecord,
	submittedAt: string,
) {
	return [
		comment.id,
		comment.author,
		comment.email ?? null,
		comment.body ?? null,
		comment.route,
		comment.status,
		comment.policy,
		submittedAt,
	] as const;
}

export function bindTestimonialFilter(
	db: D1DatabaseLike,
	status: TestimonialStatus | null | undefined,
) {
	const val = status ?? null;
	return db.prepare(SQL_TESTIMONIALS).bind(val, val);
}

export function buildApprovedAtExpr(status: TestimonialStatus): string {
	const approvedStatuses: TestimonialStatus[] = ["approved", "featured"];
	return approvedStatuses.includes(status)
		? "CASE WHEN approved_at IS NULL THEN CURRENT_TIMESTAMP ELSE approved_at END"
		: "approved_at";
}

export function buildModerateSql(
	db: D1DatabaseLike,
	status: TestimonialStatus,
	id: string,
) {
	const approvedAtExpr = buildApprovedAtExpr(status);
	const sql = `UPDATE testimonial_submissions SET status = ?, approved_at = ${approvedAtExpr} WHERE id = ?`;
	return db.prepare(sql).bind(status, id).run();
}
