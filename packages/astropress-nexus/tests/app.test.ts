import { describe, it, expect, vi, beforeEach } from "vitest";
import { createNexusApp } from "../src/app.js";
import type { NexusConfig } from "../src/types.js";

// ─── Test config ─────────────────────────────────────────────────────────────

const testConfig: NexusConfig = {
  sites: [
    {
      id: "site-a",
      name: "Site A",
      baseUrl: "https://site-a.example.com",
      token: "token-a",
      adminUrl: "https://site-a.example.com/ap-admin",
      deployHookUrl: "https://deploy.example.com/site-a",
      description: "Primary marketing property",
    },
    { id: "site-b", name: "Site B", baseUrl: "https://site-b.example.com", token: "token-b", description: "Docs property" },
  ],
  dashboardTitle: "Astropress Nexus",
};

const ORG_TOKEN = "org-secret-token";

// ─── Fetch mock helpers ───────────────────────────────────────────────────────

function makeFetchMock(handler: (url: string) => { ok: boolean; status: number; body: unknown }) {
  return vi.fn(async (url: RequestInfo | URL) => {
    const urlStr = url.toString();
    const result = handler(urlStr);
    return {
      ok: result.ok,
      status: result.status,
      json: async () => result.body,
    } as Response;
  });
}

function networkError(): Response {
  throw new Error("network error");
}

// ─── Helper: call Hono app directly ──────────────────────────────────────────

async function callApp(
  app: ReturnType<typeof createNexusApp>,
  path: string,
  options: { token?: string; method?: string; body?: BodyInit | null; contentType?: string } = {},
): Promise<{ status: number; body: unknown; text: string }> {
  const headers: Record<string, string> = {};
  if (options.token) {
    headers["Authorization"] = `Bearer ${options.token}`;
  }
  if (options.contentType) {
    headers["Content-Type"] = options.contentType;
  }
  const req = new Request(`http://localhost${path}`, {
    method: options.method ?? "GET",
    headers,
    body: options.body,
  });
  const res = await app.fetch(req);
  const text = await res.text();
  let body: unknown = null;
  try {
    body = JSON.parse(text) as unknown;
  } catch {
    body = text;
  }
  return { status: res.status, body, text };
}

// ─── Auth tests ───────────────────────────────────────────────────────────────

describe("gateway auth", () => {
  const app = createNexusApp({ config: testConfig, authToken: ORG_TOKEN });

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("GET / is public (no token needed)", async () => {
    vi.spyOn(globalThis, "fetch").mockImplementation(
      makeFetchMock(() => ({ ok: true, status: 200, body: {} })),
    );
    const { status } = await callApp(app, "/");
    expect(status).toBe(200);
  });

  it("GET /sites without token returns 401", async () => {
    const { status, body } = await callApp(app, "/sites");
    expect(status).toBe(401);
    expect((body as Record<string, unknown>).error).toBeTruthy();
  });

  it("GET /sites with wrong token returns 401", async () => {
    const { status } = await callApp(app, "/sites", { token: "wrong-token" });
    expect(status).toBe(401);
  });

  it("GET /sites with correct token returns 200", async () => {
    vi.spyOn(globalThis, "fetch").mockImplementation(
      makeFetchMock(() => ({ ok: true, status: 200, body: {} })),
    );
    const { status } = await callApp(app, "/sites", { token: ORG_TOKEN });
    expect(status).toBe(200);
  });

  it("GET /dashboard accepts the query token for browser-driven auth", async () => {
    vi.spyOn(globalThis, "fetch").mockImplementation(
      makeFetchMock((url) => url.includes("/metrics")
        ? { ok: true, status: 200, body: { posts: 1, pages: 1, media: 0 } }
        : { ok: true, status: 200, body: {} }),
    );
    const { status, text } = await callApp(app, `/dashboard?token=${ORG_TOKEN}`);
    expect(status).toBe(200);
    expect(text).toContain("Astropress Nexus");
  });
});

