import { describe, expect, it, vi } from "vitest";

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
	SQL_TESTIMONIALS,
	SQL_TRANSLATION_STATE,
	type SettingsRow,
	TESTIMONIAL_INSERT_SQL,
	type TestimonialRow,
	bindTestimonialFilter,
	buildApprovedAtExpr,
	buildCommentBindParams,
	buildModerateSql,
	deriveUserStatus,
	mapAdminUserRow,
	mapAuditEventRow,
	mapCommentRow,
	mapContactRow,
	mapMediaRow,
	mapRedirectRow,
	mapSettingsRow,
	mapTestimonialRow,
	testimonialInputBindParams,
} from "../src/d1-store-operations-helpers";
import {
	SQL_LIST_ADMIN_USERS_WITH_INVITE,
	SQL_LIST_AUDIT_EVENTS,
} from "../src/persistence-commons";

describe("D1 SQL constants", () => {
	it("SQL_AUDIT_EVENTS aliases the persistence-commons single source of truth", () => {
		expect(SQL_AUDIT_EVENTS).toBe(SQL_LIST_AUDIT_EVENTS);
	});

	it("SQL_ADMIN_USERS aliases the persistence-commons single source of truth", () => {
		expect(SQL_ADMIN_USERS).toBe(SQL_LIST_ADMIN_USERS_WITH_INVITE);
	});

	it("SQL_REDIRECT_RULES filters soft-deleted rules and orders by source_path", () => {
		expect(SQL_REDIRECT_RULES).toContain("FROM redirect_rules");
		expect(SQL_REDIRECT_RULES).toContain("deleted_at IS NULL");
		expect(SQL_REDIRECT_RULES).toMatch(/ORDER BY source_path ASC/);
	});

	it("SQL_COMMENTS orders pending → approved → other and then by submitted_at desc", () => {
		expect(SQL_COMMENTS).toContain("FROM comments");
		expect(SQL_COMMENTS).toContain(
			"CASE status WHEN 'pending' THEN 0 WHEN 'approved' THEN 1 ELSE 2 END",
		);
		expect(SQL_COMMENTS).toMatch(/datetime\(submitted_at\) DESC/);
	});

	it("SQL_CONTACT_SUBMISSIONS orders by submitted_at desc", () => {
		expect(SQL_CONTACT_SUBMISSIONS).toContain("FROM contact_submissions");
		expect(SQL_CONTACT_SUBMISSIONS).toMatch(/datetime\(submitted_at\) DESC/);
	});

	it("SQL_TESTIMONIALS uses a NULL-safe filter so optional status binds with two slots", () => {
		expect(SQL_TESTIMONIALS).toContain("FROM testimonial_submissions");
		expect(SQL_TESTIMONIALS).toContain("(? IS NULL OR status = ?)");
	});

	it("SQL_TRANSLATION_STATE selects state for a single route with LIMIT 1", () => {
		expect(SQL_TRANSLATION_STATE).toBe(
			"SELECT state FROM translation_overrides WHERE route = ? LIMIT 1",
		);
	});

	it("SQL_SITE_SETTINGS reads the singleton row id = 1", () => {
		expect(SQL_SITE_SETTINGS).toContain("FROM site_settings");
		expect(SQL_SITE_SETTINGS).toContain("WHERE id = 1");
		expect(SQL_SITE_SETTINGS).toContain("LIMIT 1");
	});

	it("SQL_MEDIA_ASSETS filters soft-deleted rows and orders newest first", () => {
		expect(SQL_MEDIA_ASSETS).toContain("FROM media_assets");
		expect(SQL_MEDIA_ASSETS).toContain("deleted_at IS NULL");
		expect(SQL_MEDIA_ASSETS).toMatch(/datetime\(uploaded_at\) DESC/);
	});

	it("TESTIMONIAL_INSERT_SQL hardcodes status='pending' (clients cannot self-approve)", () => {
		expect(TESTIMONIAL_INSERT_SQL).toContain(
			"INSERT INTO testimonial_submissions",
		);
		expect(TESTIMONIAL_INSERT_SQL).toContain("'pending'");
	});

	it("CONTACT_INSERT_SQL writes exactly the five expected columns", () => {
		expect(CONTACT_INSERT_SQL).toBe(
			"INSERT INTO contact_submissions (id, name, email, message, submitted_at)\n   VALUES (?, ?, ?, ?, ?)",
		);
	});

	it("COMMENT_INSERT_SQL writes exactly the eight expected columns", () => {
		expect(COMMENT_INSERT_SQL).toBe(
			"INSERT INTO comments (id, author, email, body, route, status, policy, submitted_at)\n   VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
		);
	});
});

