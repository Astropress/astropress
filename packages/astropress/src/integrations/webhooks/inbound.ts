/**
 * Verify an inbound webhook signature against a shared secret.
 *
 * Each provider documents a header convention: GitHub uses
 * `X-Hub-Signature-256: sha256=<hex>`, Stripe uses
 * `Stripe-Signature: t=<ts>,v1=<hex>`, etc. The shared cryptographic
 * primitive is HMAC-SHA-256 over the raw request body keyed by the
 * shared secret. This helper accepts the raw header value, parses
 * the algorithm prefix (when present), runs HMAC-SHA-256 over the
 * body, and compares constant-time.
 *
 * Usage from a generic receiver:
 *
 *   const ok = await verifyInboundWebhookSignature({
 *     algo: "hmac-sha256",
 *     header: req.headers.get("x-hub-signature-256") ?? "",
 *     body: rawBytes,
 *     secret,
 *   });
 *   if (!ok) return new Response(null, { status: 401 });
 *
 * The body MUST be passed as the raw bytes the upstream signed —
 * decoding to JSON or trimming whitespace breaks the HMAC. Receivers
 * therefore read the body once with `await req.bytes()` (or
 * `arrayBuffer()`), verify, then parse.
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

const ALGORITHM_LABELS: Record<InboundWebhookAlgorithm, string> = {
	"hmac-sha256": "SHA-256",
	"hmac-sha512": "SHA-512",
};

const ALGORITHM_PREFIXES: Record<InboundWebhookAlgorithm, string> = {
	"hmac-sha256": "sha256=",
	"hmac-sha512": "sha512=",
};

function hexToBytes(hex: string): Uint8Array | null {
	const trimmed = hex.trim();
	if (trimmed.length === 0 || trimmed.length % 2 !== 0) return null;
	if (!/^[0-9a-fA-F]+$/.test(trimmed)) return null;
	const out = new Uint8Array(trimmed.length / 2);
	for (let i = 0; i < trimmed.length; i += 2) {
		out[i / 2] = Number.parseInt(trimmed.slice(i, i + 2), 16);
	}
	return out;
}

function stripPrefix(value: string, algo: InboundWebhookAlgorithm): string {
	const prefix = ALGORITHM_PREFIXES[algo];
	return value.startsWith(prefix) ? value.slice(prefix.length) : value;
}

async function importHmacKey(
	algo: InboundWebhookAlgorithm,
	secret: string,
): Promise<CryptoKey> {
	const keyBytes = new TextEncoder().encode(secret);
	const buffer = new ArrayBuffer(keyBytes.byteLength);
	new Uint8Array(buffer).set(keyBytes);
	return crypto.subtle.importKey(
		"raw",
		buffer,
		{ name: "HMAC", hash: { name: ALGORITHM_LABELS[algo] } },
		false,
		["sign"],
	);
}

async function computeHmac(
	algo: InboundWebhookAlgorithm,
	secret: string,
	body: Uint8Array,
): Promise<Uint8Array> {
	const key = await importHmacKey(algo, secret);
	const bodyBuffer = new ArrayBuffer(body.byteLength);
	new Uint8Array(bodyBuffer).set(body);
	const sig = await crypto.subtle.sign(
		{ name: "HMAC", hash: { name: ALGORITHM_LABELS[algo] } },
		key,
		bodyBuffer,
	);
	return new Uint8Array(sig);
}

export async function verifyInboundWebhookSignature(
	args: VerifyInboundWebhookArgs,
): Promise<boolean> {
	if (!args.header || !args.secret) return false;
	const hex = stripPrefix(args.header, args.algo);
	const supplied = hexToBytes(hex);
	if (!supplied) return false;
	const expected = await computeHmac(args.algo, args.secret, args.body);
	return constantTimeEqual(supplied, expected);
}

/**
 * Convenience helper: HMAC-SHA-256 with `sha256=…` GitHub-style header.
 */
export async function verifyGithubWebhookSignature(args: {
	header: string;
	body: Uint8Array;
	secret: string;
}): Promise<boolean> {
	return verifyInboundWebhookSignature({ ...args, algo: "hmac-sha256" });
}
