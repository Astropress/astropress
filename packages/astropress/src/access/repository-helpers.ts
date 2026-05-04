// Row mappers, attribute codecs, and starter role seeding for the access
// repository. Extracted from repository.ts to keep that file under the
// 400-line arch-lint warning.

import type {
	AccessRepository,
	RolePolicyRecord,
	RoleRecord,
	UserPolicyRecord,
	UserRoleAssignment,
} from "./repository";
import type { AttributeValue, Condition, Effect } from "./types";

export interface RoleRow {
	id: string;
	name: string;
	description: string;
	is_system: number;
	created_at: string;
	updated_at: string;
}
export interface RolePolicyRow {
	id: string;
	role_id: string;
	effect: Effect;
	action: string;
	condition_json: string | null;
	priority: number;
}
export interface UserPolicyRow {
	id: string;
	user_id: number;
	effect: Effect;
	action: string;
	condition_json: string | null;
	priority: number;
	granted_by: string | null;
}
export interface UserRoleRow {
	user_id: number;
	role_id: string;
	granted_at: string;
	granted_by: string | null;
}

export function rowToRole(r: RoleRow): RoleRecord {
	return {
		id: r.id,
		name: r.name,
		description: r.description,
		isSystem: r.is_system === 1,
		createdAt: r.created_at,
		updatedAt: r.updated_at,
	};
}
export function rowToRolePolicy(r: RolePolicyRow): RolePolicyRecord {
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
export function rowToUserPolicy(r: UserPolicyRow): UserPolicyRecord {
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
export function rowToUserRole(r: UserRoleRow): UserRoleAssignment {
	return {
		userId: r.user_id,
		roleId: r.role_id,
		grantedAt: r.granted_at,
		grantedBy: r.granted_by,
	};
}

export function encodeAttribute(v: AttributeValue): string {
	return JSON.stringify(v);
}
export function decodeAttribute(raw: string): AttributeValue {
	try {
		return JSON.parse(raw) as AttributeValue;
	} catch {
		return raw;
	}
}

export function nowIso(): string {
	return new Date().toISOString();
}

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
	repo.addRolePolicy({ roleId: editor.id, effect: "allow", action: "pages:*" });
	repo.addRolePolicy({
		roleId: editor.id,
		effect: "deny",
		action: "pages:delete",
		priority: 100,
	});
	repo.addRolePolicy({ roleId: editor.id, effect: "allow", action: "posts:*" });
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