// ─── Health endpoint ──────────────────────────────────────────────────────────

describe("GET /", () => {
  const app = createNexusApp({ config: testConfig });

  beforeEach(() => vi.restoreAllMocks());

  it("returns 200 with site list when all sites are reachable", async () => {
    vi.spyOn(globalThis, "fetch").mockImplementation(
      makeFetchMock(() => ({ ok: true, status: 200, body: {} })),
    );
    const { status, body } = await callApp(app, "/");
    expect(status).toBe(200);
    const b = body as Record<string, unknown>;
    expect(b.siteCount).toBe(2);
    expect(Array.isArray(b.sites)).toBe(true);
    const sites = b.sites as Array<Record<string, unknown>>;
    expect(sites).toHaveLength(2);
    expect(sites[0]).toHaveProperty("id");
    expect(sites[0]).toHaveProperty("status");
  });

  it("returns degraded status when a site is unreachable", async () => {
    vi.spyOn(globalThis, "fetch").mockImplementation(
      vi.fn(async (url: RequestInfo | URL) => {
        if (url.toString().includes("site-b")) {
          throw new Error("ECONNREFUSED");
        }
        return { ok: true, status: 200, json: async () => ({}) } as Response;
      }),
    );
    const { status, body } = await callApp(app, "/");
    expect(status).toBe(200);
    const b = body as Record<string, unknown>;
    expect(b.status).toBe("degraded");
  });
});

// ─── Sites list ───────────────────────────────────────────────────────────────

describe("GET /sites", () => {
  const app = createNexusApp({ config: testConfig });

  beforeEach(() => vi.restoreAllMocks());

  it("returns an array of site objects", async () => {
    vi.spyOn(globalThis, "fetch").mockImplementation(
      makeFetchMock(() => ({ ok: true, status: 200, body: {} })),
    );
    const { status, body } = await callApp(app, "/sites");
    expect(status).toBe(200);
    expect(Array.isArray(body)).toBe(true);
    const sites = body as Array<Record<string, unknown>>;
    expect(sites).toHaveLength(2);
  });
});

describe("GET /dashboard", () => {
  const app = createNexusApp({ config: testConfig });

  beforeEach(() => vi.restoreAllMocks());

  it("renders a searchable HTML dashboard with site cards", async () => {
    vi.spyOn(globalThis, "fetch").mockImplementation(
      makeFetchMock((url) => url.includes("/metrics")
        ? { ok: true, status: 200, body: { posts: 3, pages: 2, media: 1 } }
        : { ok: true, status: 200, body: {} }),
    );
    const { status, text } = await callApp(app, "/dashboard");
    expect(status).toBe(200);
    expect(text).toContain("Operate multiple Astropress sites");
    expect(text).toContain("Site A");
    expect(text).toContain("Primary marketing property");
  });

  it("filters dashboard cards by the q search param", async () => {
    vi.spyOn(globalThis, "fetch").mockImplementation(
      makeFetchMock((url) => url.includes("/metrics")
        ? { ok: true, status: 200, body: { posts: 3, pages: 2, media: 1 } }
        : { ok: true, status: 200, body: {} }),
    );
    const { text } = await callApp(app, "/dashboard?q=docs");
    expect(text).toContain("Site B");
    expect(text).not.toContain("Primary marketing property");
  });
});

describe("GET /dashboard/sites/:id", () => {
  const app = createNexusApp({ config: testConfig });

  beforeEach(() => vi.restoreAllMocks());

  it("renders a site detail page with breadcrumbs and actions", async () => {
    vi.spyOn(globalThis, "fetch").mockImplementation(
      makeFetchMock(() => ({ ok: true, status: 200, body: {} })),
    );
    const { status, text } = await callApp(app, "/dashboard/sites/site-a");
    expect(status).toBe(200);
    expect(text).toContain("Dashboard");
    expect(text).toContain("Open admin");
    expect(text).toContain("Primary marketing property");
  });
});

