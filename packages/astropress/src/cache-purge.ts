import type { CmsConfig } from "./config";
import {
	type ResolvedCdnPurge,
	resolveCdnPurge,
} from "./integrations/resolvers/cdn-purge-resolver.js";

/**
 * Issue a CDN purge for a single content slug against an already-resolved
 * configuration. The split between this function and {@link purgeCdnCache}
 * keeps the imperative I/O branches separate from source resolution —
 * the resolver is unit-tested for every priority/fallback path; this
 * function is unit-tested with mocked fetch for each `kind`.
 *
 * Failures are non-fatal: errors are logged with `console.warn` but
 * never thrown, so a CDN purge failure never blocks a content publish.
 */
export async function purgeCdnCacheForResolved(
	slug: string,
	resolved: ResolvedCdnPurge,
	deps: { readonly fetch?: typeof fetch } = {},
): Promise<void> {
	if (resolved.kind === "none") return;
	const fetchImpl = deps.fetch ?? fetch;
	const purgedAt = new Date().toISOString();

	if (resolved.kind === "cloudflare") {
		try {
			const url = `https://api.cloudflare.com/client/v4/zones/${encodeURIComponent(resolved.zoneId)}/purge_cache`;
			const res = await fetchImpl(url, {
				method: "POST",
				headers: {
					Authorization: `Bearer ${resolved.apiToken}`,
					"Content-Type": "application/json",
				},
				body: JSON.stringify({ tags: [`slug:${slug}`] }),
			});
			if (!res.ok) {
				const body = await res.text().catch(() => "");
				console.warn(
					`[cache-purge] Cloudflare purge failed for slug "${slug}": ${res.status} ${body}`,
				);
			}
		} catch (err) {
			console.warn(`[cache-purge] Cloudflare purge error for slug "${slug}":`, err);
		}
		return;
	}

	// kind === "webhook"
	try {
		const res = await fetchImpl(resolved.url, {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ slug, purgedAt }),
		});
		if (!res.ok) {
			const body = await res.text().catch(() => "");
			console.warn(`[cache-purge] Webhook purge failed for slug "${slug}": ${res.status} ${body}`);
		}
	} catch (err) {
		console.warn(`[cache-purge] Webhook purge error for slug "${slug}":`, err);
	}
}

/**
 * Legacy entry point — purges via env (Cloudflare) and/or static
 * `config.cdnPurgeWebhook`. Hosts that have admin-connected a
 * Cloudflare CDN provider via the Phase 4 connect flow should call
 * the registry-aware path instead (resolve via
 * {@link resolveCdnPurge} with `registry` populated, then
 * {@link purgeCdnCacheForResolved}).
 *
 * Backward-compatible: keeps the single-arg `(slug, config)` shape
 * that `runtime-actions-content.ts` and downstream callers already
 * use, so call-sites can migrate incrementally without a flag-day.
 */
export async function purgeCdnCache(
	slug: string,
	config: CmsConfig,
	registryFields?: {
		readonly apiToken: string;
		readonly zoneId: string;
	} | null,
): Promise<void> {
	const env = typeof process !== "undefined" ? process.env : undefined;
	const resolved = resolveCdnPurge({
		registry: registryFields,
		env: env
			? {
					CLOUDFLARE_API_TOKEN: env.CLOUDFLARE_API_TOKEN,
					CLOUDFLARE_ZONE_ID: env.CLOUDFLARE_ZONE_ID,
				}
			: undefined,
		config: { cdnPurgeWebhook: config.cdnPurgeWebhook },
	});
	await purgeCdnCacheForResolved(slug, resolved);
}
