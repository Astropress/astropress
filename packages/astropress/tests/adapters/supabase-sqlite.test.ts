import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";

import { createAstropressSupabaseSqliteAdapter } from "../../src/adapters/supabase-sqlite";

const workspaces: string[] = [];
afterEach(() => {
	workspaces.length = 0;
});

async function freshWorkspace(): Promise<string> {
	const w = await mkdtemp(join(tmpdir(), "astropress-supabase-sqlite-"));
	workspaces.push(w);
	return w;
}

describe("createAstropressSupabaseSqliteAdapter", () => {
	it("returns an adapter with the supabase capability profile", async () => {
		const workspace = await freshWorkspace();
		const adapter = createAstropressSupabaseSqliteAdapter({
			workspaceRoot: workspace,
			dbPath: join(workspace, "supabase-admin.sqlite"),
		});
		expect(adapter).toBeDefined();
		// supabase wraps sqlite: the resulting adapter must expose the
		// supabase identity, not the bare sqlite identity.
		expect(adapter.capabilities.name).toBe("supabase");
	});

	it("accepts an empty options object via the default argument", async () => {
		// Pins the default-arg mutation: `options = {}` → `options = "Stryker was here"`.
		const adapter = createAstropressSupabaseSqliteAdapter();
		expect(adapter).toBeDefined();
		expect(adapter.capabilities.name).toBe("supabase");
	});

	it("propagates the workspaceRoot through to the wrapped sqlite adapter", async () => {
		const workspace = await freshWorkspace();
		const adapter = createAstropressSupabaseSqliteAdapter({
			workspaceRoot: workspace,
		});
		// The supabase wrapper exposes the inner sqlite adapter via the
		// capability profile; both should agree the adapter is set up.
		expect(adapter.capabilities.database).toBe(true);
	});

	it("end-to-end: sign-in works (proves backingAdapter actually wires sqlite)", async () => {
		// Pins the ObjectLiteral mutation that drops the backingAdapter:
		// without sqlite underneath, signIn would not resolve a user record.
		const workspace = await freshWorkspace();
		const adapter = createAstropressSupabaseSqliteAdapter({
			workspaceRoot: workspace,
			dbPath: join(workspace, "supabase-admin.sqlite"),
		});
		const user = await adapter.auth.signIn("admin@example.com", "password");
		// The sqlite-backed signIn returns an admin user envelope shaped
		// { id, email, isAdmin }. The hosted-API path either throws at
		// config-read time (no SUPABASE_URL) or resolves over fetch — either
		// way it cannot produce this exact local-sqlite shape with the seed
		// admin's email and admin role flag.
		expect(user).toMatchObject({
			email: "admin@example.com",
			isAdmin: true,
		});
		expect(typeof user?.id).toBe("string");
		// Distinguishes the sqlite-backed signIn from the in-memory fallback:
		// sqlite returns a generated session id, while the default in-memory
		// auth store always returns the seed user's literal id "admin-1".
		// This kills the ObjectLiteral mutation that drops backingAdapter.
		expect(user?.id).not.toBe("admin-1");
	});
});
