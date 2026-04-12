import { Hono } from "hono";
import type { NexusConfig, FanOutResult, ContentItem } from "./types.js";
import { SiteRegistry } from "./registry.js";
import { checkSiteHealth, proxySiteRequest } from "./site-client.js";
import { getAggregateMetrics } from "./metrics-cache.js";

export type NexusAppOptions = {
  config: NexusConfig;
  /** Org-level bearer token required on all protected routes. If omitted, auth is disabled. */
  authToken?: string;
};

export function createNexusApp(options: NexusAppOptions): Hono {
  const { config, authToken } = options;
  const registry = new SiteRegistry(config);
  const app = new Hono();

  // ── Auth middleware (applied to all routes except GET /) ──────────────────
  app.use("/*", async (c, next) => {
    // Health check is public
    if (c.req.method === "GET" && (c.req.path === "/" || c.req.path === "")) {
      return next();
    }

    if (!authToken) {
      return next();
    }

    const authorization = c.req.header("Authorization");
    const token = authorization?.startsWith("Bearer ") ? authorization.slice(7) : null;

    if (!token || token !== authToken) {
      return c.json({ error: "Unauthorized" }, 401);
    }

    return next();
  });

  // ── GET / — public health check ───────────────────────────────────────────
  app.get("/", async (c) => {
    const sites = registry.getAll();
    const healthChecks = await Promise.allSettled(sites.map((s) => checkSiteHealth(s)));

    const siteStatuses = healthChecks.map((r, i) => {
      if (r.status === "fulfilled") return r.value;
      return { id: sites[i].id, name: sites[i].name, baseUrl: sites[i].baseUrl, status: "degraded" as const, error: "check failed" };
    });

    const allOk = siteStatuses.every((s) => s.status === "ok");
    return c.json({
      status: allOk ? "ok" : "degraded",
      siteCount: sites.length,
      sites: siteStatuses,
    });
  });

  // ── GET /sites — list all sites with health ───────────────────────────────
  app.get("/sites", async (c) => {
    const sites = registry.getAll();
    const healthChecks = await Promise.allSettled(sites.map((s) => checkSiteHealth(s)));

    const siteStatuses = healthChecks.map((r, i) => {
      if (r.status === "fulfilled") return r.value;
      return { id: sites[i].id, name: sites[i].name, baseUrl: sites[i].baseUrl, status: "degraded" as const };
    });

    return c.json(siteStatuses);
  });

  // ── GET /sites/:id — single site metadata + health ────────────────────────
  app.get("/sites/:id", async (c) => {
    const id = c.req.param("id");
    const site = registry.get(id);
    if (!site) {
      return c.json({ error: `Site '${id}' not found` }, 404);
    }
    const health = await checkSiteHealth(site);
    return c.json(health);
  });

  // ── GET /sites/:id/content — proxy to member site content ────────────────
  app.get("/sites/:id/content", async (c) => {
    const id = c.req.param("id");
    const site = registry.get(id);
    if (!site) {
      return c.json({ error: `Site '${id}' not found` }, 404);
    }
    const url = new URL(c.req.url);
    const result = await proxySiteRequest(site, "content", url.searchParams);
    return c.json(result.body, result.status as 200 | 502);
  });

  // ── GET /sites/:id/content/:slug — proxy single record ───────────────────
  app.get("/sites/:id/content/:slug", async (c) => {
    const id = c.req.param("id");
    const slug = c.req.param("slug");
    const site = registry.get(id);
    if (!site) {
      return c.json({ error: `Site '${id}' not found` }, 404);
    }
    const result = await proxySiteRequest(site, `content/${encodeURIComponent(slug)}`);
    return c.json(result.body, result.status as 200 | 404 | 502);
  });

  // ── GET /sites/:id/media — proxy to member site media ────────────────────
  app.get("/sites/:id/media", async (c) => {
    const id = c.req.param("id");
    const site = registry.get(id);
    if (!site) {
      return c.json({ error: `Site '${id}' not found` }, 404);
    }
    const url = new URL(c.req.url);
    const result = await proxySiteRequest(site, "media", url.searchParams);
    return c.json(result.body, result.status as 200 | 502);
  });

  // ── GET /sites/:id/settings — proxy to member site settings ──────────────
  app.get("/sites/:id/settings", async (c) => {
    const id = c.req.param("id");
    const site = registry.get(id);
    if (!site) {
      return c.json({ error: `Site '${id}' not found` }, 404);
    }
    const result = await proxySiteRequest(site, "settings");
    return c.json(result.body, result.status as 200 | 502);
  });

  // ── GET /content — fan-out across all sites ───────────────────────────────
  app.get("/content", async (c) => {
    const sites = registry.getAll();
    const url = new URL(c.req.url);

    const results = await Promise.allSettled(
      sites.map(async (site): Promise<FanOutResult<ContentItem[]>> => {
        const result = await proxySiteRequest(site, "content", url.searchParams);
        if (!result.ok) {
          return { siteId: site.id, status: "degraded", error: String((result.body as Record<string, unknown>).error ?? "request failed") };
        }
        const items = (Array.isArray(result.body) ? result.body : (result.body as Record<string, unknown>).items ?? []) as ContentItem[];
        const tagged = items.map((item) => ({ ...item, siteId: site.id }));
        return { siteId: site.id, status: "ok", data: tagged };
      }),
    );

    const items: ContentItem[] = [];
    const degraded: Array<{ siteId: string; error: string }> = [];

    for (const r of results) {
      if (r.status === "fulfilled") {
        if (r.value.status === "ok" && r.value.data) {
          items.push(...r.value.data);
        } else {
          degraded.push({ siteId: r.value.siteId, error: r.value.error ?? "unknown" });
        }
      }
    }

    return c.json({ items, degraded, total: items.length });
  });

  // ── GET /metrics — cached aggregate metrics ───────────────────────────────
  app.get("/metrics", async (c) => {
    const sites = registry.getAll();
    const metrics = await getAggregateMetrics(sites);
    return c.json(metrics);
  });

  return app;
}
