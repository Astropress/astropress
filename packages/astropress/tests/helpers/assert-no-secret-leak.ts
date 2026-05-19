import { expect } from "vitest";

/**
 * Assert that none of the supplied secret canaries appear in the given
 * haystack (a response body, redirect URL, DB-row dump, log line, etc.).
 *
 * Security tests that handle live token/secret material universally
 * pattern-match the same "scan a string for a literal" check. Co-locating
 * the helper here means:
 *
 *   - one definition to grep when adding a new canary category;
 *   - every assertion failure looks the same in CI output, so a leak
 *     regression is recognisable at a glance;
 *   - new tests inherit the .not.toContain semantics (whole-string scan,
 *     no regex escaping pitfalls) without copy-pasting.
 *
 * Pass the canary literals you want to check for. The function is
 * variadic so call sites read as:
 *
 *   assertNoSecretLeak(body, CANARY_ACCESS, CANARY_REFRESH, CANARY_SCOPE);
 *
 * The haystack is coerced to string so callers can pass JSON-serialisable
 * objects without an explicit `JSON.stringify` on each call.
 */
export function assertNoSecretLeak(haystack: unknown, ...canaries: readonly string[]): void {
	const text = typeof haystack === "string" ? haystack : JSON.stringify(haystack);
	for (const canary of canaries) {
		expect(text).not.toContain(canary);
	}
}
