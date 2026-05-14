/**
 * adapters/sqlite mutation pins.
 *
 * Drives createAstropressSqliteAdapter over an in-memory SQLite database
 * (injected via a stub seed toolkit) and exercises capabilities, the auth
 * flow, content get/delete, media put/delete, revisions, the health check,
 * and the lazy-seed / workspace-root wiring.
 */

import { DatabaseSync } from "node:sqlite";
import { afterEach, describe, expect, it } from "vitest";

import {
	type AstropressSqliteAdapterOptions,
	createAstropressSqliteAdapter,
} from "../../src/adapters/sqlite.js";
import { handleHealthRequest } from "../../src/runtime-health.js";
import type { AstropressSqliteSeedToolkit } from "../../src/sqlite-bootstrap.js";
import { readAstropressSqliteSchemaSql } from "../../src/sqlite-bootstrap.js";
import { makePasswordHash } from "../helpers/sqlite-admin-runtime-fixture.js";

function seedDb(): DatabaseSync {
	const db = new DatabaseSync(":memory:");
	db.exec(readAstropressSqliteSchemaSql());
	db.prepare(
		"INSERT INTO admin_users (email, password_hash, name, active, is_admin) VALUES (?, ?, ?, 1, 1)",
	).run("admin@test.local", makePasswordHash("correct-password"), "Site Admin");
	db.prepare(
		"INSERT INTO admin_users (email, password_hash, name, active, is_admin) VALUES (?, ?, ?, 1, 0)",
	).run("editor@test.local", makePasswordHash("editor-password"), "Site Editor");
	return db;
}

interface BrokenDb {
	prepare(): never;
	exec(): void;
}

function makeBrokenDb(): BrokenDb {
	return {
		prepare() {
			throw new Error("database unavailable");
		},
		exec() {},
	};
}

function makeAdapter(opts: { db?: DatabaseSync | BrokenDb; workspaceRoot?: string } = {}) {
	const db = opts.db ?? seedDb();
	let seedCalls = 0;
	let lastSeedArgs: { dbPath?: string; workspaceRoot?: string } | undefined;
	const seedToolkit = {
		getDefaultAdminDbPath: () => ":memory:",
		seedDatabase: (args: { dbPath?: string; workspaceRoot?: string }) => {
			seedCalls += 1;
			lastSeedArgs = args;
		},
		openSeedDatabase: () => db,
	} as unknown as AstropressSqliteSeedToolkit;

	const options: AstropressSqliteAdapterOptions = { seedToolkit };
	if (opts.workspaceRoot !== undefined) options.workspaceRoot = opts.workspaceRoot;

	const adapter = createAstropressSqliteAdapter(options);
	return {
		adapter,
		db,
		getSeedCalls: () => seedCalls,
		getLastSeedArgs: () => lastSeedArgs,
	};
}

afterEach(() => {
	// handleHealthRequest reads a module-level singleton; nothing to reset, but
	// keep tests from leaking open in-memory handles where possible.
});

describe("createAstropressSqliteAdapter — capabilities", () => {
	it("advertises the SQLite provider's static capability flags (kills L64-L69 BooleanLiteral)", () => {
		const { adapter } = makeAdapter();
		expect(adapter.capabilities.hostedAdmin).toBe(true);
		expect(adapter.capabilities.previewEnvironments).toBe(true);
		expect(adapter.capabilities.serverRuntime).toBe(true);
		expect(adapter.capabilities.database).toBe(true);
		expect(adapter.capabilities.objectStorage).toBe(false);
		expect(adapter.capabilities.gitSync).toBe(true);
	});
});

