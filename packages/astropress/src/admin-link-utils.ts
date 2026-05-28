function parseUrl(value: string | null | undefined, baseUrl: URL): URL | null {
	if (!value) return null;
	const trimmed = value.trim();
	if (!trimmed) return null;
	try {
		return new URL(trimmed, baseUrl);
	} catch {
		return null;
	}
}

export function resolveSafeAdminHref(
	baseUrl: URL,
	value: string | null | undefined,
	allowedPaths: string[],
): string | null {
	const parsed = parseUrl(value, baseUrl);
	if (!parsed || parsed.origin !== baseUrl.origin) return null;
	if (!allowedPaths.includes(parsed.pathname)) return null;
	return `${parsed.pathname}${parsed.search}${parsed.hash}`;
}

/** The admin base every safe post-auth redirect target must live under. */
const ADMIN_PATH_PREFIX = "/ap-admin/";

/**
 * Normalises an untrusted post-auth `returnTo` to a safe, same-origin admin
 * path. Unlike {@link resolveSafeAdminHref} this accepts any path *under*
 * `/ap-admin/` (prefix, not an exact allowlist) so OAuth flows can resume on
 * the page they started from — but anything else (cross-origin, protocol- or
 * scheme-relative, or outside the admin tree) collapses to `fallback`. This is
 * the open-redirect guard for the OAuth callback sink: the `returnTo` is signed
 * into the state at flow start, but it originates from user form input, so the
 * redirect sink must still normalise it (#123).
 */
export function resolveSafeAdminReturnTo(
	baseUrl: URL,
	value: string | null | undefined,
	fallback = "/ap-admin/services",
): string {
	const parsed = parseUrl(value, baseUrl);
	if (!parsed || parsed.origin !== baseUrl.origin) return fallback;
	if (!parsed.pathname.startsWith(ADMIN_PATH_PREFIX)) return fallback;
	return `${parsed.pathname}${parsed.search}${parsed.hash}`;
}
