/**
 * Envelope encryption for connected-integration secrets.
 *
 * Design doc: tooling/docs/phase-2-secret-store-design.md
 *
 *   plaintext  → {fields: {apiKey: "…"}}
 *   dek        → 32 random bytes (per record)
 *   kek        → HKDF(rootSecret, wrap_salt,
 *                     "astropress:integration-secret-kek:v1", 32)
 *   dek_wrap   → AES-GCM(kek, wrap_iv, dek,
 *                        AAD = "astropress:dek-wrap:v1|domain|provider")
 *   ciphertext → AES-GCM(dek, data_iv, JSON.stringify(plaintext),
 *                        AAD = "astropress:integration-secret:v1|domain|provider")
 *
 * The AAD binds every record to (envelope-version, domain, provider) so a
 * row swapped between providers fails to decrypt — defence in depth
 * against accidental cross-binding bugs.
 *
 * Rotation: every record is tagged with `kid: "current" | "previous"`.
 * Reads try the named slot first; on AES-GCM auth failure fall back to
 * the other slot if available. Callers re-seal opportunistically after
 * a successful previous-key decrypt so the rotation amortises in place.
 *
 * No new env var: KEK material comes from the existing rootSecret
 * (runtime-env.ts:185 — getAstropressRootSecretCandidates). No new
 * dependency: WebCrypto AES-GCM is on Bun + Cloudflare Workers, and
 * @noble/hashes/hkdf is already in the dep tree.
 */

import { hkdf } from "@noble/hashes/hkdf.js";
import { sha256 as hkdfHashFn } from "@noble/hashes/sha2.js";

const ENVELOPE_VERSION = 1 as const;
const KEK_INFO = "astropress:integration-secret-kek:v1";
const DEK_WRAP_AAD_PREFIX = "astropress:dek-wrap:v1";
const CIPHERTEXT_AAD_PREFIX = "astropress:integration-secret:v1";
const KEY_BYTES = 32;
const IV_BYTES = 12;
const SALT_BYTES = 16;

const textEncoder = new TextEncoder();
const textDecoder = new TextDecoder();

export type SealedSecretKid = "current" | "previous";

export interface SealedSecret {
	readonly v: typeof ENVELOPE_VERSION;
	readonly kid: SealedSecretKid;
	readonly wrap_salt: string;
	readonly wrap_iv: string;
	readonly dek_wrap: string;
	readonly data_iv: string;
	readonly ciphertext: string;
}

export interface SecretContext {
	readonly domain: string;
	readonly provider: string;
}

export interface RootSecretCandidates {
	readonly current: string;
	readonly previous?: string;
}

export interface OpenedSecret<TFields extends Record<string, string>> {
	readonly fields: TFields;
	readonly usedKid: SealedSecretKid;
}

export class IntegrationSecretError extends Error {
	constructor(
		public readonly code:
			| "INVALID_ENVELOPE"
			| "DECRYPT_FAILED"
			| "MISSING_PREVIOUS_KEY"
			| "INVALID_PLAINTEXT",
		message: string,
	) {
		super(message);
		this.name = "IntegrationSecretError";
	}
}

function getRandomBytes(length: number): Uint8Array {
	return crypto.getRandomValues(new Uint8Array(length));
}

