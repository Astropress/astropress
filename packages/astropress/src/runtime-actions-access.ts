/**
 * Runtime helpers backing the /ap-admin/access form actions.
 *
 * Each helper dispatches via `withLocalStoreFallback` to either raw async D1
 * SQL (production) or the sync local sqlite store (dev/test). All writes
 * return `ActionResult<T>` so callers can short-circuit through the
 * `withAdminFormAction` redirect-on-failure flow.
 *
 * Last-admin safeguard: any operation that could lower the active admin
 * count must call `assertNotLastActiveAdmin(locals, targetEmail)` first.
 * The helper inspects `admin_users.is_admin AND active` on the target row
 * and refuses when removing them would leave zero break-glass admins.
 */

import { randomUUID } from "node:crypto";
import type {
	RolePolicyRecord,
	RoleRecord,
	UserPolicyRecord,
} from "./access/index";
import type { Condition, Effect } from "./access/index";
import { getAdminDb, withLocalStoreFallback } from "./admin-store-dispatch";
import type { D1DatabaseLike } from "./d1-database";
import type { ActionResult } from "./platform-contracts";

interface AssignRoleInput {
	userId: number;
	roleId: string;
	grantedBy?: string;
}

interface DirectGrantInput {
	userId: number;
	effect: Effect;
	action: string;
	condition?: Condition | null;
	priority?: number;
	grantedBy?: string;
}

export async function assignRuntimeUserRole(
	locals: App.Locals | null | undefined,
	input: AssignRoleInput,
): Promise<ActionResult<{ userId: number; roleId: string }>> {
	return withLocalStoreFallback<
		ActionResult<{ userId: number; roleId: string }>
	>(
		locals,
		async (db) => {
			await db
				.prepare(
					"INSERT OR IGNORE INTO access_user_roles (user_id, role_id, granted_by) VALUES (?, ?, ?)",
				)
				.bind(input.userId, input.roleId, input.grantedBy ?? null)
				.run();
			return {
				ok: true as const,
				data: { userId: input.userId, roleId: input.roleId },
			};
		},
		async () => ({
			ok: false as const,
			error:
				"Local admin store does not yet expose access role assignment. Wire the access surface to enable role management in dev.",
		}),
	);
}

export async function revokeRuntimeUserRole(
	locals: App.Locals | null | undefined,
	input: { userId: number; roleId: string },
): Promise<ActionResult<{ userId: number; roleId: string }>> {
	return withLocalStoreFallback<
		ActionResult<{ userId: number; roleId: string }>
	>(
		locals,
		async (db) => {
			await db
				.prepare(
					"DELETE FROM access_user_roles WHERE user_id = ? AND role_id = ?",
				)
				.bind(input.userId, input.roleId)
				.run();
			return {
				ok: true as const,
				data: { userId: input.userId, roleId: input.roleId },
			};
		},
		async () => ({
			ok: false as const,
			error:
				"Local admin store does not yet expose access role assignment. Wire the access surface to enable role management in dev.",
		}),
	);
}

export async function addRuntimeUserDirectGrant(
	locals: App.Locals | null | undefined,
	input: DirectGrantInput,
): Promise<ActionResult<UserPolicyRecord>> {
	const id = randomUUID();
	const conditionJson = input.condition
		? JSON.stringify(input.condition)
		: null;
	const priority = input.priority ?? 0;
	return withLocalStoreFallback<ActionResult<UserPolicyRecord>>(
		locals,
		async (db) => {
			await db
				.prepare(
					"INSERT INTO access_user_policies (id, user_id, effect, action, condition_json, priority, granted_by) VALUES (?, ?, ?, ?, ?, ?, ?)",
				)
				.bind(
					id,
					input.userId,
					input.effect,
					input.action,
					conditionJson,
					priority,
					input.grantedBy ?? null,
				)
				.run();
			return {
				ok: true as const,
				data: {
					id,
					userId: input.userId,
					effect: input.effect,
					action: input.action,
					condition: input.condition ?? null,
					priority,
					grantedBy: input.grantedBy ?? null,
				},
			};
		},
		async () => ({
			ok: false as const,
			error: "Local admin store does not yet expose direct user grants.",
		}),
	);
}

export async function removeRuntimeUserDirectGrant(
	locals: App.Locals | null | undefined,
	input: { grantId: string },
): Promise<ActionResult<{ id: string }>> {
	return withLocalStoreFallback<ActionResult<{ id: string }>>(
		locals,
		async (db) => {
			await db
				.prepare("DELETE FROM access_user_policies WHERE id = ?")
				.bind(input.grantId)
				.run();
			return { ok: true as const, data: { id: input.grantId } };
		},
		async () => ({
			ok: false as const,
			error: "Local admin store does not yet expose direct user grants.",
		}),
	);
}

/**
 * Refuses any operation that would leave zero active admins. Inspects the
 * target user's is_admin flag and the system-wide active admin count.
 *
 * Returns ok when the operation is safe (target is not an admin, or there
 * is at least one other active admin).
 */
export async function assertNotLastActiveAdmin(
	locals: App.Locals | null | undefined,
	targetEmail: string,
): Promise<ActionResult<void>> {
	const db = getAdminDb(locals);
	if (!db) {
		return {
			ok: false as const,
			error:
				"Cannot evaluate the last-admin safeguard without a database binding.",
		};
	}
	return checkLastAdminAgainstD1(db, targetEmail);
}

