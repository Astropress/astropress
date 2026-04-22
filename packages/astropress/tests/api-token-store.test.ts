import { describe, expect, it } from "vitest";

import type {
	ApiScope,
	ApiTokenRecord,
	ApiTokenStore,
} from "../src/platform-contracts";
import { createApiTokenStore } from "../src/sqlite-runtime/api-tokens.js";
import { hashOpaqueToken } from "../src/sqlite-runtime/utils.js";
import { makeDb } from "./helpers/make-db.js";

// ─── ApiTokenRecord shape ─────────────────────────────────────────────────────

describe("ApiTokenRecord shape", () => {
	it("has all required fields", () => {
		const record: ApiTokenRecord = {
			id: "tok_01",
			label: "AI assistant",
			scopes: ["content:read"],
			createdAt: new Date().toISOString(),
		};

		expect(record.id).toBe("tok_01");
		expect(record.label).toBe("AI assistant");
		expect(record.scopes).toContain("content:read");
		expect(record.revokedAt).toBeUndefined();
	});

	it("supports all defined scopes", () => {
		const allScopes: ApiScope[] = [
			"content:read",
			"content:write",
			"media:read",
			"media:write",
			"settings:read",
			"webhooks:manage",
			"import:write",
		];
		const record: ApiTokenRecord = {
			id: "tok_02",
			label: "Full access",
			scopes: allScopes,
			createdAt: new Date().toISOString(),
		};
		expect(record.scopes).toHaveLength(7);
	});

	it("optional fields are truly optional", () => {
		const minimal: ApiTokenRecord = {
			id: "tok_03",
			label: "Minimal",
			scopes: ["settings:read"],
			createdAt: "2026-01-01T00:00:00Z",
		};
		expect(minimal.expiresAt).toBeUndefined();
		expect(minimal.lastUsedAt).toBeUndefined();
		expect(minimal.revokedAt).toBeUndefined();
	});
});

describe("ApiTokenStore SQLite implementation", () => {
	it("create: stores hashed token and returns raw token once", async () => {
		const db = makeDb();
		const store = createApiTokenStore(db);

		const { record, rawToken } = await store.create({
			label: "test",
			scopes: ["content:read"],
		});

		expect(rawToken.length).toBeGreaterThanOrEqual(32);
		expect(record.label).toBe("test");
		expect(record.scopes).toEqual(["content:read"]);
		expect(record.revokedAt).toBeNull();

		// Hash stored, not raw token
		const row = db
			.prepare("SELECT token_hash FROM api_tokens WHERE id = ?")
			.get(record.id) as { token_hash: string };
		expect(row.token_hash).toBe(hashOpaqueToken(rawToken));
		expect(row.token_hash).not.toBe(rawToken);
	});

	it("list: returns tokens without token_hash", async () => {
		const db = makeDb();
		const store = createApiTokenStore(db);
		await store.create({ label: "alpha", scopes: ["content:read"] });
		await store.create({ label: "beta", scopes: ["media:read"] });

		const tokens = await store.list();
		expect(tokens).toHaveLength(2);
		const labels = tokens.map((t) => t.label);
		expect(labels).toContain("alpha");
		expect(labels).toContain("beta");
		// No hash exposed
		for (const token of tokens) {
			expect((token as Record<string, unknown>).token_hash).toBeUndefined();
		}
	});

	it("verify: valid unrevoked token succeeds and updates lastUsedAt", async () => {
		const db = makeDb();
		const store = createApiTokenStore(db);
		const { rawToken } = await store.create({
			label: "agent",
			scopes: ["content:read"],
		});

		const result = await store.verify(rawToken);
		expect(result.valid).toBe(true);
		if (!result.valid) throw new Error("expected valid");

		expect(result.record.label).toBe("agent");
		expect(result.record.lastUsedAt).not.toBeNull();
	});

	it("verify: revoked token returns { valid: false }", async () => {
		const db = makeDb();
		const store = createApiTokenStore(db);
		const { record, rawToken } = await store.create({
			label: "short-lived",
			scopes: ["settings:read"],
		});

		await store.revoke(record.id);
		const result = await store.verify(rawToken);
		expect(result.valid).toBe(false);
	});

	it("verify: unknown token returns { valid: false }", async () => {
		const db = makeDb();
		const store = createApiTokenStore(db);
		const result = await store.verify("completely-unknown-token");
		expect(result.valid).toBe(false);
	});

	it("revoke: sets revokedAt timestamp", async () => {
		const db = makeDb();
		const store = createApiTokenStore(db);
		const { record } = await store.create({
			label: "revoke-me",
			scopes: ["content:write"],
		});

		await store.revoke(record.id);
		const tokens = await store.list();
		const revoked = tokens.find((t) => t.id === record.id);
		expect(revoked?.revokedAt).not.toBeNull();
	});

	it("list: revoked tokens still appear in list (for admin display)", async () => {
		const db = makeDb();
		const store = createApiTokenStore(db);
		const { record } = await store.create({
			label: "revocable",
			scopes: ["content:read"],
		});
		await store.revoke(record.id);

		const tokens = await store.list();
		expect(tokens.some((t) => t.id === record.id)).toBe(true);
	});
});

// Type-level smoke test: ensure the interface is structurally correct
function assertApiTokenStoreShape(store: ApiTokenStore) {
	const _create = store.create;
	const _list = store.list;
	const _verify = store.verify;
	const _revoke = store.revoke;
	return { _create, _list, _verify, _revoke };
}

// Unused reference satisfies TypeScript without needing a real implementation
void assertApiTokenStoreShape;