describe("createAstropressSqliteAdapter — lazy seed + workspace root", () => {
	it("seeds the database exactly once across multiple operations (kills L42 ConditionalExpression)", async () => {
		const { adapter, getSeedCalls } = makeAdapter();
		await adapter.content.list();
		await adapter.content.list();
		// `if (!seeded)` forced to `true` would re-run seedDatabase on every
		// ensureDatabase() call instead of just the first.
		expect(getSeedCalls()).toBe(1);
	});

	it("passes the configured workspaceRoot through to seedDatabase (kills L32 LogicalOperator ?? → &&)", async () => {
		const { adapter, getLastSeedArgs } = makeAdapter({ workspaceRoot: "/custom/workspace" });
		await adapter.content.list();
		// `options.workspaceRoot ?? process.cwd()` mutated to `&&` would forward
		// process.cwd() instead of the caller-supplied root.
		expect(getLastSeedArgs()?.workspaceRoot).toBe("/custom/workspace");
	});
});

describe("createAstropressSqliteAdapter — health check", () => {
	it("reports ok when the database answers SELECT 1 (kills L49 StringLiteral '')", async () => {
		makeAdapter();
		const response = await handleHealthRequest(new Request("https://example.com/health"));
		// Mutating "SELECT 1" to "" makes prepare() throw → status would be degraded.
		expect(response.status).toBe(200);
		expect((await response.json()).status).toBe("ok");
	});

	it("reports degraded when the database probe throws (kills L48 BlockStatement)", async () => {
		makeAdapter({ db: makeBrokenDb() });
		const response = await handleHealthRequest(new Request("https://example.com/health"));
		// Emptying the health-check callback body skips the probe entirely, so a
		// broken database would still report ok.
		expect(response.status).toBe(503);
		expect((await response.json()).status).toBe("degraded");
	});
});

describe("createAstropressSqliteAdapter — auth", () => {
	it("signs in a valid admin and reports isAdmin true", async () => {
		const { adapter } = makeAdapter();
		const session = await adapter.auth.signIn("admin@test.local", "correct-password");
		expect(session).not.toBeNull();
		expect(session?.email).toBe("admin@test.local");
		expect(session?.isAdmin).toBe(true);
	});

	it("returns null for invalid credentials (kills L74 ConditionalExpression)", async () => {
		const { adapter } = makeAdapter();
		// `if (!user) return null` forced false would call createSession(null) and throw.
		await expect(adapter.auth.signIn("admin@test.local", "wrong-password")).resolves.toBeNull();
	});

	it("marks a non-admin user's session as isAdmin false (kills L80 ConditionalExpression)", async () => {
		const { adapter } = makeAdapter();
		const session = await adapter.auth.signIn("editor@test.local", "editor-password");
		expect(session).not.toBeNull();
		// `user.role === "admin"` forced true would mark every session admin.
		expect(session?.isAdmin).toBe(false);
	});

	it("getSession reflects the session user's admin status (kills L94 ConditionalExpression)", async () => {
		const { adapter } = makeAdapter();
		const editorSession = await adapter.auth.signIn("editor@test.local", "editor-password");
		const resolved = await adapter.auth.getSession(editorSession?.id ?? "");
		expect(resolved?.email).toBe("editor@test.local");
		expect(resolved?.isAdmin).toBe(false);
	});

	it("getSession returns null for an unknown session id", async () => {
		const { adapter } = makeAdapter();
		expect(await adapter.auth.getSession("not-a-real-session")).toBeNull();
	});

	it("signOut revokes the session and records a logout audit (kills L83 BlockStatement & L86 ConditionalExpression:false)", async () => {
		const { adapter, db } = makeAdapter();
		const session = await adapter.auth.signIn("admin@test.local", "correct-password");
		await adapter.auth.signOut(session?.id ?? "");

		// Emptying signOut's body would leave the session valid.
		expect(await adapter.auth.getSession(session?.id ?? "")).toBeNull();

		// Skipping `if (user) recordLogout(user)` would leave no logout audit row.
		const audit = (db as DatabaseSync)
			.prepare("SELECT action FROM audit_events WHERE action = 'auth.logout'")
			.get() as { action: string } | undefined;
		expect(audit?.action).toBe("auth.logout");
	});

	it("signOut with an unknown session id is a no-op and does not throw (kills L86 ConditionalExpression:true)", async () => {
		const { adapter } = makeAdapter();
		// `if (user) recordLogout(user)` forced true would call recordLogout(null) and throw.
		await expect(adapter.auth.signOut("not-a-real-session")).resolves.toBeUndefined();
	});
});

