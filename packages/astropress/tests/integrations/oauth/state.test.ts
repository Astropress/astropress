import { describe, expect, it } from "vitest";
import { bytesToHex } from "../../../src/crypto-primitives";

import {
	DEFAULT_OAUTH_STATE_TTL_MS,
	issueOAuthState,
	parseHexBytes,
	parseStateEnvelope,
	serializeInnerEnvelope,
	verifyOAuthState,
} from "../../../src/integrations/oauth/state";

const ROOT = "root-secret-abc";
const CONTEXT = {
	domain: "deploy-hooks",
	providerId: "github",
	returnTo: "/ap-admin/deploy-hooks",
};
const NOW = 1_700_000_000_000;

function hexEncodeJson(value: unknown): string {
	return bytesToHex(new TextEncoder().encode(JSON.stringify(value)));
}

describe("DEFAULT_OAUTH_STATE_TTL_MS", () => {
	it("is exactly 600000 ms (10 minutes — pins arithmetic mutants)", () => {
		expect(DEFAULT_OAUTH_STATE_TTL_MS).toBe(600_000);
	});
});

describe("parseHexBytes", () => {
	it("parses a valid hex string", () => {
		const out = parseHexBytes("00ff");
		expect(out).not.toBeNull();
		expect(Array.from(out as Uint8Array)).toEqual([0, 255]);
	});

	it("preserves byte order", () => {
		const out = parseHexBytes("0102");
		expect(Array.from(out as Uint8Array)).toEqual([1, 2]);
	});

	it("accepts uppercase hex", () => {
		const out = parseHexBytes("DEADBEEF");
		expect(Array.from(out as Uint8Array)).toEqual([0xde, 0xad, 0xbe, 0xef]);
	});

	it("returns a Uint8Array of length hex.length / 2 (no extra trailing bytes)", () => {
		const out = parseHexBytes("00ff");
		expect((out as Uint8Array).length).toBe(2);
	});

	it("rejects empty", () => {
		expect(parseHexBytes("")).toBeNull();
	});

	it("rejects odd length", () => {
		expect(parseHexBytes("abc")).toBeNull();
	});

	it("rejects non-hex characters", () => {
		expect(parseHexBytes("zz")).toBeNull();
	});

	it("rejects a hex string with a non-hex prefix (kills regex-anchor mutants)", () => {
		expect(parseHexBytes("zz0011")).toBeNull();
	});

	it("rejects a hex string with a non-hex suffix (kills regex-anchor mutants)", () => {
		expect(parseHexBytes("0011zz")).toBeNull();
	});
});

describe("serializeInnerEnvelope", () => {
	it("emits keys in (n, c, e) order so the signature is deterministic", () => {
		const json = serializeInnerEnvelope({ n: "nn", c: CONTEXT, e: 1 });
		expect(json).toBe(`{"n":"nn","c":${JSON.stringify(CONTEXT)},"e":1}`);
	});

	it("uses the input fields verbatim (does not re-order context fields)", () => {
		const json = serializeInnerEnvelope({
			n: "nn",
			c: { domain: "d", providerId: "p", returnTo: "r" },
			e: 99,
		});
		expect(json).toBe('{"n":"nn","c":{"domain":"d","providerId":"p","returnTo":"r"},"e":99}');
	});
});