function bytesToBase64Url(bytes: Uint8Array): string {
	let binary = "";
	for (const byte of bytes) binary += String.fromCharCode(byte);
	let encoded = btoa(binary).replace(/\+/g, "-").replace(/\//g, "_");
	// Strip trailing '=' without a regex quantifier (CodeQL flags `/=+$/`
	// even though base64 padding is bounded to ≤2 chars). At most two
	// iterations.
	while (encoded.endsWith("=")) encoded = encoded.slice(0, -1);
	return encoded;
}

function base64UrlToBytes(value: string): Uint8Array {
	const padded = value.replace(/-/g, "+").replace(/_/g, "/");
	const padLen = (4 - (padded.length % 4)) % 4;
	const binary = atob(padded + "=".repeat(padLen));
	const bytes = new Uint8Array(binary.length);
	for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
	return bytes;
}

function deriveKek(rootSecret: string, wrapSalt: Uint8Array): Uint8Array {
	return hkdf(
		hkdfHashFn,
		textEncoder.encode(rootSecret),
		wrapSalt,
		textEncoder.encode(KEK_INFO),
		KEY_BYTES,
	);
}

function buildAad(prefix: string, ctx: SecretContext): Uint8Array {
	return textEncoder.encode(`${prefix}|${ctx.domain}|${ctx.provider}`);
}

// crypto.subtle expects BufferSource (ArrayBuffer-backed). Coerce
// Uint8Array views by copying onto a fresh ArrayBuffer so the typing
// stays clean across runtimes that may default the buffer to
// ArrayBufferLike (SharedArrayBuffer-compatible).
function toBufferSource(bytes: Uint8Array): ArrayBuffer {
	const copy = new ArrayBuffer(bytes.byteLength);
	new Uint8Array(copy).set(bytes);
	return copy;
}

async function importAesKey(
	keyBytes: Uint8Array,
	usage: KeyUsage,
): Promise<CryptoKey> {
	return crypto.subtle.importKey(
		"raw",
		toBufferSource(keyBytes),
		{ name: "AES-GCM" },
		false,
		[usage],
	);
}

async function aesGcmEncrypt(
	keyBytes: Uint8Array,
	iv: Uint8Array,
	plaintext: Uint8Array,
	aad: Uint8Array,
): Promise<Uint8Array> {
	const key = await importAesKey(keyBytes, "encrypt");
	const buf = await crypto.subtle.encrypt(
		{
			name: "AES-GCM",
			iv: toBufferSource(iv),
			additionalData: toBufferSource(aad),
		},
		key,
		toBufferSource(plaintext),
	);
	return new Uint8Array(buf);
}

async function aesGcmDecrypt(
	keyBytes: Uint8Array,
	iv: Uint8Array,
	ciphertext: Uint8Array,
	aad: Uint8Array,
): Promise<Uint8Array> {
	const key = await importAesKey(keyBytes, "decrypt");
	const buf = await crypto.subtle.decrypt(
		{
			name: "AES-GCM",
			iv: toBufferSource(iv),
			additionalData: toBufferSource(aad),
		},
		key,
		toBufferSource(ciphertext),
	);
	return new Uint8Array(buf);
}

async function tryUnwrap(
	rootSecret: string,
	sealed: SealedSecret,
	ctx: SecretContext,
): Promise<Uint8Array | null> {
	try {
		const wrapSalt = base64UrlToBytes(sealed.wrap_salt);
		const wrapIv = base64UrlToBytes(sealed.wrap_iv);
		const dekWrap = base64UrlToBytes(sealed.dek_wrap);
		const kek = deriveKek(rootSecret, wrapSalt);
		const dek = await aesGcmDecrypt(
			kek,
			wrapIv,
			dekWrap,
			buildAad(DEK_WRAP_AAD_PREFIX, ctx),
		);
		return dek;
	} catch {
		return null;
	}
}

/**
 * Seal a secret payload under the current rootSecret. Always tags the
 * record with `kid: "current"`; the rotation script (or callers
 * re-sealing on read) is responsible for moving previous-key records
 * forward.
 */
export async function sealIntegrationSecret(
	plaintextFields: Record<string, string>,
	ctx: SecretContext,
	rootSecret: string,
): Promise<SealedSecret> {
	if (!rootSecret) {
		throw new IntegrationSecretError(
			"INVALID_ENVELOPE",
			"sealIntegrationSecret requires a non-empty rootSecret",
		);
	}
	const wrapSalt = getRandomBytes(SALT_BYTES);
	const wrapIv = getRandomBytes(IV_BYTES);
	const dataIv = getRandomBytes(IV_BYTES);
	const dek = getRandomBytes(KEY_BYTES);
	const kek = deriveKek(rootSecret, wrapSalt);

	const dekWrap = await aesGcmEncrypt(
		kek,
		wrapIv,
		dek,
		buildAad(DEK_WRAP_AAD_PREFIX, ctx),
	);
	const ciphertext = await aesGcmEncrypt(
		dek,
		dataIv,
		textEncoder.encode(JSON.stringify(plaintextFields)),
		buildAad(CIPHERTEXT_AAD_PREFIX, ctx),
	);

	return {
		v: ENVELOPE_VERSION,
		kid: "current",
		wrap_salt: bytesToBase64Url(wrapSalt),
		wrap_iv: bytesToBase64Url(wrapIv),
		dek_wrap: bytesToBase64Url(dekWrap),
		data_iv: bytesToBase64Url(dataIv),
		ciphertext: bytesToBase64Url(ciphertext),
	};
}

/**
 * Open a sealed record. Tries the kid named in the envelope first; on
 * AES-GCM auth failure, falls back to the other slot if available.
 * Reports which slot succeeded so the repository can re-seal under
 * `current` after a `previous`-key hit.
 */
export async function openIntegrationSecret<
	TFields extends Record<string, string> = Record<string, string>,
>(
	sealed: SealedSecret,
	ctx: SecretContext,
	rootSecrets: RootSecretCandidates,
): Promise<OpenedSecret<TFields>> {
	if (sealed.v !== ENVELOPE_VERSION) {
		throw new IntegrationSecretError(
			"INVALID_ENVELOPE",
			`unknown envelope version ${sealed.v}; expected ${ENVELOPE_VERSION}`,
		);
	}
	if (sealed.kid !== "current" && sealed.kid !== "previous") {
		throw new IntegrationSecretError(
			"INVALID_ENVELOPE",
			`invalid envelope kid: ${sealed.kid}`,
		);
	}

	const order: SealedSecretKid[] =
		sealed.kid === "current"
			? ["current", "previous"]
			: ["previous", "current"];

	let usedKid: SealedSecretKid | null = null;
	let dek: Uint8Array | null = null;
	for (const kid of order) {
		const root = kid === "current" ? rootSecrets.current : rootSecrets.previous;
		if (!root) continue;
		const candidate = await tryUnwrap(root, sealed, ctx);
		if (candidate) {
			dek = candidate;
			usedKid = kid;
			break;
		}
	}

	if (!dek || !usedKid) {
		throw new IntegrationSecretError(
			"DECRYPT_FAILED",
			`unable to decrypt integration secret for ${ctx.domain}/${ctx.provider}`,
		);
	}

	let plaintextBytes: Uint8Array;
	try {
		plaintextBytes = await aesGcmDecrypt(
			dek,
			base64UrlToBytes(sealed.data_iv),
			base64UrlToBytes(sealed.ciphertext),
			buildAad(CIPHERTEXT_AAD_PREFIX, ctx),
		);
	} catch {
		throw new IntegrationSecretError(
			"DECRYPT_FAILED",
			`ciphertext authentication failed for ${ctx.domain}/${ctx.provider}`,
		);
	}

	let parsed: unknown;
	try {
		parsed = JSON.parse(textDecoder.decode(plaintextBytes));
	} catch {
		throw new IntegrationSecretError(
			"INVALID_PLAINTEXT",
			"sealed payload did not decode to valid JSON",
		);
	}
	if (
		!parsed ||
		typeof parsed !== "object" ||
		Array.isArray(parsed) ||
		Object.values(parsed as Record<string, unknown>).some(
			(v) => typeof v !== "string",
		)
	) {
		throw new IntegrationSecretError(
			"INVALID_PLAINTEXT",
			"sealed payload must be a flat string-valued object",
		);
	}

	return {
		fields: parsed as TFields,
		usedKid,
	};
}

/** Test-only helper for size budgeting (D1 row-size sanity). */
export function envelopeSerializedLength(sealed: SealedSecret): number {
	return JSON.stringify(sealed).length;
}
