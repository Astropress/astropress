// Static-import counterpart to runtime-actions-misc.test.ts. The sibling file
// uses dynamic imports + vi.resetModules for its no-db fallback assertions,
// which prevents stryker's per-test coverage tracker from recording most of
// its assertions against this source. This file imports statically and pins
// the audit-event content, exact error strings, status-code mapping, and the
// existing-row branches that the dynamic-import file cannot.
import type { DatabaseSync } from "node:sqlite";
import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { registerCms } from "../src/config";
import {
	createRuntimeRedirectRule,
	deleteRuntimeRedirectRule,
	moderateRuntimeComment,
	saveRuntimeSettings,
	updateRuntimeTranslationState,
} from "../src/runtime-actions-misc.js";
import { makeDb, STANDARD_ACTOR, STANDARD_CMS_CONFIG } from "./helpers/make-db.js";
import { makeLocals } from "./helpers/make-locals.js";

const { fakeLocalStore, mockLoadLocalAdminStore } = vi.hoisted(() => ({
	fakeLocalStore: {
		updateTranslationState: vi.fn(),
		createRedirectRule: vi.fn(),
		deleteRedirectRule: vi.fn(),
		moderateComment: vi.fn(),
		saveSettings: vi.fn(),
	},
	mockLoadLocalAdminStore: vi.fn(),
}));

vi.mock("../src/local-runtime-modules", () => ({
	loadLocalAdminStore: mockLoadLocalAdminStore,
}));
vi.mock("../src/local-runtime-modules.js", () => ({
	loadLocalAdminStore: mockLoadLocalAdminStore,
}));

const actor = STANDARD_ACTOR;
let db: DatabaseSync;
let locals: App.Locals;

beforeEach(() => {
	db = makeDb();
	locals = makeLocals(db);
	registerCms(STANDARD_CMS_CONFIG);
	db.prepare(
		"INSERT INTO redirect_rules (source_path, target_path, status_code, created_by) VALUES (?, ?, ?, ?)",
	).run("/existing", "/dest", 301, "admin@test.local");
	db.prepare(
		"INSERT INTO redirect_rules (source_path, target_path, status_code, created_by, deleted_at) VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP)",
	).run("/soft-deleted", "/dest", 301, "admin@test.local");
	db.prepare("INSERT INTO comments (id, route, author, body, status) VALUES (?, ?, ?, ?, ?)").run(
		"c-1",
		"/page",
		"Bob",
		"Hello",
		"pending",
	);
	for (const m of Object.values(fakeLocalStore)) m.mockReset();
	mockLoadLocalAdminStore.mockReset();
	mockLoadLocalAdminStore.mockResolvedValue(fakeLocalStore);
});

afterEach(() => {
	vi.clearAllMocks();
});

afterAll(() => {
	vi.resetModules();
});

describe("updateRuntimeTranslationState — audit and error text", () => {
	it("rejects with a message listing every valid state", async () => {
		const result = (await updateRuntimeTranslationState("/about", "bogus", actor, locals)) as {
			ok: false;
			error: string;
		};
		expect(result.ok).toBe(false);
		expect(result.error).toBe(
			"Invalid translation state. Must be one of: not_started, partial, fallback_en, translated, reviewed, published",
		);
	});

	it("records a translation.update audit event with the route and new state in the summary", async () => {
		await updateRuntimeTranslationState("/about", "translated", actor, locals);
		const row = db
			.prepare(
				"SELECT user_email, action, resource_type, resource_id, summary FROM audit_events ORDER BY id DESC LIMIT 1",
			)
			.get() as Record<string, string>;
		expect(row).toEqual({
			user_email: actor.email,
			action: "translation.update",
			resource_type: "content",
			resource_id: "/about",
			summary: "Updated translation state for /about to translated.",
		});
	});

	it("forwards to localStore.updateTranslationState when no D1 binding is present", async () => {
		fakeLocalStore.updateTranslationState.mockResolvedValue({ ok: true });
		const result = await updateRuntimeTranslationState("/about", "translated", actor, undefined);
		expect(fakeLocalStore.updateTranslationState).toHaveBeenCalledWith(
			"/about",
			"translated",
			actor,
		);
		expect(result).toEqual({ ok: true });
	});
});

