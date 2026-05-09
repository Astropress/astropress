/**
 * OAuth state-token issuance and verification.
 *
 * The browser hands the IdP a `state` parameter at the start of an
 * authorization-code flow; the IdP returns it verbatim on callback.
 * The state must therefore:
 *
 *   1. be unforgeable by the IdP (so a malicious IdP can't replay
 *      a captured state to land in a different account's context);
 *   2. carry enough server-side context to resume the flow without
 *      cookies (needed for Cloudflare Workers, where setting a
 *      cookie on the redirect-out is awkward);
 *   3. expire so a captured state can't be replayed indefinitely;
 *   4. be single-use so an attacker can't replay a leaked state
 *      across multiple browser sessions.
 *
 * Wire format: hex(JSON envelope `{n, c, e, s}` UTF-8) where:
 *   - `n` is a 16-byte random nonce (hex);
 *   - `c` is the resume-context payload `{domain, providerId, returnTo}`;
 *   - `e` is the expiry as ms-since-epoch;
 *   - `s` is HMAC-SHA-256(rootSecret, JSON.stringify({n,c,e})) as hex.
 *
 * Hex (rather than base64url) keeps the encode/decode path symmetric,
 * trivially URL-safe with no padding, and easy to mutation-test —
 * the trade-off is roughly 1.6× the wire length of base64url, which
 * is well within typical URL-length budgets for an OAuth state.
 *
 * Defensive parsing is intentionally minimal: we hex-decode, JSON-parse,
 * canonical-serialize the inner under the schema we expect, and check
 * the signature. Any structural difference between the attacker's
 * forgery and a real envelope produces a different signature, so a
 * shape mismatch is automatically caught as INVALID_SIGNATURE rather
 * than via a separate per-field type guard. If `JSON.parse` itself
 * throws, or any property access in the canonicalisation throws, we
 * report INVALID_FORMAT.
 *
 * Replay protection requires a nonce store; this module returns the
 * nonce so the caller can register it with the rate-limit /
 * idempotency table and reject re-uses on callback.
 */

import { bytesToHex, constantTimeEqual } from "../../crypto-primitives.js";

export interface OAuthStateContext {
	readonly domain: string;
	readonly providerId: string;
	readonly returnTo: string;
}

export interface IssuedOAuthState {
	readonly token: string;
	readonly nonce: string;
	readonly expiresAt: number;
}

export interface VerifyOAuthStateOk {
	readonly ok: true;
	readonly nonce: string;
	readonly context: OAuthStateContext;
	readonly expiresAt: number;
}

export type VerifyOAuthStateErrorCode =
	| "INVALID_FORMAT"
	| "INVALID_SIGNATURE"
	| "EXPIRED"
	| "CONTEXT_MISMATCH";

export interface VerifyOAuthStateErr {
	readonly ok: false;
	readonly code: VerifyOAuthStateErrorCode;
}

export type VerifyOAuthStateResult = VerifyOAuthStateOk | VerifyOAuthStateErr;

export interface IssueOAuthStateArgs {
	readonly context: OAuthStateContext;
	readonly rootSecret: string;
	readonly nowMs: number;
	readonly ttlMs?: number;
}

export interface VerifyOAuthStateArgs {
	readonly token: string;
	readonly rootSecret: string;
	readonly nowMs: number;
	readonly expectedContext?: Partial<OAuthStateContext>;
}

export const DEFAULT_OAUTH_STATE_TTL_MS = 600_000;
const NONCE_BYTES = 16;
const textEncoder = new TextEncoder();

export function parseHexBytes(hex: string): Uint8Array | null {
	if (!/^[0-9a-fA-F]+$/.test(hex)) return null;
	if (hex.length % 2 !== 0) return null;
	const out = new Uint8Array(hex.length / 2);
	// Stryker disable next-line EqualityOperator: i <= hex.length is observably equivalent — Uint8Array silently drops out-of-bounds writes, returned bytes are identical.
	for (let i = 0; i < hex.length; i += 2) {
		out[i / 2] = Number.parseInt(hex.slice(i, i + 2), 16);
	}
	return out;
}

interface InnerEnvelope {
	readonly n: string;
	readonly c: OAuthStateContext;
	readonly e: number;
}

export function serializeInnerEnvelope(inner: InnerEnvelope): string {
	return JSON.stringify({ n: inner.n, c: inner.c, e: inner.e });
}

