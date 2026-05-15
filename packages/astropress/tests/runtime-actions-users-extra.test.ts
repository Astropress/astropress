// Extra coverage for runtime-actions-users.ts beyond the smoke tests in
// runtime-actions-users.test.ts: audit-event content, exact error strings,
// regex boundaries on the email validator, ttl arithmetic on the invite
// expiry, and the local-store fallback wiring for every export.
import type { DatabaseSync } from "node:sqlite";
import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { registerCms } from "../src/config";
import {
	consumeRuntimeInviteToken,
	createRuntimePasswordResetToken,
	getRuntimeInviteRequest,
	inviteRuntimeAdminUser,
	suspendRuntimeAdminUser,
	unsuspendRuntimeAdminUser,
} from "../src/runtime-actions-users.js";
import { makeDb, STANDARD_ACTOR, STANDARD_CMS_CONFIG } from "./helpers/make-db.js";
import { makeLocals } from "./helpers/make-locals.js";

const { fakeLocalStore, mockLoadLocalAdminStore } = vi.hoisted(() => ({
	fakeLocalStore: {
		inviteAdminUser: vi.fn(),
		getInviteRequest: vi.fn(),
		consumeInviteToken: vi.fn(),
		suspendAdminUser: vi.fn(),
		unsuspendAdminUser: vi.fn(),
		createPasswordResetToken: vi.fn(),
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
		"INSERT INTO admin_users (email, password_hash, name, active, is_admin) VALUES (?, ?, ?, 1, 1)",
	).run("admin@test.local", "hash", "Test Admin");
	db.prepare(
		"INSERT INTO admin_users (email, password_hash, name, active, is_admin) VALUES (?, ?, ?, 1, 0)",
	).run("editor@test.local", "hash", "Test Editor");
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

async function inviteAndExtractToken(email = "new@test.local", role = "editor") {
	const result = (await inviteRuntimeAdminUser({ name: "New", email, role }, actor, locals)) as {
		inviteUrl: string;
	};
	const raw = result.inviteUrl.split("token=")[1];
	return decodeURIComponent(raw);
}

describe("inviteRuntimeAdminUser — error strings, audit, edge cases", () => {
	it("returns the exact 'name/email/role required' error when name is whitespace", async () => {
		const result = await inviteRuntimeAdminUser(
			{ name: "  ", email: "x@test.local", role: "editor" },
			actor,
			locals,
		);
		expect(result).toEqual({ ok: false, error: "Name, email, and role are required." });
	});

	it("returns the exact 'name/email/role required' error when role is unrecognised", async () => {
		const result = await inviteRuntimeAdminUser(
			{ name: "X", email: "x@test.local", role: "superuser" },
			actor,
			locals,
		);
		expect(result).toEqual({ ok: false, error: "Name, email, and role are required." });
	});

	it("returns the exact 'valid email' error for a malformed address (no dot)", async () => {
		const result = await inviteRuntimeAdminUser(
			{ name: "X", email: "no-at-symbol", role: "editor" },
			actor,
			locals,
		);
		expect(result).toEqual({ ok: false, error: "Enter a valid email address." });
	});

	it("rejects an address missing the local part (anchored ^ in the regex)", async () => {
		const result = await inviteRuntimeAdminUser(
			{ name: "X", email: "@host.tld", role: "editor" },
			actor,
			locals,
		);
		expect(result).toMatchObject({ ok: false, error: "Enter a valid email address." });
	});

	it("rejects an address missing the TLD (anchored $ in the regex)", async () => {
		const result = await inviteRuntimeAdminUser(
			{ name: "X", email: "user@host", role: "editor" },
			actor,
			locals,
		);
		expect(result).toMatchObject({ ok: false, error: "Enter a valid email address." });
	});

	it("returns the exact 'already belongs to an admin user' error for a duplicate email", async () => {
		const result = await inviteRuntimeAdminUser(
			{ name: "Dup", email: "editor@test.local", role: "editor" },
			actor,
			locals,
		);
		expect(result).toEqual({
			ok: false,
			error: "That email address already belongs to an admin user.",
		});
	});

	it("admin role is stored as is_admin=1, editor as is_admin=0", async () => {
		await inviteRuntimeAdminUser(
			{ name: "Adm", email: "admin2@test.local", role: "admin" },
			actor,
			locals,
		);
		await inviteRuntimeAdminUser(
			{ name: "Ed", email: "editor2@test.local", role: "editor" },
			actor,
			locals,
		);
		const adminRow = db
			.prepare("SELECT is_admin FROM admin_users WHERE email = 'admin2@test.local'")
			.get() as { is_admin: number };
		const editorRow = db
			.prepare("SELECT is_admin FROM admin_users WHERE email = 'editor2@test.local'")
			.get() as { is_admin: number };
		expect(adminRow.is_admin).toBe(1);
		expect(editorRow.is_admin).toBe(0);
	});

	it("invite id starts with 'invite-' and expires roughly 7 days from now", async () => {
		await inviteRuntimeAdminUser(
			{ name: "E", email: "e@test.local", role: "editor" },
			actor,
			locals,
		);
		const row = db
			.prepare("SELECT id, expires_at, invited_by FROM user_invites ORDER BY id DESC LIMIT 1")
			.get() as { id: string; expires_at: string; invited_by: string };
		expect(row.id.startsWith("invite-")).toBe(true);
		expect(row.invited_by).toBe(actor.email);
		const expiresMs = Date.parse(row.expires_at);
		const expectedMs = Date.now() + 7 * 24 * 60 * 60 * 1000;
		expect(Math.abs(expiresMs - expectedMs)).toBeLessThan(30_000);
		// Pin: must be at least 6 days in the future (kills any operator mutation that reduces TTL)
		expect(expiresMs).toBeGreaterThan(Date.now() + 6 * 24 * 60 * 60 * 1000);
	});

	it("records a user.invite audit event with the role and email in the summary", async () => {
		await inviteRuntimeAdminUser(
			{ name: "Adit", email: "audit@test.local", role: "admin" },
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
			action: "user.invite",
			resource_type: "auth",
			resource_id: "audit@test.local",
			summary: "Invited audit@test.local as an admin user.",
		});
	});

	it("forwards to localStore.inviteAdminUser when no D1 binding is present", async () => {
		fakeLocalStore.inviteAdminUser.mockResolvedValue({ ok: true, inviteUrl: "/local" });
		const input = { name: "X", email: "x@test.local", role: "editor" };
		const result = await inviteRuntimeAdminUser(input, actor, undefined);
		expect(fakeLocalStore.inviteAdminUser).toHaveBeenCalledWith(input, actor);
		expect(result).toEqual({ ok: true, inviteUrl: "/local" });
	});
});

describe("getRuntimeInviteRequest — token state branches and fallback", () => {
	it("returns null for an invite that has already been accepted", async () => {
		const token = await inviteAndExtractToken();
		db.prepare(
			"UPDATE user_invites SET accepted_at = CURRENT_TIMESTAMP WHERE accepted_at IS NULL",
		).run();
		const request = await getRuntimeInviteRequest(token, locals);
		expect(request).toBeNull();
	});

	it("returns null for an invite whose user has been deactivated", async () => {
		const token = await inviteAndExtractToken("inactive@test.local");
		db.prepare("UPDATE admin_users SET active = 0 WHERE email = 'inactive@test.local'").run();
		const request = await getRuntimeInviteRequest(token, locals);
		expect(request).toBeNull();
	});

	it("returns null for an expired invite token", async () => {
		const token = await inviteAndExtractToken();
		db.prepare(
			"UPDATE user_invites SET expires_at = '2000-01-01T00:00:00.000Z' WHERE accepted_at IS NULL",
		).run();
		const request = await getRuntimeInviteRequest(token, locals);
		expect(request).toBeNull();
	});

	it("forwards to localStore.getInviteRequest when no D1 binding is present", async () => {
		fakeLocalStore.getInviteRequest.mockResolvedValue({
			email: "x",
			name: "X",
			role: "editor",
			expiresAt: "x",
		});
		const result = await getRuntimeInviteRequest("rt", undefined);
		expect(fakeLocalStore.getInviteRequest).toHaveBeenCalledWith("rt");
		expect(result).toEqual({ email: "x", name: "X", role: "editor", expiresAt: "x" });
	});
});

describe("consumeRuntimeInviteToken — error strings, audit, branches", () => {
	it("returns the exact short-password error when the trimmed password is below 12 chars", async () => {
		const token = await inviteAndExtractToken();
		const result = await consumeRuntimeInviteToken(token, "    short    ", locals);
		expect(result).toEqual({ ok: false, error: "Password must be at least 12 characters." });
	}, 15000);

	it("accepts a password whose trimmed length is exactly 12", async () => {
		const token = await inviteAndExtractToken();
		const result = await consumeRuntimeInviteToken(token, "a".repeat(12), locals);
		expect(result).toMatchObject({ ok: true });
	}, 15000);

	it("returns the user object on success and records an auth.invite_accept audit event", async () => {
		const token = await inviteAndExtractToken("acceptor@test.local", "admin");
		const result = (await consumeRuntimeInviteToken(token, "newpassword123", locals)) as {
			ok: true;
			user: { email: string; role: string; name: string };
		};
		expect(result.ok).toBe(true);
		expect(result.user).toEqual({ email: "acceptor@test.local", role: "admin", name: "New" });
		const auditRow = db
			.prepare(
				"SELECT user_email, action, resource_type, resource_id, summary FROM audit_events ORDER BY id DESC LIMIT 1",
			)
			.get() as Record<string, string>;
		expect(auditRow).toEqual({
			user_email: "acceptor@test.local",
			action: "auth.invite_accept",
			resource_type: "auth",
			resource_id: "acceptor@test.local",
			summary: "acceptor@test.local accepted an admin invitation.",
		});
	}, 15000);

	it("forwards to localStore.consumeInviteToken when no D1 binding is present", async () => {
		fakeLocalStore.consumeInviteToken.mockResolvedValue({ ok: true });
		const result = await consumeRuntimeInviteToken("rt", "pw", undefined);
		expect(fakeLocalStore.consumeInviteToken).toHaveBeenCalledWith("rt", "pw");
		expect(result).toEqual({ ok: true });
	});
});

describe("suspendRuntimeAdminUser — error strings, audit, fallback", () => {
	it("returns the exact 'email required' error for a blank email", async () => {
		const result = await suspendRuntimeAdminUser("   ", actor, locals);
		expect(result).toEqual({ ok: false, error: "Email is required." });
	});

	it("returns the exact 'cannot suspend own account' error", async () => {
		const result = await suspendRuntimeAdminUser("admin@test.local", actor, locals);
		expect(result).toEqual({
			ok: false,
			error: "You cannot suspend the account you are currently using.",
		});
	});

	it("returns the exact 'could not be suspended' error for an unknown user", async () => {
		const result = await suspendRuntimeAdminUser("nobody@test.local", actor, locals);
		expect(result).toEqual({ ok: false, error: "That admin user could not be suspended." });
	});

	it("records a user.suspend audit event with the suspended email", async () => {
		await suspendRuntimeAdminUser("editor@test.local", actor, locals);
		const row = db
			.prepare(
				"SELECT user_email, action, resource_type, resource_id, summary FROM audit_events ORDER BY id DESC LIMIT 1",
			)
			.get() as Record<string, string>;
		expect(row).toEqual({
			user_email: actor.email,
			action: "user.suspend",
			resource_type: "auth",
			resource_id: "editor@test.local",
			summary: "Suspended editor@test.local.",
		});
	});

	it("forwards to localStore.suspendAdminUser when no D1 binding is present", async () => {
		fakeLocalStore.suspendAdminUser.mockResolvedValue({ ok: true });
		const result = await suspendRuntimeAdminUser("x@y.z", actor, undefined);
		expect(fakeLocalStore.suspendAdminUser).toHaveBeenCalledWith("x@y.z", actor);
		expect(result).toEqual({ ok: true });
	});
});

describe("unsuspendRuntimeAdminUser — error strings, audit, fallback", () => {
	it("returns the exact 'email required' error for a blank email", async () => {
		const result = await unsuspendRuntimeAdminUser("   ", actor, locals);
		expect(result).toEqual({ ok: false, error: "Email is required." });
	});

	it("returns the exact 'could not be restored' error for an already-active user", async () => {
		const result = await unsuspendRuntimeAdminUser("editor@test.local", actor, locals);
		expect(result).toEqual({ ok: false, error: "That admin user could not be restored." });
	});

	it("records a user.restore audit event with the restored email", async () => {
		db.prepare("UPDATE admin_users SET active = 0 WHERE email = 'editor@test.local'").run();
		await unsuspendRuntimeAdminUser("editor@test.local", actor, locals);
		const row = db
			.prepare(
				"SELECT user_email, action, resource_type, resource_id, summary FROM audit_events ORDER BY id DESC LIMIT 1",
			)
			.get() as Record<string, string>;
		expect(row).toEqual({
			user_email: actor.email,
			action: "user.restore",
			resource_type: "auth",
			resource_id: "editor@test.local",
			summary: "Restored editor@test.local.",
		});
	});

	it("forwards to localStore.unsuspendAdminUser when no D1 binding is present", async () => {
		fakeLocalStore.unsuspendAdminUser.mockResolvedValue({ ok: true });
		const result = await unsuspendRuntimeAdminUser("x@y.z", actor, undefined);
		expect(fakeLocalStore.unsuspendAdminUser).toHaveBeenCalledWith("x@y.z", actor);
		expect(result).toEqual({ ok: true });
	});
});

describe("createRuntimePasswordResetToken — re-export wiring", () => {
	it("is re-exported from runtime-actions-users and reaches localStore on the no-DB path", async () => {
		fakeLocalStore.createPasswordResetToken.mockResolvedValue({ ok: true, resetUrl: "/x" });
		const result = await createRuntimePasswordResetToken("e@test.local", actor, undefined);
		expect(fakeLocalStore.createPasswordResetToken).toHaveBeenCalledWith("e@test.local", actor);
		expect(result).toEqual({ ok: true, resetUrl: "/x" });
	});
});
