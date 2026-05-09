import type { DatabaseSync } from "node:sqlite";
import { beforeEach, describe, expect, it } from "vitest";

import { createAccessRepository, seedStarterRoles } from "../src/access";
import {
	addRuntimeRolePolicy,
	addRuntimeUserDirectGrant,
	assertNotLastActiveAdmin,
	assignRuntimeUserRole,
	createRuntimeRole,
	deleteRuntimeRole,
	removeRuntimeRolePolicy,
	removeRuntimeUserDirectGrant,
	revokeRuntimeUserRole,
	updateRuntimeRole,
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
		"INSERT INTO admin_users (email, password_hash, name, active, is_admin) VALUES (?, ?, ?, ?, ?)",
	).run("admin@test.local", "hash", "Admin", 1, 1);
	db.prepare(
		"INSERT INTO admin_users (email, password_hash, name, active, is_admin) VALUES (?, ?, ?, ?, ?)",
	).run("editor@test.local", "hash", "Editor", 1, 0);
	const repo = createAccessRepository(db as never);
	seedStarterRoles(repo);
	editorRow = db.prepare("SELECT id FROM admin_users WHERE email = ?").get("editor@test.local") as {
		id: number;
	};
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
		expect(repo.listUserRoleIds(editorRow.id).filter((r) => r === editorRoleId)).toHaveLength(1);
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
			"INSERT INTO admin_users (email, password_hash, name, active, is_admin) VALUES (?, ?, ?, ?, ?)",
		).run("admin2@test.local", "hash", "Admin Two", 1, 1);
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

describe("createRuntimeRole / updateRuntimeRole / deleteRuntimeRole", () => {
	it("Creating a role inserts a non-system row that listRoles surfaces", async () => {
		const result = await createRuntimeRole(locals, {
			name: "Reviewer",
			description: "Approves drafts",
		});
		expect(result.ok).toBe(true);
		const repo = createAccessRepository(db as never);
		const role = repo.listRoles().find((r) => r.name === "Reviewer");
		expect(role).toBeDefined();
		expect(role?.isSystem).toBe(false);
	});

	it("Refuses to create a role with an empty name — keeps the table clean", async () => {
		const result = await createRuntimeRole(locals, { name: "  " });
		expect(result.ok).toBe(false);
	});

	it("Updating a custom role rewrites name and description in place", async () => {
		const created = await createRuntimeRole(locals, { name: "Tmp" });
		expect(created.ok).toBe(true);
		if (!created.ok) return;
		const updated = await updateRuntimeRole(locals, {
			id: created.data.id,
			name: "Renamed",
			description: "New description",
		});
		expect(updated.ok).toBe(true);
		const repo = createAccessRepository(db as never);
		const row = repo.getRole(created.data.id);
		expect(row?.name).toBe("Renamed");
		expect(row?.description).toBe("New description");
	});

	it("Refuses to delete system roles — they are managed by seedStarterRoles", async () => {
		const repo = createAccessRepository(db as never);
		db.prepare("UPDATE access_roles SET is_system = 1 WHERE name = ?").run("Editor");
		const editor = repo.listRoles().find((r) => r.name === "Editor");
		if (!editor) throw new Error("Editor role missing");
		const result = await deleteRuntimeRole(locals, { id: editor.id });
		expect(result.ok).toBe(false);
	});

	it("Deleting a custom role removes its row", async () => {
		const created = await createRuntimeRole(locals, { name: "Disposable" });
		expect(created.ok).toBe(true);
		if (!created.ok) return;
		const result = await deleteRuntimeRole(locals, { id: created.data.id });
		expect(result.ok).toBe(true);
		const repo = createAccessRepository(db as never);
		expect(repo.getRole(created.data.id)).toBeUndefined();
	});
});

describe("addRuntimeRolePolicy / removeRuntimeRolePolicy", () => {
	it("Adding a role policy inserts an access_role_policies row visible via listRolePolicies", async () => {
		const result = await addRuntimeRolePolicy(locals, {
			roleId: editorRoleId,
			effect: "allow",
			action: "posts:edit",
			priority: 10,
		});
		expect(result.ok).toBe(true);
		const repo = createAccessRepository(db as never);
		const policies = repo.listRolePolicies(editorRoleId);
		expect(policies.some((p) => p.action === "posts:edit")).toBe(true);
	});

	it("Removing a role policy by id drops it from listRolePolicies", async () => {
		const added = await addRuntimeRolePolicy(locals, {
			roleId: editorRoleId,
			effect: "deny",
			action: "settings:edit",
		});
		expect(added.ok).toBe(true);
		if (!added.ok) return;
		const result = await removeRuntimeRolePolicy(locals, {
			policyId: added.data.id,
		});
		expect(result.ok).toBe(true);
		const repo = createAccessRepository(db as never);
		expect(repo.listRolePolicies(editorRoleId).some((p) => p.id === added.data.id)).toBe(false);
	});
});