// ─── Single site ──────────────────────────────────────────────────────────────

describe("GET /sites/:id", () => {
  const app = createNexusApp({ config: testConfig });

  beforeEach(() => vi.restoreAllMocks());

  it("returns site metadata for a known site", async () => {
    vi.spyOn(globalThis, "fetch").mockImplementation(
      makeFetchMock(() => ({ ok: true, status: 200, body: {} })),
    );
    const { status, body } = await callApp(app, "/sites/site-a");
    expect(status).toBe(200);
    expect((body as Record<string, unknown>).id).toBe("site-a");
  });

  it("returns 404 for an unknown site", async () => {
    const { status, body } = await callApp(app, "/sites/nonexistent");
    expect(status).toBe(404);
    expect((body as Record<string, unknown>).error).toMatch(/not found/i);
  });
});

// ─── Site proxy routes ────────────────────────────────────────────────────────

describe("GET /sites/:id/content", () => {
  const app = createNexusApp({ config: testConfig });

  beforeEach(() => vi.restoreAllMocks());

  it("proxies content request to the member site", async () => {
    const contentList = { items: [{ id: "post-1", slug: "post-1", kind: "post", status: "published" }] };
    vi.spyOn(globalThis, "fetch").mockImplementation(
      makeFetchMock(() => ({ ok: true, status: 200, body: contentList })),
    );
    const { status } = await callApp(app, "/sites/site-a/content");
    expect(status).toBe(200);
  });

  it("returns 404 for unknown site", async () => {
    const { status } = await callApp(app, "/sites/unknown/content");
    expect(status).toBe(404);
  });

  it("returns 502 when the member site is unreachable", async () => {
    vi.spyOn(globalThis, "fetch").mockImplementation(vi.fn(() => { throw new Error("ECONNREFUSED"); }));
    const { status, body } = await callApp(app, "/sites/site-a/content");
    expect(status).toBe(502);
    expect((body as Record<string, unknown>).error).toBeTruthy();
  });
});

describe("GET /sites/:id/settings", () => {
  const app = createNexusApp({ config: testConfig });

  beforeEach(() => vi.restoreAllMocks());

  it("proxies settings request to the member site", async () => {
    vi.spyOn(globalThis, "fetch").mockImplementation(
      makeFetchMock(() => ({ ok: true, status: 200, body: { siteTitle: "Test" } })),
    );
    const { status } = await callApp(app, "/sites/site-a/settings");
    expect(status).toBe(200);
  });
});

describe("GET /sites/:id/media", () => {
  const app = createNexusApp({ config: testConfig });

  beforeEach(() => vi.restoreAllMocks());

  it("proxies media request to the member site", async () => {
    vi.spyOn(globalThis, "fetch").mockImplementation(
      makeFetchMock(() => ({ ok: true, status: 200, body: { items: [] } })),
    );
    const { status } = await callApp(app, "/sites/site-a/media");
    expect(status).toBe(200);
  });
});

// ─── Fan-out /content ─────────────────────────────────────────────────────────

