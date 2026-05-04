/**
 * Storage layer for the ABAC access control system.
 *
 * Decoupled from any specific SQLite driver: the repository accepts a
 * minimal `AccessStore` interface so D1, better-sqlite3, and the in-memory
 * test adapter can all back it. The shape mirrors how content/auth
 * repositories are wired in this codebase.
 *
 * The repository is the only module that knows the DB schema for
 * access_roles / access_role_policies / access_user_roles /
 * access_user_policies / access_user_attributes. Higher layers — the
 * policy engine, the per-request loader, the admin UI — talk to it
 * through these typed methods.
 */

import { randomUUID } from "node:crypto";
import type { AttributeValue, Condition, Effect, Policy } from "./types";

export interface RoleRecord {
	id: string;
	name: string;
	description: string;
	isSystem: boolean;
	createdAt: string;
	updatedAt: string;
}

export interface RolePolicyRecord {
	id: string;
	roleId: string;
	effect: Effect;
	action: string;
	condition: Condition | null;
	priority: number;
}

export interface UserPolicyRecord {
	id: string;
	userId: number;
	effect: Effect;
	action: string;
	condition: Condition | null;
	priority: number;
	grantedBy: string | null;
}

export interface UserRoleAssignment {
	userId: number;
	roleId: string;
	grantedAt: string;
	grantedBy: string | null;
}

/**
 * Minimal SQL surface this repository depends on. Keeps the module portable
 * across better-sqlite3 / D1-bound / in-memory test stubs.
 */
export interface AccessStore {
	exec(sql: string): void;
	prepare(sql: string): {
		// audit-boundary: opaque-passthrough -- mirrors driver bind-arg shape
		all<T = unknown>(...params: unknown[]): T[];
		// audit-boundary: opaque-passthrough -- mirrors driver bind-arg shape
		get<T = unknown>(...params: unknown[]): T | undefined;
		// audit-boundary: opaque-passthrough -- mirrors driver bind-arg shape
		run(...params: unknown[]): { changes: number };
	};
}

