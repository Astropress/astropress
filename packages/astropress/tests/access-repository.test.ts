import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { afterEach, beforeEach, describe, expect, test } from "vitest";
import type { AccessStore, Subject } from "../src/access";
import {
	createAccessRepository,
	createPolicyEngine,
	evaluate,
	seedStarterRoles,
} from "../src/access";
import {
	decodeAttribute,
	rowToRole,
	rowToRolePolicy,
	rowToUserPolicy,
} from "../src/access/repository-helpers";
import { loadSqliteDatabase } from "../src/sqlite-bootstrap-helpers";

const SCHEMA = readFileSync(
	fileURLToPath(new URL("../src/sqlite-schema.sql", import.meta.url)),
	"utf8",
);

let store: AccessStore;
let admin: { id: number };
let editorUser: { id: number };

beforeEach(async () => {
	const DbClass = await loadSqliteDatabase();
	const db = new DbClass(":memory:");
	db.exec(SCHEMA);
	// Two seeded users so user_id FKs pass.
	db.prepare(
		"INSERT INTO admin_users (email, password_hash, name, is_admin) VALUES (?, 'h', 'Admin', 1)",
	).run("admin@example.com");
	db.prepare(
		"INSERT INTO admin_users (email, password_hash, name, is_admin) VALUES (?, 'h', 'Editor', 0)",
	).run("editor@example.com");
	admin = db.prepare("SELECT id FROM admin_users WHERE email = ?").get("admin@example.com") as {
		id: number;
	};
	editorUser = db
		.prepare("SELECT id FROM admin_users WHERE email = ?")
		.get("editor@example.com") as { id: number };
	store = db as unknown as AccessStore;
});

afterEach(() => {
	(store as unknown as { close: () => void }).close?.();
});

function subject(overrides: Partial<Subject> = {}): Subject {
	return {
		id: String(editorUser.id),
		email: "editor@example.com",
		isAdmin: false,
		roles: [],
		attributes: {},
		...overrides,
	};
}

describe("access repository — roles + policies", () => {
	test("createRole / listRoles / updateRole / deleteRole round-trip", () => {
		const repo = createAccessRepository(store);
		const role = repo.createRole({ name: "Reviewer", description: "checks" });
		expect(role.id).toBeTruthy();
		expect(repo.listRoles().map((r) => r.name)).toContain("Reviewer");

		repo.updateRole(role.id, { description: "checks the work" });
		expect(repo.getRole(role.id)?.description).toBe("checks the work");

		repo.deleteRole(role.id);
		expect(repo.getRole(role.id)).toBeUndefined();
	});

	test("createRole defaults description to '' and isSystem to false (pins L110/L114/L115)", () => {
		const repo = createAccessRepository(store);
		const role = repo.createRole({ name: "WithoutDesc" });
		expect(role.description).toBe("");
		expect(role.isSystem).toBe(false);
		const fromDb = repo.getRole(role.id);
		expect(fromDb?.description).toBe("");
		expect(fromDb?.isSystem).toBe(false);
	});

	test("updateRole with only name applies name but not description (pins L125/L129 conditionals)", () => {
		const repo = createAccessRepository(store);
		const role = repo.createRole({ name: "BeforeRename", description: "orig" });
		repo.updateRole(role.id, { name: "AfterRename" });
		const updated = repo.getRole(role.id);
		expect(updated?.name).toBe("AfterRename");
		expect(updated?.description).toBe("orig");
	});

	test("updateRole with only description applies description but not name (pins L125/L129 conditionals)", () => {
		const repo = createAccessRepository(store);
		const role = repo.createRole({ name: "RenameMe", description: "before" });
		repo.updateRole(role.id, { description: "after" });
		const updated = repo.getRole(role.id);
		expect(updated?.name).toBe("RenameMe");
		expect(updated?.description).toBe("after");
	});

	test("updateRole with no fields is a no-op (pins L133 sets.length === 0 early return)", () => {
		const repo = createAccessRepository(store);
		const role = repo.createRole({ name: "NoChange", description: "stable" });
		const beforeUpdated = repo.getRole(role.id)?.updatedAt;
		repo.updateRole(role.id, {});
		const after = repo.getRole(role.id);
		expect(after?.name).toBe("NoChange");
		expect(after?.description).toBe("stable");
		expect(after?.updatedAt).toBe(beforeUpdated);
	});

	test("addRolePolicy / listRolePolicies persists condition JSON", () => {
		const repo = createAccessRepository(store);
		const role = repo.createRole({ name: "OwnerEditor" });
		repo.addRolePolicy({
			roleId: role.id,
			effect: "allow",
			action: "posts:edit",
			condition: {
				op: "stringEquals",
				left: "resource.ownerId",
				right: "${user.id}",
			},
			priority: 50,
		});
		const policies = repo.listRolePolicies(role.id);
		expect(policies).toHaveLength(1);
		expect(policies[0].condition?.op).toBe("stringEquals");
		expect(policies[0].priority).toBe(50);
	});

	test("deleting a role cascades its policies and assignments", () => {
		const repo = createAccessRepository(store);
		const role = repo.createRole({ name: "Temp" });
		repo.addRolePolicy({
			roleId: role.id,
			effect: "allow",
			action: "posts:list",
		});
		repo.assignRole({ userId: editorUser.id, roleId: role.id });
		expect(repo.listRolePolicies(role.id)).toHaveLength(1);
		expect(repo.listUserRoles(editorUser.id)).toHaveLength(1);

		repo.deleteRole(role.id);
		expect(repo.listRolePolicies(role.id)).toHaveLength(0);
		expect(repo.listUserRoles(editorUser.id)).toHaveLength(0);
	});
});

