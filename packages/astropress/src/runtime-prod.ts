/**
 * Leaf module for production-mode detection and the root-secret fail-closed
 * helpers.
 *
 * Deliberately free of `App.Locals` / Astro-global references so it can be
 * imported by low-level utilities (e.g. sqlite-runtime/utils for token
 * hashing) without dragging the Astro global augmentation into every
 * consumer's TS program. `runtime-env.ts` re-exports these for back-compat.
 */

function importMetaEnv(): Record<string, string | undefined> {
	return (
		(
			import.meta as ImportMeta & {
				env?: Record<string, string | undefined>;
			}
		).env ?? {}
	);
}

/** Reads a runtime env value from process.env first, then import.meta.env. */
export function getRuntimeEnvValue(key: string): string | undefined {
	return process.env[key] ?? importMetaEnv()[key];
}

/** True when the runtime reports PROD (env `PROD` === "true" | "1"). */
export function isProductionRuntime(): boolean {
	const value = getRuntimeEnvValue("PROD");
	return value === "true" || value === "1";
}

/**
 * The single literal occurrence of the development root-secret fallback.
 * All other code that needs it MUST import this constant or — preferably —
 * call `devRootSecretOrThrow()` / `resolveTokenHashSecret()`.
 * `audit-dev-secret-fail-closed` forbids any second source of this string.
 */
export const DEV_ROOT_SECRET_FALLBACK = "astropress-dev-root-secret";

/**
 * Returns the development root-secret fallback in non-production runtimes,
 * or throws in production. Fixes #126 / #132: a production deployment missing
 * `ASTROPRESS_ROOT_SECRET` / `SESSION_SECRET` must not silently protect
 * sessions, invite/reset tokens, API tokens, or sealed integration secrets
 * with a publicly-known constant.
 */
export function devRootSecretOrThrow(): string {
	if (isProductionRuntime()) {
		throw new Error(
			"Astropress: ASTROPRESS_ROOT_SECRET (or SESSION_SECRET) must be configured " +
				"in production. Refusing to fall back to the public development root secret " +
				"for session/token/integration-seal protection.",
		);
	}
	return DEV_ROOT_SECRET_FALLBACK;
}

/**
 * Resolves the per-call secret used for opaque-token hashing. Callers that
 * thread a configured secret pass it through; callers that omit/pass
 * `undefined`/`null` get the dev fallback in non-production and a fail-closed
 * throw in production.
 *
 * `!= null` (not `??`/falsy) so an explicit empty-string secret still flows
 * through unchanged — a weak choice but not the implicit fallback #132 targets.
 */
export function resolveTokenHashSecret(secret?: string | null): string {
	if (secret != null) return secret;
	return devRootSecretOrThrow();
}