export function createAccessRepository(store: AccessStore) {
	return {
		// ─── Roles ─────────────────────────────────────────────────────────
		listRoles(): RoleRecord[] {
			return store
				.prepare(
					"SELECT id, name, description, is_system, created_at, updated_at FROM access_roles ORDER BY name",
				)
				.all<RoleRow>()
				.map(rowToRole);
		},
		getRole(id: string): RoleRecord | undefined {
			const row = store
				.prepare(
					"SELECT id, name, description, is_system, created_at, updated_at FROM access_roles WHERE id = ?",
				)
				.get<RoleRow>(id);
			return row ? rowToRole(row) : undefined;
		},
		createRole(input: { name: string; description?: string }): RoleRecord {
			const id = randomUUID();
			const now = nowIso();
			store
				.prepare(
					"INSERT INTO access_roles (id, name, description, is_system, created_at, updated_at) VALUES (?, ?, ?, 0, ?, ?)",
				)
				.run(id, input.name, input.description ?? "", now, now);
			return {
				id,
				name: input.name,
				description: input.description ?? "",
				isSystem: false,
				createdAt: now,
				updatedAt: now,
			};
		},
		updateRole(
			id: string,
			input: { name?: string; description?: string },
		): void {
			const now = nowIso();
			const sets: string[] = [];
			// audit-boundary: opaque-passthrough -- variadic SQL bind args
			const args: unknown[] = [];
			if (input.name !== undefined) {
				sets.push("name = ?");
				args.push(input.name);
			}
			if (input.description !== undefined) {
				sets.push("description = ?");
				args.push(input.description);
			}
			if (sets.length === 0) return;
			sets.push("updated_at = ?");
			args.push(now, id);
			store
				.prepare(`UPDATE access_roles SET ${sets.join(", ")} WHERE id = ?`)
				.run(...args);
		},
		deleteRole(id: string): void {
			// CASCADE handles role_policies + user_roles.
			store.prepare("DELETE FROM access_roles WHERE id = ?").run(id);
		},

		// ─── Role policies ─────────────────────────────────────────────────
		listRolePolicies(roleId: string): RolePolicyRecord[] {
			return store
				.prepare(
					"SELECT id, role_id, effect, action, condition_json, priority FROM access_role_policies WHERE role_id = ? ORDER BY priority DESC, id",
				)
				.all<RolePolicyRow>(roleId)
				.map(rowToRolePolicy);
		},
		addRolePolicy(input: {
			roleId: string;
			effect: Effect;
			action: string;
			condition?: Condition | null;
			priority?: number;
		}): RolePolicyRecord {
			const id = randomUUID();
			const condJson = input.condition ? JSON.stringify(input.condition) : null;
			const priority = input.priority ?? 0;
			store
				.prepare(
					"INSERT INTO access_role_policies (id, role_id, effect, action, condition_json, priority) VALUES (?, ?, ?, ?, ?, ?)",
				)
				.run(id, input.roleId, input.effect, input.action, condJson, priority);
			return {
				id,
				roleId: input.roleId,
				effect: input.effect,
				action: input.action,
				condition: input.condition ?? null,
				priority,
			};
		},
		removeRolePolicy(id: string): void {
			store.prepare("DELETE FROM access_role_policies WHERE id = ?").run(id);
		},

		// ─── User-role assignments ─────────────────────────────────────────
		listUserRoles(userId: number): UserRoleAssignment[] {
			return store
				.prepare(
					"SELECT user_id, role_id, granted_at, granted_by FROM access_user_roles WHERE user_id = ?",
				)
				.all<UserRoleRow>(userId)
				.map(rowToUserRole);
		},
		assignRole(input: {
			userId: number;
			roleId: string;
			grantedBy?: string;
		}): void {
			store
				.prepare(
					"INSERT OR IGNORE INTO access_user_roles (user_id, role_id, granted_by) VALUES (?, ?, ?)",
				)
				.run(input.userId, input.roleId, input.grantedBy ?? null);
		},
		revokeRole(input: { userId: number; roleId: string }): void {
			store
				.prepare(
					"DELETE FROM access_user_roles WHERE user_id = ? AND role_id = ?",
				)
				.run(input.userId, input.roleId);
		},

		// ─── Direct user policies ──────────────────────────────────────────
		listUserPolicies(userId: number): UserPolicyRecord[] {
			return store
				.prepare(
					"SELECT id, user_id, effect, action, condition_json, priority, granted_by FROM access_user_policies WHERE user_id = ? ORDER BY priority DESC, id",
				)
				.all<UserPolicyRow>(userId)
				.map(rowToUserPolicy);
		},
		countUserDirectGrants(userId: number): number {
			const row = store
				.prepare(
					"SELECT COUNT(*) AS n FROM access_user_policies WHERE user_id = ?",
				)
				.get<{ n: number }>(userId);
			return row?.n ?? 0;
		},
		addUserPolicy(input: {
			userId: number;
			effect: Effect;
			action: string;
			condition?: Condition | null;
			priority?: number;
			grantedBy?: string;
		}): UserPolicyRecord {
			const id = randomUUID();
			const condJson = input.condition ? JSON.stringify(input.condition) : null;
			const priority = input.priority ?? 0;
			store
				.prepare(
					"INSERT INTO access_user_policies (id, user_id, effect, action, condition_json, priority, granted_by) VALUES (?, ?, ?, ?, ?, ?, ?)",
				)
				.run(
					id,
					input.userId,
					input.effect,
					input.action,
					condJson,
					priority,
					input.grantedBy ?? null,
				);
			return {
				id,
				userId: input.userId,
				effect: input.effect,
				action: input.action,
				condition: input.condition ?? null,
				priority,
				grantedBy: input.grantedBy ?? null,
			};
		},
		removeUserPolicy(id: string): void {
			store.prepare("DELETE FROM access_user_policies WHERE id = ?").run(id);
		},

		// ─── User attributes ───────────────────────────────────────────────
		getUserAttributes(
			userId: number,
		): Readonly<Record<string, AttributeValue>> {
			const rows = store
				.prepare(
					"SELECT key, value FROM access_user_attributes WHERE user_id = ?",
				)
				.all<{ key: string; value: string }>(userId);
			const out: Record<string, AttributeValue> = {};
			for (const r of rows) {
				out[r.key] = decodeAttribute(r.value);
			}
			return out;
		},
		setUserAttribute(input: {
			userId: number;
			key: string;
			value: AttributeValue;
		}): void {
			store
				.prepare(
					"INSERT INTO access_user_attributes (user_id, key, value) VALUES (?, ?, ?) ON CONFLICT(user_id, key) DO UPDATE SET value = excluded.value",
				)
				.run(input.userId, input.key, encodeAttribute(input.value));
		},
		deleteUserAttribute(input: { userId: number; key: string }): void {
			store
				.prepare(
					"DELETE FROM access_user_attributes WHERE user_id = ? AND key = ?",
				)
				.run(input.userId, input.key);
		},

		// ─── Subject resolution ────────────────────────────────────────────
		/**
		 * Compute the effective set of policies for a user — union of:
		 *  - all policies attached to roles the user holds
		 *  - all direct user policies
		 * Results are tagged with a `source` so audit reasons can attribute
		 * the matched policy.
		 */
		resolvePoliciesForUser(userId: number): Policy[] {
			const roleAssignments = this.listUserRoles(userId);
			const policies: Policy[] = [];
			for (const ra of roleAssignments) {
				const role = this.getRole(ra.roleId);
				const roleName = role?.name ?? ra.roleId;
				for (const rp of this.listRolePolicies(ra.roleId)) {
					policies.push({
						id: rp.id,
						effect: rp.effect,
						action: rp.action,
						condition: rp.condition ?? undefined,
						priority: rp.priority,
						source: { kind: "role", roleId: ra.roleId, roleName },
					});
				}
			}
			for (const up of this.listUserPolicies(userId)) {
				policies.push({
					id: up.id,
					effect: up.effect,
					action: up.action,
					condition: up.condition ?? undefined,
					priority: up.priority,
					source: { kind: "direct" },
				});
			}
			return policies;
		},

		listUserRoleIds(userId: number): string[] {
			return this.listUserRoles(userId).map((r) => r.roleId);
		},

		// ─── Last-admin safeguard ──────────────────────────────────────────
		countActiveAdmins(): number {
			const row = store
				.prepare(
					"SELECT COUNT(*) AS n FROM admin_users WHERE active = 1 AND is_admin = 1",
				)
				.get<{ n: number }>();
			return row?.n ?? 0;
		},
	};
}

