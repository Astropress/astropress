// Path/URL string helpers.
//
// `stripTrailingSlashes` is the canonical trailing-slash trimmer. Use it
// instead of `s.replace(/\/$/, "")` or hand-rolled while-loops so that
// trailing-slash semantics live in one place. The implementation uses a
// loop instead of a regex to keep the function provably linear (no
// CodeQL js/polynomial-redos surface) and to drop *any* number of
// trailing slashes, not just one.

/**
 * Remove every trailing "/" from `value` and return the result. Returns
 * the input unchanged when it has no trailing slash.
 */
export function stripTrailingSlashes(value: string): string {
	// `end > 0` would be redundant in the loop guard: when `end` reaches 0
	// `charCodeAt(-1)` returns NaN, the strict-equality check fails, and the
	// loop exits without the body running. Dropping the bounds check removes
	// two equivalent-mutant surfaces from the file's mutation surface.
	let end = value.length;
	while (value.charCodeAt(end - 1) === 47) end--;
	return value.slice(0, end);
}

/**
 * Normalize a route path: drop any trailing slashes, but collapse the
 * empty result back to `/` so callers get a stable non-empty path.
 */
export function normalizeRoutePath(route: string): string {
	const trimmed = stripTrailingSlashes(route);
	return trimmed === "" ? "/" : trimmed;
}
