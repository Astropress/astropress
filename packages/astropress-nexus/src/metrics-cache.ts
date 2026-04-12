import type { AggregateMetrics, SiteEntry, SiteStatus } from "./types.js";
import { proxySiteRequest } from "./site-client.js";

const CACHE_TTL_MS = 30_000;

type CacheEntry = {
  data: AggregateMetrics;
  expiresAt: number;
};

let cache: CacheEntry | null = null;

export function clearMetricsCache(): void {
  cache = null;
}

export async function getAggregateMetrics(
  sites: SiteEntry[],
  now = Date.now,
): Promise<AggregateMetrics> {
  const currentTime = now();

  if (cache && cache.expiresAt > currentTime) {
    return cache.data;
  }

  const results = await Promise.allSettled(
    sites.map(async (site) => {
      const result = await proxySiteRequest(site, "metrics");
      return { site, result };
    }),
  );

  let totalPosts = 0;
  let totalPages = 0;
  let totalMedia = 0;
  let reachableSites = 0;
  let degradedSites = 0;

  const siteMetrics = results.map((r) => {
    if (r.status === "fulfilled") {
      const { site, result } = r.value;

      if (result.ok && result.body && typeof result.body === "object") {
        const body = result.body as Record<string, unknown>;
        const posts = typeof body.posts === "number" ? body.posts : 0;
        const pages = typeof body.pages === "number" ? body.pages : 0;
        const media = typeof body.media === "number" ? body.media : 0;
        totalPosts += posts;
        totalPages += pages;
        totalMedia += media;
        reachableSites++;
        return { id: site.id, status: "ok" as SiteStatus, posts, pages, media };
      }

      degradedSites++;
      return { id: site.id, status: "degraded" as SiteStatus };
    }

    const site = sites.find((s) => s.id);
    degradedSites++;
    return { id: site?.id ?? "unknown", status: "degraded" as SiteStatus };
  });

  const metrics: AggregateMetrics = {
    siteCount: sites.length,
    reachableSites,
    degradedSites,
    totalPosts,
    totalPages,
    totalMedia,
    sites: siteMetrics,
  };

  cache = { data: metrics, expiresAt: currentTime + CACHE_TTL_MS };
  return metrics;
}
