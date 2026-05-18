/**
 * Persistence half of the OAuth authorization-code flow.
 *
 * The callback route (`pages/ap-admin/oauth/callback/[provider].ts`) owns
 * state verification, code-for-token exchange, and the final redirect.
 * Once the exchange returns a token set, this helper seals those tokens
 * under the Phase 2 envelope into the `integration_secrets` table via
 * `IntegrationsRepository.connect()`.
 *
 * Why a separate module:
 *   * the seal step is the only piece of the callback that touches the
 *     runtime store, so it benefits from being unit-testable in
 *     isolation with an in-memory SQLite repository (no Astro request
 *     plumbing required); and
 *   * the route file stays a thin orchestrator, which keeps the
 *     `audit:route-http-matrix` greps stable.
 *
 * Plaintext discipline:
 *   * `tokensToSecretFields` is the *only* place that copies bytes out
 *     of `OAuthTokenSet`; everything below this layer sees the sealed
 *     ciphertext;
 *   * structured error shapes never include token material — see the
 *     tests under `tests/integrations/oauth/seal-callback.test.ts`,
 *     which assert that no error path leaks `accessToken`,
 *     `refreshToken`, or any provider-supplied substring.
 */

import { withLocalStoreFallback } from "../../admin-store-dispatch.js";
import type { OAuthTokenSet } from "./token-exchange";

export type SealOAuthCallbackErrorCode = "INTEGRATIONS_NOT_AVAILABLE" | "SEAL_FAILED";

export type SealOAuthCallbackResult =
	| { readonly ok: true }
	| { readonly ok: false; readonly code: SealOAuthCallbackErrorCode };

export interface SealOAuthCallbackInput {
	readonly domain: string;
	readonly provider: string;
	readonly tokens: OAuthTokenSet;
	readonly rootSecret: string;
	readonly now: string;
}

/**
 * Project an OAuthTokenSet into the `Record<string,string>` shape that
 * `sealIntegrationSecret` expects. `expiresIn` (a number) is stringified;
 * optional fields are only included when present so they don't seal as
 * the literal string "undefined".
 *
 * Exported (not internal) so the security tests can pin the exact key
 * set — any field we later widen the token set to must be threaded
 * through here, and the tests catch silent omissions.
 */
export function tokensToSecretFields(tokens: OAuthTokenSet): Record<string, string> {
	const out: Record<string, string> = {
		accessToken: tokens.accessToken,
		tokenType: tokens.tokenType,
	};
	if (tokens.refreshToken !== undefined) {
		out.refreshToken = tokens.refreshToken;
	}
	if (tokens.expiresIn !== undefined) {
		out.expiresIn = String(tokens.expiresIn);
	}
	if (tokens.scope !== undefined) {
		out.scope = tokens.scope;
	}
	return out;
}

export async function sealOAuthCallbackTokens(
	locals: App.Locals | null | undefined,
	input: SealOAuthCallbackInput,
): Promise<SealOAuthCallbackResult> {
	const secretFields = tokensToSecretFields(input.tokens);
	return withLocalStoreFallback<SealOAuthCallbackResult>(
		locals,
		// D1 path: IntegrationsRepository over D1 has not landed yet
		// (issue #81). Mirror runtime-actions-integrations.ts: return a
		// typed INTEGRATIONS_NOT_AVAILABLE rather than silently writing
		// to a half-implemented store.
		async () => ({ ok: false, code: "INTEGRATIONS_NOT_AVAILABLE" }),
		async (store) => {
			const repo = store.integrations;
			if (!repo) {
				return { ok: false, code: "INTEGRATIONS_NOT_AVAILABLE" };
			}
			try {
				await repo.connect(
					{
						domain: input.domain,
						provider: input.provider,
						secretFields,
						configJson: "{}",
						now: input.now,
					},
					input.rootSecret,
				);
				return { ok: true };
			} catch {
				// Swallow the error *body* deliberately — repo.connect's
				// failure modes (DB write error, sealIntegrationSecret
				// envelope failure) can carry input substrings in their
				// messages, and we never want token material on the
				// response or in audit logs from this helper.
				return { ok: false, code: "SEAL_FAILED" };
			}
		},
	);
}
