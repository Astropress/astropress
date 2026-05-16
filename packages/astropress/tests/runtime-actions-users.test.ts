import type { DatabaseSync } from "node:sqlite";
import { beforeEach, describe, expect, it } from "vitest";

import { registerCms } from "../src/config";
import {
	consumeRuntimeInviteToken,
	consumeRuntimePasswordResetToken,
	createRuntimePasswordResetToken,
	getRuntimeInviteRequest,
	getRuntimePasswordResetRequest,
	inviteRuntimeAdminUser,
	suspendRuntimeAdminUser,
	unsuspendRuntimeAdminUser,
} from "../src/runtime-actions-users";
import { makeDb, STANDARD_ACTOR, STANDARD_CMS_CONFIG } from "./helpers/make-db.js";
import { makeLocals } from "./helpers/make-locals.js";

const actor = STANDARD_ACTOR;

let db: DatabaseSync;
let locals: App.Locals;

beforeEach(() => {
	db = makeDb();
	locals = makeLocals(db);
	registerCms(STANDARD_CMS_CONFIG);

	db.prepare(
		"INSERT INTO admin_users (email, password_hash, name, active, is_admin) VALUES (?1, ?2, ?4, ?5, CASE WHEN ?3 = 'admin' THEN 1 ELSE 0 END)",
	).run("admin@test.local", "hash", "admin", "Test Admin", 1);
	db.prepare(
		"INSERT INTO admin_users (email, password_hash, name, active, is_admin) VALUES (?1, ?2, ?4, ?5, CASE WHEN ?3 = 'admin' THEN 1 ELSE 0 END)",
	).run("editor@test.local", "hash", "editor", "Test Editor", 1);
});

describe("inviteRuntimeAdminUser", () => {
	it("creates a user and returns an invite URL", async () => {
		const result = await inviteRuntimeAdminUser(
			{ name: "New User", email: "new@test.local", role: "editor" },
			actor,
			locals,
		);
		expect(result).toMatchObject({ ok: true });
		expect((result as { inviteUrl: string }).inviteUrl).toContain("/accept-invite?token=");
	});

	it("rejects duplicate email", async () => {
		const result = await inviteRuntimeAdminUser(
			{ name: "Dup", email: "editor@test.local", role: "editor" },
			actor,
			locals,
		);
		expect(result).toMatchObject({ ok: false });
	});

	it("rejects missing name", async () => {
		const result = await inviteRuntimeAdminUser(
			{ name: "  ", email: "x@test.local", role: "editor" },
			actor,
			locals,
		);
		expect(result).toMatchObject({ ok: false });
	});

	it("rejects invalid role", async () => {
		const result = await inviteRuntimeAdminUser(
			{ name: "X", email: "x@test.local", role: "superuser" },
			actor,
			locals,
		);
		expect(result).toMatchObject({ ok: false });
	});

	it("rejects invalid email format", async () => {
		const result = await inviteRuntimeAdminUser(
			{ name: "X", email: "not-an-email", role: "editor" },
			actor,
			locals,
		);
		expect(result).toMatchObject({ ok: false });
	});
});

describe("getRuntimeInviteRequest / consumeRuntimeInviteToken", () => {
	async function createInvite() {
		const invite = await inviteRuntimeAdminUser(
			{ name: "Invite User", email: "invite@test.local", role: "editor" },
			actor,
			locals,
		);
		const rawToken = (invite as { inviteUrl: string }).inviteUrl.split("token=")[1];
		return decodeURIComponent(rawToken);
	}

	it("returns invite details for a valid token", async () => {
		const token = await createInvite();
		const request = await getRuntimeInviteRequest(token, locals);
		expect(request).toMatchObject({
			email: "invite@test.local",
			role: "editor",
		});
	});

	it("returns null for an unknown token", async () => {
		const request = await getRuntimeInviteRequest("bad-token", locals);
		expect(request).toBeNull();
	});

	it("returns null for a blank token", async () => {
		const request = await getRuntimeInviteRequest("   ", locals);
		expect(request).toBeNull();
	});

	it("consumes an invite token and sets password", async () => {
		const token = await createInvite();
		const result = await consumeRuntimeInviteToken(token, "newpassword123", locals);
		expect(result).toMatchObject({ ok: true });
	});

	it("rejects a short password", async () => {
		const token = await createInvite();
		const result = await consumeRuntimeInviteToken(token, "short", locals);
		expect(result).toMatchObject({ ok: false });
	});
});

