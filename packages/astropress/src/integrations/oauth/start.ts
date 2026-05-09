/**
 * Pure helper for the `pages/ap-admin/oauth/start.ts` Astro endpoint.
 *
 * Given a registered OAuth provider, the request origin, an optional
 * post-auth `returnTo`, and the rootSecret, it issues a state token
 * (via {@link issueOAuthState}) and assembles the IdP authorization
 * URL. The Astro route layer is then a thin wrapper that:
 *
 *   1. ABAC-checks `integration:write`,
 *   2. CSRF-checks the form post,
 *   3. Calls this helper,
 *   4. Returns a 302 to `redirectUrl`.
 *
 * Splitting the URL-construction out keeps the route layer free of
 * crypto, and makes the redirect-URL shape mutation-testable.
 */

import type { OAuthProviderDefinition } from "./registry.js";
import { type IssuedOAuthState, issueOAuthState } from "./state.js";

export interface BuildAuthorizeRedirectArgs {
	readonly provider: OAuthProviderDefinition;
	readonly origin: string;
	readonly clientId: string;
	readonly returnTo: string;
	readonly rootSecret: string;
	readonly nowMs: number;
	readonly ttlMs?: number;
}

export interface BuildAuthorizeRedirectResult {
	readonly redirectUrl: string;
	readonly state: IssuedOAuthState;
}

export function buildRedirectUri(origin: string, redirectPath: string): string {
	// charCodeAt at a negative index returns NaN (never === 47), so the
	// loop self-terminates at end === 0 without an explicit guard.
	let end = origin.length;
	while (origin.charCodeAt(end - 1) === 47 /* '/' */) end -= 1;
	const trimmedOrigin = origin.slice(0, end);
	const path = redirectPath.startsWith("/") ? redirectPath : `/${redirectPath}`;
	return `${trimmedOrigin}${path}`;
}

export async function buildAuthorizeRedirect(
	args: BuildAuthorizeRedirectArgs,
): Promise<BuildAuthorizeRedirectResult> {
	const state = await issueOAuthState({
		context: {
			domain: args.provider.domain,
			providerId: args.provider.id,
			returnTo: args.returnTo,
		},
		rootSecret: args.rootSecret,
		nowMs: args.nowMs,
		ttlMs: args.ttlMs,
	});
	const url = new URL(args.provider.authorizationUrl);
	url.searchParams.set("client_id", args.clientId);
	url.searchParams.set("redirect_uri", buildRedirectUri(args.origin, args.provider.redirectPath));
	url.searchParams.set("response_type", "code");
	url.searchParams.set("scope", args.provider.scopes.join(" "));
	url.searchParams.set("state", state.token);
	return { redirectUrl: url.toString(), state };
}
