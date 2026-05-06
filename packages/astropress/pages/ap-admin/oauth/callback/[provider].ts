import {
	buildRedirectUri,
	exchangeCodeForToken,
	getAstropressRootSecretCandidates,
	getOAuthProvider,
	verifyOAuthState,
} from "@astropress-diy/astropress";
import type { APIRoute } from "astro";

/**
 * OAuth authorization-code callback. The IdP redirects the operator
 * back here with `?code=…&state=…`; we verify the state under the
 * rootSecret, exchange the code for tokens against the provider's
 * `tokenUrl`, and redirect back to the original `returnTo`.
 *
 * Token sealing through the Phase 2 envelope is intentionally
 * deferred — the route lays down the full state-verify + token-
 * exchange path; persistence lives in a follow-up commit that wires
 * the IntegrationsRepository into the same callback context. That
 * keeps the surface area of this PR bounded.
 */

export const GET: APIRoute = async (context) => {
	const params = context.url.searchParams;
	const code = params.get("code");
	const stateToken = params.get("state");
	const providerSlug = context.params.provider;

	if (!code || !stateToken || !providerSlug) {
		return new Response("Missing code, state, or provider.", { status: 400 });
	}

	const rootSecret = getAstropressRootSecretCandidates(context.locals)[0];
	if (!rootSecret) {
		return new Response("Root secret unavailable.", { status: 500 });
	}

	const verified = await verifyOAuthState({
		token: stateToken,
		rootSecret,
		nowMs: Date.now(),
	});
	if (!verified.ok) {
		return new Response(`OAuth state rejected: ${verified.code}`, {
			status: 400,
		});
	}

	const provider = getOAuthProvider(
		verified.context.domain as Parameters<typeof getOAuthProvider>[0],
		verified.context.providerId,
	);
	if (!provider || provider.id !== providerSlug) {
		return new Response("OAuth provider not found or slug mismatch.", {
			status: 404,
		});
	}

	const env =
		(context.locals as { runtime?: { env?: Record<string, string> } } | null)?.runtime?.env ??
		(typeof process !== "undefined" ? process.env : {});
	const clientId = env[provider.clientIdEnv];
	const clientSecret = env[provider.clientSecretEnv];
	if (!clientId || !clientSecret) {
		return new Response("OAuth client credentials are not configured.", {
			status: 500,
		});
	}

	const redirectUri = buildRedirectUri(context.url.origin, provider.redirectPath);
	const result = await exchangeCodeForToken({
		tokenUrl: provider.tokenUrl,
		clientId,
		clientSecret,
		code,
		redirectUri,
	});
	if (!result.ok) {
		return new Response(`OAuth token exchange failed: ${result.code}`, {
			status: 502,
		});
	}

	// TODO: seal `result.tokens` via Phase 2 envelope into
	// integration_secrets. Until that lands, redirect back with a
	// query flag so the operator sees that the OAuth round-trip
	// completed end-to-end.
	const returnTo = verified.context.returnTo || "/ap-admin/services";
	const sep = returnTo.includes("?") ? "&" : "?";
	return context.redirect(`${returnTo}${sep}oauth_pending_seal=1`);
};