describe("createRuntimePasswordResetToken / getRuntimePasswordResetRequest / consumeRuntimePasswordResetToken", () => {
	async function createResetToken(email = "editor@test.local") {
		const r = await createRuntimePasswordResetToken(email, actor, locals);
		const rawToken = (r as { resetUrl: string }).resetUrl.split("token=")[1];
		return decodeURIComponent(rawToken);
	}

	it("creates a reset URL for a known active user", async () => {
		const result = await createRuntimePasswordResetToken("editor@test.local", actor, locals);
		expect(result).toMatchObject({ ok: true });
		expect((result as { resetUrl: string }).resetUrl).toContain("/reset-password?token=");
	});

	it("returns not-ok (with actor) for unknown email", async () => {
		const result = await createRuntimePasswordResetToken("nobody@test.local", actor, locals);
		expect(result).toMatchObject({ ok: false });
	});

	it("returns ok with null resetUrl (without actor) for unknown email", async () => {
		const result = await createRuntimePasswordResetToken("nobody@test.local", null, locals);
		expect(result).toMatchObject({ ok: true });
		expect((result as { resetUrl: null }).resetUrl).toBeNull();
	});

	it("returns reset request details for a valid token", async () => {
		const token = await createResetToken();
		const request = await getRuntimePasswordResetRequest(token, locals);
		expect(request).toMatchObject({ email: "editor@test.local" });
	});

	it("returns null for an unknown token", async () => {
		const request = await getRuntimePasswordResetRequest("bad-token", locals);
		expect(request).toBeNull();
	});

	it("consumes a reset token and updates password", async () => {
		const token = await createResetToken();
		const result = await consumeRuntimePasswordResetToken(token, "newpassword123", locals);
		expect(result).toMatchObject({ ok: true });
	}, 15000);

	it("rejects a short password", async () => {
		const token = await createResetToken();
		const result = await consumeRuntimePasswordResetToken(token, "short", locals);
		expect(result).toMatchObject({ ok: false });
	});

	it("rejects an already-consumed token", async () => {
		const token = await createResetToken();
		await consumeRuntimePasswordResetToken(token, "newpassword123", locals);
		const result = await consumeRuntimePasswordResetToken(token, "anotherpassword", locals);
		expect(result).toMatchObject({ ok: false });
	}, 15000);

	it("rejects an empty email with the required-email error", async () => {
		const result = await createRuntimePasswordResetToken("   ", actor, locals);
		expect(result).toEqual({ ok: false, error: "Email is required." });
	});

	it("returns the exact unknown-email error string for known-actor lookups", async () => {
		const result = await createRuntimePasswordResetToken("nobody@test.local", actor, locals);
		expect(result).toEqual({ ok: false, error: "That admin user could not be found." });
	});

	it("stores requested_by = actor.email and writes the issue audit event", async () => {
		await createRuntimePasswordResetToken("editor@test.local", actor, locals);
		const tokenRow = db
			.prepare(
				"SELECT id, requested_by, expires_at FROM password_reset_tokens ORDER BY id DESC LIMIT 1",
			)
			.get() as { id: string; requested_by: string; expires_at: string };
		expect(tokenRow.id.startsWith("reset-")).toBe(true);
		expect(tokenRow.requested_by).toBe(actor.email);
		const expiresMs = Date.parse(tokenRow.expires_at);
		const expectedMs = Date.now() + 60 * 60 * 1000;
		expect(Math.abs(expiresMs - expectedMs)).toBeLessThan(10_000);
		expect(expiresMs).toBeGreaterThan(Date.now() + 50 * 60 * 1000);

		const auditRow = db
			.prepare(
				"SELECT user_email, action, resource_type, resource_id, summary FROM audit_events ORDER BY id DESC LIMIT 1",
			)
			.get() as Record<string, string>;
		expect(auditRow).toEqual({
			user_email: actor.email,
			action: "auth.password_reset_issue",
			resource_type: "auth",
			resource_id: "editor@test.local",
			summary: "Issued a password reset link for editor@test.local.",
		});
	});

	it("stores requested_by = NULL and writes no audit when actor is omitted", async () => {
		const before = (db.prepare("SELECT COUNT(*) AS c FROM audit_events").get() as { c: number }).c;
		await createRuntimePasswordResetToken("editor@test.local", null, locals);
		const tokenRow = db
			.prepare("SELECT requested_by FROM password_reset_tokens ORDER BY id DESC LIMIT 1")
			.get() as { requested_by: string | null };
		expect(tokenRow.requested_by).toBeNull();
		const after = (db.prepare("SELECT COUNT(*) AS c FROM audit_events").get() as { c: number }).c;
		expect(after).toBe(before);
	});

	it("rejects a reset request for an inactive user", async () => {
		await createRuntimePasswordResetToken("editor@test.local", actor, locals);
		const token = (await createRuntimePasswordResetToken("editor@test.local", actor, locals)) as {
			resetUrl: string;
		};
		const rawToken = decodeURIComponent(token.resetUrl.split("token=")[1]);
		db.prepare("UPDATE admin_users SET active = 0 WHERE email = 'editor@test.local'").run();
		const request = await getRuntimePasswordResetRequest(rawToken, locals);
		expect(request).toBeNull();
	});

	it("rejects a reset request for an expired token", async () => {
		const token = await createResetToken();
		db.prepare(
			"UPDATE password_reset_tokens SET expires_at = '2000-01-01T00:00:00.000Z' WHERE consumed_at IS NULL",
		).run();
		const request = await getRuntimePasswordResetRequest(token, locals);
		expect(request).toBeNull();
	});

	it("returns the exact invalid-or-expired error for an unknown token on consume", async () => {
		const result = await consumeRuntimePasswordResetToken(
			"not-a-real-token",
			"newpassword123",
			locals,
		);
		expect(result).toEqual({
			ok: false,
			error: "That password reset link is invalid or has expired.",
		});
	});

	it("returns the exact short-password error for a password trimmed below 12", async () => {
		const token = await createResetToken();
		// 13-char input but trimmed length is 5 ("short"); without trim it'd pass the length check
		const result = await consumeRuntimePasswordResetToken(token, "    short    ", locals);
		expect(result).toEqual({ ok: false, error: "Password must be at least 12 characters." });
	}, 15000);

	it("accepts a password whose trimmed length is exactly 12", async () => {
		const token = await createResetToken();
		const result = await consumeRuntimePasswordResetToken(token, "a".repeat(12), locals);
		expect(result).toMatchObject({ ok: true });
	}, 15000);

	it("returns the user object and writes the complete audit on consume", async () => {
		const token = await createResetToken();
		const result = (await consumeRuntimePasswordResetToken(token, "newpassword123", locals)) as {
			ok: true;
			user: { email: string; role: string; name: string };
		};
		expect(result.ok).toBe(true);
		expect(result.user).toEqual({
			email: "editor@test.local",
			role: "editor",
			name: "Test Editor",
		});

		const auditRow = db
			.prepare(
				"SELECT user_email, action, resource_type, resource_id, summary FROM audit_events ORDER BY id DESC LIMIT 1",
			)
			.get() as Record<string, string>;
		expect(auditRow).toEqual({
			user_email: "editor@test.local",
			action: "auth.password_reset_complete",
			resource_type: "auth",
			resource_id: "editor@test.local",
			summary: "editor@test.local completed a password reset.",
		});
	}, 15000);
});

