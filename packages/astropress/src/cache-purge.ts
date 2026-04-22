import type { CmsConfig } from "./config";

/**
 * Purges CDN cache for a specific content slug after it is published.
 *
 * Supports three purge strategies:
 * 1. Generic webhook — POST `{ slug, purgedAt }` to `config.cdnPurgeWebhook`
 * 2. Cloudflare Cache API — uses CLOUDFLARE_ZONE_ID + CLOUDFLARE_API_TOKEN env vars
 * 3. Both can be active simultaneously (webhook fires after Cloudflare API call)
 *
 * Failures are non-fatal: errors are logged with `console.warn` but never thrown,
 * so a CDN purge failure never blocks a content publish operation.
 *
 * @example
 * ```ts
 * await purgeCdnCache("my-post-slug", getCmsConfig());
 * ```
 */
export async function purgeCdnCache(
	slug: string,
	config: CmsConfig,
): Promise<void> {
	const purgedAt = new Date().toISOString();
	const promises: Promise<void>[] = [];

	// Strategy 1: Cloudflare Cache API
	const cfZoneId =
		typeof process !== "undefined"
			? process.env?.CLOUDFLARE_ZONE_ID
			: undefined;
	const cfApiToken =
		typeof process !== "undefined"
			? process.env?.CLOUDFLARE_API_TOKEN
			: undefined;

	if (cfZoneId && cfApiToken) {
		promises.push(
			(async () => {
				const cfUrl = `https://api.cloudflare.com/client/v4/zones/${cfZoneId}/purge_cache`;
				const res = await fetch(cfUrl, {
					method: "POST",
					headers: {
						Authorization: `Bearer ${cfApiToken}`,
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
			})().catch((err: unknown) => {
				console.warn(
					`[cache-purge] Cloudflare purge error for slug "${slug}":`,
					err,
				);
			}),
		);
	}

	// Strategy 2: Generic webhook (Vercel, Netlify, custom)
	if (config.cdnPurgeWebhook) {
		promises.push(
			(async () => {
				const res = await fetch(config.cdnPurgeWebhook, {
					method: "POST",
					headers: { "Content-Type": "application/json" },
					body: JSON.stringify({ slug, purgedAt }),
				});
				if (!res.ok) {
					const body = await res.text().catch(() => "");
					console.warn(
						`[cache-purge] Webhook purge failed for slug "${slug}": ${res.status} ${body}`,
					);
				}
			})().catch((err: unknown) => {
				console.warn(
					`[cache-purge] Webhook purge error for slug "${slug}":`,
					err,
				);
			}),
		);
	}

	if (promises.length > 0) {
		await Promise.all(promises);
	}
}