async function hmacSha256Hex(secret: string, message: string): Promise<string> {
	const keyBytes = textEncoder.encode(secret);
	const keyBuf = new ArrayBuffer(keyBytes.byteLength);
	new Uint8Array(keyBuf).set(keyBytes);
	const key = await crypto.subtle.importKey(
		"raw",
		keyBuf,
		{ name: "HMAC", hash: "SHA-256" },
		// Stryker disable next-line BooleanLiteral: extractable does not affect the sign output we test.
		false,
		// Stryker disable next-line StringLiteral: any non-empty usage that includes "sign" works; the operation is what we test.
		["sign"],
	);
	const msgBytes = textEncoder.encode(message);
	const msgBuf = new ArrayBuffer(msgBytes.byteLength);
	new Uint8Array(msgBuf).set(msgBytes);
	const sig = new Uint8Array(
		await crypto.subtle.sign({ name: "HMAC", hash: "SHA-256" }, key, msgBuf),
	);
	return bytesToHex(sig);
}

export async function issueOAuthState(args: IssueOAuthStateArgs): Promise<IssuedOAuthState> {
	const nonce = bytesToHex(crypto.getRandomValues(new Uint8Array(NONCE_BYTES)));
	const ttl = args.ttlMs ?? DEFAULT_OAUTH_STATE_TTL_MS;
	const expiresAt = args.nowMs + ttl;
	const inner: InnerEnvelope = { n: nonce, c: args.context, e: expiresAt };
	const sig = await hmacSha256Hex(args.rootSecret, serializeInnerEnvelope(inner));
	const envelope = JSON.stringify({ ...inner, s: sig });
	const token = bytesToHex(textEncoder.encode(envelope));
	return { token, nonce, expiresAt };
}

interface ParsedEnvelope {
	readonly inner: InnerEnvelope;
	readonly signatureHex: string;
}

/**
 * Decode a token to its inner envelope + signature, or `null` if the
 * token is not a hex-encoded envelope our issuer would have produced.
 *
 * The structural type-coercion below is "trusting": if a forger
 * supplied unexpected types, the canonical re-serialisation under
 * {@link serializeInnerEnvelope} will not round-trip, the recomputed
 * signature won't match, and {@link verifyOAuthState} returns
 * `INVALID_SIGNATURE`. So we only need to guard against shapes that
 * would *throw* during canonicalisation (null, missing nested
 * `.c`, etc.) — every other shape difference is caught by the HMAC
 * check downstream.
 */
export function parseStateEnvelope(token: string): ParsedEnvelope | null {
	const decoded = parseHexBytes(token);
	// Stryker disable next-line ConditionalExpression: equivalent — TextDecoder.decode(null) below throws and the catch returns null with the same outcome.
	if (decoded === null) return null;
	try {
		const parsed = JSON.parse(new TextDecoder().decode(decoded)) as {
			n?: unknown;
			c?: { domain?: unknown; providerId?: unknown; returnTo?: unknown };
			e?: unknown;
			s?: unknown;
		};
		const ctx = parsed.c ?? {};
		const inner: InnerEnvelope = {
			n: String(parsed.n ?? ""),
			c: {
				domain: String(ctx.domain ?? ""),
				providerId: String(ctx.providerId ?? ""),
				returnTo: String(ctx.returnTo ?? ""),
			},
			e: typeof parsed.e === "number" ? parsed.e : 0,
		};
		const signatureHex =
			typeof parsed.s === "string" && /^[0-9a-fA-F]+$/.test(parsed.s) ? parsed.s : "";
		return { inner, signatureHex };
	} catch {
		return null;
	}
}

export async function verifyOAuthState(
	args: VerifyOAuthStateArgs,
): Promise<VerifyOAuthStateResult> {
	const parsed = parseStateEnvelope(args.token);
	if (parsed === null) return { ok: false, code: "INVALID_FORMAT" };
	const lhs = parseHexBytes(parsed.signatureHex);
	if (lhs === null) return { ok: false, code: "INVALID_SIGNATURE" };
	const expectedSig = await hmacSha256Hex(args.rootSecret, serializeInnerEnvelope(parsed.inner));
	const rhs = parseHexBytes(expectedSig);
	if (rhs === null) return { ok: false, code: "INVALID_SIGNATURE" };
	if (!constantTimeEqual(lhs, rhs)) {
		return { ok: false, code: "INVALID_SIGNATURE" };
	}
	if (args.nowMs > parsed.inner.e) {
		return { ok: false, code: "EXPIRED" };
	}
	const exp = args.expectedContext;
	if (exp !== undefined) {
		if (exp.domain !== undefined && exp.domain !== parsed.inner.c.domain) {
			return { ok: false, code: "CONTEXT_MISMATCH" };
		}
		if (exp.providerId !== undefined && exp.providerId !== parsed.inner.c.providerId) {
			return { ok: false, code: "CONTEXT_MISMATCH" };
		}
		if (exp.returnTo !== undefined && exp.returnTo !== parsed.inner.c.returnTo) {
			return { ok: false, code: "CONTEXT_MISMATCH" };
		}
	}
	return {
		ok: true,
		nonce: parsed.inner.n,
		context: parsed.inner.c,
		expiresAt: parsed.inner.e,
	};
}