describe("access repository — direct user grants", () => {
	test("addUserPolicy + countUserDirectGrants reflects sprawl", () => {
		const repo = createAccessRepository(store);
		expect(repo.countUserDirectGrants(editorUser.id)).toBe(0);
		repo.addUserPolicy({
			userId: editorUser.id,
			effect: "allow",
			action: "audit:view",
			grantedBy: "admin@example.com",
		});
		expect(repo.countUserDirectGrants(editorUser.id)).toBe(1);
		const policies = repo.listUserPolicies(editorUser.id);
		expect(policies[0].action).toBe("audit:view");
		expect(policies[0].grantedBy).toBe("admin@example.com");
	});
});

describe("access repository — attributes", () => {
	test("setUserAttribute / getUserAttributes round-trip with type preservation", () => {
		const repo = createAccessRepository(store);
		repo.setUserAttribute({
			userId: editorUser.id,
			key: "team",
			value: "alpha",
		});
		repo.setUserAttribute({ userId: editorUser.id, key: "tier", value: 3 });
		repo.setUserAttribute({ userId: editorUser.id, key: "mfa", value: true });
		const attrs = repo.getUserAttributes(editorUser.id);
		expect(attrs.team).toBe("alpha");
		expect(attrs.tier).toBe(3);
		expect(attrs.mfa).toBe(true);
	});

	test("setUserAttribute upserts on conflict", () => {
		const repo = createAccessRepository(store);
		repo.setUserAttribute({
			userId: editorUser.id,
			key: "team",
			value: "alpha",
		});
		repo.setUserAttribute({
			userId: editorUser.id,
			key: "team",
			value: "beta",
		});
		expect(repo.getUserAttributes(editorUser.id).team).toBe("beta");
	});
});

describe("access repository — last-admin safeguard", () => {
	test("countActiveAdmins reports only active is_admin users", () => {
		const repo = createAccessRepository(store);
		expect(repo.countActiveAdmins()).toBe(1);
	});
});

describe("seedStarterRoles", () => {
	test("creates Editor + Author + Moderator + Translator on empty table", () => {
		const repo = createAccessRepository(store);
		seedStarterRoles(repo);
		const names = repo.listRoles().map((r) => r.name);
		expect(names).toContain("Editor");
		expect(names).toContain("Author");
		expect(names).toContain("Moderator");
		expect(names).toContain("Translator");
	});

	test("is idempotent — does not duplicate on re-run", () => {
		const repo = createAccessRepository(store);
		seedStarterRoles(repo);
		seedStarterRoles(repo);
		expect(repo.listRoles().filter((r) => r.name === "Editor")).toHaveLength(1);
	});
});

describe("repository write/delete operations", () => {
	test("removeRolePolicy deletes a role policy by id", () => {
		const repo = createAccessRepository(store);
		const role = repo.createRole({ name: "TempRole" });
		const policy = repo.addRolePolicy({
			roleId: role.id,
			effect: "allow",
			action: "post:read",
		});
		expect(repo.listRolePolicies(role.id)).toHaveLength(1);
		repo.removeRolePolicy(policy.id);
		expect(repo.listRolePolicies(role.id)).toHaveLength(0);
	});

	test("revokeRole removes a user-role assignment", () => {
		const repo = createAccessRepository(store);
		const role = repo.createRole({ name: "TempRole2" });
		repo.assignRole({ userId: editorUser.id, roleId: role.id });
		expect(repo.listUserRoles(editorUser.id)).toHaveLength(1);
		repo.revokeRole({ userId: editorUser.id, roleId: role.id });
		expect(repo.listUserRoles(editorUser.id)).toHaveLength(0);
	});

	test("removeUserPolicy deletes a user policy by id", () => {
		const repo = createAccessRepository(store);
		const policy = repo.addUserPolicy({
			userId: editorUser.id,
			effect: "allow",
			action: "post:edit",
		});
		expect(repo.listUserPolicies(editorUser.id)).toHaveLength(1);
		repo.removeUserPolicy(policy.id);
		expect(repo.listUserPolicies(editorUser.id)).toHaveLength(0);
	});

	test("deleteUserAttribute removes a single attribute", () => {
		const repo = createAccessRepository(store);
		repo.setUserAttribute({
			userId: editorUser.id,
			key: "team",
			value: "alpha",
		});
		expect(repo.getUserAttributes(editorUser.id).team).toBe("alpha");
		repo.deleteUserAttribute({ userId: editorUser.id, key: "team" });
		expect(repo.getUserAttributes(editorUser.id).team).toBeUndefined();
	});
});

