// Behavioral test for OAuth state-nonce replay protection
// (src/integrations/oauth/replay.ts). Proves the property #122 requires:
// the first callback for a nonce proceeds, every replay of the same nonce is
// rejected — exercised against a real D1-backed rate-limit window.
import { describe, expect, it } from "vitest";

import {
	consumeOAuthStateNonce,
	OAUTH_NONCE_RATE_KEY_PREFIX,
} from "../../../src/integrations/oauth/replay.js";
import { makeDb } from "../../helpers/make-db.js";
import { makeLocals } from "../../helpers/make-locals.js";

describe("consumeOAuthStateNonce", () => {
	it("allows the first use of a nonce and rejects every replay", async () => {
		const locals = makeLocals(makeDb());
		const nonce = "abc123def456";

		expect(await consumeOAuthStateNonce(locals, nonce)).toBe(true);
		expect(await consumeOAuthStateNonce(locals, nonce)).toBe(false);
		expect(await consumeOAuthStateNonce(locals, nonce)).toBe(false);
	});

	it("treats distinct nonces independently", async () => {
		const locals = makeLocals(makeDb());
		expect(await consumeOAuthStateNonce(locals, "nonce-a")).toBe(true);
		expect(await consumeOAuthStateNonce(locals, "nonce-b")).toBe(true);
		expect(await consumeOAuthStateNonce(locals, "nonce-a")).toBe(false);
	});

	it("records the nonce under the namespaced rate-limit key", async () => {
		const db = makeDb();
		const locals = makeLocals(db);
		await consumeOAuthStateNonce(locals, "keycheck");
		const row = db
			.prepare("SELECT key FROM rate_limits WHERE key = ?")
			.get(`${OAUTH_NONCE_RATE_KEY_PREFIX}keycheck`) as { key: string } | undefined;
		expect(row?.key).toBe(`${OAUTH_NONCE_RATE_KEY_PREFIX}keycheck`);
	});

	it("re-uses across a fresh window are still rejected within TTL", async () => {
		const locals = makeLocals(makeDb());
		// A very long TTL keeps the window open, so a replay stays blocked.
		expect(await consumeOAuthStateNonce(locals, "ttl", 60_000)).toBe(true);
		expect(await consumeOAuthStateNonce(locals, "ttl", 60_000)).toBe(false);
	});
});