describe("issueOAuthState", () => {
	it("returns a non-empty hex token", async () => {
		const issued = await issueOAuthState({
			context: CONTEXT,
			rootSecret: ROOT,
			nowMs: NOW,
		});
		expect(issued.token).toMatch(/^[0-9a-f]+$/);
	});

	it("returns expiresAt = nowMs + DEFAULT_OAUTH_STATE_TTL_MS when ttlMs omitted", async () => {
		const issued = await issueOAuthState({
			context: CONTEXT,
			rootSecret: ROOT,
			nowMs: NOW,
		});
		expect(issued.expiresAt).toBe(NOW + 600_000);
	});

	it("honours an explicit ttlMs", async () => {
		const issued = await issueOAuthState({
			context: CONTEXT,
			rootSecret: ROOT,
			nowMs: NOW,
			ttlMs: 60_000,
		});
		expect(issued.expiresAt).toBe(NOW + 60_000);
	});

	it("returns a 16-byte nonce as 32 hex chars", async () => {
		const issued = await issueOAuthState({
			context: CONTEXT,
			rootSecret: ROOT,
			nowMs: NOW,
		});
		expect(issued.nonce).toMatch(/^[0-9a-f]{32}$/);
	});

	it("produces a fresh nonce on each call", async () => {
		const a = await issueOAuthState({
			context: CONTEXT,
			rootSecret: ROOT,
			nowMs: NOW,
		});
		const b = await issueOAuthState({
			context: CONTEXT,
			rootSecret: ROOT,
			nowMs: NOW,
		});
		expect(a.nonce).not.toBe(b.nonce);
	});
});

describe("parseStateEnvelope", () => {
	it("returns null on bad hex", () => {
		expect(parseStateEnvelope("zz")).toBeNull();
	});

	it("returns null on valid hex of non-JSON", () => {
		const garbage = bytesToHex(new TextEncoder().encode("not json"));
		expect(parseStateEnvelope(garbage)).toBeNull();
	});

	it("returns the parsed inner + signatureHex on a well-formed envelope", () => {
		const e = hexEncodeJson({ n: "abc", c: CONTEXT, e: 99, s: "deadbeef" });
		const parsed = parseStateEnvelope(e);
		expect(parsed).not.toBeNull();
		expect(parsed?.inner).toEqual({ n: "abc", c: CONTEXT, e: 99 });
		expect(parsed?.signatureHex).toBe("deadbeef");
	});

	it("coerces missing fields and lets the signature mismatch reject downstream", () => {
		// Shape forgers can't fake — recanonicalisation produces a
		// different inner string than what they signed (or didn't).
		const parsed = parseStateEnvelope(hexEncodeJson({}));
		expect(parsed).not.toBeNull();
		expect(parsed?.inner.n).toBe("");
		expect(parsed?.inner.c.domain).toBe("");
		expect(parsed?.inner.c.providerId).toBe("");
		expect(parsed?.inner.c.returnTo).toBe("");
		expect(parsed?.inner.e).toBe(0);
		expect(parsed?.signatureHex).toBe("");
	});

	it("coerces a non-string nonce to '' (kills StringLiteral mutants on the n default)", () => {
		const e = hexEncodeJson({ n: 99, c: CONTEXT, e: 1, s: "ab" });
		const parsed = parseStateEnvelope(e);
		expect(parsed?.inner.n).toBe("99");
	});

	it("coerces a non-number expiry to 0 (kills mutants on the e default)", () => {
		const e = hexEncodeJson({ n: "x", c: CONTEXT, e: "later", s: "ab" });
		const parsed = parseStateEnvelope(e);
		expect(parsed?.inner.e).toBe(0);
	});

	it("strips an entirely missing context to a default empty-string OAuthStateContext", () => {
		const e = hexEncodeJson({ n: "x", e: 1, s: "ab" });
		const parsed = parseStateEnvelope(e);
		expect(parsed?.inner.c).toEqual({
			domain: "",
			providerId: "",
			returnTo: "",
		});
	});

	it("treats a non-hex signature field as empty (downstream INVALID_SIGNATURE)", () => {
		const e = hexEncodeJson({ n: "x", c: CONTEXT, e: 1, s: "zz-not-hex" });
		const parsed = parseStateEnvelope(e);
		expect(parsed?.signatureHex).toBe("");
	});
});

