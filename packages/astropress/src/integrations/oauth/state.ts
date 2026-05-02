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
 * Format: a base64-encoded JSON envelope `{n, c, e, s}` where:
 *   - `n` is a 16-byte random nonce (hex);
 *   - `c` is the resume-context payload (domain, providerId,
 *     returnTo path);
 *   - `e` is the expiry as ms-since-epoch;
 *   - `s` is HMAC-SHA-256(rootSecret, JSON.stringify({n,c,e})) as
 *     hex.
 *
 * Replay protection requires a nonce store; this module returns
 * the nonce so the caller can register it with the rate-limit /
 * idempotency table and reject re-uses on callback.
 */

import { constantTimeEqual } from "../../crypto-primitives.js";

export interface OAuthStateContext {
	readonly domain: string;
	readonly providerId: string;
	readonly returnTo: string;
}

export interface IssuedState {
	readonly token: string;
	readonly nonce: string;
	readonly expiresAt: number;
}

export interface VerifyStateOk {
	readonly ok: true;
	readonly nonce: string;
	readonly context: OAuthStateContext;
}

export interface VerifyStateErr {
	readonly ok: false;
	readonly code:
		| "INVALID_FORMAT"
		| "INVALID_SIGNATURE"
		| "EXPIRED"
		| "CONTEXT_MISMATCH";
}

export type VerifyStateResult = VerifyStateOk | VerifyStateErr;

export interface IssueStateArgs {
	readonly context: OAuthStateContext;
	readonly rootSecret: string;
	readonly nowMs: number;
	readonly ttlMs?: number;
}

export interface VerifyStateArgs {
	readonly token: string;
	readonly rootSecret: string;
	readonly nowMs: number;
	readonly expectedContext?: Partial<OAuthStateContext>;
}

const DEFAULT_TTL_MS = 10 * 60 * 1000;
const NONCE_BYTES = 16;
const textEncoder = new TextEncoder();

function bytesToHex(bytes: Uint8Array): string {
	return Array.from(bytes)
		.map((b) => b.toString(16).padStart(2, "0"))
		.join("");
}

function hexToBytes(hex: string): Uint8Array | null {
	if (hex.length === 0 || hex.length % 2 !== 0) return null;
	if (!/^[0-9a-fA-F]+$/.test(hex)) return null;
	const out = new Uint8Array(hex.length / 2);
	for (let i = 0; i < hex.length; i += 2) {
		out[i / 2] = Number.parseInt(hex.slice(i, i + 2), 16);
	}
	return out;
}

async function hmacSha256(secret: string, message: string): Promise<string> {
	const keyBytes = textEncoder.encode(secret);
	const keyBuf = new ArrayBuffer(keyBytes.byteLength);
	new Uint8Array(keyBuf).set(keyBytes);
	const key = await crypto.subtle.importKey(
		"raw",
		keyBuf,
		{ name: "HMAC", hash: "SHA-256" },
		false,
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

function bytesToBase64Url(bytes: Uint8Array): string {
	let binary = "";
	for (const byte of bytes) binary += String.fromCharCode(byte);
	let encoded = btoa(binary).replace(/\+/g, "-").replace(/\//g, "_");
	while (encoded.endsWith("=")) encoded = encoded.slice(0, -1);
	return encoded;
}

function base64UrlToBytes(value: string): Uint8Array | null {
	const padded = value.replace(/-/g, "+").replace(/_/g, "/");
	const fillLen = (4 - (padded.length % 4)) % 4;
	const filled = padded + "=".repeat(fillLen);
	try {
		const binary = atob(filled);
		const bytes = new Uint8Array(binary.length);
		for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
		return bytes;
	} catch {
		return null;
	}
}

interface InnerEnvelope {
	readonly n: string;
	readonly c: OAuthStateContext;
	readonly e: number;
}

export async function issueOAuthState(
	args: IssueStateArgs,
): Promise<IssuedState> {
	const nonce = bytesToHex(crypto.getRandomValues(new Uint8Array(NONCE_BYTES)));
	const expiresAt = args.nowMs + (args.ttlMs ?? DEFAULT_TTL_MS);
	const inner: InnerEnvelope = { n: nonce, c: args.context, e: expiresAt };
	const innerJson = JSON.stringify(inner);
	const sig = await hmacSha256(args.rootSecret, innerJson);
	const envelope = JSON.stringify({ ...inner, s: sig });
	const token = bytesToBase64Url(textEncoder.encode(envelope));
	return { token, nonce, expiresAt };
}

export async function verifyOAuthState(
	args: VerifyStateArgs,
): Promise<VerifyStateResult> {
	const decoded = base64UrlToBytes(args.token);
	if (!decoded) return { ok: false, code: "INVALID_FORMAT" };
	let parsed: unknown;
	try {
		parsed = JSON.parse(new TextDecoder().decode(decoded));
	} catch {
		return { ok: false, code: "INVALID_FORMAT" };
	}
	if (
		!parsed ||
		typeof parsed !== "object" ||
		Array.isArray(parsed) ||
		!("n" in parsed) ||
		!("c" in parsed) ||
		!("e" in parsed) ||
		!("s" in parsed)
	) {
		return { ok: false, code: "INVALID_FORMAT" };
	}
	const obj = parsed as { n: unknown; c: unknown; e: unknown; s: unknown };
	if (
		typeof obj.n !== "string" ||
		typeof obj.s !== "string" ||
		typeof obj.e !== "number" ||
		!obj.c ||
		typeof obj.c !== "object" ||
		Array.isArray(obj.c)
	) {
		return { ok: false, code: "INVALID_FORMAT" };
	}
	const ctxObj = obj.c as Record<string, unknown>;
	if (
		typeof ctxObj.domain !== "string" ||
		typeof ctxObj.providerId !== "string" ||
		typeof ctxObj.returnTo !== "string"
	) {
		return { ok: false, code: "INVALID_FORMAT" };
	}
	const inner: InnerEnvelope = {
		n: obj.n,
		c: {
			domain: ctxObj.domain,
			providerId: ctxObj.providerId,
			returnTo: ctxObj.returnTo,
		},
		e: obj.e,
	};
	const innerJson = JSON.stringify(inner);
	const expectedSig = await hmacSha256(args.rootSecret, innerJson);
	const lhs = hexToBytes(obj.s);
	const rhs = hexToBytes(expectedSig);
	if (!lhs || !rhs || !constantTimeEqual(lhs, rhs)) {
		return { ok: false, code: "INVALID_SIGNATURE" };
	}
	if (args.nowMs > inner.e) {
		return { ok: false, code: "EXPIRED" };
	}
	if (args.expectedContext) {
		const exp = args.expectedContext;
		if (
			(exp.domain !== undefined && exp.domain !== inner.c.domain) ||
			(exp.providerId !== undefined && exp.providerId !== inner.c.providerId) ||
			(exp.returnTo !== undefined && exp.returnTo !== inner.c.returnTo)
		) {
			return { ok: false, code: "CONTEXT_MISMATCH" };
		}
	}
	return { ok: true, nonce: inner.n, context: inner.c };
}