describe("createRuntimeRedirectRule — error strings, audit, branches", () => {
	it("returns the exact 'both required' error when sourcePath is empty after normalisation", async () => {
		const result = await createRuntimeRedirectRule(
			{ sourcePath: "   ", targetPath: "/to", statusCode: 301 },
			actor,
			locals,
		);
		expect(result).toEqual({ ok: false, error: "Both legacy and target paths are required." });
	});

	it("returns the exact 'must be different' error when source and target match", async () => {
		const result = await createRuntimeRedirectRule(
			{ sourcePath: "/same", targetPath: "/same", statusCode: 301 },
			actor,
			locals,
		);
		expect(result).toEqual({ ok: false, error: "Legacy and target paths must be different." });
	});

	it("returns the exact 'already has a reviewed rule' error for an active duplicate", async () => {
		const result = await createRuntimeRedirectRule(
			{ sourcePath: "/existing", targetPath: "/other", statusCode: 301 },
			actor,
			locals,
		);
		expect(result).toEqual({
			ok: false,
			error: "That legacy path already has a reviewed redirect rule.",
		});
	});

	it("re-activates a previously soft-deleted rule rather than rejecting as duplicate", async () => {
		// deleted_at is non-null → existing && existing.deleted_at === null is false → continue
		// (the mutant `if (true)` would reject as duplicate)
		const result = await createRuntimeRedirectRule(
			{ sourcePath: "/soft-deleted", targetPath: "/new-dest", statusCode: 302 },
			actor,
			locals,
		);
		expect(result).toMatchObject({
			ok: true,
			rule: { sourcePath: "/soft-deleted", targetPath: "/new-dest", statusCode: 302 },
		});
		const row = db
			.prepare(
				"SELECT target_path, status_code, deleted_at FROM redirect_rules WHERE source_path = '/soft-deleted'",
			)
			.get() as { target_path: string; status_code: number; deleted_at: string | null };
		expect(row.deleted_at).toBeNull();
		expect(row.target_path).toBe("/new-dest");
		expect(row.status_code).toBe(302);
	});

	it("creates a fresh redirect when no existing row matches the source path", async () => {
		const result = await createRuntimeRedirectRule(
			{ sourcePath: "/fresh", targetPath: "/dest", statusCode: 301 },
			actor,
			locals,
		);
		expect(result).toMatchObject({ ok: true });
	});

	it("records a redirect.create audit event with the source, target and status code", async () => {
		await createRuntimeRedirectRule(
			{ sourcePath: "/from", targetPath: "/to", statusCode: 302 },
			actor,
			locals,
		);
		const row = db
			.prepare(
				"SELECT user_email, action, resource_type, resource_id, summary FROM audit_events ORDER BY id DESC LIMIT 1",
			)
			.get() as Record<string, string>;
		expect(row).toEqual({
			user_email: actor.email,
			action: "redirect.create",
			resource_type: "redirect",
			resource_id: "/from",
			summary: "Created redirect /from -> /to (302).",
		});
	});

	it("forwards to localStore.createRedirectRule when no D1 binding is present", async () => {
		fakeLocalStore.createRedirectRule.mockResolvedValue({ ok: true });
		const input = { sourcePath: "/a", targetPath: "/b", statusCode: 301 };
		const result = await createRuntimeRedirectRule(input, actor, undefined);
		expect(fakeLocalStore.createRedirectRule).toHaveBeenCalledWith(input, actor);
		expect(result).toEqual({ ok: true });
	});
});

describe("deleteRuntimeRedirectRule — audit and fallback", () => {
	it("records a redirect.delete audit event with the source path in the summary", async () => {
		await deleteRuntimeRedirectRule("/existing", actor, locals);
		const row = db
			.prepare(
				"SELECT user_email, action, resource_type, resource_id, summary FROM audit_events ORDER BY id DESC LIMIT 1",
			)
			.get() as Record<string, string>;
		expect(row).toEqual({
			user_email: actor.email,
			action: "redirect.delete",
			resource_type: "redirect",
			resource_id: "/existing",
			summary: "Deleted redirect /existing.",
		});
	});

	it("forwards to localStore.deleteRedirectRule when no D1 binding is present", async () => {
		fakeLocalStore.deleteRedirectRule.mockResolvedValue({ ok: true });
		const result = await deleteRuntimeRedirectRule("/p", actor, undefined);
		expect(fakeLocalStore.deleteRedirectRule).toHaveBeenCalledWith("/p", actor);
		expect(result).toEqual({ ok: true });
	});
});