export type AccessRepository = ReturnType<typeof createAccessRepository>;

// ─── Row mappers + attribute codec ───────────────────────────────────────

interface RoleRow {
	id: string;
	name: string;
	description: string;
	is_system: number;
	created_at: string;
	updated_at: string;
}
interface RolePolicyRow {
	id: string;
	role_id: string;
	effect: Effect;
	action: string;
	condition_json: string | null;
	priority: number;
}
interface UserPolicyRow {
	id: string;
	user_id: number;
	effect: Effect;
	action: string;
	condition_json: string | null;
	priority: number;
	granted_by: string | null;
}
interface UserRoleRow {
	user_id: number;
	role_id: string;
	granted_at: string;
	granted_by: string | null;
}

function rowToRole(r: RoleRow): RoleRecord {
	return {
		id: r.id,
		name: r.name,
		description: r.description,
		isSystem: r.is_system === 1,
		createdAt: r.created_at,
		updatedAt: r.updated_at,
	};
}
function rowToRolePolicy(r: RolePolicyRow): RolePolicyRecord {
	return {
		id: r.id,
		roleId: r.role_id,
		effect: r.effect,
		action: r.action,
		condition: r.condition_json
			? (JSON.parse(r.condition_json) as Condition)
			: null,
		priority: r.priority,
	};
}
function rowToUserPolicy(r: UserPolicyRow): UserPolicyRecord {
	return {
		id: r.id,
		userId: r.user_id,
		effect: r.effect,
		action: r.action,
		condition: r.condition_json
			? (JSON.parse(r.condition_json) as Condition)
			: null,
		priority: r.priority,
		grantedBy: r.granted_by,
	};
}
function rowToUserRole(r: UserRoleRow): UserRoleAssignment {
	return {
		userId: r.user_id,
		roleId: r.role_id,
		grantedAt: r.granted_at,
		grantedBy: r.granted_by,
	};
}

