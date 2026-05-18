import {
	buildRedirectUri,
	exchangeCodeForToken,
	getAstropressRootSecretCandidates,
	getOAuthProvider,
	sealOAuthCallbackTokens,
	verifyOAuthState,
} from "@astropress-diy/astropress";
import type { APIRoute } from "astro";

/**
 * OAuth authorization-code callback. The IdP redirects the operator
 * back here with `?code=…&state=…`; we verify the state under the
 * rootSecret, exchange the code for tokens against the provider's
 * `tokenUrl`, seal the tokens via the Phase 2 envelope into
 * `integration_secrets`, then redirect back to the original
 * `returnTo` without surfacing any token material in the URL or
 * response body.
 *
 * Failure modes — each maps to a fixed status + opaque body:
 *   400 — missing query params, unrecognised state, or signature
 *         mismatch.
 *   404 — verified state references a provider/slug that the registry
 *         no longer exposes.
 *   500 — root-secret unavailable, OAuth client credentials missing,
 *         or token sealing failed.
 *   502 — token-endpoint exchange failed (network or HTTP error).
 *
 * Persistence happens inline via `sealOAuthCallbackTokens`. Sealing
 * failures bubble up as 500 with a structured code; the route never
 * returns success while leaving secrets unpersisted.
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

	const sealed = await sealOAuthCallbackTokens(context.locals, {
		domain: verified.context.domain,
		provider: provider.id,
		tokens: result.tokens,
		rootSecret,
		now: new Date().toISOString(),
	});
	if (!sealed.ok) {
		// Opaque code only — never include any part of `result.tokens` in
		// the response. The structured code is enough for the operator to
		// surface in the admin UI; the underlying error is captured in
		// the runtime log via the repo layer.
		return new Response(`OAuth token persistence failed: ${sealed.code}`, {
			status: 500,
		});
	}

	const returnTo = verified.context.returnTo || "/ap-admin/services";
	return context.redirect(returnTo);
};
