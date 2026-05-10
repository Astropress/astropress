import type { DatabaseSync } from "node:sqlite";
import { beforeEach, describe, expect, it } from "vitest";
import type { Actor } from "../src/persistence-types";
import { createSqliteSettingsStore } from "../src/sqlite-runtime/settings";
import type { AstropressSqliteDatabaseLike } from "../src/sqlite-runtime/utils";
import { makeDb, STANDARD_ACTOR } from "./helpers/make-db.js";

const actor: Actor = STANDARD_ACTOR;

let db: DatabaseSync;
let store: ReturnType<typeof createSqliteSettingsStore>;

beforeEach(() => {
	db = makeDb();
	store = createSqliteSettingsStore(() => db as unknown as AstropressSqliteDatabaseLike);
});

function latestAudit(action: string) {
	return db
		.prepare(
			"SELECT user_email, action, resource_type, resource_id, summary FROM audit_events WHERE action = ? ORDER BY id DESC LIMIT 1",
		)
		.get(action) as Record<string, unknown> | undefined;
}

// ---------------------------------------------------------------------------
// Redirect repository
// ---------------------------------------------------------------------------

describe("createSqliteSettingsStore — redirect repository", () => {
	it("createRedirectRule writes an active row and emits a 'redirect.create' audit with resource_type='redirect' and the source-path target_id", async () => {
		const result = await store.sqliteRedirectRepository.createRedirectRule(
			{ sourcePath: "/old", targetPath: "/new", statusCode: 301 },
			actor,
		);
		expect(result).toEqual({
			ok: true,
			rule: { sourcePath: "/old", targetPath: "/new", statusCode: 301 },
		});

		const row = db
			.prepare(
				"SELECT source_path, target_path, status_code, deleted_at, created_by FROM redirect_rules WHERE source_path = '/old'",
			)
			.get() as Record<string, unknown>;
		expect(row).toMatchObject({
			source_path: "/old",
			target_path: "/new",
			status_code: 301,
			deleted_at: null,
			created_by: actor.email,
		});

		const audit = latestAudit("redirect.create");
		expect(audit).toMatchObject({
			user_email: actor.email,
			action: "redirect.create",
			resource_type: "redirect",
			resource_id: "/old",
			summary: "Created redirect /old -> /new (301).",
		});
	});

	it("getRedirectRules returns only non-deleted rows", async () => {
		await store.sqliteRedirectRepository.createRedirectRule(
			{ sourcePath: "/keep", targetPath: "/k", statusCode: 301 },
			actor,
		);
		await store.sqliteRedirectRepository.createRedirectRule(
			{ sourcePath: "/drop", targetPath: "/d", statusCode: 301 },
			actor,
		);
		await store.sqliteRedirectRepository.deleteRedirectRule("/drop", actor);

		const rules = await store.sqliteRedirectRepository.getRedirectRules();
		expect(rules.map((r) => r.sourcePath)).toEqual(["/keep"]);
	});

	it("deleteRedirectRule soft-deletes the row, returns ok, and emits a 'redirect.delete' audit", async () => {
		await store.sqliteRedirectRepository.createRedirectRule(
			{ sourcePath: "/old", targetPath: "/new", statusCode: 301 },
			actor,
		);
		const result = await store.sqliteRedirectRepository.deleteRedirectRule("/old", actor);
		expect(result).toEqual({ ok: true });

		const audit = latestAudit("redirect.delete");
		expect(audit).toMatchObject({
			action: "redirect.delete",
			resource_type: "redirect",
			resource_id: "/old",
			summary: "Deleted redirect /old.",
		});

		const row = db
			.prepare("SELECT deleted_at FROM redirect_rules WHERE source_path = '/old'")
			.get() as { deleted_at: string | null };
		expect(row.deleted_at).not.toBeNull();
	});

	it("deleteRedirectRule returns ok=false and emits NO audit when the rule is absent", async () => {
		const result = await store.sqliteRedirectRepository.deleteRedirectRule("/never", actor);
		expect(result).toEqual({ ok: false });
		expect(latestAudit("redirect.delete")).toBeUndefined();
	});
});

// ---------------------------------------------------------------------------
// Comment repository
// ---------------------------------------------------------------------------

describe("createSqliteSettingsStore — comment repository", () => {
	it("submitPublicComment persists the comment row with email/body NULL when omitted", async () => {
		const result = await store.sqliteCommentRepository.submitPublicComment({
			author: "Anon",
			route: "/post-a",
		});
		expect(result.ok).toBe(true);

		const row = db
			.prepare("SELECT author, email, body, route, status, policy FROM comments WHERE id = ?")
			.get(result.ok ? result.comment.id : "x") as Record<string, unknown>;
		expect(row).toMatchObject({
			author: "Anon",
			email: null,
			body: null,
			route: "/post-a",
			status: "pending",
			policy: "open-moderated",
		});
	});

	it("submitPublicComment uses caller-provided submittedAt and returns it on the comment", async () => {
		const ts = "2026-04-01T00:00:00.000Z";
		const result = await store.sqliteCommentRepository.submitPublicComment({
			author: "Anon",
			route: "/r",
			submittedAt: ts,
		});
		expect(result.ok).toBe(true);
		if (result.ok) expect(result.comment.submittedAt).toBe(ts);
	});

	it("getComments returns email/body as undefined (not null) for NULL DB rows", async () => {
		await store.sqliteCommentRepository.submitPublicComment({ author: "Anon", route: "/r" });
		const all = await store.sqliteCommentRepository.getComments();
		expect(all).toHaveLength(1);
		expect(all[0]?.email).toBeUndefined();
		expect(all[0]?.body).toBeUndefined();
	});

	it("moderateComment changes status, returns ok, and emits a 'comment.moderate' audit with resource_type='comment'", async () => {
		const submission = await store.sqliteCommentRepository.submitPublicComment({
			author: "Anon",
			route: "/post-x",
			body: "hi",
		});
		expect(submission.ok).toBe(true);
		if (!submission.ok) return;

		const result = await store.sqliteCommentRepository.moderateComment(
			submission.comment.id,
			"approved",
			actor,
		);
		expect(result).toEqual({ ok: true });

		const row = db
			.prepare("SELECT status FROM comments WHERE id = ?")
			.get(submission.comment.id) as { status: string };
		expect(row.status).toBe("approved");

		const audit = latestAudit("comment.moderate");
		expect(audit).toMatchObject({
			action: "comment.moderate",
			resource_type: "comment",
			resource_id: submission.comment.id,
			summary: "Marked /post-x as approved.",
		});
	});

	it("moderateComment returns ok=false and emits NO audit when the comment id is absent", async () => {
		const result = await store.sqliteCommentRepository.moderateComment(
			"no-such",
			"approved",
			actor,
		);
		expect(result).toMatchObject({ ok: false });
		expect(latestAudit("comment.moderate")).toBeUndefined();
	});
});