// Attributes are stored as JSON-encoded strings so the DB column stays a
// scalar TEXT regardless of value type. Decode is permissive — anything
// that fails JSON.parse is returned as the raw string.
function encodeAttribute(v: AttributeValue): string {
	return JSON.stringify(v);
}
function decodeAttribute(raw: string): AttributeValue {
	try {
		return JSON.parse(raw) as AttributeValue;
	} catch {
		return raw;
	}
}

function nowIso(): string {
	return new Date().toISOString();
}

// ─── Starter role seeding ────────────────────────────────────────────────

/**
 * Seed the four starter roles (Editor, Author, Moderator, Translator) if
 * the access_roles table is empty. Admins can rename, edit, or delete
 * them at will — they are not flagged is_system so the UI does not lock
 * them down. Idempotent: only runs when the table is empty.
 */
export function seedStarterRoles(repo: AccessRepository): void {
	if (repo.listRoles().length > 0) return;

	const editor = repo.createRole({
		name: "Editor",
		description:
			"Edits site content (pages, posts, media). Cannot delete published items or manage users / settings. Admins can rename, edit, or delete this role.",
	});
	repo.addRolePolicy({
		roleId: editor.id,
		effect: "allow",
		action: "pages:*",
	});
	repo.addRolePolicy({
		roleId: editor.id,
		effect: "deny",
		action: "pages:delete",
		priority: 100,
	});
	repo.addRolePolicy({
		roleId: editor.id,
		effect: "allow",
		action: "posts:*",
	});
	repo.addRolePolicy({
		roleId: editor.id,
		effect: "deny",
		action: "posts:delete",
		priority: 100,
	});
	repo.addRolePolicy({
		roleId: editor.id,
		effect: "allow",
		action: "media:upload",
	});
	repo.addRolePolicy({
		roleId: editor.id,
		effect: "allow",
		action: "media:list",
	});

	const author = repo.createRole({
		name: "Author",
		description:
			"Creates and edits their own posts only. Cannot edit other authors' work, manage taxonomies, or touch site structure. Admins can customize this role.",
	});
	repo.addRolePolicy({
		roleId: author.id,
		effect: "allow",
		action: "posts:list",
	});
	repo.addRolePolicy({
		roleId: author.id,
		effect: "allow",
		action: "posts:create",
	});
	repo.addRolePolicy({
		roleId: author.id,
		effect: "allow",
		action: "posts:edit",
		condition: {
			op: "stringEquals",
			left: "resource.ownerId",
			right: "${user.id}",
		},
	});
	repo.addRolePolicy({
		roleId: author.id,
		effect: "allow",
		action: "media:upload",
	});

	const moderator = repo.createRole({
		name: "Moderator",
		description:
			"Moderates comments and audience signals. No content authoring authority. Admins can customize this role.",
	});
	repo.addRolePolicy({
		roleId: moderator.id,
		effect: "allow",
		action: "comments:*",
	});

	const translator = repo.createRole({
		name: "Translator",
		description:
			"Edits localized strings only. Read-only on everything else. Admins can customize this role.",
	});
	repo.addRolePolicy({
		roleId: translator.id,
		effect: "allow",
		action: "translations:manage",
	});
}
