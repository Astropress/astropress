/**
 * D1 read path for the /ap-admin/access page model. Lives here (filename
 * prefix `d1-`) so the SQL-containment arch rule keeps `.prepare()` confined
 * to the adapter layer.
 */

import type { D1DatabaseLike } from "../d1-database";
import type { RoleRecord } from "./repository";

export interface AccessTabData {
	roles: RoleRecord[];
	userRoleMap: Record<number, string[]>;
	userDirectGrantCounts: Record<number, number>;
	activeAdminCount: number;
}

export async function loadAccessTabDataFromD1(
	db: D1DatabaseLike,
): Promise<AccessTabData> {
	const [roleRows, assignmentRows, grantCountRows, adminCountRow] =
		await Promise.all([
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

	return {
		roles,
		userRoleMap,
		userDirectGrantCounts,
		activeAdminCount: adminCountRow?.n ?? 0,
	};
}
