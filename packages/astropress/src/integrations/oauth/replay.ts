/**
 * OAuth state-nonce replay protection.
 *
 * The OAuth state token is stateless and signed (see `state.ts`), which makes
 * it unforgeable but NOT single-use on its own: a captured-but-valid state can
 * be replayed against the callback until it expires. `verifyOAuthState` returns
 * the per-flow `nonce` precisely so the callback can record first use and
 * reject replays (#122).
 *
 * Rather than introduce a new table we record the nonce in the existing
 * rate-limit window with `max = 1`: the first callback for a given nonce is
 * "under limit" (allowed), every subsequent one is "over limit" (rejected).
 * The window TTL matches the state's own lifetime so the record outlives any
 * state that could still verify.
 */

import { checkRuntimeRateLimit } from "../../runtime-mutation-store.js";
import { DEFAULT_OAUTH_STATE_TTL_MS } from "./state.js";

/** Namespacing prefix so OAuth nonces never collide with other rate-limit keys. */
export const OAUTH_NONCE_RATE_KEY_PREFIX = "oauth-state-nonce:";

/**
 * Atomically records that `nonce` has been seen. Returns `true` on the first
 * call for a nonce (the caller should proceed) and `false` on every later call
 * (a replay — the caller must reject). `ttlMs` defaults to the state TTL.
 */
export async function consumeOAuthStateNonce(
	locals: App.Locals | null | undefined,
	nonce: string,
	ttlMs: number = DEFAULT_OAUTH_STATE_TTL_MS,
): Promise<boolean> {
	return checkRuntimeRateLimit(`${OAUTH_NONCE_RATE_KEY_PREFIX}${nonce}`, 1, ttlMs, locals);
}
