import type { DatabaseSync } from "node:sqlite";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { createAccessRepository, seedStarterRoles } from "../src/access";
import * as d1AccessPageStore from "../src/access/d1-access-page-store";
import * as accessRequestContext from "../src/access/request-context";
import { type AccessPageTab, buildAccessPageModel } from "../src/admin-page-models-access";
import * as adminStoreDispatch from "../src/admin-store-dispatch";
import * as runtimePageStore from "../src/runtime-page-store";
import { makeDb } from "./helpers/make-db.js";
import { makeLocals } from "./helpers/make-locals.js";

// BDD: /ap-admin/access — three-tab Access page (Users / Roles / My Permissions)
//
// Tabs share a single page-model builder so the shell can switch tabs by
// reading ?tab=... without refetching unrelated data. Server-side guard
// is the source of truth: anything reachable here is gated by
// requiresAccess(Astro, "users:list") at the page level and per-action
// requiresAccess on each form action.

const adminUser = {
	id: "1",
	email: "admin@test.local",
	role: "admin" as const,
	isAdmin: true,
};
const editorUser = {
	id: "2",
	email: "editor@test.local",
	role: "editor" as const,
	isAdmin: false,
};

let db: DatabaseSync;
let locals: App.Locals;

beforeEach(() => {
	db = makeDb();
	locals = makeLocals(db);
	// The Access page resolves the viewer's effective permissions through
	// getAccessContext(locals), which reads locals.adminUser — exactly the
	// object access.astro passes as `user`. Wire it so the permission-gated
	// role/grant load (roles:manage / grants:manage) sees an admin viewer.
	(locals as { adminUser?: typeof adminUser }).adminUser = adminUser;
	db.prepare(
		"INSERT INTO admin_users (email, password_hash, name, active, is_admin) VALUES (?, ?, ?, ?, ?)",
	).run("admin@test.local", "hash", "Admin", 1, 1);
	db.prepare(
		"INSERT INTO admin_users (email, password_hash, name, active, is_admin) VALUES (?, ?, ?, ?, ?)",
	).run("editor@test.local", "hash", "Editor", 1, 0);
	const repo = createAccessRepository(db as never);
	seedStarterRoles(repo);
});

afterEach(() => {
	vi.restoreAllMocks();
});

