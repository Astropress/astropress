import type { DatabaseSync } from "node:sqlite";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { createAccessRepository, seedStarterRoles } from "../src/access";
import * as adminStoreDispatch from "../src/admin-store-dispatch";
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

function forceLocalFallback() {
	return vi
		.spyOn(adminStoreDispatch, "withLocalStoreFallback")
		.mockImplementationOnce(async (_locals, _onD1, onLocal) =>
			onLocal(undefined as unknown as Parameters<typeof onLocal>[0]),
		);
}

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

describe("local-store fallback (no DB binding)", () => {
	afterEach(() => {
		vi.restoreAllMocks();
	});

	it("assignRuntimeUserRole falls back with exact error", async () => {
		forceLocalFallback();
		const r = await assignRuntimeUserRole(locals, { userId: 1, roleId: "r1" });
		expect(r).toEqual({
			ok: false,
			error:
				"Local admin store does not yet expose access role assignment. Wire the access surface to enable role management in dev.",
		});
	});

	it("revokeRuntimeUserRole falls back with exact error", async () => {
		forceLocalFallback();
		const r = await revokeRuntimeUserRole(locals, { userId: 1, roleId: "r1" });
		expect(r).toEqual({
			ok: false,
			error:
				"Local admin store does not yet expose access role assignment. Wire the access surface to enable role management in dev.",
		});
	});

	it("addRuntimeUserDirectGrant falls back with exact error", async () => {
		forceLocalFallback();
		const r = await addRuntimeUserDirectGrant(locals, {
			userId: 1,
			effect: "allow",
			action: "a:b",
		});
		expect(r).toEqual({
			ok: false,
			error: "Local admin store does not yet expose direct user grants.",
		});
	});

	it("removeRuntimeUserDirectGrant falls back with exact error", async () => {
		forceLocalFallback();
		const r = await removeRuntimeUserDirectGrant(locals, { grantId: "x" });
		expect(r).toEqual({
			ok: false,
			error: "Local admin store does not yet expose direct user grants.",
		});
	});

	it("createRuntimeRole falls back with exact error (post empty-name guard)", async () => {
		forceLocalFallback();
		const r = await createRuntimeRole(locals, { name: "Role" });
		expect(r).toEqual({
			ok: false,
			error: "Local admin store does not yet expose role management.",
		});
	});

	it("updateRuntimeRole falls back with exact error", async () => {
		forceLocalFallback();
		const r = await updateRuntimeRole(locals, { id: "id-1", name: "Renamed" });
		expect(r).toEqual({
			ok: false,
			error: "Local admin store does not yet expose role management.",
		});
	});

	it("deleteRuntimeRole falls back with exact error", async () => {
		forceLocalFallback();
		const r = await deleteRuntimeRole(locals, { id: "id-1" });
		expect(r).toEqual({
			ok: false,
			error: "Local admin store does not yet expose role management.",
		});
	});

	it("addRuntimeRolePolicy falls back with exact error", async () => {
		forceLocalFallback();
		const r = await addRuntimeRolePolicy(locals, {
			roleId: "r1",
			effect: "allow",
			action: "a:b",
		});
		expect(r).toEqual({
			ok: false,
			error: "Local admin store does not yet expose role management.",
		});
	});

	it("removeRuntimeRolePolicy falls back with exact error", async () => {
		forceLocalFallback();
		const r = await removeRuntimeRolePolicy(locals, { policyId: "p1" });
		expect(r).toEqual({
			ok: false,
			error: "Local admin store does not yet expose role management.",
		});
	});
});

describe("assignRuntimeUserRole — data shape", () => {
	it("returns userId and roleId verbatim in result.data on success", async () => {
		const r = await assignRuntimeUserRole(locals, {
			userId: editorRow.id,
			roleId: editorRoleId,
		});
		expect(r.ok).toBe(true);
		if (!r.ok) return;
		expect(r.data).toEqual({ userId: editorRow.id, roleId: editorRoleId });
	});
});

describe("revokeRuntimeUserRole — data shape", () => {
	it("returns userId and roleId verbatim in result.data on success", async () => {
		const r = await revokeRuntimeUserRole(locals, {
			userId: editorRow.id,
			roleId: editorRoleId,
		});
		expect(r.ok).toBe(true);
		if (!r.ok) return;
		expect(r.data).toEqual({ userId: editorRow.id, roleId: editorRoleId });
	});
});

