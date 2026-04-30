import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { beforeEach, describe, expect, test, vi } from "vitest";

import {
	createAccessRepository,
	requiresAccess,
	seedStarterRoles,
} from "../src/access";
import type { LocalAccessStoreSurface } from "../src/access";
import { loadSqliteDatabase } from "../src/sqlite-bootstrap-helpers";

const SCHEMA = readFileSync(
	fileURLToPath(new URL("../src/sqlite-schema.sql", import.meta.url)),
	"utf8",
);

interface DbHandle {
	prepare: (sql: string) => {
		all: <T = unknown>(...args: unknown[]) => T[];
		get: <T = unknown>(...args: unknown[]) => T | undefined;
		run: (...args: unknown[]) => { changes: number };
	};
	exec: (sql: string) => void;
}

let currentStore: { access?: LocalAccessStoreSurface } = {};

vi.mock("../src/local-runtime-modules", async (orig) => {
	const original = await orig<typeof import("../src/local-runtime-modules")>();
	return {
		...original,
		loadLocalAdminStore: async () => currentStore as never,
	};
});

function buildLocalSurface(db: DbHandle): LocalAccessStoreSurface {
	const repo = createAccessRepository(db as never);
	return {
		resolveAccessSnapshotByEmail(email) {
			const row = db
				.prepare(
					"SELECT id, is_admin FROM admin_users WHERE email = ? AND active = 1 LIMIT 1",
				)
				.get<{ id: number; is_admin: number }>(email);
			if (!row) return null;
			return {
				userId: String(row.id),
				isAdmin: row.is_admin === 1,
				roles: repo.listUserRoleIds(row.id),
				attributes: repo.getUserAttributes(row.id),
				policies: repo.resolvePoliciesForUser(row.id),
			};
		},
	};
}

function fakeAstro(
	adminUser: { email: string; role: "admin" | "editor"; name: string } | null,
) {
	const calls: Array<{ path: string; status?: number }> = [];
	const astro = {
		locals: { adminUser } as unknown as App.Locals,
		redirect(path: string, status?: number) {
			calls.push({ path, status });
			return new Response(null, {
				status: status ?? 302,
				headers: { Location: path },
			});
		},
	};
	return { astro, calls };
}

describe("requiresAccess", () => {
	let db: DbHandle;
	beforeEach(async () => {
		const DbClass = await loadSqliteDatabase();
		const inst = new DbClass(":memory:");
		inst.exec(SCHEMA);
		db = inst as unknown as DbHandle;
		db.prepare(
			"INSERT INTO admin_users (email, password_hash, name, is_admin) VALUES (?, 'h', 'Admin', 1)",
		).run("admin@example.com");
		db.prepare(
			"INSERT INTO admin_users (email, password_hash, name, is_admin) VALUES (?, 'h', 'Editor', 0)",
		).run("editor@example.com");
		const repo = createAccessRepository(db as never);
		seedStarterRoles(repo);
		const editor = repo.listRoles().find((r) => r.name === "Editor");
		if (!editor) throw new Error("Editor role missing");
		const editorRow = db
			.prepare("SELECT id FROM admin_users WHERE email = ?")
			.get<{ id: number }>("editor@example.com");
		if (!editorRow) throw new Error("editor fixture missing");
		repo.assignRole({ userId: editorRow.id, roleId: editor.id });
		currentStore = { access: buildLocalSurface(db) };
	});

	test("returns null and continues when subject is allowed", async () => {
		const { astro, calls } = fakeAstro({
			email: "admin@example.com",
			role: "admin",
			name: "Admin",
		});
		const result = await requiresAccess(astro, "settings:edit");
		expect(result).toBeNull();
		expect(calls).toHaveLength(0);
	});

	test("redirects with forbidden path on deny — appends the engine reason for the UI banner", async () => {
		const { astro, calls } = fakeAstro({
			email: "editor@example.com",
			role: "editor",
			name: "Editor",
		});
		const result = await requiresAccess(astro, "users:invite");
		expect(result).not.toBeNull();
		expect(calls[0]?.path).toMatch(
			/^\/ap-admin\?error=insufficient-permissions&reason=/,
		);
	});

	test("redirects to login when no admin user", async () => {
		const { astro, calls } = fakeAstro(null);
		const result = await requiresAccess(astro, "settings:edit");
		expect(result).not.toBeNull();
		expect(calls[0]?.path).toBe("/ap-admin/login");
	});

	test("respects override forbidden + login paths", async () => {
		const { astro: astro1, calls: calls1 } = fakeAstro({
			email: "editor@example.com",
			role: "editor",
			name: "Editor",
		});
		await requiresAccess(astro1, "users:invite", {
			forbiddenPath: "/ap-admin/forbidden",
		});
		expect(calls1[0]?.path).toBe("/ap-admin/forbidden");

		const { astro: astro2, calls: calls2 } = fakeAstro(null);
		await requiresAccess(astro2, "settings:edit", {
			loginPath: "/auth/login",
		});
		expect(calls2[0]?.path).toBe("/auth/login");
	});
});