async function checkLastAdminAgainstD1(
	db: D1DatabaseLike,
	targetEmail: string,
): Promise<ActionResult<void>> {
	const targetRow = await db
		.prepare("SELECT is_admin, active FROM admin_users WHERE email = ? LIMIT 1")
		.bind(targetEmail)
		.first<{ is_admin: number; active: number }>();
	if (!targetRow) return { ok: true as const, data: undefined };
	if (targetRow.is_admin !== 1) return { ok: true as const, data: undefined };

	const countRow = await db
		.prepare(
			"SELECT COUNT(*) AS n FROM admin_users WHERE active = 1 AND is_admin = 1",
		)
		.first<{ n: number }>();
	const count = countRow?.n ?? 0;
	if (count <= 1) {
		return {
			ok: false as const,
			error:
				"Cannot remove the last active admin — at least one break-glass admin must remain.",
		};
	}
	return { ok: true as const, data: undefined };
}

// ─── Role CRUD ───────────────────────────────────────────────────────────────

export async function createRuntimeRole(
	locals: App.Locals | null | undefined,
	input: { name: string; description?: string },
): Promise<ActionResult<RoleRecord>> {
	const trimmedName = input.name.trim();
	if (!trimmedName) {
		return { ok: false as const, error: "Role name is required." };
	}
	const id = randomUUID();
	const description = (input.description ?? "").trim();
	const now = new Date().toISOString();
	return withLocalStoreFallback<ActionResult<RoleRecord>>(
		locals,
		async (db) => {
			await db
				.prepare(
					"INSERT INTO access_roles (id, name, description, is_system, created_at, updated_at) VALUES (?, ?, ?, 0, ?, ?)",
				)
				.bind(id, trimmedName, description, now, now)
				.run();
			return {
				ok: true as const,
				data: {
					id,
					name: trimmedName,
					description,
					isSystem: false,
					createdAt: now,
					updatedAt: now,
				},
			};
		},
		async () => ({
			ok: false as const,
			error: "Local admin store does not yet expose role management.",
		}),
	);
}

export async function updateRuntimeRole(
	locals: App.Locals | null | undefined,
	input: { id: string; name?: string; description?: string },
): Promise<ActionResult<{ id: string }>> {
	const trimmedName = input.name?.trim();
	const description = input.description?.trim();
	if (trimmedName !== undefined && trimmedName === "") {
		return { ok: false as const, error: "Role name cannot be empty." };
	}
	const now = new Date().toISOString();
	return withLocalStoreFallback<ActionResult<{ id: string }>>(
		locals,
		async (db) => {
			if (trimmedName !== undefined) {
				await db
					.prepare(
						"UPDATE access_roles SET name = ?, updated_at = ? WHERE id = ? AND is_system = 0",
					)
					.bind(trimmedName, now, input.id)
					.run();
			}
			if (description !== undefined) {
				await db
					.prepare(
						"UPDATE access_roles SET description = ?, updated_at = ? WHERE id = ?",
					)
					.bind(description, now, input.id)
					.run();
			}
			return { ok: true as const, data: { id: input.id } };
		},
		async () => ({
			ok: false as const,
			error: "Local admin store does not yet expose role management.",
		}),
	);
}

export async function deleteRuntimeRole(
	locals: App.Locals | null | undefined,
	input: { id: string },
): Promise<ActionResult<{ id: string }>> {
	return withLocalStoreFallback<ActionResult<{ id: string }>>(
		locals,
		async (db) => {
			const row = await db
				.prepare("SELECT is_system FROM access_roles WHERE id = ?")
				.bind(input.id)
				.first<{ is_system: number }>();
			if (row && row.is_system === 1) {
				return {
					ok: false as const,
					error: "System roles cannot be deleted.",
				};
			}
			await db
				.prepare("DELETE FROM access_roles WHERE id = ? AND is_system = 0")
				.bind(input.id)
				.run();
			return { ok: true as const, data: { id: input.id } };
		},
		async () => ({
			ok: false as const,
			error: "Local admin store does not yet expose role management.",
		}),
	);
}

export async function addRuntimeRolePolicy(
	locals: App.Locals | null | undefined,
	input: {
		roleId: string;
		effect: Effect;
		action: string;
		condition?: Condition | null;
		priority?: number;
	},
): Promise<ActionResult<RolePolicyRecord>> {
	const id = randomUUID();
	const conditionJson = input.condition
		? JSON.stringify(input.condition)
		: null;
	const priority = input.priority ?? 0;
	return withLocalStoreFallback<ActionResult<RolePolicyRecord>>(
		locals,
		async (db) => {
			await db
				.prepare(
					"INSERT INTO access_role_policies (id, role_id, effect, action, condition_json, priority) VALUES (?, ?, ?, ?, ?, ?)",
				)
				.bind(
					id,
					input.roleId,
					input.effect,
					input.action,
					conditionJson,
					priority,
				)
				.run();
			return {
				ok: true as const,
				data: {
					id,
					roleId: input.roleId,
					effect: input.effect,
					action: input.action,
					condition: input.condition ?? null,
					priority,
				},
			};
		},
		async () => ({
			ok: false as const,
			error: "Local admin store does not yet expose role management.",
		}),
	);
}

export async function removeRuntimeRolePolicy(
	locals: App.Locals | null | undefined,
	input: { policyId: string },
): Promise<ActionResult<{ id: string }>> {
	return withLocalStoreFallback<ActionResult<{ id: string }>>(
		locals,
		async (db) => {
			await db
				.prepare("DELETE FROM access_role_policies WHERE id = ?")
				.bind(input.policyId)
				.run();
			return { ok: true as const, data: { id: input.policyId } };
		},
		async () => ({
			ok: false as const,
			error: "Local admin store does not yet expose role management.",
		}),
	);
}
