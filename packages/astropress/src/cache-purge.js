/**
 * Purges CDN cache for a specific content slug after it is published.
 *
 * Supports Cloudflare Cache API (via env vars) and generic webhooks (Vercel, Netlify, custom).
 * Failures are non-fatal: errors are logged but never thrown.
 */
export async function purgeCdnCache(slug, config) {
  const purgedAt = new Date().toISOString();
  const promises = [];

  // Strategy 1: Cloudflare Cache API
  const cfZoneId = typeof process !== "undefined" ? process.env?.CLOUDFLARE_ZONE_ID : undefined;
  const cfApiToken = typeof process !== "undefined" ? process.env?.CLOUDFLARE_API_TOKEN : undefined;

  if (cfZoneId && cfApiToken) {
    promises.push(
      (async () => {
        const cfUrl = `https://api.cloudflare.com/client/v4/zones/${cfZoneId}/purge_cache`;
        const res = await fetch(cfUrl, {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${cfApiToken}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ tags: [`slug:${slug}`] }),
        });
        if (!res.ok) {
          const body = await res.text().catch(() => "");
          console.warn(`[cache-purge] Cloudflare purge failed for slug "${slug}": ${res.status} ${body}`);
        }
      })().catch((err) => {
        console.warn(`[cache-purge] Cloudflare purge error for slug "${slug}":`, err);
      })
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
          console.warn(`[cache-purge] Webhook purge failed for slug "${slug}": ${res.status} ${body}`);
        }
      })().catch((err) => {
        console.warn(`[cache-purge] Webhook purge error for slug "${slug}":`, err);
      })
    );
  }

  if (promises.length > 0) {
    await Promise.all(promises);
  }
}
