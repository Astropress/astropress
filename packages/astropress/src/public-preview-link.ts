export interface PublicPreviewLink {
	/** Same-origin or absolute href to open the published page, or null. */
	href: string | null;
	/** True when the target is expected to resolve; false → render disabled. */
	available: boolean;
}

/**
 * Resolve an admin listing's "Open page/route" preview link (#181).
 *
 * The public site is a *separate origin* from the admin by design — the
 * production admin carries zero admin surface — so a bare same-origin `path`
 * only resolves when the public renderer is actually served by the running app.
 * Three cases:
 *   1. the public renderer is present in this app (scaffold `astro dev`, which
 *      composes createAstropressPublicSiteIntegration) → same-origin path;
 *   2. no renderer here, but a public site is configured at a *different* origin
 *      (production admin) → absolute `siteUrl` + path;
 *   3. otherwise — no renderer here and no distinct public origin (the admin
 *      harness, whose siteUrl is its own origin) → unavailable, so the caller
 *      renders a disabled affordance instead of a link that silently 404s.
 */
export function resolvePublicPreviewLink(params: {
	baseUrl: URL;
	path: string | null | undefined;
	siteUrl: string | null | undefined;
	publicRendererPresent: boolean;
}): PublicPreviewLink {
	const { baseUrl, path, siteUrl, publicRendererPresent } = params;
	if (!path) return { href: null, available: false };
	const rel = path.startsWith("/") ? path : `/${path}`;

	// (1) This app serves the public renderer → a same-origin link resolves.
	if (publicRendererPresent) return { href: rel, available: true };

	// (2) A public site at a genuinely different origin → link there absolutely.
	// URL.parse returns null for unparseable input (no throw); a relative/own-origin
	// siteUrl resolves to baseUrl.origin and is rejected by the origin check below.
	const site = siteUrl ? URL.parse(siteUrl, baseUrl.href) : null;
	if (site && site.origin !== baseUrl.origin) {
		return { href: `${site.origin}${rel}`, available: true };
	}

	// (3) No renderer here and no distinct public origin → honest disabled state.
	return { href: null, available: false };
}
