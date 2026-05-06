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
import {
	type RolePolicyRow,
	type RoleRow,
	type UserPolicyRow,
	type UserRoleRow,
	decodeAttribute,
	encodeAttribute,
	nowIso,
	rowToRole,
	rowToRolePolicy,
	rowToUserPolicy,
	rowToUserRole,
} from "./repository-helpers";
import type { AttributeValue, Condition, Effect, Policy } from "./types";

export { seedStarterRoles } from "./repository-helpers";

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

function rolesMethods(store: AccessStore) {
	return {
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
			store.prepare("DELETE FROM access_roles WHERE id = ?").run(id);
		},
	};
}

function rolePoliciesMethods(store: AccessStore) {
	return {
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
	};
}

function userRolesMethods(store: AccessStore) {
	return {
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
	};
}

function userPoliciesMethods(store: AccessStore) {
	return {
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
	};
}

function attributesMethods(store: AccessStore) {
	return {
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
	};
}

function adminCountMethods(store: AccessStore) {
	return {
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

export function createAccessRepository(store: AccessStore) {
	const roles = rolesMethods(store);
	const rolePolicies = rolePoliciesMethods(store);
	const userRoles = userRolesMethods(store);
	const userPolicies = userPoliciesMethods(store);
	const attrs = attributesMethods(store);
	const adminCount = adminCountMethods(store);

	return {
		...roles,
		...rolePolicies,
		...userRoles,
		...userPolicies,
		...attrs,
		...adminCount,

		/**
		 * Compute the effective set of policies for a user — union of:
		 *  - all policies attached to roles the user holds
		 *  - all direct user policies
		 * Results are tagged with a `source` so audit reasons can attribute
		 * the matched policy.
		 */
		resolvePoliciesForUser(userId: number): Policy[] {
			const roleAssignments = userRoles.listUserRoles(userId);
			const policies: Policy[] = [];
			for (const ra of roleAssignments) {
				const role = roles.getRole(ra.roleId);
				const roleName = role?.name ?? ra.roleId;
				for (const rp of rolePolicies.listRolePolicies(ra.roleId)) {
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
			for (const up of userPolicies.listUserPolicies(userId)) {
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
			return userRoles.listUserRoles(userId).map((r) => r.roleId);
		},
	};
}

export type AccessRepository = ReturnType<typeof createAccessRepository>;
