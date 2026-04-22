import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
	type RuntimeFixture,
	createRuntimeFixture,
} from "./helpers/sqlite-admin-runtime-fixture.js";

let fixture: RuntimeFixture;

beforeAll(() => {
	fixture = createRuntimeFixture();
});

afterAll(() => {
	fixture.db.close();
});

// ─── Users ────────────────────────────────────────────────────────────────────

describe("users", () => {
	it("listAdminUsers returns active, suspended, and invited statuses", () => {
		const users = fixture.store.users.listAdminUsers();
		expect(
			users.some(
				(u) => u.email === "admin@test.local" && u.status === "active",
			),
		).toBe(true);
		expect(
			users.some(
				(u) => u.email === "suspended@test.local" && u.status === "suspended",
			),
		).toBe(true);
		expect(
			users.some(
				(u) => u.email === "invited@test.local" && u.status === "invited",
			),
		).toBe(true);
	});

	it("inviteAdminUser creates a new user", () => {
		const result = fixture.store.users.inviteAdminUser(
			{ email: "new-editor@test.local", role: "editor", name: "New Editor" },
			fixture.actor,
		);
		expect(result.ok).toBe(true);
	});

	it("inviteAdminUser returns error for duplicate email", () => {
		fixture.store.users.inviteAdminUser(
			{ email: "dup-editor@test.local", role: "editor", name: "Dup" },
			fixture.actor,
		);
		const result = fixture.store.users.inviteAdminUser(
			{ email: "dup-editor@test.local", role: "editor", name: "Dup Again" },
			fixture.actor,
		);
		expect(result.ok).toBe(false);
	});

	it("suspendAdminUser and unsuspendAdminUser toggle active state", () => {
		fixture.store.users.inviteAdminUser(
			{ email: "toggle@test.local", role: "editor", name: "Toggle" },
			fixture.actor,
		);
		expect(
			fixture.store.users.suspendAdminUser("toggle@test.local", fixture.actor)
				.ok,
		).toBe(true);
		expect(
			fixture.store.users.unsuspendAdminUser("toggle@test.local", fixture.actor)
				.ok,
		).toBe(true);
	});

	it("suspendAdminUser returns error for unknown user", () => {
		expect(
			fixture.store.users.suspendAdminUser("nobody@test.local", fixture.actor)
				.ok,
		).toBe(false);
	});
});

// ─── Audit ────────────────────────────────────────────────────────────────────

describe("audit", () => {
	it("getAuditEvents returns events with correct targetType mapping", () => {
		for (const [action, type, id] of [
			["test.redirect", "redirect", "/old"],
			["test.comment", "comment", "c1"],
			["test.content", "content", "post-1"],
			["test.auth", "auth", "site-settings"],
			["test.unknown", "media", "asset-1"],
		] as const) {
			fixture.db
				.prepare(
					"INSERT INTO audit_events (user_email, action, resource_type, resource_id, summary) VALUES (?, ?, ?, ?, ?)",
				)
				.run("admin@test.local", action, type, id, `${type} audit`);
		}

		const events = fixture.store.audit.getAuditEvents();
		expect(events.some((e) => e.targetType === "redirect")).toBe(true);
		expect(events.some((e) => e.targetType === "comment")).toBe(true);
		expect(events.some((e) => e.targetType === "content")).toBe(true);
		expect(events.some((e) => e.targetType === "auth")).toBe(true);
	});
});

// ─── User management error branches ──────────────────────────────────────────

describe("users additional error branches", () => {
	it("inviteAdminUser: empty name returns error", () => {
		expect(
			fixture.store.users.inviteAdminUser(
				{ email: "valid@test.local", role: "editor", name: "" },
				fixture.actor,
			).ok,
		).toBe(false);
	});

	it("inviteAdminUser: invalid role returns error (role normalizes to empty string)", () => {
		expect(
			fixture.store.users.inviteAdminUser(
				{ email: "valid2@test.local", role: "superuser" as string, name: "X" },
				fixture.actor,
			).ok,
		).toBe(false);
	});

	it("inviteAdminUser: invalid email format returns error", () => {
		expect(
			fixture.store.users.inviteAdminUser(
				{ email: "not-an-email", role: "editor", name: "X" },
				fixture.actor,
			).ok,
		).toBe(false);
	});

	it("suspendAdminUser: empty email returns error", () => {
		expect(fixture.store.users.suspendAdminUser("", fixture.actor).ok).toBe(
			false,
		);
	});

	it("suspendAdminUser: suspending yourself returns error", () => {
		expect(
			fixture.store.users.suspendAdminUser("admin@test.local", fixture.actor)
				.ok,
		).toBe(false);
	});

	it("unsuspendAdminUser: empty email returns error", () => {
		expect(fixture.store.users.unsuspendAdminUser("", fixture.actor).ok).toBe(
			false,
		);
	});

	it("unsuspendAdminUser: non-existent user returns error", () => {
		expect(
			fixture.store.users.unsuspendAdminUser("nobody@test.local", fixture.actor)
				.ok,
		).toBe(false);
	});
});

// ─── Users inviteAdminUser role branches ─────────────────────────────────────

describe("users inviteAdminUser role branches", () => {
	it("inviteAdminUser with 'admin' role (covers the 'admin' arm of the nested ternary)", () => {
		const result = fixture.store.users.inviteAdminUser(
			{ email: "new-admin@test.local", role: "admin", name: "New Admin" },
			fixture.actor,
		);
		expect(result.ok).toBe(true);
	});
});
