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
	): Promise<
		{ valid: true; record: ApiTokenRecord } | { valid: false; reason: string }
	>;
	revoke(id: string): Promise<void>;
}