describe("GET /content (fan-out)", () => {
  const app = createNexusApp({ config: testConfig });

  beforeEach(() => vi.restoreAllMocks());

  it("merges content items from all sites and tags with siteId", async () => {
    vi.spyOn(globalThis, "fetch").mockImplementation(
      vi.fn(async (url: RequestInfo | URL) => {
        const items = url.toString().includes("site-a")
          ? [{ id: "a1", slug: "post-a", kind: "post", status: "published" }]
          : [{ id: "b1", slug: "post-b", kind: "post", status: "published" }];
        return { ok: true, status: 200, json: async () => items } as Response;
      }),
    );
    const { status, body } = await callApp(app, "/content");
    expect(status).toBe(200);
    const b = body as Record<string, unknown>;
    const items = b.items as Array<Record<string, unknown>>;
    expect(items.length).toBeGreaterThanOrEqual(2);
    const sitaAItem = items.find((i) => i.siteId === "site-a");
    const siteBItem = items.find((i) => i.siteId === "site-b");
    expect(sitaAItem).toBeTruthy();
    expect(siteBItem).toBeTruthy();
  });

  it("continues when one site is degraded, includes degraded entry", async () => {
    vi.spyOn(globalThis, "fetch").mockImplementation(
      vi.fn(async (url: RequestInfo | URL) => {
        if (url.toString().includes("site-b")) {
          throw new Error("ECONNREFUSED");
        }
        return { ok: true, status: 200, json: async () => [{ id: "a1", slug: "post-a", kind: "post", status: "published" }] } as Response;
      }),
    );
    const { status, body } = await callApp(app, "/content");
    expect(status).toBe(200);
    const b = body as Record<string, unknown>;
    const degraded = b.degraded as Array<Record<string, unknown>>;
    expect(degraded.length).toBeGreaterThanOrEqual(1);
    expect(degraded[0].siteId).toBe("site-b");
  });
});

// ─── Metrics ──────────────────────────────────────────────────────────────────

describe("GET /metrics", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    // Clear the module-level cache between tests
    import("../src/metrics-cache.js").then((m) => m.clearMetricsCache());
  });

  it("returns aggregate metrics with siteCount and totalPosts", async () => {
    const app = createNexusApp({ config: testConfig });
    vi.spyOn(globalThis, "fetch").mockImplementation(
      makeFetchMock(() => ({ ok: true, status: 200, body: { posts: 5, pages: 2, media: 3 } })),
    );
    const { status, body } = await callApp(app, "/metrics");
    expect(status).toBe(200);
    const b = body as Record<string, unknown>;
    expect(b.siteCount).toBe(2);
    expect(typeof b.totalPosts).toBe("number");
  });
});

describe("POST /actions/redeploy", () => {
  const app = createNexusApp({ config: testConfig, authToken: ORG_TOKEN });

  beforeEach(() => vi.restoreAllMocks());

  it("triggers deploy hooks for selected sites and redirects back to dashboard", async () => {
    vi.spyOn(globalThis, "fetch").mockImplementation(
      makeFetchMock((url) => url.includes("deploy.example.com")
        ? { ok: true, status: 202, body: {} }
        : { ok: true, status: 200, body: {} }),
    );
    const form = new URLSearchParams({ siteId: "site-a", redirectTo: "/dashboard" });
    const res = await app.fetch(new Request(`http://localhost/actions/redeploy?token=${ORG_TOKEN}`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: form,
    }));
    expect(res.status).toBe(302);
    expect(res.headers.get("location")).toContain("redeployed=1");
  });
});

describe("POST /actions/refresh", () => {
  const app = createNexusApp({ config: testConfig, authToken: ORG_TOKEN });

  beforeEach(() => vi.restoreAllMocks());

  it("refreshes selected sites and redirects with a refreshed count", async () => {
    vi.spyOn(globalThis, "fetch").mockImplementation(
      makeFetchMock(() => ({ ok: true, status: 200, body: {} })),
    );
    const form = new URLSearchParams({ siteId: "site-a", redirectTo: "/dashboard" });
    const res = await app.fetch(new Request(`http://localhost/actions/refresh?token=${ORG_TOKEN}`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: form,
    }));
    expect(res.status).toBe(302);
    expect(res.headers.get("location")).toContain("refreshed=1");
  });
});

// ─── SiteRegistry ─────────────────────────────────────────────────────────────

describe("SiteRegistry", () => {
  it("exposes all registered sites", async () => {
    const { SiteRegistry } = await import("../src/registry.js");
    const registry = new SiteRegistry(testConfig);
    expect(registry.getAll()).toHaveLength(2);
    expect(registry.get("site-a")?.name).toBe("Site A");
    expect(registry.has("site-b")).toBe(true);
    expect(registry.has("unknown")).toBe(false);
  });
});
