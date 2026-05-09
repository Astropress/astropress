import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { beforeEach, describe, expect, test } from "vitest";
import type { LocalAccessStoreSurface } from "../src/access";
import { createAccessRepository, getAccessContext, seedStarterRoles } from "../src/access";
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

async function makeDb(): Promise<DbHandle> {
	const DbClass = await loadSqliteDatabase();
	const db = new DbClass(":memory:");
	db.exec(SCHEMA);
	return db as unknown as DbHandle;
}

function buildLocalSurface(db: DbHandle): LocalAccessStoreSurface {
	const repo = createAccessRepository(db as never);
	return {
		resolveAccessSnapshotByEmail(email) {
			const row = db
				.prepare("SELECT id, is_admin FROM admin_users WHERE email = ? AND active = 1 LIMIT 1")
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

function makeLocalsFromStore(
	storeOverrides: Partial<{ access: LocalAccessStoreSurface }>,
	adminUser: { email: string; role: "admin" | "editor"; name: string },
): App.Locals {
	const localStore = { ...storeOverrides };
	return {
		adminUser,
		__testLocalStore: localStore,
	} as unknown as App.Locals;
}

// Stub the local-runtime-modules loader so getAccessContext's local fallback
// receives our in-memory store instead of throwing.
import { vi } from "vitest";

vi.mock("../src/local-runtime-modules", async (orig) => {
	const original = await orig<typeof import("../src/local-runtime-modules")>();
	return {
		...original,
		loadLocalAdminStore: async () => currentStore as never,
	};
});

let currentStore: { access?: LocalAccessStoreSurface } = {};

describe("getAccessContext (local sqlite path)", () => {
	let db: DbHandle;
	beforeEach(async () => {
		db = await makeDb();
		db.prepare(
			"INSERT INTO admin_users (email, password_hash, name, is_admin) VALUES (?, 'h', 'Admin', 1)",
		).run("admin@example.com");
		db.prepare(
			"INSERT INTO admin_users (email, password_hash, name, is_admin) VALUES (?, 'h', 'Editor', 0)",
		).run("editor@example.com");
		const repo = createAccessRepository(db as never);
		seedStarterRoles(repo);
		const editor = repo.listRoles().find((r) => r.name === "Editor");
		if (!editor) throw new Error("seedStarterRoles did not create Editor");
		const editorRow = db
			.prepare("SELECT id FROM admin_users WHERE email = ?")
			.get<{ id: number }>("editor@example.com");
		if (!editorRow) throw new Error("editor user fixture missing");
		repo.assignRole({ userId: editorRow.id, roleId: editor.id });
		currentStore = { access: buildLocalSurface(db) };
	});

	test("admin subject bypasses policy evaluation", async () => {
		const locals = makeLocalsFromStore(currentStore, {
			email: "admin@example.com",
			role: "admin",
			name: "Admin",
		});
		const ctx = await getAccessContext({ locals });
		if (!ctx) throw new Error("expected access context");
		expect(ctx.subject.isAdmin).toBe(true);
		expect(ctx.can("anything:weird").decision).toBe("allow");
	});

	test("editor subject gets allowed posts:list via seeded role", async () => {
		const locals = makeLocalsFromStore(currentStore, {
			email: "editor@example.com",
			role: "editor",
			name: "Editor",
		});
		const ctx = await getAccessContext({ locals });
		if (!ctx) throw new Error("expected access context");
		expect(ctx.subject.isAdmin).toBe(false);
		expect(ctx.can("media:upload").decision).toBe("allow");
		expect(ctx.can("users:invite").decision).toBe("deny");
	});

	test("returns null when no admin user is on locals", async () => {
		const locals = { runtime: { env: {} } } as unknown as App.Locals;
		const ctx = await getAccessContext({ locals });
		expect(ctx).toBeNull();
	});

	test("caches the resolved context across calls", async () => {
		const locals = makeLocalsFromStore(currentStore, {
			email: "editor@example.com",
			role: "editor",
			name: "Editor",
		});
		const a = await getAccessContext({ locals });
		const b = await getAccessContext({ locals });
		expect(a).toBe(b);
	});
});
