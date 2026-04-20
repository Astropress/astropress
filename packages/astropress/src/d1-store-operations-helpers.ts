import type { D1DatabaseLike } from "./d1-database";
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
import { defaultSiteSettings } from "./site-settings";

export type CommentPolicy = "legacy-readonly" | "disabled" | "open-moderated";

export type AuditEventRow = {
	id: number;
	user_email: string;
	action: string;
	resource_type: string;
	resource_id: string | null;
	summary: string;
	created_at: string;
};

export type AdminUserRow = {
	id: number;
	email: string;
	role: "admin" | "editor";
	name: string;
	active: number;
	created_at: string;
	has_pending_invite: number;
};

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

export const AUDIT_TARGET_TYPES = new Set(["redirect", "comment", "content"]);

export const SQL_AUDIT_EVENTS = `SELECT id, user_email, action, resource_type, resource_id, summary, created_at
   FROM audit_events ORDER BY datetime(created_at) DESC, id DESC`;

export const SQL_ADMIN_USERS = `SELECT id, email, role, name, active, created_at,
     EXISTS (SELECT 1 FROM user_invites i
       WHERE i.user_id = admin_users.id AND i.accepted_at IS NULL
         AND datetime(i.expires_at) > CURRENT_TIMESTAMP
     ) AS has_pending_invite
   FROM admin_users
   ORDER BY CASE role WHEN 'admin' THEN 0 ELSE 1 END, datetime(created_at) ASC, email ASC`;

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
	return {
		id: `d1-audit-${row.id}`,
		action: row.action,
		actorEmail: row.user_email,
		actorRole: "admin" as const,
		summary: row.summary,
		targetType: AUDIT_TARGET_TYPES.has(row.resource_type)
			? (row.resource_type as AuditEvent["targetType"])
			: "auth",
		targetId: row.resource_id ?? `${row.id}`,
		createdAt: row.created_at,
	};
}

export function deriveUserStatus(
	active: number,
	hasPendingInvite: number,
): "suspended" | "invited" | "active" {
	if (active !== 1) return "suspended";
	if (hasPendingInvite === 1) return "invited";
	return "active";
}

export function mapAdminUserRow(row: AdminUserRow): ManagedAdminUser {
	return {
		id: row.id,
		email: row.email,
		role: row.role,
		name: row.name,
		active: row.active === 1,
		status: deriveUserStatus(row.active, row.has_pending_invite),
		createdAt: row.created_at,
	};
}

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