describe("mapAuditEventRow", () => {
	const row: AuditEventRow = {
		id: 7,
		user_email: "ada@example.test",
		action: "publish",
		resource_type: "content",
		resource_id: "post-1",
		summary: "Published",
		created_at: "2026-04-25T00:00:00Z",
	};

	it("namespaces id with the d1-audit- prefix to avoid SQLite collisions", () => {
		expect(mapAuditEventRow(row).id).toBe("d1-audit-7");
	});

	it("falls back to 'auth' for unknown resource_type values", () => {
		expect(
			mapAuditEventRow({ ...row, resource_type: "session" }).targetType,
		).toBe("auth");
	});

	it("uses stringified id when resource_id is null", () => {
		expect(mapAuditEventRow({ ...row, resource_id: null }).targetId).toBe("7");
	});
});

describe("deriveUserStatus + mapAdminUserRow", () => {
	const row: AdminUserRow = {
		id: 3,
		email: "ada@example.test",
		role: "admin",
		name: "Ada",
		active: 1,
		created_at: "2026-04-25T00:00:00Z",
		has_pending_invite: 0,
	};

	it("derives 'active' / 'invited' / 'suspended' correctly", () => {
		expect(deriveUserStatus(1, 0)).toBe("active");
		expect(deriveUserStatus(1, 1)).toBe("invited");
		expect(deriveUserStatus(0, 0)).toBe("suspended");
		expect(deriveUserStatus(0, 1)).toBe("suspended");
	});

	it("maps active=1 to boolean true and surfaces status='active'", () => {
		const mapped = mapAdminUserRow(row);
		expect(mapped.active).toBe(true);
		expect(mapped.status).toBe("active");
	});

	it("maps inactive (active=0) to boolean false and status='suspended'", () => {
		const mapped = mapAdminUserRow({ ...row, active: 0 });
		expect(mapped.active).toBe(false);
		expect(mapped.status).toBe("suspended");
	});
});

describe("mapCommentRow", () => {
	const row: CommentRow = {
		id: "c-1",
		author: "Ada",
		email: "ada@example.test",
		body: "Nice post",
		route: "/hello",
		status: "approved",
		policy: "open-moderated",
		submitted_at: "2026-04-25T00:00:00Z",
	};

	it("preserves required fields and renames submitted_at → submittedAt", () => {
		const mapped = mapCommentRow(row);
		expect(mapped).toEqual({
			id: "c-1",
			author: "Ada",
			email: "ada@example.test",
			body: "Nice post",
			route: "/hello",
			status: "approved",
			policy: "open-moderated",
			submittedAt: "2026-04-25T00:00:00Z",
		});
	});

	it("maps null email/body to undefined (so callers can use ??)", () => {
		const mapped = mapCommentRow({ ...row, email: null, body: null });
		expect(mapped.email).toBeUndefined();
		expect(mapped.body).toBeUndefined();
	});
});

describe("mapTestimonialRow", () => {
	const row: TestimonialRow = {
		id: "t-1",
		name: "Ada",
		email: "ada@example.test",
		company: "ACME",
		role: "Eng",
		before_state: "before",
		transformation: "during",
		specific_result: "after",
		consent_to_publish: 1,
		status: "approved",
		source: "formbricks",
		submitted_at: "2026-04-25T00:00:00Z",
		approved_at: "2026-04-25T01:00:00Z",
	};

	it("converts consent_to_publish = 1 to boolean true", () => {
		expect(mapTestimonialRow(row).consentToPublish).toBe(true);
	});

	it("converts consent_to_publish = 0 to boolean false", () => {
		expect(
			mapTestimonialRow({ ...row, consent_to_publish: 0 }).consentToPublish,
		).toBe(false);
	});

	it("renames snake_case fields to camelCase", () => {
		const mapped = mapTestimonialRow(row);
		expect(mapped.beforeState).toBe("before");
		expect(mapped.transformation).toBe("during");
		expect(mapped.specificResult).toBe("after");
		expect(mapped.submittedAt).toBe("2026-04-25T00:00:00Z");
		expect(mapped.approvedAt).toBe("2026-04-25T01:00:00Z");
	});

	it("maps null optional fields to undefined", () => {
		const mapped = mapTestimonialRow({
			...row,
			company: null,
			role: null,
			before_state: null,
			transformation: null,
			specific_result: null,
			approved_at: null,
		});
		expect(mapped.company).toBeUndefined();
		expect(mapped.role).toBeUndefined();
		expect(mapped.beforeState).toBeUndefined();
		expect(mapped.transformation).toBeUndefined();
		expect(mapped.specificResult).toBeUndefined();
		expect(mapped.approvedAt).toBeUndefined();
	});
});