describe("buildAccessPageModel", () => {
	it("returns forbidden for a subject that cannot list users — page-level users:list gate", async () => {
		// The viewer resolved from locals must lack users:list. The seeded editor
		// holds no grants, so getAccessContext denies users:list → forbidden.
		(locals as { adminUser?: typeof editorUser }).adminUser = editorUser;
		const result = await buildAccessPageModel(locals, editorUser);
		expect(result.status).toBe("forbidden");
	});

	it("returns forbidden when the user arg is null even though locals carries an admin", async () => {
		// The `if (!user)` early-return is independent of the locals-derived
		// viewer: a null caller is forbidden regardless of who is on locals.
		// beforeEach already put an admin on locals.
		const result = await buildAccessPageModel(locals, null);
		expect(result.status).toBe("forbidden");
	});

	it("loads role data for a viewer with roles:manage but NOT grants:manage — #112 (|| not &&)", async () => {
		const repo = createAccessRepository(db as never);
		const editorRow = db
			.prepare("SELECT id FROM admin_users WHERE email = ?")
			.get("editor@test.local") as { id: number };
		for (const action of ["users:list", "roles:manage"]) {
			repo.addUserPolicy({ userId: editorRow.id, effect: "allow", action });
		}
		(locals as { adminUser?: typeof editorUser }).adminUser = editorUser;

		const result = await buildAccessPageModel(locals, editorUser);
		expect(result.status).toBe("ok");
		expect(result.data.canManageRoles).toBe(true);
		expect(result.data.canManageGrants).toBe(false);
		// roles:manage alone must still load the tab data (the gate is OR, not AND).
		expect(result.data.roles.length).toBeGreaterThan(0);
	});

	it("serves a partial-permission viewer (users:list only) but withholds role/grant data — #112", async () => {
		const repo = createAccessRepository(db as never);
		const editorRow = db
			.prepare("SELECT id FROM admin_users WHERE email = ?")
			.get("editor@test.local") as { id: number };
		repo.addUserPolicy({ userId: editorRow.id, effect: "allow", action: "users:list" });
		(locals as { adminUser?: typeof editorUser }).adminUser = editorUser;

		const result = await buildAccessPageModel(locals, editorUser);
		expect(result.status).toBe("ok");
		// My permissions always loads; management surfaces stay closed + empty.
		expect(result.data.canManageRoles).toBe(false);
		expect(result.data.canManageGrants).toBe(false);
		expect(result.data.roles).toEqual([]);
		expect(result.data.rolePoliciesMap).toEqual({});
		expect(result.data.userDirectGrantCounts).toEqual({});
		expect(result.data.viewerPolicies.length).toBeGreaterThan(0);
	});

	it("loads role/grant data for a viewer holding roles:manage + grants:manage — #112", async () => {
		const repo = createAccessRepository(db as never);
		const editorRow = db
			.prepare("SELECT id FROM admin_users WHERE email = ?")
			.get("editor@test.local") as { id: number };
		for (const action of ["users:list", "roles:manage", "grants:manage"]) {
			repo.addUserPolicy({ userId: editorRow.id, effect: "allow", action });
		}
		(locals as { adminUser?: typeof editorUser }).adminUser = editorUser;

		const result = await buildAccessPageModel(locals, editorUser);
		expect(result.status).toBe("ok");
		expect(result.data.canManageRoles).toBe(true);
		expect(result.data.canManageGrants).toBe(true);
		expect(result.data.roles.length).toBeGreaterThan(0);
	});

	it("returns ok with the active tab defaulting to 'users' — users come from listAdminUsers, roles from access repo", async () => {
		const result = await buildAccessPageModel(locals, adminUser);
		expect(result.status).toBe("ok");
		expect(result.data.activeTab).toBe<AccessPageTab>("users");
		expect(result.data.users.length).toBeGreaterThanOrEqual(2);
		const seededRoleNames = result.data.roles.map((r) => r.name).sort();
		expect(seededRoleNames).toEqual(["Author", "Editor", "Moderator", "Translator"]);
	});

	it("respects the requested tab — 'roles' selects roles tab, 'my-permissions' selects perms tab", async () => {
		const r1 = await buildAccessPageModel(locals, adminUser, { tab: "roles" });
		expect(r1.data.activeTab).toBe("roles");
		const r2 = await buildAccessPageModel(locals, adminUser, {
			tab: "my-permissions",
		});
		expect(r2.data.activeTab).toBe("my-permissions");
	});

	it("falls back to 'users' for an unrecognized tab — query string is untrusted input", async () => {
		const result = await buildAccessPageModel(locals, adminUser, {
			tab: "garbage" as AccessPageTab,
		});
		expect(result.data.activeTab).toBe("users");
	});

	it("counts active admins for the last-admin safeguard — drives the demote/delete UI guard", async () => {
		const result = await buildAccessPageModel(locals, adminUser);
		expect(result.data.activeAdminCount).toBe(1);
	});

	it("returns the user→role assignment map — the Users tab renders one row of checkboxes per user", async () => {
		const repo = createAccessRepository(db as never);
		const editor = repo.listRoles().find((r) => r.name === "Editor");
		if (!editor) throw new Error("Editor role missing in seed");
		const editorRow = db
			.prepare("SELECT id FROM admin_users WHERE email = ?")
			.get("editor@test.local") as { id: number };
		repo.assignRole({ userId: editorRow.id, roleId: editor.id });

		const result = await buildAccessPageModel(locals, adminUser);
		expect(result.data.userRoleMap[editorRow.id]).toContain(editor.id);
	});

	it("flags users that hold direct grants — so the UI can badge sprawl beyond their roles", async () => {
		const repo = createAccessRepository(db as never);
		const editorRow = db
			.prepare("SELECT id FROM admin_users WHERE email = ?")
			.get("editor@test.local") as { id: number };
		repo.addUserPolicy({
			userId: editorRow.id,
			effect: "allow",
			action: "settings:edit",
		});

		const result = await buildAccessPageModel(locals, adminUser);
		expect(result.data.userDirectGrantCounts[editorRow.id]).toBe(1);
	});

	it("returns each role's policies grouped by role id — the Roles tab renders them inline", async () => {
		const repo = createAccessRepository(db as never);
		const editor = repo.listRoles().find((r) => r.name === "Editor");
		if (!editor) throw new Error("Editor role missing in seed");
		const result = await buildAccessPageModel(locals, adminUser, {
			tab: "roles",
		});
		expect(result.data.activeTab).toBe("roles");
		expect(result.data.rolePoliciesMap[editor.id]).toBeDefined();
		expect(result.data.rolePoliciesMap[editor.id]?.length ?? 0).toBeGreaterThan(0);
	});

	it("computes the active subject's effective policies for the My Permissions tab", async () => {
		const result = await buildAccessPageModel(locals, adminUser, {
			tab: "my-permissions",
		});
		expect(result.data.activeTab).toBe("my-permissions");
		// The viewer is admin — admins bypass policy evaluation, but the
		// computed list should still expose the policy snapshot for transparency.
		expect(Array.isArray(result.data.viewerPolicies)).toBe(true);
	});

	it("returns the users-unavailable warning and an empty users array when getRuntimeAdminUsers rejects", async () => {
		vi.spyOn(runtimePageStore, "getRuntimeAdminUsers").mockRejectedValueOnce(new Error("fail"));
		const result = await buildAccessPageModel(locals, adminUser);
		expect(result.warnings).toContain("User records are temporarily unavailable.");
		expect(result.data.users).toEqual([]);
	});

	it("returns the tab-data-unavailable warning and the empty fallback shape when loadAccessTabDataFromD1 rejects", async () => {
		vi.spyOn(d1AccessPageStore, "loadAccessTabDataFromD1").mockRejectedValueOnce(new Error("fail"));
		const result = await buildAccessPageModel(locals, adminUser);
		expect(result.warnings).toContain("Access role and grant data is temporarily unavailable.");
		// Every shape-key in the fallback object literal is asserted so an ObjectLiteral → {}
		// mutant on the fallback would replace these with undefined and fail.
		expect(result.data.roles).toEqual([]);
		expect(result.data.userRoleMap).toEqual({});
		expect(result.data.userDirectGrantCounts).toEqual({});
		expect(result.data.rolePoliciesMap).toEqual({});
		expect(result.data.activeAdminCount).toBe(0);
	});

	it("falls through to the local-store fallback shape when DB binding is unavailable", async () => {
		// Stub the viewer context to an admin (can() → allow) so the management
		// load runs without itself going through withLocalStoreFallback; the
		// once-mock below then targets the loadAccessTabData call specifically.
		vi.spyOn(accessRequestContext, "getAccessContext").mockResolvedValueOnce({
			subject: { id: "1", email: adminUser.email, isAdmin: true, roles: [], attributes: {} },
			engine: { policiesFor: () => [], can: () => ({ decision: "allow", reason: "" }) },
			can: () => ({ decision: "allow", reason: "" }),
		} as unknown as Awaited<ReturnType<typeof accessRequestContext.getAccessContext>>);
		// Force the dispatcher to take the onLocal path so the local-fallback arrow
		// (`async () => ({...})`) is the one that produces tabData. An ArrowFunction
		// mutant on that local fallback would return undefined and crash; the explicit
		// shape assertions below confirm the real fallback object literal is returned.
		vi.spyOn(adminStoreDispatch, "withLocalStoreFallback").mockImplementationOnce(
			async (_locals, _onD1, onLocal) =>
				onLocal(undefined as unknown as Parameters<typeof onLocal>[0]),
		);
		const result = await buildAccessPageModel(locals, adminUser);
		expect(result.status).toBe("ok");
		expect(result.data.roles).toEqual([]);
		expect(result.data.userRoleMap).toEqual({});
		expect(result.data.userDirectGrantCounts).toEqual({});
		expect(result.data.rolePoliciesMap).toEqual({});
		expect(result.data.activeAdminCount).toBe(0);
	});

	it("returns an empty viewerPolicies array when getAccessContext resolves null", async () => {
		vi.spyOn(accessRequestContext, "getAccessContext").mockResolvedValueOnce(null);
		const result = await buildAccessPageModel(locals, adminUser);
		expect(result.status).toBe("ok");
		expect(result.data.viewerPolicies).toEqual([]);
	});
});
