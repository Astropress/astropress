/**
 * D1 read path for the per-request access snapshot.
 *
 * Lives here (not in `request-context.ts`) so the SQL-containment arch
 * rule can keep .prepare() confined to the d1- and sqlite- adapter layer.
 * The repository in `repository.ts` owns sync writes against the access
 * tables; this module owns the async read path against Cloudflare D1.
 */

import type { D1DatabaseLike } from "../d1-database";
import type { AttributeValue, Condition, Effect, Policy } from "./types";

export interface AccessSnapshot {
	userId: string;
	isAdmin: boolean;
	roles: readonly string[];
	attributes: Readonly<Record<string, AttributeValue>>;
	policies: readonly Policy[];
}

export async function loadAccessSnapshotFromD1(
	db: D1DatabaseLike,
	email: string,
): Promise<AccessSnapshot | null> {
	const userRow = await db
		.prepare(
			"SELECT id, is_admin FROM admin_users WHERE email = ? AND active = 1 LIMIT 1",
		)
		.bind(email)
		.first<{ id: number; is_admin: number }>();
	if (!userRow) return null;

	const userId = userRow.id;
	const isAdmin = userRow.is_admin === 1;

	const [roleRows, attrRows, rolePolicyRows, userPolicyRows] =
		await Promise.all([
			db
				.prepare(
					"SELECT r.id, r.name FROM access_user_roles ur JOIN access_roles r ON r.id = ur.role_id WHERE ur.user_id = ?",
				)
				.bind(userId)
				.all<{ id: string; name: string }>(),
			db
				.prepare(
					"SELECT key, value FROM access_user_attributes WHERE user_id = ?",
				)
				.bind(userId)
				.all<{ key: string; value: string }>(),
			db
				.prepare(
					`SELECT rp.id, rp.role_id, rp.effect, rp.action, rp.condition_json, rp.priority, r.name AS role_name
					 FROM access_role_policies rp
					 JOIN access_user_roles ur ON ur.role_id = rp.role_id
					 JOIN access_roles r ON r.id = rp.role_id
					 WHERE ur.user_id = ?`,
				)
				.bind(userId)
				.all<RolePolicyRow>(),
			db
				.prepare(
					"SELECT id, effect, action, condition_json, priority FROM access_user_policies WHERE user_id = ?",
				)
				.bind(userId)
				.all<UserPolicyRow>(),
		]);

	const roleIds = (roleRows.results ?? []).map((r) => r.id);
	const attributes: Record<string, AttributeValue> = {};
	for (const r of attrRows.results ?? []) {
		attributes[r.key] = decodeAttribute(r.value);
	}

	const policies: Policy[] = [];
	for (const rp of rolePolicyRows.results ?? []) {
		policies.push({
			id: rp.id,
			effect: rp.effect,
			action: rp.action,
			condition: rp.condition_json
				? (JSON.parse(rp.condition_json) as Condition)
				: undefined,
			priority: rp.priority,
			source: { kind: "role", roleId: rp.role_id, roleName: rp.role_name },
		});
	}
	for (const up of userPolicyRows.results ?? []) {
		policies.push({
			id: up.id,
			effect: up.effect,
			action: up.action,
			condition: up.condition_json
				? (JSON.parse(up.condition_json) as Condition)
				: undefined,
			priority: up.priority,
			source: { kind: "direct" },
		});
	}

	return {
		userId: String(userId),
		isAdmin,
		roles: roleIds,
		attributes,
		policies,
	};
}

interface RolePolicyRow {
	id: string;
	role_id: string;
	role_name: string;
	effect: Effect;
	action: string;
	condition_json: string | null;
	priority: number;
}

interface UserPolicyRow {
	id: string;
	effect: Effect;
	action: string;
	condition_json: string | null;
	priority: number;
}

function decodeAttribute(raw: string): AttributeValue {
	try {
		return JSON.parse(raw) as AttributeValue;
	} catch {
		return raw;
	}
}