describe("createAstropressSqliteAdapter — content.get", () => {
	it("resolves a record by both id and slug (kills L108 Conditional/Logical/Equality mutants)", async () => {
		const { adapter } = makeAdapter();
		const users = await adapter.content.list("user");
		const editor = users.find((u) => u.slug === "editor@test.local");
		expect(editor).toBeDefined();
		if (!editor) return;

		// id and slug differ for user records (numeric id vs email slug).
		const byId = await adapter.content.get(editor.id);
		expect(byId?.id).toBe(editor.id);
		expect(byId?.slug).toBe("editor@test.local");

		const bySlug = await adapter.content.get("editor@test.local");
		expect(bySlug?.id).toBe(editor.id);
	});

	it("trims the lookup id before resolving (kills L104 MethodExpression)", async () => {
		const { adapter } = makeAdapter();
		const padded = await adapter.content.get("  editor@test.local  ");
		// Dropping id.trim() would leave the padded string unmatched.
		expect(padded?.slug).toBe("editor@test.local");
	});

	it("returns null for an id that matches no record", async () => {
		const { adapter } = makeAdapter();
		expect(await adapter.content.get("missing-everywhere")).toBeNull();
	});
});

describe("createAstropressSqliteAdapter — content.delete", () => {
	it("is a no-op for a non-existent record and does not throw (kills L116 ConditionalExpression)", async () => {
		const { adapter } = makeAdapter();
		// `if (!existing) return` forced false would call deleteSqliteContentRecord(undefined) and throw.
		await expect(adapter.content.delete("does-not-exist")).resolves.toBeUndefined();
	});
});

describe("createAstropressSqliteAdapter — media", () => {
	it("put records the adapter actor's email as uploaded_by (kills L53 StringLiteral '')", async () => {
		const { adapter, db } = makeAdapter();
		await adapter.media.put({ id: "media-1", filename: "pic.png", mimeType: "image/png" });

		const row = (db as DatabaseSync)
			.prepare("SELECT uploaded_by FROM media_assets WHERE id = ?")
			.get("media-1") as { uploaded_by: string };
		expect(row.uploaded_by).toBe("admin@example.com");
	});

	it("delete soft-deletes the asset so media.get no longer returns it (kills L128 BlockStatement)", async () => {
		const { adapter } = makeAdapter();
		await adapter.media.put({ id: "media-2", filename: "gone.png", mimeType: "image/png" });
		expect(await adapter.media.get("media-2")).not.toBeNull();

		await adapter.media.delete("media-2");
		// Emptying the delete callback body would leave the asset visible.
		expect(await adapter.media.get("media-2")).toBeNull();
	});
});

describe("createAstropressSqliteAdapter — revisions", () => {
	it("list returns [] for a record with no revisions (kills L134 ArrayDeclaration)", async () => {
		const { adapter } = makeAdapter();
		// getContentRevisions returns null for an unknown record → `?? []`.
		expect(await adapter.revisions.list("no-such-record")).toEqual([]);
	});

	it("append then list round-trips actorId and summary (kills L139 & L140 LogicalOperator ?? → &&)", async () => {
		const { adapter } = makeAdapter();
		await adapter.content.save({
			id: "rev-page",
			kind: "page",
			slug: "rev-page",
			status: "published",
			title: "Revision Page",
			body: "body",
		});

		await adapter.revisions.append({
			id: "rev-xyz",
			recordId: "rev-page",
			snapshot: { title: "Revision Page", status: "published" },
			summary: "manual revision note",
			createdAt: new Date().toISOString(),
			actorId: "author@example.com",
		});

		const list = await adapter.revisions.list("rev-page");
		const appended = list.find((r) => r.id === "rev-xyz");
		expect(appended).toBeDefined();
		// `revision.createdBy ?? null` / `revision.revisionNote ?? null` mutated to
		// `&&` would null out both fields even though the row has values.
		expect(appended?.actorId).toBe("author@example.com");
		expect(appended?.summary).toBe("manual revision note");
	});
});
