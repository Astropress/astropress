import { peekCmsConfig } from "./config.js";

/**
 * Resolve the canonical site origin for machine-consumed public outputs
 * (sitemap.xml, robots.txt, llms.txt).
 *
 * Trusted-origin resolution rule:
 *   1. If `CmsConfig.siteUrl` is configured and parseable, its origin wins.
 *      This keeps these outputs stable behind proxies, alternate hosts, and
 *      SSR adapters that rewrite the inbound `request.url` host.
 *   2. Otherwise fall back to the request-derived origin so the routes still
 *      work in zero-config / preview setups where no siteUrl is registered.
 *
 * Using the configured origin (rather than `new URL(request.url).origin`)
 * means an attacker-controlled `Host`/`X-Forwarded-Host` header cannot poison
 * the canonical URLs we advertise to crawlers. See issue #124.
 */
export function resolveCanonicalOrigin(request: { url: string }): string {
	const configured = peekCmsConfig()?.siteUrl;
	if (configured) {
		try {
			return new URL(configured).origin;
		} catch {
			// Malformed siteUrl — fall through to the request-derived origin.
		}
	}
	return new URL(request.url).origin;
}