describe("repository-helpers row mappers", () => {
	test("rowToRole maps is_system === 1 to isSystem true and any other number to false", () => {
		const base = {
			id: "r1",
			name: "n",
			description: "d",
			created_at: "t",
			updated_at: "t",
		};
		expect(rowToRole({ ...base, is_system: 1 }).isSystem).toBe(true);
		expect(rowToRole({ ...base, is_system: 0 }).isSystem).toBe(false);
		expect(rowToRole({ ...base, is_system: 2 }).isSystem).toBe(false);
	});

	test("decodeAttribute returns the raw string when the input is not valid JSON", () => {
		expect(decodeAttribute("not-json")).toBe("not-json");
		expect(decodeAttribute('{"unterminated":')).toBe('{"unterminated":');
	});

	test("decodeAttribute parses valid JSON values", () => {
		expect(decodeAttribute('"hello"')).toBe("hello");
		expect(decodeAttribute("42")).toBe(42);
		expect(decodeAttribute("true")).toBe(true);
	});

	test("rowToRolePolicy parses condition_json when present and returns null when absent", () => {
		const base = {
			id: "p1",
			role_id: "r1",
			effect: "allow" as const,
			action: "post:edit",
			priority: 0,
		};
		expect(
			rowToRolePolicy({
				...base,
				condition_json: '{"op":"eq","left":"a","right":"b"}',
			}).condition,
		).toEqual({ op: "eq", left: "a", right: "b" });
		expect(rowToRolePolicy({ ...base, condition_json: null }).condition).toBe(null);
	});

	test("rowToUserPolicy parses condition_json when present and returns null when absent", () => {
		const base = {
			id: "u1",
			user_id: 7,
			effect: "deny" as const,
			action: "post:delete",
			priority: 1,
			granted_by: "admin",
		};
		expect(
			rowToUserPolicy({
				...base,
				condition_json: '{"op":"eq","left":"a","right":"b"}',
			}).condition,
		).toEqual({ op: "eq", left: "a", right: "b" });
		expect(rowToUserPolicy({ ...base, condition_json: null }).condition).toBe(null);
	});
});

describe("end-to-end: repository → policy engine", () => {
	test("Author role can edit own post but not someone else's", () => {
		const repo = createAccessRepository(store);
		seedStarterRoles(repo);
		const author = repo.listRoles().find((r) => r.name === "Author");
		if (!author) throw new Error("seedStarterRoles did not create Author");
		repo.assignRole({ userId: editorUser.id, roleId: author.id });

		const engine = createPolicyEngine({
			resolvePoliciesForSubject: () => repo.resolvePoliciesForUser(editorUser.id),
		});
		const subj = subject({ id: String(editorUser.id) });
		expect(
			engine.can(subj, "posts:edit", {
				type: "post",
				ownerId: String(editorUser.id),
			}).decision,
		).toBe("allow");
		expect(
			engine.can(subj, "posts:edit", {
				type: "post",
				ownerId: "u9",
			}).decision,
		).toBe("deny");
	});

	test("Editor role allows posts:edit but denies posts:delete", () => {
		const repo = createAccessRepository(store);
		seedStarterRoles(repo);
		const editor = repo.listRoles().find((r) => r.name === "Editor");
		if (!editor) throw new Error("seedStarterRoles did not create Editor");
		repo.assignRole({ userId: editorUser.id, roleId: editor.id });

		const policies = repo.resolvePoliciesForUser(editorUser.id);
		const subj = subject({ id: String(editorUser.id) });
		expect(evaluate(subj, "posts:edit", policies).decision).toBe("allow");
		expect(evaluate(subj, "posts:delete", policies).decision).toBe("deny");
	});

	test("admin bypasses every policy", () => {
		const repo = createAccessRepository(store);
		const adminSubject: Subject = subject({
			id: String(admin.id),
			isAdmin: true,
		});
		const r = evaluate(adminSubject, "anything:goes", repo.resolvePoliciesForUser(admin.id));
		expect(r.decision).toBe("allow");
	});

	test("direct user policy stacks onto role policies", () => {
		const repo = createAccessRepository(store);
		seedStarterRoles(repo);
		const author = repo.listRoles().find((r) => r.name === "Author");
		if (!author) throw new Error("seedStarterRoles did not create Author");
		repo.assignRole({ userId: editorUser.id, roleId: author.id });
		repo.addUserPolicy({
			userId: editorUser.id,
			effect: "allow",
			action: "audit:view",
			grantedBy: "admin@example.com",
		});

		const policies = repo.resolvePoliciesForUser(editorUser.id);
		const subj = subject({ id: String(editorUser.id) });
		expect(evaluate(subj, "audit:view", policies).decision).toBe("allow");
		expect(evaluate(subj, "audit:view", policies).matchedPolicy?.source.kind).toBe("direct");
	});
});
