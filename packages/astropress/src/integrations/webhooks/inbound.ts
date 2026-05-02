/**
 * Inbound webhook signature verifier.
 *
 * Providers sign webhook bodies with HMAC over the raw bytes; the
 * receiver recomputes the HMAC with the shared secret and compares
 * constant-time. GitHub uses `X-Hub-Signature-256: sha256=<hex>`.
 *
 * The body MUST be the raw bytes the upstream signed. Decoding to
 * JSON or trimming whitespace breaks the HMAC, so receivers should
 * `await req.bytes()` once, verify, then parse.
 */

import { constantTimeEqual } from "../../crypto-primitives.js";

export type InboundWebhookAlgorithm = "hmac-sha256" | "hmac-sha512";

export interface VerifyInboundWebhookArgs {
	readonly algo: InboundWebhookAlgorithm;
	/** The raw header value as received (e.g. `"sha256=abcdef…"`). */
	readonly header: string;
	readonly body: Uint8Array;
	readonly secret: string;
}

/**
 * WebCrypto hash-name for the given algorithm. Pure.
 */
export function algorithmHashName(
	algo: InboundWebhookAlgorithm,
): "SHA-256" | "SHA-512" {
	if (algo === "hmac-sha256") return "SHA-256";
	return "SHA-512";
}

/**
 * Algorithm prefix that GitHub-style headers use (`sha256=` / `sha512=`).
 * Pure.
 */
export function algorithmHeaderPrefix(algo: InboundWebhookAlgorithm): string {
	if (algo === "hmac-sha256") return "sha256=";
	return "sha512=";
}

/**
 * Strip the algorithm prefix from a header value if present, else
 * return the input verbatim. Pure.
 */
export function extractWebhookHexSignature(
	header: string,
	algo: InboundWebhookAlgorithm,
): string {
	const prefix = algorithmHeaderPrefix(algo);
	if (header.startsWith(prefix)) {
		return header.slice(prefix.length);
	}
	return header;
}

/**
 * Parse a hex string into bytes. Returns `null` on empty input, odd
 * length, or any non-hex character. Pure.
 */
export function parseWebhookHexBytes(hex: string): Uint8Array | null {
	if (!/^[0-9a-fA-F]+$/.test(hex)) return null;
	if (hex.length % 2 !== 0) return null;
	const out = new Uint8Array(hex.length / 2);
	for (let i = 0; i < hex.length; i += 2) {
		out[i / 2] = Number.parseInt(hex.slice(i, i + 2), 16);
	}
	return out;
}

export async function computeWebhookHmacBytes(
	algo: InboundWebhookAlgorithm,
	secret: string,
	body: Uint8Array,
): Promise<Uint8Array> {
	const hash = algorithmHashName(algo);
	const keyBytes = new TextEncoder().encode(secret);
	const keyBuf = new ArrayBuffer(keyBytes.byteLength);
	new Uint8Array(keyBuf).set(keyBytes);
	const key = await crypto.subtle.importKey(
		"raw",
		keyBuf,
		{ name: "HMAC", hash: { name: hash } },
		false,
		["sign"],
	);
	const bodyBuf = new ArrayBuffer(body.byteLength);
	new Uint8Array(bodyBuf).set(body);
	const sig = await crypto.subtle.sign(
		{ name: "HMAC", hash: { name: hash } },
		key,
		bodyBuf,
	);
	return new Uint8Array(sig);
}

export async function verifyInboundWebhookSignature(
	args: VerifyInboundWebhookArgs,
): Promise<boolean> {
	if (args.secret.length === 0) return false;
	const hex = extractWebhookHexSignature(args.header, args.algo);
	const supplied = parseWebhookHexBytes(hex);
	if (supplied === null) return false;
	const expected = await computeWebhookHmacBytes(
		args.algo,
		args.secret,
		args.body,
	);
	return constantTimeEqual(supplied, expected);
}

/**
 * Convenience wrapper for GitHub-style `X-Hub-Signature-256` headers.
 */
export async function verifyGithubWebhookSignature(args: {
	readonly header: string;
	readonly body: Uint8Array;
	readonly secret: string;
}): Promise<boolean> {
	return verifyInboundWebhookSignature({ ...args, algo: "hmac-sha256" });
}
