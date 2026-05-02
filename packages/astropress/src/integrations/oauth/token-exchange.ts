/**
 * Pure helper that exchanges an authorization-code for an access token
 * against the standard OAuth 2.0 token endpoint shape (RFC 6749 §4.1.3).
 *
 * The Astro callback route layer is then responsible for:
 *
 *   1. ABAC + state verification (already covered in
 *      `oauth/state.ts` and the surrounding admin-action utilities);
 *   2. Calling this helper with the registered provider's
 *      `tokenUrl`, the env-resolved client id/secret, and the
 *      `code` returned by the IdP;
 *   3. Sealing the resulting tokens via the Phase 2 envelope.
 *
 * Splitting this out means the network branches (200 / 4xx / 5xx /
 * malformed JSON) are fully unit-testable with an injected fetch.
 */

export interface ExchangeCodeForTokenArgs {
	readonly tokenUrl: string;
	readonly clientId: string;
	readonly clientSecret: string;
	readonly code: string;
	readonly redirectUri: string;
	readonly fetch?: typeof fetch;
}

export interface OAuthTokenSet {
	readonly accessToken: string;
	readonly tokenType: string;
	readonly refreshToken?: string;
	readonly expiresIn?: number;
	readonly scope?: string;
}

export type OAuthTokenExchangeErrorCode =
	| "TOKEN_HTTP_ERROR"
	| "TOKEN_MALFORMED"
	| "TOKEN_NETWORK_ERROR";

export type OAuthTokenExchangeResult =
	| { readonly ok: true; readonly tokens: OAuthTokenSet }
	| {
			readonly ok: false;
			readonly code: OAuthTokenExchangeErrorCode;
			readonly status?: number;
	  };

interface RawTokenResponse {
	access_token?: unknown;
	token_type?: unknown;
	refresh_token?: unknown;
	expires_in?: unknown;
	scope?: unknown;
}

function parseTokenResponse(raw: unknown): OAuthTokenSet | null {
	if (typeof raw !== "object" || raw === null) return null;
	const r = raw as RawTokenResponse;
	if (typeof r.access_token !== "string" || r.access_token.length === 0) {
		return null;
	}
	const tokenType =
		typeof r.token_type === "string" && r.token_type.length > 0
			? r.token_type
			: "bearer";
	const tokens: OAuthTokenSet = {
		accessToken: r.access_token,
		tokenType,
		...(typeof r.refresh_token === "string" && r.refresh_token.length > 0
			? { refreshToken: r.refresh_token }
			: {}),
		...(typeof r.expires_in === "number" && Number.isFinite(r.expires_in)
			? { expiresIn: r.expires_in }
			: {}),
		...(typeof r.scope === "string" ? { scope: r.scope } : {}),
	};
	return tokens;
}

export async function exchangeCodeForToken(
	args: ExchangeCodeForTokenArgs,
): Promise<OAuthTokenExchangeResult> {
	const fetchImpl = args.fetch ?? fetch;
	const body = new URLSearchParams({
		grant_type: "authorization_code",
		code: args.code,
		redirect_uri: args.redirectUri,
		client_id: args.clientId,
		client_secret: args.clientSecret,
	});
	let response: Response;
	try {
		response = await fetchImpl(args.tokenUrl, {
			method: "POST",
			headers: {
				Accept: "application/json",
				"Content-Type": "application/x-www-form-urlencoded",
			},
			body: body.toString(),
		});
	} catch {
		return { ok: false, code: "TOKEN_NETWORK_ERROR" };
	}
	if (!response.ok) {
		return { ok: false, code: "TOKEN_HTTP_ERROR", status: response.status };
	}
	let parsed: unknown;
	try {
		parsed = await response.json();
	} catch {
		return { ok: false, code: "TOKEN_MALFORMED" };
	}
	const tokens = parseTokenResponse(parsed);
	if (!tokens) return { ok: false, code: "TOKEN_MALFORMED" };
	return { ok: true, tokens };
}