describe("mapSettingsRow", () => {
	const row: SettingsRow = {
		site_title: "Astropress",
		site_tagline: "Static-first CMS",
		donation_url: "https://example.test/donate",
		newsletter_enabled: 1,
		comments_default_policy: "open-moderated",
		admin_slug: "secret-admin",
	};

	it("converts newsletter_enabled = 1 to boolean true", () => {
		expect(mapSettingsRow(row).newsletterEnabled).toBe(true);
	});

	it("converts newsletter_enabled = 0 to boolean false", () => {
		expect(
			mapSettingsRow({ ...row, newsletter_enabled: 0 }).newsletterEnabled,
		).toBe(false);
	});

	it("preserves operator-chosen admin_slug verbatim", () => {
		expect(mapSettingsRow(row).adminSlug).toBe("secret-admin");
	});

	it("falls back to 'ap-admin' when admin_slug is null (the only nullish case ?? guards)", () => {
		expect(
			mapSettingsRow({ ...row, admin_slug: null as unknown as string })
				.adminSlug,
		).toBe("ap-admin");
	});
});

describe("mapMediaRow", () => {
	const row: MediaRow = {
		id: "m-1",
		source_url: "https://example.test/img.png",
		local_path: "/media/img.png",
		r2_key: "uploads/img.png",
		mime_type: "image/png",
		width: 800,
		height: 600,
		file_size: 12345,
		alt_text: "An example image",
		title: "Example",
		uploaded_at: "2026-04-25T00:00:00Z",
		uploaded_by: "ada@example.test",
	};

	it("preserves nullable URL/r2 fields verbatim (does NOT coerce to undefined)", () => {
		const mapped = mapMediaRow({ ...row, source_url: null, r2_key: null });
		expect(mapped.sourceUrl).toBeNull();
		expect(mapped.r2Key).toBeNull();
	});

	it("falls back alt_text/title to empty strings (never null) and uploaded_by likewise", () => {
		const mapped = mapMediaRow({
			...row,
			alt_text: null,
			title: null,
			uploaded_by: null,
		});
		expect(mapped.altText).toBe("");
		expect(mapped.title).toBe("");
		expect(mapped.uploadedBy).toBe("");
	});

	it("preserves numeric dimensions and file_size verbatim", () => {
		const mapped = mapMediaRow(row);
		expect(mapped.width).toBe(800);
		expect(mapped.height).toBe(600);
		expect(mapped.fileSize).toBe(12345);
	});
});

describe("mapContactRow", () => {
	it("renames submitted_at → submittedAt and preserves all other fields", () => {
		expect(
			mapContactRow({
				id: "c-1",
				name: "Ada",
				email: "ada@example.test",
				message: "Hello",
				submitted_at: "2026-04-25T00:00:00Z",
			}),
		).toEqual({
			id: "c-1",
			name: "Ada",
			email: "ada@example.test",
			message: "Hello",
			submittedAt: "2026-04-25T00:00:00Z",
		});
	});
});

describe("mapRedirectRow", () => {
	it("renames source_path/target_path/status_code to camelCase", () => {
		expect(
			mapRedirectRow({
				source_path: "/old",
				target_path: "/new",
				status_code: 301,
			}),
		).toEqual({ sourcePath: "/old", targetPath: "/new", statusCode: 301 });
	});

	it("preserves the 302 status code without coercing it to 301", () => {
		expect(
			mapRedirectRow({
				source_path: "/a",
				target_path: "/b",
				status_code: 302,
			}).statusCode,
		).toBe(302);
	});
});

describe("testimonialInputBindParams", () => {
	const baseInput = {
		name: "Ada",
		email: "ada@example.test",
		company: "ACME",
		role: "Eng",
		beforeState: "before",
		transformation: "during",
		specificResult: "after",
		consentToPublish: true,
		source: "formbricks" as const,
		submittedAt: "2026-04-25T00:00:00Z",
	};

	it("returns id first and submittedAt last (matches TESTIMONIAL_INSERT_SQL placeholder order)", () => {
		const params = testimonialInputBindParams("t-1", baseInput);
		expect(params[0]).toBe("t-1");
		expect(params[params.length - 1]).toBe("2026-04-25T00:00:00Z");
		expect(params).toHaveLength(11);
	});

	it("converts consent boolean to 1/0 numeric for SQLite", () => {
		expect(testimonialInputBindParams("t-1", baseInput)[8]).toBe(1);
		expect(
			testimonialInputBindParams("t-2", {
				...baseInput,
				consentToPublish: false,
			})[8],
		).toBe(0);
	});

	it("maps undefined optional strings to null (NOT to the JS string 'undefined')", () => {
		const params = testimonialInputBindParams("t-1", {
			...baseInput,
			company: undefined,
			role: undefined,
			beforeState: undefined,
			transformation: undefined,
			specificResult: undefined,
		});
		expect(params[3]).toBeNull();
		expect(params[4]).toBeNull();
		expect(params[5]).toBeNull();
		expect(params[6]).toBeNull();
		expect(params[7]).toBeNull();
	});
});