// ---------------------------------------------------------------------------
// Translation repository
// ---------------------------------------------------------------------------

describe("createSqliteSettingsStore — translation repository", () => {
	it("updateTranslationState persists state and emits 'translation.update' audit with resource_type='content' and the documented summary", async () => {
		const result = await store.sqliteTranslationRepository.updateTranslationState(
			"/es/about",
			"published",
			actor,
		);
		expect(result).toEqual({ ok: true });

		const row = db
			.prepare("SELECT state, updated_by FROM translation_overrides WHERE route = '/es/about'")
			.get() as Record<string, unknown>;
		expect(row).toMatchObject({
			state: "published",
			updated_by: actor.email,
		});

		const audit = latestAudit("translation.update");
		expect(audit).toMatchObject({
			action: "translation.update",
			resource_type: "content",
			resource_id: "/es/about",
			summary: "Updated translation state for /es/about to published.",
		});
	});

	it("getEffectiveTranslationState returns the persisted state when present", async () => {
		await store.sqliteTranslationRepository.updateTranslationState("/es/about", "reviewed", actor);
		expect(store.sqliteTranslationRepository.getEffectiveTranslationState("/es/about")).toBe(
			"reviewed",
		);
	});
});

// ---------------------------------------------------------------------------
// Settings repository
// ---------------------------------------------------------------------------

describe("createSqliteSettingsStore — settings repository", () => {
	it("getSettings returns defaultSiteSettings when no row exists", async () => {
		const settings = await store.sqliteSettingsRepository.getSettings();
		expect(settings).toBeDefined();
		expect(settings.adminSlug).toBe("ap-admin");
	});

	it("saveSettings upserts a row and emits 'settings.update' audit with resource_type='auth' and resource_id='site-settings'", async () => {
		const result = await store.sqliteSettingsRepository.saveSettings(
			{
				siteTitle: "Astro",
				siteTagline: "Press",
				donationUrl: "https://example.com/donate",
				newsletterEnabled: true,
				commentsDefaultPolicy: "open-moderated",
				adminSlug: "secret-admin",
			},
			actor,
		);
		expect(result.ok).toBe(true);

		const row = db
			.prepare(
				"SELECT site_title, site_tagline, donation_url, newsletter_enabled, comments_default_policy, admin_slug, updated_by FROM site_settings WHERE id = 1",
			)
			.get() as Record<string, unknown>;
		expect(row).toMatchObject({
			site_title: "Astro",
			site_tagline: "Press",
			donation_url: "https://example.com/donate",
			newsletter_enabled: 1,
			comments_default_policy: "open-moderated",
			admin_slug: "secret-admin",
			updated_by: actor.email,
		});

		const audit = latestAudit("settings.update");
		expect(audit).toMatchObject({
			action: "settings.update",
			resource_type: "auth",
			resource_id: "site-settings",
			summary: "Updated site settings.",
		});
	});

	it("saveSettings persists newsletterEnabled=false as 0 (boolean → 1/0 round-trip)", async () => {
		await store.sqliteSettingsRepository.saveSettings(
			{
				siteTitle: "X",
				siteTagline: "Y",
				donationUrl: "",
				newsletterEnabled: false,
				commentsDefaultPolicy: "disabled",
				adminSlug: "ap-admin",
			},
			actor,
		);
		const row = db.prepare("SELECT newsletter_enabled FROM site_settings WHERE id = 1").get() as {
			newsletter_enabled: number;
		};
		expect(row.newsletter_enabled).toBe(0);

		const settings = await store.sqliteSettingsRepository.getSettings();
		expect(settings.newsletterEnabled).toBe(false);
	});

	it("getSettings reads back exactly the persisted shape (round-trip)", async () => {
		await store.sqliteSettingsRepository.saveSettings(
			{
				siteTitle: "Astro",
				siteTagline: "Press",
				donationUrl: "https://example.com/donate",
				newsletterEnabled: true,
				commentsDefaultPolicy: "open-moderated",
				adminSlug: "custom-slug",
			},
			actor,
		);
		const settings = await store.sqliteSettingsRepository.getSettings();
		expect(settings).toEqual({
			siteTitle: "Astro",
			siteTagline: "Press",
			donationUrl: "https://example.com/donate",
			newsletterEnabled: true,
			commentsDefaultPolicy: "open-moderated",
			adminSlug: "custom-slug",
		});
	});
});
