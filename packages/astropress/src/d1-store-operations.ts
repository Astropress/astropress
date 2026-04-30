import type { D1AdminMutationStore, D1AdminReadStore } from "./d1-admin-store";
import type { D1DatabaseLike } from "./d1-database";
import { createD1RateLimitPart } from "./d1-rate-limit-part";
import {
	type AdminUserRow,
	type AuditEventRow,
	COMMENT_INSERT_SQL,
	CONTACT_INSERT_SQL,
	type CommentRow,
	type MediaRow,
	SQL_ADMIN_USERS,
	SQL_AUDIT_EVENTS,
	SQL_COMMENTS,
	SQL_CONTACT_SUBMISSIONS,
	SQL_MEDIA_ASSETS,
	SQL_REDIRECT_RULES,
	SQL_SITE_SETTINGS,
	SQL_TRANSLATION_STATE,
	type SettingsRow,
	TESTIMONIAL_INSERT_SQL,
	type TestimonialRow,
	bindTestimonialFilter,
	buildCommentBindParams,
	buildModerateSql,
	mapAdminUserRow,
	mapAuditEventRow,
	mapCommentRow,
	mapContactRow,
	mapMediaRow,
	mapRedirectRow,
	mapSettingsRow,
	mapTestimonialRow,
	testimonialInputBindParams,
} from "./d1-store-operations-helpers";
import type {
	CommentRecord,
	ContactSubmission,
	TestimonialStatus,
	TestimonialSubmissionInput,
} from "./persistence-types";
import { defaultSiteSettings } from "./site-settings";
import { normalizeTranslationState } from "./translation-state";

/* ── Factory: read operations ── */

export function createD1OperationsReadPart(
	db: D1DatabaseLike,
): Omit<D1AdminReadStore, "content" | "authors" | "taxonomies"> {
	return {
		audit: {
			async getAuditEvents() {
				const rows = (await db.prepare(SQL_AUDIT_EVENTS).all<AuditEventRow>())
					.results;
				return rows.map(mapAuditEventRow);
			},
			async recordAuditEvent(input) {
				await db
					.prepare(
						`INSERT INTO audit_events (user_email, action, resource_type, resource_id, summary)
             VALUES (?, ?, ?, ?, ?)`,
					)
					.bind(
						input.userEmail,
						input.action,
						input.resourceType,
						input.resourceId ?? null,
						input.summary,
					)
					.run();
			},
		},
		users: {
			async listAdminUsers() {
				const rows = (await db.prepare(SQL_ADMIN_USERS).all<AdminUserRow>())
					.results;
				return rows.map(mapAdminUserRow);
			},
		},
		redirects: {
			async getRedirectRules() {
				const rows = (
					await db.prepare(SQL_REDIRECT_RULES).all<{
						source_path: string;
						target_path: string;
						status_code: 301 | 302;
					}>()
				).results;
				return rows.map(mapRedirectRow);
			},
		},
		comments: {
			async getComments() {
				const rows = (await db.prepare(SQL_COMMENTS).all<CommentRow>()).results;
				return rows.map(mapCommentRow);
			},
			async getApprovedCommentsForRoute(route: string) {
				const comments = await this.getComments();
				return comments.filter(
					(c) => c.route === route && c.status === "approved",
				);
			},
		},
		submissions: {
			async getContactSubmissions() {
				const rows = (
					await db.prepare(SQL_CONTACT_SUBMISSIONS).all<{
						id: string;
						name: string;
						email: string;
						message: string;
						submitted_at: string;
					}>()
				).results;
				return rows.map(mapContactRow);
			},
			async getTestimonials(status?: TestimonialStatus) {
				const rows = (
					await bindTestimonialFilter(db, status).all<TestimonialRow>()
				).results;
				return rows.map(mapTestimonialRow);
			},
		},
		translations: {
			async getEffectiveTranslationState(
				route: string,
				fallback = "not_started",
			) {
				const row = await db
					.prepare(SQL_TRANSLATION_STATE)
					.bind(route)
					.first<{ state: string }>();
				return normalizeTranslationState(
					row?.state,
					normalizeTranslationState(fallback),
				);
			},
		},
		settings: {
			async getSettings() {
				const row = await db.prepare(SQL_SITE_SETTINGS).first<SettingsRow>();
				if (!row) return { ...defaultSiteSettings };
				return mapSettingsRow(row);
			},
		},
		rateLimits: createD1RateLimitPart(db),
		media: {
			async listMediaAssets() {
				const rows = (await db.prepare(SQL_MEDIA_ASSETS).all<MediaRow>())
					.results;
				return rows.map(mapMediaRow);
			},
		},
	};
}

/* ── Factory: mutation operations ── */

export function createD1OperationsMutationPart(
	db: D1DatabaseLike,
): Pick<D1AdminMutationStore, "submissions" | "comments" | "rateLimits"> {
	return {
		submissions: {
			async submitTestimonial(
				input: TestimonialSubmissionInput,
			): Promise<{ ok: true; id: string }> {
				const id = `testimonial-${crypto.randomUUID()}`;
				const params = testimonialInputBindParams(id, input);
				await db
					.prepare(TESTIMONIAL_INSERT_SQL)
					.bind(...params)
					.run();
				return { ok: true as const, id };
			},
			async moderateTestimonial(
				id: string,
				status: TestimonialStatus,
				actorEmail: string,
			): Promise<{ ok: true } | { ok: false; error: string }> {
				const result = await buildModerateSql(db, status, id);
				if (!result.meta.changes)
					return { ok: false as const, error: "Testimonial not found" };
				return { ok: true as const };
			},
			async submitContact(
				input,
			): Promise<{ ok: true; submission: ContactSubmission }> {
				const submission: ContactSubmission = {
					id: `contact-${crypto.randomUUID()}`,
					name: input.name,
					email: input.email,
					message: input.message,
					submittedAt: input.submittedAt,
				};
				await db
					.prepare(CONTACT_INSERT_SQL)
					.bind(
						submission.id,
						submission.name,
						submission.email,
						submission.message,
						submission.submittedAt,
					)
					.run();
				return { ok: true as const, submission };
			},
		},
		comments: {
			async submitPublicComment(
				input,
			): Promise<{ ok: true; comment: CommentRecord }> {
				const submittedAt = input.submittedAt || new Date().toISOString();
				const comment: CommentRecord = {
					id: `public-${crypto.randomUUID()}`,
					author: input.author,
					email: input.email,
					body: input.body,
					route: input.route,
					status: "pending",
					policy: "open-moderated",
					submittedAt,
				};
				await db
					.prepare(COMMENT_INSERT_SQL)
					.bind(...buildCommentBindParams(comment, submittedAt))
					.run();
				return { ok: true as const, comment };
			},
		},
		rateLimits: createD1RateLimitPart(db),
	};
}
