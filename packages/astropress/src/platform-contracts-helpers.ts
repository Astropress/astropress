// stryker-disable-file: data-only — pure type declarations (ApiScope, ApiTokenId, ApiTokenRecord, ApiTokenStore, FlashStore); no runtime code to mutate.
// ─── API Token Store ──────────────────────────────────────────────────────────
// Extracted to keep platform-contracts.ts under the 400-line limit.

export type ApiScope =
	| "content:read"
	| "content:write"
	| "media:read"
	| "media:write"
	| "settings:read"
	| "webhooks:manage"
	| "import:write";

/** An API token ID — prevents mixing with other ID types. */
export type ApiTokenId = string & { readonly __brand: "ApiTokenId" };

export interface ApiTokenRecord {
	id: string;
	label: string;
	scopes: ApiScope[];
	createdAt: string;
	expiresAt?: string | null;
	lastUsedAt?: string | null;
	revokedAt?: string | null;
}

export interface ApiTokenStore {
	create(input: {
		label: string;
		scopes: ApiScope[];
		expiresAt?: string;
	}): Promise<{ record: ApiTokenRecord; rawToken: string }>;
	list(): Promise<ApiTokenRecord[]>;
	verify(
		rawToken: string,
	): Promise<{ valid: true; record: ApiTokenRecord } | { valid: false; reason: string }>;
	revoke(id: string): Promise<void>;
}

// ─── Flash Store (one-time server-side secret hand-off) ─────────────────────
/**
 * Single-read-then-delete store for secret payloads that must survive a
 * POST→redirect→GET round trip WITHOUT ever appearing in the URL. The action
 * handler {@link FlashStore.put}s the secret and redirects carrying only an
 * opaque `flash=<id>`; the destination page {@link FlashStore.consume}s it
 * exactly once, server-side. This is the fix for the secret-in-URL class
 * (raw API tokens, webhook keys, reset/invite links) — see issues
 * #113, #115, #133. The opaque id is non-guessable and the entry self-expires.
 */
export interface FlashStore {
	/**
	 * Persists a payload and returns its opaque id. The entry expires after
	 * `ttlMs` (default 5 minutes) so an abandoned redirect can't leak later.
	 */
	put(payload: string, ttlMs?: number): Promise<{ id: string }>;
	/**
	 * Returns the payload and deletes it in the same call (single-use). Returns
	 * null when the id is unknown, already consumed, or expired.
	 */
	consume(id: string): Promise<string | null>;
}
