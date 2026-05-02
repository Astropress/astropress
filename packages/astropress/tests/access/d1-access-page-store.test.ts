import { describe, expect, it } from "vitest";

import { loadAccessTabDataFromD1 } from "../../src/access/d1-access-page-store";

interface FakeStmt {
	all: () => Promise<unknown>;
	first: () => Promise<unknown>;
}

function makeDb(handlers: Record<string, () => unknown>) {
	const queries: string[] = [];
	const db = {
		prepare(q: string) {
			queries.push(q);
			const handler = Object.entries(handlers).find(([key]) => q.includes(key));
			const value = handler?.[1]();
			const stmt: FakeStmt = {
				async all() {
					return value;
				},
				async first() {
					return value;
				},
			};
			return stmt;
		},
	};
	return { db: db as never, queries };
}

describe("loadAccessTabDataFromD1", () => {
	it("returns empty maps and 0 admin count when every query returns empty results", async () => {
		const { db } = makeDb({
			access_roles: () => ({ results: [] }),
			access_user_roles: () => ({ results: [] }),
			access_user_policies: () => ({ results: [] }),
			access_role_policies: () => ({ results: [] }),
			admin_users: () => null,
		});
		const data = await loadAccessTabDataFromD1(db);
		expect(data).toEqual({
			roles: [],
			userRoleMap: {},
			userDirectGrantCounts: {},
			rolePoliciesMap: {},
			activeAdminCount: 0,
		});
	});

	it("falls back to 0 admin count when admin row exists with n=0", async () => {
		const { db } = makeDb({
			access_roles: () => ({ results: [] }),
			access_user_roles: () => ({ results: [] }),
			access_user_policies: () => ({ results: [] }),
			access_role_policies: () => ({ results: [] }),
			admin_users: () => ({ n: 0 }),
		});
		expect((await loadAccessTabDataFromD1(db)).activeAdminCount).toBe(0);
	});

	it("propagates active admin count when present", async () => {
		const { db } = makeDb({
			access_roles: () => ({ results: [] }),
			access_user_roles: () => ({ results: [] }),
			access_user_policies: () => ({ results: [] }),
			access_role_policies: () => ({ results: [] }),
			admin_users: () => ({ n: 5 }),
		});
		expect((await loadAccessTabDataFromD1(db)).activeAdminCount).toBe(5);
	});

	it("maps role rows including is_system=1 as boolean true", async () => {
		const { db } = makeDb({
			access_roles: () => ({
				results: [
					{
						id: "r1",
						name: "Editor",
						description: "Edit content",
						is_system: 1,
						created_at: "2026-05-03T00:00:00Z",
						updated_at: "2026-05-04T00:00:00Z",
					},
				],
			}),
			access_user_roles: () => ({ results: [] }),
			access_user_policies: () => ({ results: [] }),
			access_role_policies: () => ({ results: [] }),
			admin_users: () => null,
		});
		const data = await loadAccessTabDataFromD1(db);
		expect(data.roles).toEqual([
			{
				id: "r1",
				name: "Editor",
				description: "Edit content",
				isSystem: true,
				createdAt: "2026-05-03T00:00:00Z",
				updatedAt: "2026-05-04T00:00:00Z",
			},
		]);
	});

	it("treats is_system=0 as boolean false (only ===1 is true)", async () => {
		const { db } = makeDb({
			access_roles: () => ({
				results: [
					{
						id: "r2",
						name: "Custom",
						description: "",
						is_system: 0,
						created_at: "T",
						updated_at: "T",
					},
				],
			}),
			access_user_roles: () => ({ results: [] }),
			access_user_policies: () => ({ results: [] }),
			access_role_policies: () => ({ results: [] }),
			admin_users: () => null,
		});
		expect((await loadAccessTabDataFromD1(db)).roles[0]?.isSystem).toBe(false);
	});

	it("treats is_system=2 as boolean false too (strict equality)", async () => {
		const { db } = makeDb({
			access_roles: () => ({
				results: [
					{
						id: "r3",
						name: "X",
						description: "",
						is_system: 2,
						created_at: "T",
						updated_at: "T",
					},
				],
			}),
			access_user_roles: () => ({ results: [] }),
			access_user_policies: () => ({ results: [] }),
			access_role_policies: () => ({ results: [] }),
			admin_users: () => null,
		});
		expect((await loadAccessTabDataFromD1(db)).roles[0]?.isSystem).toBe(false);
	});

	it("groups multiple role assignments per user_id", async () => {
		const { db } = makeDb({
			access_roles: () => ({ results: [] }),
			access_user_roles: () => ({
				results: [
					{ user_id: 1, role_id: "r1" },
					{ user_id: 1, role_id: "r2" },
					{ user_id: 2, role_id: "r1" },
				],
			}),
			access_user_policies: () => ({ results: [] }),
			access_role_policies: () => ({ results: [] }),
			admin_users: () => null,
		});
		const data = await loadAccessTabDataFromD1(db);
		expect(data.userRoleMap).toEqual({
			1: ["r1", "r2"],
			2: ["r1"],
		});
	});

	it("captures direct grant counts per user", async () => {
		const { db } = makeDb({
			access_roles: () => ({ results: [] }),
			access_user_roles: () => ({ results: [] }),
			access_user_policies: () => ({
				results: [
					{ user_id: 1, n: 3 },
					{ user_id: 2, n: 1 },
				],
			}),
			access_role_policies: () => ({ results: [] }),
			admin_users: () => null,
		});
		const data = await loadAccessTabDataFromD1(db);
		expect(data.userDirectGrantCounts).toEqual({ 1: 3, 2: 1 });
	});

	it("groups role policies and parses condition_json into Condition object", async () => {
		const { db } = makeDb({
			access_roles: () => ({ results: [] }),
			access_user_roles: () => ({ results: [] }),
			access_user_policies: () => ({ results: [] }),
			access_role_policies: () => ({
				results: [
					{
						id: "p1",
						role_id: "r1",
						effect: "allow",
						action: "read",
						condition_json: JSON.stringify({
							op: "stringEquals",
							left: "user.id",
							right: "u1",
						}),
						priority: 10,
					},
					{
						id: "p2",
						role_id: "r1",
						effect: "deny",
						action: "delete",
						condition_json: null,
						priority: 5,
					},
				],
			}),
			admin_users: () => null,
		});
		const data = await loadAccessTabDataFromD1(db);
		expect(data.rolePoliciesMap.r1).toEqual([
			{
				id: "p1",
				roleId: "r1",
				effect: "allow",
				action: "read",
				condition: { op: "stringEquals", left: "user.id", right: "u1" },
				priority: 10,
			},
			{
				id: "p2",
				roleId: "r1",
				effect: "deny",
				action: "delete",
				condition: null,
				priority: 5,
			},
		]);
	});

	it("falls back to condition=null when condition_json is invalid JSON (catches throw)", async () => {
		const { db } = makeDb({
			access_roles: () => ({ results: [] }),
			access_user_roles: () => ({ results: [] }),
			access_user_policies: () => ({ results: [] }),
			access_role_policies: () => ({
				results: [
					{
						id: "p1",
						role_id: "r1",
						effect: "allow",
						action: "read",
						condition_json: "{not-json}",
						priority: 1,
					},
				],
			}),
			admin_users: () => null,
		});
		expect(
			(await loadAccessTabDataFromD1(db)).rolePoliciesMap.r1?.[0]?.condition,
		).toBeNull();
	});

	it("issues SELECT queries against the documented tables", async () => {
		const { db, queries } = makeDb({
			access_roles: () => ({ results: [] }),
			access_user_roles: () => ({ results: [] }),
			access_user_policies: () => ({ results: [] }),
			access_role_policies: () => ({ results: [] }),
			admin_users: () => null,
		});
		await loadAccessTabDataFromD1(db);
		expect(queries.some((q) => q.includes("FROM access_roles"))).toBe(true);
		expect(queries.some((q) => q.includes("FROM access_user_roles"))).toBe(
			true,
		);
		expect(queries.some((q) => q.includes("FROM access_user_policies"))).toBe(
			true,
		);
		expect(queries.some((q) => q.includes("FROM access_role_policies"))).toBe(
			true,
		);
		expect(
			queries.some(
				(q) =>
					q.includes("FROM admin_users") &&
					q.includes("active = 1") &&
					q.includes("is_admin = 1"),
			),
		).toBe(true);
	});

	it("treats undefined results as [] (the `?? []` fallback)", async () => {
		const { db } = makeDb({
			access_roles: () => ({}),
			access_user_roles: () => ({}),
			access_user_policies: () => ({}),
			access_role_policies: () => ({}),
			admin_users: () => null,
		});
		const data = await loadAccessTabDataFromD1(db);
		// Use strict equality + key counts to pin the ArrayDeclaration mutation
		// `?? []` -> `?? ["Stryker was here"]`. The mutant would iterate over the
		// sentinel string and add an "undefined" key to each map.
		expect(data.roles).toStrictEqual([]);
		expect(data.roles.length).toBe(0);
		expect(Object.keys(data.userRoleMap)).toEqual([]);
		expect(Object.keys(data.userDirectGrantCounts)).toEqual([]);
		expect(Object.keys(data.rolePoliciesMap)).toEqual([]);
	});

	it("treats undefined adminCountRow as activeAdminCount=0 (?? 0 fallback)", async () => {
		const { db } = makeDb({
			access_roles: () => ({ results: [] }),
			access_user_roles: () => ({ results: [] }),
			access_user_policies: () => ({ results: [] }),
			access_role_policies: () => ({ results: [] }),
			admin_users: () => undefined,
		});
		expect((await loadAccessTabDataFromD1(db)).activeAdminCount).toBe(0);
	});
});
