import type { DatabaseSync } from "node:sqlite";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { createAccessRepository, seedStarterRoles } from "../src/access";
import {
	type AccessPageTab,
	buildAccessPageModel,
} from "../src/admin-page-models-access";
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
	it("returns forbidden for non-admin subject — admin-only break-glass guard", async () => {
		const result = await buildAccessPageModel(locals, editorUser);
		expect(result.status).toBe("forbidden");
	});

	it("returns ok with the active tab defaulting to 'users' — users come from listAdminUsers, roles from access repo", async () => {
		const result = await buildAccessPageModel(locals, adminUser);
		expect(result.status).toBe("ok");
		expect(result.data.activeTab).toBe<AccessPageTab>("users");
		expect(result.data.users.length).toBeGreaterThanOrEqual(2);
		const seededRoleNames = result.data.roles.map((r) => r.name).sort();
		expect(seededRoleNames).toEqual([
			"Author",
			"Editor",
			"Moderator",
			"Translator",
		]);
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
		expect(result.data.rolePoliciesMap[editor.id]?.length ?? 0).toBeGreaterThan(
			0,
		);
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
});
