import type { DatabaseSync } from "node:sqlite";
import { beforeEach, describe, expect, it } from "vitest";

import { createAccessRepository, seedStarterRoles } from "../src/access";
import {
	addRuntimeUserDirectGrant,
	assertNotLastActiveAdmin,
	assignRuntimeUserRole,
	removeRuntimeUserDirectGrant,
	revokeRuntimeUserRole,
} from "../src/runtime-actions-access";
import { makeDb } from "./helpers/make-db.js";
import { makeLocals } from "./helpers/make-locals.js";

// BDD: access runtime actions — role assignment, direct grants, last-admin safeguard
//
// Behaviour-level tests on the helpers that the four /ap-admin/actions/access-*
// endpoints call. Form-level CSRF/session/redirect plumbing is covered by
// admin-action-utils tests + Playwright admin-harness e2e.

let db: DatabaseSync;
let locals: App.Locals;
let editorRow: { id: number };
let editorRoleId: string;

beforeEach(() => {
	db = makeDb();
	locals = makeLocals(db);
	db.prepare(
		"INSERT INTO admin_users (email, password_hash, role, name, active, is_admin) VALUES (?, ?, ?, ?, ?, ?)",
	).run("admin@test.local", "hash", "admin", "Admin", 1, 1);
	db.prepare(
		"INSERT INTO admin_users (email, password_hash, role, name, active, is_admin) VALUES (?, ?, ?, ?, ?, ?)",
	).run("editor@test.local", "hash", "editor", "Editor", 1, 0);
	const repo = createAccessRepository(db as never);
	seedStarterRoles(repo);
	editorRow = db
		.prepare("SELECT id FROM admin_users WHERE email = ?")
		.get("editor@test.local") as { id: number };
	const editorRole = repo.listRoles().find((r) => r.name === "Editor");
	if (!editorRole) throw new Error("seedStarterRoles did not create Editor");
	editorRoleId = editorRole.id;
});

describe("assignRuntimeUserRole / revokeRuntimeUserRole", () => {
	it("Assigning a role attaches it to the user — listUserRoleIds reflects the change", async () => {
		const result = await assignRuntimeUserRole(locals, {
			userId: editorRow.id,
			roleId: editorRoleId,
		});
		expect(result.ok).toBe(true);
		const repo = createAccessRepository(db as never);
		expect(repo.listUserRoleIds(editorRow.id)).toContain(editorRoleId);
	});

	it("Assigning the same role twice is idempotent — INSERT OR IGNORE keeps a single row", async () => {
		await assignRuntimeUserRole(locals, {
			userId: editorRow.id,
			roleId: editorRoleId,
		});
		await assignRuntimeUserRole(locals, {
			userId: editorRow.id,
			roleId: editorRoleId,
		});
		const repo = createAccessRepository(db as never);
		expect(
			repo.listUserRoleIds(editorRow.id).filter((r) => r === editorRoleId),
		).toHaveLength(1);
	});

	it("Revoking a role detaches it — list no longer contains the role id", async () => {
		await assignRuntimeUserRole(locals, {
			userId: editorRow.id,
			roleId: editorRoleId,
		});
		const result = await revokeRuntimeUserRole(locals, {
			userId: editorRow.id,
			roleId: editorRoleId,
		});
		expect(result.ok).toBe(true);
		const repo = createAccessRepository(db as never);
		expect(repo.listUserRoleIds(editorRow.id)).not.toContain(editorRoleId);
	});
});

describe("addRuntimeUserDirectGrant / removeRuntimeUserDirectGrant", () => {
	it("Adding a direct grant creates a user policy row — countUserDirectGrants increments", async () => {
		const result = await addRuntimeUserDirectGrant(locals, {
			userId: editorRow.id,
			effect: "allow",
			action: "settings:edit",
		});
		expect(result.ok).toBe(true);
		const repo = createAccessRepository(db as never);
		expect(repo.countUserDirectGrants(editorRow.id)).toBe(1);
	});

	it("Removing a direct grant by id drops it — count returns to zero", async () => {
		const add = await addRuntimeUserDirectGrant(locals, {
			userId: editorRow.id,
			effect: "deny",
			action: "comments:moderate",
		});
		expect(add.ok).toBe(true);
		if (!add.ok) return;
		const result = await removeRuntimeUserDirectGrant(locals, {
			grantId: add.data.id,
		});
		expect(result.ok).toBe(true);
		const repo = createAccessRepository(db as never);
		expect(repo.countUserDirectGrants(editorRow.id)).toBe(0);
	});
});

describe("assertNotLastActiveAdmin", () => {
	it("Allows the operation when more than one active admin exists", async () => {
		db.prepare(
			"INSERT INTO admin_users (email, password_hash, role, name, active, is_admin) VALUES (?, ?, ?, ?, ?, ?)",
		).run("admin2@test.local", "hash", "admin", "Admin Two", 1, 1);
		const result = await assertNotLastActiveAdmin(locals, "admin@test.local");
		expect(result.ok).toBe(true);
	});

	it("Blocks the operation when exactly one active admin remains — protects break-glass access", async () => {
		const result = await assertNotLastActiveAdmin(locals, "admin@test.local");
		expect(result.ok).toBe(false);
		if (result.ok) return;
		expect(result.error).toMatch(/last/i);
	});

	it("Allows deactivating a non-admin user even when admin count is 1", async () => {
		const result = await assertNotLastActiveAdmin(locals, "editor@test.local");
		expect(result.ok).toBe(true);
	});
});