describe("addRuntimeUserDirectGrant — data shape and defaults", () => {
	it("returns the full UserPolicyRecord shape with defaults applied", async () => {
		const r = await addRuntimeUserDirectGrant(locals, {
			userId: editorRow.id,
			effect: "allow",
			action: "settings:edit",
		});
		expect(r.ok).toBe(true);
		if (!r.ok) return;
		expect(r.data).toMatchObject({
			userId: editorRow.id,
			effect: "allow",
			action: "settings:edit",
			condition: null,
			priority: 0,
			grantedBy: null,
		});
		expect(typeof r.data.id).toBe("string");
		expect(r.data.id.length).toBeGreaterThan(0);
	});

	it("threads explicit condition / priority / grantedBy into the row", async () => {
		const r = await addRuntimeUserDirectGrant(locals, {
			userId: editorRow.id,
			effect: "deny",
			action: "settings:edit",
			condition: { op: "stringEquals", left: "user.id", right: "u1" },
			priority: 7,
			grantedBy: "admin@test.local",
		});
		expect(r.ok).toBe(true);
		if (!r.ok) return;
		expect(r.data).toMatchObject({
			condition: { op: "stringEquals", left: "user.id", right: "u1" },
			priority: 7,
			grantedBy: "admin@test.local",
		});
	});
});

describe("removeRuntimeUserDirectGrant — data shape", () => {
	it("echoes the grant id back in result.data", async () => {
		const add = await addRuntimeUserDirectGrant(locals, {
			userId: editorRow.id,
			effect: "allow",
			action: "settings:edit",
		});
		expect(add.ok).toBe(true);
		if (!add.ok) return;
		const r = await removeRuntimeUserDirectGrant(locals, { grantId: add.data.id });
		expect(r.ok).toBe(true);
		if (!r.ok) return;
		expect(r.data).toEqual({ id: add.data.id });
	});
});

describe("assertNotLastActiveAdmin — boundary and error", () => {
	it("returns the exact error string when blocking the last admin", async () => {
		const r = await assertNotLastActiveAdmin(locals, "admin@test.local");
		expect(r).toEqual({
			ok: false,
			error: "Cannot remove the last active admin — at least one break-glass admin must remain.",
		});
	});

	it("emits database-binding error verbatim when locals has no DB", async () => {
		const r = await assertNotLastActiveAdmin(
			{ runtime: { env: {} } } as unknown as App.Locals,
			"anyone@test.local",
		);
		expect(r).toEqual({
			ok: false,
			error: "Cannot evaluate the last-admin safeguard without a database binding.",
		});
	});

	it("missing target email row → ok (no-op safeguard)", async () => {
		const r = await assertNotLastActiveAdmin(locals, "ghost@test.local");
		expect(r).toEqual({ ok: true, data: undefined });
	});

	it("target row exists but is_admin=0 → ok (non-admins don't count)", async () => {
		const r = await assertNotLastActiveAdmin(locals, "editor@test.local");
		expect(r).toEqual({ ok: true, data: undefined });
	});

	it("count > 1 → ok with success result", async () => {
		db.prepare(
			"INSERT INTO admin_users (email, password_hash, name, active, is_admin) VALUES (?, ?, ?, ?, ?)",
		).run("admin2@test.local", "hash", "Admin Two", 1, 1);
		const r = await assertNotLastActiveAdmin(locals, "admin@test.local");
		expect(r).toEqual({ ok: true, data: undefined });
	});
});

describe("createRuntimeRole — data shape and trim semantics", () => {
	it("returns the exact empty-name error string", async () => {
		const r = await createRuntimeRole(locals, { name: "  " });
		expect(r).toEqual({ ok: false, error: "Role name is required." });
	});

	it("trims the role name in the persisted row and response", async () => {
		const r = await createRuntimeRole(locals, { name: "  Trimmed  " });
		expect(r.ok).toBe(true);
		if (!r.ok) return;
		expect(r.data.name).toBe("Trimmed");
	});

	it("defaults description to empty string when omitted, trims when present", async () => {
		const empty = await createRuntimeRole(locals, { name: "NoDesc" });
		expect(empty.ok).toBe(true);
		if (!empty.ok) return;
		expect(empty.data.description).toBe("");

		const trimmed = await createRuntimeRole(locals, {
			name: "WithDesc",
			description: "  desc  ",
		});
		expect(trimmed.ok).toBe(true);
		if (!trimmed.ok) return;
		expect(trimmed.data.description).toBe("desc");
	});

	it("returns isSystem:false and matching timestamps on created role", async () => {
		const r = await createRuntimeRole(locals, { name: "Custom" });
		expect(r.ok).toBe(true);
		if (!r.ok) return;
		expect(r.data.isSystem).toBe(false);
		expect(r.data.createdAt).toBe(r.data.updatedAt);
	});
});