describe("suspendRuntimeAdminUser / unsuspendRuntimeAdminUser", () => {
	it("suspends an active user", async () => {
		const result = await suspendRuntimeAdminUser("editor@test.local", actor, locals);
		expect(result).toMatchObject({ ok: true });
		const row = db
			.prepare("SELECT active FROM admin_users WHERE email = 'editor@test.local'")
			.get() as { active: number };
		expect(row.active).toBe(0);
	});

	it("cannot suspend own account", async () => {
		const result = await suspendRuntimeAdminUser("admin@test.local", actor, locals);
		expect(result).toMatchObject({ ok: false });
	});

	it("returns not-ok for unknown or already-suspended user", async () => {
		const result = await suspendRuntimeAdminUser("nobody@test.local", actor, locals);
		expect(result).toMatchObject({ ok: false });
	});

	it("returns not-ok for blank email on suspend", async () => {
		const result = await suspendRuntimeAdminUser("   ", actor, locals);
		expect(result).toMatchObject({ ok: false });
	});

	it("restores a suspended user", async () => {
		db.prepare("UPDATE admin_users SET active = 0 WHERE email = 'editor@test.local'").run();
		const result = await unsuspendRuntimeAdminUser("editor@test.local", actor, locals);
		expect(result).toMatchObject({ ok: true });
		const row = db
			.prepare("SELECT active FROM admin_users WHERE email = 'editor@test.local'")
			.get() as { active: number };
		expect(row.active).toBe(1);
	});

	it("returns not-ok for already-active user on unsuspend", async () => {
		const result = await unsuspendRuntimeAdminUser("editor@test.local", actor, locals);
		expect(result).toMatchObject({ ok: false });
	});

	it("returns not-ok for blank email on unsuspend", async () => {
		const result = await unsuspendRuntimeAdminUser("   ", actor, locals);
		expect(result).toMatchObject({ ok: false });
	});
});