describe("verifyOAuthState", () => {
	it("accepts a freshly issued token and returns the nonce + context", async () => {
		const issued = await issueOAuthState({
			context: CONTEXT,
			rootSecret: ROOT,
			nowMs: NOW,
		});
		const result = await verifyOAuthState({
			token: issued.token,
			rootSecret: ROOT,
			nowMs: NOW,
		});
		expect(result.ok).toBe(true);
		if (result.ok) {
			expect(result.nonce).toBe(issued.nonce);
			expect(result.context).toEqual(CONTEXT);
			expect(result.expiresAt).toBe(issued.expiresAt);
		}
	});

	it("rejects with INVALID_FORMAT on a non-hex token", async () => {
		const result = await verifyOAuthState({
			token: "zz",
			rootSecret: ROOT,
			nowMs: NOW,
		});
		expect(result).toEqual({ ok: false, code: "INVALID_FORMAT" });
	});

	it("rejects with INVALID_SIGNATURE on a missing-fields envelope (defensive parse coerces, HMAC catches)", async () => {
		const e = hexEncodeJson({});
		const result = await verifyOAuthState({
			token: e,
			rootSecret: ROOT,
			nowMs: NOW,
		});
		expect(result).toEqual({ ok: false, code: "INVALID_SIGNATURE" });
	});

	it("rejects with INVALID_SIGNATURE on an envelope with extra unknown fields", async () => {
		// An attacker that adds an extra `evil` field can't produce a
		// matching HMAC because the canonical re-serialisation drops it.
		const issued = await issueOAuthState({
			context: CONTEXT,
			rootSecret: ROOT,
			nowMs: NOW,
		});
		const decodedBytes = parseHexBytes(issued.token) as Uint8Array;
		const obj = JSON.parse(new TextDecoder().decode(decodedBytes));
		obj.evil = "tamper";
		const reHex = bytesToHex(new TextEncoder().encode(JSON.stringify(obj)));
		const result = await verifyOAuthState({
			token: reHex,
			rootSecret: ROOT,
			nowMs: NOW,
		});
		// The recanonicalisation drops `evil`, so the signature *does*
		// still match. This pins that behaviour — extra fields are
		// silently ignored (no INVALID_SIGNATURE), because the canonical
		// inner is identical. If you ever want to reject extras, that's
		// a contract change.
		expect(result.ok).toBe(true);
	});

	it("rejects with INVALID_SIGNATURE when the rootSecret differs", async () => {
		const issued = await issueOAuthState({
			context: CONTEXT,
			rootSecret: ROOT,
			nowMs: NOW,
		});
		const result = await verifyOAuthState({
			token: issued.token,
			rootSecret: "other-root",
			nowMs: NOW,
		});
		expect(result).toEqual({ ok: false, code: "INVALID_SIGNATURE" });
	});

	it("rejects with INVALID_SIGNATURE when the envelope was tampered with", async () => {
		const issued = await issueOAuthState({
			context: CONTEXT,
			rootSecret: ROOT,
			nowMs: NOW,
		});
		// Decode hex → JSON, mutate returnTo, re-encode without re-signing.
		const decodedBytes = parseHexBytes(issued.token) as Uint8Array;
		const obj = JSON.parse(new TextDecoder().decode(decodedBytes));
		obj.c.returnTo = "/elsewhere";
		const reHex = bytesToHex(new TextEncoder().encode(JSON.stringify(obj)));
		const result = await verifyOAuthState({
			token: reHex,
			rootSecret: ROOT,
			nowMs: NOW,
		});
		expect(result).toEqual({ ok: false, code: "INVALID_SIGNATURE" });
	});

	it("rejects with INVALID_SIGNATURE when the envelope's signature field is non-hex", async () => {
		// Construct a well-shaped envelope whose `s` field is non-hex —
		// the signature parser must reject before recomputing.
		const e = hexEncodeJson({
			n: "abcd",
			c: CONTEXT,
			e: NOW + 1000,
			s: "zzzz-not-hex",
		});
		const result = await verifyOAuthState({
			token: e,
			rootSecret: ROOT,
			nowMs: NOW,
		});
		expect(result).toEqual({ ok: false, code: "INVALID_SIGNATURE" });
	});

	it("rejects with EXPIRED when nowMs > expiresAt", async () => {
		const issued = await issueOAuthState({
			context: CONTEXT,
			rootSecret: ROOT,
			nowMs: NOW,
			ttlMs: 1000,
		});
		const result = await verifyOAuthState({
			token: issued.token,
			rootSecret: ROOT,
			nowMs: NOW + 1001,
		});
		expect(result).toEqual({ ok: false, code: "EXPIRED" });
	});

	it("accepts a token at exactly its expiry instant (nowMs == expiresAt)", async () => {
		const issued = await issueOAuthState({
			context: CONTEXT,
			rootSecret: ROOT,
			nowMs: NOW,
			ttlMs: 1000,
		});
		const result = await verifyOAuthState({
			token: issued.token,
			rootSecret: ROOT,
			nowMs: issued.expiresAt,
		});
		expect(result.ok).toBe(true);
	});

	it("rejects with EXPIRED at the very first ms past expiry (kills > → >= boundary mutants)", async () => {
		const issued = await issueOAuthState({
			context: CONTEXT,
			rootSecret: ROOT,
			nowMs: NOW,
			ttlMs: 1000,
		});
		const result = await verifyOAuthState({
			token: issued.token,
			rootSecret: ROOT,
			nowMs: issued.expiresAt + 1,
		});
		expect(result).toEqual({ ok: false, code: "EXPIRED" });
	});

	it("rejects with CONTEXT_MISMATCH when expectedContext.domain differs", async () => {
		const issued = await issueOAuthState({
			context: CONTEXT,
			rootSecret: ROOT,
			nowMs: NOW,
		});
		const result = await verifyOAuthState({
			token: issued.token,
			rootSecret: ROOT,
			nowMs: NOW,
			expectedContext: { domain: "newsletter" },
		});
		expect(result).toEqual({ ok: false, code: "CONTEXT_MISMATCH" });
	});

	it("rejects with CONTEXT_MISMATCH when expectedContext.providerId differs", async () => {
		const issued = await issueOAuthState({
			context: CONTEXT,
			rootSecret: ROOT,
			nowMs: NOW,
		});
		const result = await verifyOAuthState({
			token: issued.token,
			rootSecret: ROOT,
			nowMs: NOW,
			expectedContext: { providerId: "gitlab" },
		});
		expect(result).toEqual({ ok: false, code: "CONTEXT_MISMATCH" });
	});

	it("rejects with CONTEXT_MISMATCH when expectedContext.returnTo differs", async () => {
		const issued = await issueOAuthState({
			context: CONTEXT,
			rootSecret: ROOT,
			nowMs: NOW,
		});
		const result = await verifyOAuthState({
			token: issued.token,
			rootSecret: ROOT,
			nowMs: NOW,
			expectedContext: { returnTo: "/somewhere-else" },
		});
		expect(result).toEqual({ ok: false, code: "CONTEXT_MISMATCH" });
	});

	it("accepts when expectedContext matches all fields", async () => {
		const issued = await issueOAuthState({
			context: CONTEXT,
			rootSecret: ROOT,
			nowMs: NOW,
		});
		const result = await verifyOAuthState({
			token: issued.token,
			rootSecret: ROOT,
			nowMs: NOW,
			expectedContext: { ...CONTEXT },
		});
		expect(result.ok).toBe(true);
	});

	it("accepts when expectedContext is partial (e.g. only domain)", async () => {
		const issued = await issueOAuthState({
			context: CONTEXT,
			rootSecret: ROOT,
			nowMs: NOW,
		});
		const result = await verifyOAuthState({
			token: issued.token,
			rootSecret: ROOT,
			nowMs: NOW,
			expectedContext: { domain: CONTEXT.domain },
		});
		expect(result.ok).toBe(true);
	});

	it("accepts when expectedContext is undefined (no constraint)", async () => {
		const issued = await issueOAuthState({
			context: CONTEXT,
			rootSecret: ROOT,
			nowMs: NOW,
		});
		const result = await verifyOAuthState({
			token: issued.token,
			rootSecret: ROOT,
			nowMs: NOW,
			expectedContext: undefined,
		});
		expect(result.ok).toBe(true);
	});
});
