import { describe, expect, it } from "vitest";

import {
	issueOAuthState,
	verifyOAuthState,
} from "../../../src/integrations/oauth/state";

const ROOT = "test-root-secret-do-not-use-in-prod";
const CONTEXT = {
	domain: "deploy-hooks",
	providerId: "github",
	returnTo: "/ap-admin/deploy-hooks",
} as const;

describe("issueOAuthState / verifyOAuthState", () => {
	it("round-trips: issue → verify returns the original context + nonce", async () => {
		const issued = await issueOAuthState({
			context: CONTEXT,
			rootSecret: ROOT,
			nowMs: 1_000_000,
		});
		const verified = await verifyOAuthState({
			token: issued.token,
			rootSecret: ROOT,
			nowMs: 1_000_000,
		});
		expect(verified.ok).toBe(true);
		if (verified.ok) {
			expect(verified.nonce).toBe(issued.nonce);
			expect(verified.context).toEqual(CONTEXT);
		}
	});

	it("rejects an expired token", async () => {
		const issued = await issueOAuthState({
			context: CONTEXT,
			rootSecret: ROOT,
			nowMs: 0,
			ttlMs: 1000,
		});
		const verified = await verifyOAuthState({
			token: issued.token,
			rootSecret: ROOT,
			nowMs: 2000,
		});
		expect(verified).toEqual({ ok: false, code: "EXPIRED" });
	});

	it("rejects a token signed under a different secret", async () => {
		const issued = await issueOAuthState({
			context: CONTEXT,
			rootSecret: ROOT,
			nowMs: 0,
		});
		const verified = await verifyOAuthState({
			token: issued.token,
			rootSecret: "wrong-secret",
			nowMs: 0,
		});
		expect(verified).toEqual({ ok: false, code: "INVALID_SIGNATURE" });
	});

	it("rejects a token whose signature has been tampered", async () => {
		const issued = await issueOAuthState({
			context: CONTEXT,
			rootSecret: ROOT,
			nowMs: 0,
		});
		const tampered = `${issued.token.slice(0, -1)}A`;
		const verified = await verifyOAuthState({
			token: tampered,
			rootSecret: ROOT,
			nowMs: 0,
		});
		expect(verified.ok).toBe(false);
	});

	it("rejects a malformed token (not base64)", async () => {
		const verified = await verifyOAuthState({
			token: "$$$not-base64$$$",
			rootSecret: ROOT,
			nowMs: 0,
		});
		expect(verified.ok).toBe(false);
	});

	it("rejects when expectedContext.domain doesn't match", async () => {
		const issued = await issueOAuthState({
			context: CONTEXT,
			rootSecret: ROOT,
			nowMs: 0,
		});
		const verified = await verifyOAuthState({
			token: issued.token,
			rootSecret: ROOT,
			nowMs: 0,
			expectedContext: { domain: "other-domain" },
		});
		expect(verified).toEqual({ ok: false, code: "CONTEXT_MISMATCH" });
	});

	it("rejects when expectedContext.providerId doesn't match", async () => {
		const issued = await issueOAuthState({
			context: CONTEXT,
			rootSecret: ROOT,
			nowMs: 0,
		});
		const verified = await verifyOAuthState({
			token: issued.token,
			rootSecret: ROOT,
			nowMs: 0,
			expectedContext: { providerId: "gitlab" },
		});
		expect(verified.ok).toBe(false);
	});

	it("rejects when expectedContext.returnTo doesn't match", async () => {
		const issued = await issueOAuthState({
			context: CONTEXT,
			rootSecret: ROOT,
			nowMs: 0,
		});
		const verified = await verifyOAuthState({
			token: issued.token,
			rootSecret: ROOT,
			nowMs: 0,
			expectedContext: { returnTo: "/ap-admin/other" },
		});
		expect(verified.ok).toBe(false);
	});

	it("two issues for the same context produce different nonces and tokens", async () => {
		const a = await issueOAuthState({
			context: CONTEXT,
			rootSecret: ROOT,
			nowMs: 0,
		});
		const b = await issueOAuthState({
			context: CONTEXT,
			rootSecret: ROOT,
			nowMs: 0,
		});
		expect(a.nonce).not.toBe(b.nonce);
		expect(a.token).not.toBe(b.token);
	});

	it("rejects an envelope missing required fields", async () => {
		const fakeEnvelope = JSON.stringify({ n: "abc", c: { domain: "x" } });
		const token = btoa(fakeEnvelope)
			.replace(/\+/g, "-")
			.replace(/\//g, "_")
			.replace(/=/g, "");
		const verified = await verifyOAuthState({
			token,
			rootSecret: ROOT,
			nowMs: 0,
		});
		expect(verified).toEqual({ ok: false, code: "INVALID_FORMAT" });
	});

	it("rejects valid base64 that doesn't decode to JSON", async () => {
		const token = btoa("not-json");
		const verified = await verifyOAuthState({
			token,
			rootSecret: ROOT,
			nowMs: 0,
		});
		expect(verified).toEqual({ ok: false, code: "INVALID_FORMAT" });
	});

	it("rejects when context.domain is not a string", async () => {
		const fakeInner = {
			n: "00".repeat(16),
			c: { domain: 1, providerId: "github", returnTo: "/" },
			e: Date.now() + 60_000,
			s: "00".repeat(32),
		};
		const token = btoa(JSON.stringify(fakeInner))
			.replace(/\+/g, "-")
			.replace(/\//g, "_")
			.replace(/=/g, "");
		const verified = await verifyOAuthState({
			token,
			rootSecret: ROOT,
			nowMs: 0,
		});
		expect(verified).toEqual({ ok: false, code: "INVALID_FORMAT" });
	});

	it("expiresAt reflects the configured TTL", async () => {
		const issued = await issueOAuthState({
			context: CONTEXT,
			rootSecret: ROOT,
			nowMs: 1000,
			ttlMs: 5000,
		});
		expect(issued.expiresAt).toBe(6000);
	});
});
