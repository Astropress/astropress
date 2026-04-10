import { DatabaseSync } from "node:sqlite";
import { describe, expect, it } from "vitest";

import { apiRouteDefinitions } from "../src/api-routes.js";
import { withApiRequest } from "../src/api-middleware.js";
import { resolveAstropressSecurityArea } from "../src/security-middleware.js";
import { readAstropressSqliteSchemaSql } from "../src/sqlite-bootstrap.js";
import { createApiTokenStore } from "../src/sqlite-runtime/api-tokens.js";

// ─── Route inventory ──────────────────────────────────────────────────────────

function hasRoute(pattern: string, method: string) {
  return apiRouteDefinitions.some(
    (r) => r.pattern === pattern && r.methods.includes(method),
  );
}

describe("REST API route inventory", () => {
  it("api-routes.ts defines GET /ap-api/v1/content", () => {
    expect(hasRoute("/ap-api/v1/content", "GET")).toBe(true);
  });
  it("api-routes.ts defines POST /ap-api/v1/content", () => {
    expect(hasRoute("/ap-api/v1/content", "POST")).toBe(true);
  });
  it("api-routes.ts defines GET /ap-api/v1/content/:id", () => {
    expect(hasRoute("/ap-api/v1/content/[id]", "GET")).toBe(true);
  });
  it("api-routes.ts defines PUT /ap-api/v1/content/:id", () => {
    expect(hasRoute("/ap-api/v1/content/[id]", "PUT")).toBe(true);
  });
  it("api-routes.ts defines DELETE /ap-api/v1/content/:id", () => {
    expect(hasRoute("/ap-api/v1/content/[id]", "DELETE")).toBe(true);
  });
  it("api-routes.ts defines GET /ap-api/v1/media", () => {
    expect(hasRoute("/ap-api/v1/media", "GET")).toBe(true);
  });
  it("api-routes.ts defines POST /ap-api/v1/media", () => {
    expect(hasRoute("/ap-api/v1/media", "POST")).toBe(true);
  });
  it("api-routes.ts defines DELETE /ap-api/v1/media/:id", () => {
    expect(hasRoute("/ap-api/v1/media/[id]", "DELETE")).toBe(true);
  });
  it("api-routes.ts defines GET /ap-api/v1/revisions/:recordId", () => {
    expect(hasRoute("/ap-api/v1/revisions/[recordId]", "GET")).toBe(true);
  });
  it("api-routes.ts defines GET /ap-api/v1/settings", () => {
    expect(hasRoute("/ap-api/v1/settings", "GET")).toBe(true);
  });
  it("api-routes.ts defines GET /ap-api/v1/webhooks", () => {
    expect(hasRoute("/ap-api/v1/webhooks", "GET")).toBe(true);
  });
  it("api-routes.ts defines POST /ap-api/v1/webhooks", () => {
    expect(hasRoute("/ap-api/v1/webhooks", "POST")).toBe(true);
  });
  it("api-routes.ts defines GET /ap-api/v1/openapi.json", () => {
    expect(hasRoute("/ap-api/v1/openapi.json", "GET")).toBe(true);
  });
});

// ─── API middleware ───────────────────────────────────────────────────────────

function makeCtx(options?: { rateLimit?: number }) {
  const db = new DatabaseSync(":memory:");
  db.exec(readAstropressSqliteSchemaSql());
  const apiTokens = createApiTokenStore(db);

  const rateLimitMap = new Map<string, { count: number; windowStart: number }>();

  return {
    apiTokens,
    checkRateLimit(key: string, max: number, windowMs: number) {
      const now = Date.now();
      const entry = rateLimitMap.get(key);
      if (!entry || now - entry.windowStart > windowMs) {
        rateLimitMap.set(key, { count: 1, windowStart: now });
        return true;
      }
      if (entry.count < max) {
        entry.count++;
        return true;
      }
      return false;
    },
    rateLimit: options?.rateLimit,
  };
}