describe("moderateRuntimeComment — error text, audit, fallback", () => {
	it("returns the exact 'not found' error for an unknown comment id", async () => {
		const result = await moderateRuntimeComment("ghost", "approved", actor, locals);
		expect(result).toEqual({
			ok: false,
			error: "The selected comment record could not be found.",
		});
	});

	it("records a comment.moderate audit event naming the route and next status", async () => {
		await moderateRuntimeComment("c-1", "approved", actor, locals);
		const row = db
			.prepare(
				"SELECT user_email, action, resource_type, resource_id, summary FROM audit_events ORDER BY id DESC LIMIT 1",
			)
			.get() as Record<string, string>;
		expect(row).toEqual({
			user_email: actor.email,
			action: "comment.moderate",
			resource_type: "comment",
			resource_id: "c-1",
			summary: "Marked /page as approved.",
		});
	});

	it("forwards to localStore.moderateComment when no D1 binding is present", async () => {
		fakeLocalStore.moderateComment.mockResolvedValue({ ok: true });
		const result = await moderateRuntimeComment("c-1", "rejected", actor, undefined);
		expect(fakeLocalStore.moderateComment).toHaveBeenCalledWith("c-1", "rejected", actor);
		expect(result).toEqual({ ok: true });
	});
});

describe("saveRuntimeSettings — newsletter persistence and audit", () => {
	it("persists newsletterEnabled=true as 1 and reads back as boolean true", async () => {
		// Pins `currentRow.newsletter_enabled === 1` ↔ boolean true round-trip
		const created = await saveRuntimeSettings({ newsletterEnabled: true }, actor, locals);
		expect(created).toMatchObject({ ok: true, settings: { newsletterEnabled: true } });
		const row = db.prepare("SELECT newsletter_enabled FROM site_settings WHERE id = 1").get() as {
			newsletter_enabled: number;
		};
		expect(row.newsletter_enabled).toBe(1);

		// Second save with no newsletter field should preserve true (uses `current.newsletterEnabled`)
		const partial = await saveRuntimeSettings({ siteTitle: "x" }, actor, locals);
		expect(partial).toMatchObject({ ok: true, settings: { newsletterEnabled: true } });
	});

	it("preserves a pre-existing newsletter_enabled=0 row across a partial save that omits the field", async () => {
		// Pins `currentRow.newsletter_enabled === 1`: with the mutant `true`, current.newsletterEnabled
		// is forced to true regardless of stored row, so the partial save would flip 0 → 1.
		db.prepare(
			"INSERT INTO site_settings (id, site_title, site_tagline, donation_url, newsletter_enabled, comments_default_policy, admin_slug, updated_by) VALUES (1, '', '', '', 0, 'open-moderated', 'ap-admin', 'admin@test.local')",
		).run();
		const result = await saveRuntimeSettings({ siteTitle: "Renamed" }, actor, locals);
		expect(result).toMatchObject({ ok: true, settings: { newsletterEnabled: false } });
		const row = db.prepare("SELECT newsletter_enabled FROM site_settings WHERE id = 1").get() as {
			newsletter_enabled: number;
		};
		expect(row.newsletter_enabled).toBe(0);
	});

	it("persists newsletterEnabled=false as 0 and reads back as boolean false", async () => {
		await saveRuntimeSettings({ newsletterEnabled: true }, actor, locals);
		const result = await saveRuntimeSettings({ newsletterEnabled: false }, actor, locals);
		expect(result).toMatchObject({ ok: true, settings: { newsletterEnabled: false } });
		const row = db.prepare("SELECT newsletter_enabled FROM site_settings WHERE id = 1").get() as {
			newsletter_enabled: number;
		};
		expect(row.newsletter_enabled).toBe(0);
	});

	it("records a settings.update audit event with the exact summary 'Updated site settings.'", async () => {
		await saveRuntimeSettings({ siteTitle: "Hello" }, actor, locals);
		const row = db
			.prepare(
				"SELECT user_email, action, resource_type, resource_id, summary FROM audit_events ORDER BY id DESC LIMIT 1",
			)
			.get() as Record<string, string>;
		expect(row).toEqual({
			user_email: actor.email,
			action: "settings.update",
			resource_type: "auth",
			resource_id: "site-settings",
			summary: "Updated site settings.",
		});
	});

	it("forwards to localStore.saveSettings when no D1 binding is present", async () => {
		fakeLocalStore.saveSettings.mockResolvedValue({ ok: true });
		const partial = { siteTitle: "X" };
		const result = await saveRuntimeSettings(partial, actor, undefined);
		expect(fakeLocalStore.saveSettings).toHaveBeenCalledWith(partial, actor);
		expect(result).toEqual({ ok: true });
	});
});
