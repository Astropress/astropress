/**
 * D1 read path for the /ap-admin/access page model. Lives here (filename
 * prefix `d1-`) so the SQL-containment arch rule keeps `.prepare()` confined
 * to the adapter layer.
 */

import type { D1DatabaseLike } from "../d1-database";
import type { RolePolicyRecord, RoleRecord } from "./repository";
import type { Condition, Effect } from "./types";

export interface AccessTabData {
	roles: RoleRecord[];
	userRoleMap: Record<number, string[]>;
	userDirectGrantCounts: Record<number, number>;
	rolePoliciesMap: Record<string, RolePolicyRecord[]>;
	activeAdminCount: number;
}

export async function loadAccessTabDataFromD1(
	db: D1DatabaseLike,
): Promise<AccessTabData> {
	const [
		roleRows,
		assignmentRows,
		grantCountRows,
		rolePolicyRows,
		adminCountRow,
	] = await Promise.all([
		db
			.prepare(
				"SELECT id, name, description, is_system, created_at, updated_at FROM access_roles ORDER BY name",
			)
			.all<{
				id: string;
				name: string;
				description: string;
				is_system: number;
				created_at: string;
				updated_at: string;
			}>(),
		db
			.prepare("SELECT user_id, role_id FROM access_user_roles")
			.all<{ user_id: number; role_id: string }>(),
		db
			.prepare(
				"SELECT user_id, COUNT(*) AS n FROM access_user_policies GROUP BY user_id",
			)
			.all<{ user_id: number; n: number }>(),
		db
			.prepare(
				"SELECT id, role_id, effect, action, condition_json, priority FROM access_role_policies ORDER BY role_id, priority DESC, id",
			)
			.all<{
				id: string;
				role_id: string;
				effect: Effect;
				action: string;
				condition_json: string | null;
				priority: number;
			}>(),
		db
			.prepare(
				"SELECT COUNT(*) AS n FROM admin_users WHERE active = 1 AND is_admin = 1",
			)
			.first<{ n: number }>(),
	]);

	const roles: RoleRecord[] = (roleRows.results ?? []).map((r) => ({
		id: r.id,
		name: r.name,
		description: r.description,
		isSystem: r.is_system === 1,
		createdAt: r.created_at,
		updatedAt: r.updated_at,
	}));

	const userRoleMap: Record<number, string[]> = {};
	for (const row of assignmentRows.results ?? []) {
		const list = userRoleMap[row.user_id] ?? [];
		list.push(row.role_id);
		userRoleMap[row.user_id] = list;
	}

	const userDirectGrantCounts: Record<number, number> = {};
	for (const row of grantCountRows.results ?? []) {
		userDirectGrantCounts[row.user_id] = row.n;
	}

	const rolePoliciesMap: Record<string, RolePolicyRecord[]> = {};
	for (const row of rolePolicyRows.results ?? []) {
		const list = rolePoliciesMap[row.role_id] ?? [];
		let condition: Condition | null = null;
		if (row.condition_json) {
			try {
				condition = JSON.parse(row.condition_json) as Condition;
			} catch {
				condition = null;
			}
		}
		list.push({
			id: row.id,
			roleId: row.role_id,
			effect: row.effect,
			action: row.action,
			condition,
			priority: row.priority,
		});
		rolePoliciesMap[row.role_id] = list;
	}

	return {
		roles,
		userRoleMap,
		userDirectGrantCounts,
		rolePoliciesMap,
		activeAdminCount: adminCountRow?.n ?? 0,
	};
}