describe("buildCommentBindParams", () => {
	const comment = {
		id: "c-1",
		author: "Ada",
		email: "ada@example.test",
		body: "Hi",
		route: "/hello",
		status: "pending" as const,
		policy: "open-moderated" as const,
		submittedAt: "ignored-when-explicit-second-arg",
	};

	it("uses the explicit submittedAt argument, NOT comment.submittedAt", () => {
		const params = buildCommentBindParams(comment, "2026-04-25T00:00:00Z");
		expect(params[7]).toBe("2026-04-25T00:00:00Z");
	});

	it("maps undefined email/body to null (so SQLite stores NULL, not 'undefined')", () => {
		const params = buildCommentBindParams(
			{ ...comment, email: undefined, body: undefined },
			"2026-04-25T00:00:00Z",
		);
		expect(params[2]).toBeNull();
		expect(params[3]).toBeNull();
	});

	it("places id first and submittedAt last (matches COMMENT_INSERT_SQL placeholder order)", () => {
		const params = buildCommentBindParams(comment, "ts");
		expect(params[0]).toBe("c-1");
		expect(params[params.length - 1]).toBe("ts");
		expect(params).toHaveLength(8);
	});
});

describe("bindTestimonialFilter", () => {
	it("binds (null, null) when status is undefined so the NULL-safe filter matches all rows", () => {
		const bind = vi.fn().mockReturnValue({});
		const prepare = vi.fn().mockReturnValue({ bind });
		const db = { prepare } as unknown as Parameters<
			typeof bindTestimonialFilter
		>[0];
		bindTestimonialFilter(db, undefined);
		expect(prepare).toHaveBeenCalledWith(SQL_TESTIMONIALS);
		expect(bind).toHaveBeenCalledWith(null, null);
	});

	it("binds (null, null) when status is null", () => {
		const bind = vi.fn().mockReturnValue({});
		const prepare = vi.fn().mockReturnValue({ bind });
		const db = { prepare } as unknown as Parameters<
			typeof bindTestimonialFilter
		>[0];
		bindTestimonialFilter(db, null);
		expect(bind).toHaveBeenCalledWith(null, null);
	});

	it("binds the same status twice (NULL-safe pattern: ? IS NULL OR status = ?)", () => {
		const bind = vi.fn().mockReturnValue({});
		const prepare = vi.fn().mockReturnValue({ bind });
		const db = { prepare } as unknown as Parameters<
			typeof bindTestimonialFilter
		>[0];
		bindTestimonialFilter(db, "approved");
		expect(bind).toHaveBeenCalledWith("approved", "approved");
	});
});

describe("buildApprovedAtExpr", () => {
	it("returns the conditional CURRENT_TIMESTAMP expression for approved", () => {
		expect(buildApprovedAtExpr("approved")).toBe(
			"CASE WHEN approved_at IS NULL THEN CURRENT_TIMESTAMP ELSE approved_at END",
		);
	});

	it("returns the conditional CURRENT_TIMESTAMP expression for featured", () => {
		expect(buildApprovedAtExpr("featured")).toBe(
			"CASE WHEN approved_at IS NULL THEN CURRENT_TIMESTAMP ELSE approved_at END",
		);
	});

	it("preserves existing approved_at (no clobber) for pending and rejected", () => {
		expect(buildApprovedAtExpr("pending")).toBe("approved_at");
		expect(buildApprovedAtExpr("rejected")).toBe("approved_at");
	});
});

describe("buildModerateSql", () => {
	it("for approved/featured: emits SQL with the conditional CURRENT_TIMESTAMP expression", () => {
		const run = vi.fn().mockReturnValue({ meta: { changes: 1 } });
		const bind = vi.fn().mockReturnValue({ run });
		const prepare = vi.fn().mockReturnValue({ bind });
		const db = { prepare } as unknown as Parameters<typeof buildModerateSql>[0];
		buildModerateSql(db, "approved", "t-1");
		expect(prepare).toHaveBeenCalledWith(
			expect.stringContaining(
				"CASE WHEN approved_at IS NULL THEN CURRENT_TIMESTAMP ELSE approved_at END",
			),
		);
		expect(bind).toHaveBeenCalledWith("approved", "t-1");
		expect(run).toHaveBeenCalled();
	});

	it("for pending/rejected: does NOT clobber approved_at", () => {
		const run = vi.fn().mockReturnValue({ meta: { changes: 0 } });
		const bind = vi.fn().mockReturnValue({ run });
		const prepare = vi.fn().mockReturnValue({ bind });
		const db = { prepare } as unknown as Parameters<typeof buildModerateSql>[0];
		buildModerateSql(db, "rejected", "t-1");
		expect(prepare).toHaveBeenCalledWith(
			expect.stringContaining("approved_at = approved_at"),
		);
	});
});