describe("API middleware (Bearer token auth)", () => {
  it("withApiRequest rejects missing Authorization header with 401", async () => {
    const ctx = makeCtx();
    const req = new Request("http://localhost/ap-api/v1/content");
    const res = await withApiRequest(req, ctx, ["content:read"], async () => new Response("ok"));
    expect(res.status).toBe(401);
    const body = await res.json() as Record<string, unknown>;
    expect(body.code).toBe("unauthorized");
  });

  it("withApiRequest rejects malformed Bearer token with 401", async () => {
    const ctx = makeCtx();
    const req = new Request("http://localhost/ap-api/v1/content", {
      headers: { Authorization: "Bearer completely-unknown-token" },
    });
    const res = await withApiRequest(req, ctx, ["content:read"], async () => new Response("ok"));
    expect(res.status).toBe(401);
  });

  it("withApiRequest rejects token with insufficient scope with 403", async () => {
    const ctx = makeCtx();
    const { rawToken } = await ctx.apiTokens.create({ label: "limited", scopes: ["content:read"] });
    const req = new Request("http://localhost/ap-api/v1/content", {
      headers: { Authorization: `Bearer ${rawToken}` },
    });
    const res = await withApiRequest(req, ctx, ["content:write"], async () => new Response("ok"));
    expect(res.status).toBe(403);
    const body = await res.json() as Record<string, unknown>;
    expect(body.code).toBe("forbidden");
  });

  it("withApiRequest allows request when token is valid and scope matches", async () => {
    const ctx = makeCtx();
    const { rawToken } = await ctx.apiTokens.create({ label: "full", scopes: ["content:read", "content:write"] });
    const req = new Request("http://localhost/ap-api/v1/content", {
      headers: { Authorization: `Bearer ${rawToken}` },
    });
    const res = await withApiRequest(req, ctx, ["content:read"], async () => new Response("ok", { status: 200 }));
    expect(res.status).toBe(200);
  });

  it("withApiRequest rate-limits per-token at the configured rateLimit", async () => {
    const ctx = makeCtx({ rateLimit: 2 });
    const { rawToken } = await ctx.apiTokens.create({ label: "limited", scopes: ["content:read"] });

    const makeReq = () =>
      new Request("http://localhost/ap-api/v1/content", {
        headers: { Authorization: `Bearer ${rawToken}` },
      });

    const r1 = await withApiRequest(makeReq(), ctx, ["content:read"], async () => new Response("ok"));
    const r2 = await withApiRequest(makeReq(), ctx, ["content:read"], async () => new Response("ok"));
    const r3 = await withApiRequest(makeReq(), ctx, ["content:read"], async () => new Response("ok"));

    expect(r1.status).toBe(200);
    expect(r2.status).toBe(200);
    expect(r3.status).toBe(429);
    const body = await r3.json() as Record<string, unknown>;
    expect(body.code).toBe("rate_limited");
  });
});

// ─── Security area mapping ────────────────────────────────────────────────────

describe("Security area mapping for /ap-api/*", () => {
  it("resolveAstropressSecurityArea returns 'api' for /ap-api/v1/content", () => {
    const url = new URL("http://localhost/ap-api/v1/content");
    expect(resolveAstropressSecurityArea(url)).toBe("api");
  });

  it("resolveAstropressSecurityArea returns 'api' for /ap-api/v1/openapi.json", () => {
    const url = new URL("http://localhost/ap-api/v1/openapi.json");
    expect(resolveAstropressSecurityArea(url)).toBe("api");
  });

  it("api area applies no-store Cache-Control", async () => {
    const { applyAstropressSecurityHeaders } = await import("../src/security-headers.js");
    const headers = new Headers();
    applyAstropressSecurityHeaders(headers, { area: "api" });
    expect(headers.get("Cache-Control")).toContain("no-store");
  });

  it("api area sets default-src 'self' CSP", async () => {
    const { applyAstropressSecurityHeaders } = await import("../src/security-headers.js");
    const headers = new Headers();
    applyAstropressSecurityHeaders(headers, { area: "api" });
    const csp = headers.get("Content-Security-Policy") ?? "";
    expect(csp).toContain("default-src 'self'");
  });
});
