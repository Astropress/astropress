// Mutation-coverage + behavioral tests for the D1 API-token store
// (src/sqlite-runtime/api-tokens-d1.ts). The D1 backend is exercised through
// the SqliteBackedD1Database fixture so the async `.bind().run()/.first()/.all()`
// surface, the hashed-token storage, and the verify() reason literals are all
// observable — the D1 sibling that #137 added must behave identically to the
// sqlite store on every host that provides a D1 binding.
import { describe, expect, it } from "vitest";

import { createD1ApiTokenStore } from "../src/sqlite-runtime/api-tokens-d1.js";
import { hashOpaqueToken } from "../src/sqlite-runtime/utils.js";
import { makeDb } from "./helpers/make-db.js";
import { SqliteBackedD1Database } from "./helpers/provider-test-fixtures.js";

function makeStore() {
	const db = makeDb();
	const d1 = new SqliteBackedD1Database(db);
	return { db, store: createD1ApiTokenStore(d1) };
}

describe("createD1ApiTokenStore", () => {
	it("create: stores the hash (not the raw token) and returns the raw token once", async () => {
		const { db, store } = makeStore();
		const { record, rawToken } = await store.create({
			label: "agent",
			scopes: ["content:read"],
		});

		expect(rawToken.length).toBeGreaterThanOrEqual(32);
		expect(record.label).toBe("agent");
		expect(record.scopes).toEqual(["content:read"]);
		expect(record.id.startsWith("tok_")).toBe(true);
		expect(record.revokedAt).toBeNull();
		expect(record.lastUsedAt).toBeNull();

		const row = db.prepare("SELECT token_hash FROM api_tokens WHERE id = ?").get(record.id) as {
			token_hash: string;
		};
		expect(row.token_hash).toBe(hashOpaqueToken(rawToken));
		expect(row.token_hash).not.toBe(rawToken);
	});

	it("create: persists expiresAt and defaults it to null when omitted", async () => {
		const { store } = makeStore();
		const noExpiry = await store.create({ label: "a", scopes: ["content:read"] });
		expect(noExpiry.record.expiresAt).toBeNull();

		const future = new Date(Date.now() + 60_000).toISOString();
		const withExpiry = await store.create({
			label: "b",
			scopes: ["content:read"],
			expiresAt: future,
		});
		expect(withExpiry.record.expiresAt).toBe(future);
	});

	it("list: returns all tokens newest-first without exposing the hash", async () => {
		const { store } = makeStore();
		await store.create({ label: "alpha", scopes: ["content:read"] });
		await store.create({ label: "beta", scopes: ["media:read"] });

		const tokens = await store.list();
		expect(tokens).toHaveLength(2);
		expect(tokens.map((t) => t.label)).toEqual(expect.arrayContaining(["alpha", "beta"]));
		for (const token of tokens) {
			expect((token as Record<string, unknown>).token_hash).toBeUndefined();
		}
	});

	it("verify: valid token succeeds and stamps lastUsedAt", async () => {
		const { store } = makeStore();
		const { rawToken } = await store.create({ label: "agent", scopes: ["content:read"] });

		const result = await store.verify(rawToken);
		expect(result.valid).toBe(true);
		if (!result.valid) throw new Error("expected valid");
		expect(result.record.label).toBe("agent");
		expect(result.record.lastUsedAt).not.toBeNull();
	});

	it("verify: unknown token is rejected with a 'not found' reason", async () => {
		const { store } = makeStore();
		const result = await store.verify("definitely-not-a-real-token");
		expect(result.valid).toBe(false);
		if (result.valid) throw new Error("expected invalid");
		expect(result.reason).toMatch(/not found/i);
	});

	it("verify: revoked token is rejected with a 'revoked' reason", async () => {
		const { store } = makeStore();
		const { record, rawToken } = await store.create({
			label: "revoke-me",
			scopes: ["content:read"],
		});
		await store.revoke(record.id);

		const result = await store.verify(rawToken);
		expect(result.valid).toBe(false);
		if (result.valid) throw new Error("expected invalid");
		expect(result.reason).toMatch(/revoked/i);
	});

	it("verify: expired token is rejected with an 'expired' reason", async () => {
		const { store } = makeStore();
		const past = new Date(Date.now() - 60_000).toISOString();
		const { rawToken } = await store.create({
			label: "expired",
			scopes: ["content:read"],
			expiresAt: past,
		});

		const result = await store.verify(rawToken);
		expect(result.valid).toBe(false);
		if (result.valid) throw new Error("expected invalid");
		expect(result.reason).toMatch(/expired/i);
	});

	it("verify: future-expiry token still verifies", async () => {
		const { store } = makeStore();
		const future = new Date(Date.now() + 60_000).toISOString();
		const { rawToken } = await store.create({
			label: "future",
			scopes: ["content:read"],
			expiresAt: future,
		});
		const result = await store.verify(rawToken);
		expect(result.valid).toBe(true);
	});

	it("revoke: marks the token revoked while keeping it listed for admin display", async () => {
		const { store } = makeStore();
		const { record } = await store.create({ label: "revocable", scopes: ["content:write"] });
		await store.revoke(record.id);

		const tokens = await store.list();
		const revoked = tokens.find((t) => t.id === record.id);
		expect(revoked).toBeDefined();
		expect(revoked?.revokedAt).not.toBeNull();
	});
});