describe("updateRuntimeRole — name/description branches", () => {
	it("returns the exact empty-name error string when name is whitespace-only", async () => {
		const r = await updateRuntimeRole(locals, { id: "any", name: "   " });
		expect(r).toEqual({ ok: false, error: "Role name cannot be empty." });
	});

	it("updates only name when description is undefined", async () => {
		const created = await createRuntimeRole(locals, {
			name: "OnlyName",
			description: "orig",
		});
		expect(created.ok).toBe(true);
		if (!created.ok) return;
		const r = await updateRuntimeRole(locals, { id: created.data.id, name: "Renamed" });
		expect(r.ok).toBe(true);
		const repo = createAccessRepository(db as never);
		const row = repo.getRole(created.data.id);
		expect(row?.name).toBe("Renamed");
		expect(row?.description).toBe("orig");
	});

	it("updates only description when name is undefined", async () => {
		const created = await createRuntimeRole(locals, {
			name: "OnlyDesc",
			description: "orig",
		});
		expect(created.ok).toBe(true);
		if (!created.ok) return;
		const r = await updateRuntimeRole(locals, {
			id: created.data.id,
			description: "new-desc",
		});
		expect(r.ok).toBe(true);
		const repo = createAccessRepository(db as never);
		const row = repo.getRole(created.data.id);
		expect(row?.name).toBe("OnlyDesc");
		expect(row?.description).toBe("new-desc");
	});

	it("with neither name nor description: no-op but ok", async () => {
		const created = await createRuntimeRole(locals, {
			name: "NoOp",
			description: "orig",
		});
		expect(created.ok).toBe(true);
		if (!created.ok) return;
		const r = await updateRuntimeRole(locals, { id: created.data.id });
		expect(r).toEqual({ ok: true, data: { id: created.data.id } });
		const repo = createAccessRepository(db as never);
		const row = repo.getRole(created.data.id);
		expect(row?.name).toBe("NoOp");
		expect(row?.description).toBe("orig");
	});

	it("trims both name and description before persisting", async () => {
		const created = await createRuntimeRole(locals, { name: "Trim" });
		expect(created.ok).toBe(true);
		if (!created.ok) return;
		await updateRuntimeRole(locals, {
			id: created.data.id,
			name: "  Final  ",
			description: "  Final-desc  ",
		});
		const repo = createAccessRepository(db as never);
		const row = repo.getRole(created.data.id);
		expect(row?.name).toBe("Final");
		expect(row?.description).toBe("Final-desc");
	});
});

describe("deleteRuntimeRole — error verbiage", () => {
	it("returns the exact system-role error string when refusing", async () => {
		db.prepare("UPDATE access_roles SET is_system = 1 WHERE name = ?").run("Editor");
		const repo = createAccessRepository(db as never);
		const editor = repo.listRoles().find((r) => r.name === "Editor");
		if (!editor) throw new Error("Editor role missing");
		const r = await deleteRuntimeRole(locals, { id: editor.id });
		expect(r).toEqual({ ok: false, error: "System roles cannot be deleted." });
	});

	it("deleting unknown id is a no-op with ok:true (idempotent)", async () => {
		const r = await deleteRuntimeRole(locals, { id: "no-such-role" });
		expect(r).toEqual({ ok: true, data: { id: "no-such-role" } });
	});
});

describe("addRuntimeRolePolicy — data shape and defaults", () => {
	it("returns the full RolePolicyRecord shape with defaults applied", async () => {
		const r = await addRuntimeRolePolicy(locals, {
			roleId: editorRoleId,
			effect: "allow",
			action: "posts:edit",
		});
		expect(r.ok).toBe(true);
		if (!r.ok) return;
		expect(r.data).toMatchObject({
			roleId: editorRoleId,
			effect: "allow",
			action: "posts:edit",
			condition: null,
			priority: 0,
		});
		expect(typeof r.data.id).toBe("string");
	});

	it("threads explicit condition and priority into the row", async () => {
		const r = await addRuntimeRolePolicy(locals, {
			roleId: editorRoleId,
			effect: "deny",
			action: "comments:moderate",
			condition: { op: "bool", left: "user.isAdmin", right: true },
			priority: 50,
		});
		expect(r.ok).toBe(true);
		if (!r.ok) return;
		expect(r.data).toMatchObject({
			condition: { op: "bool", left: "user.isAdmin", right: true },
			priority: 50,
		});
	});
});

describe("removeRuntimeRolePolicy — data shape", () => {
	it("echoes the policy id back in result.data", async () => {
		const added = await addRuntimeRolePolicy(locals, {
			roleId: editorRoleId,
			effect: "allow",
			action: "a:b",
		});
		expect(added.ok).toBe(true);
		if (!added.ok) return;
		const r = await removeRuntimeRolePolicy(locals, { policyId: added.data.id });
		expect(r.ok).toBe(true);
		if (!r.ok) return;
		expect(r.data).toEqual({ id: added.data.id });
	});
});
