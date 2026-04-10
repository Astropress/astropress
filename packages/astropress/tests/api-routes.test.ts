import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { DatabaseSync } from "node:sqlite";
import { describe, expect, it } from "vitest";

import { apiRouteDefinitions } from "../src/api-routes.js";
import { withApiRequest, jsonOk, jsonOkPaginated, jsonOkWithEtag } from "../src/api-middleware.js";
import { resolveAstropressSecurityArea } from "../src/security-middleware.js";
import { readAstropressSqliteSchemaSql, runAstropressMigrations } from "../src/sqlite-bootstrap.js";
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

// ─── Response helpers ─────────────────────────────────────────────────────────

describe("jsonOk helper", () => {
  it("returns 200 with JSON content-type", () => {
    const res = jsonOk({ key: "value" });
    expect(res.status).toBe(200);
    expect(res.headers.get("Content-Type")).toBe("application/json");
  });

  it("accepts custom status code", () => {
    const res = jsonOk({ created: true }, 201);
    expect(res.status).toBe(201);
  });
});

describe("jsonOkPaginated helper", () => {
  it("returns 200 with X-Total-Count header", () => {
    const res = jsonOkPaginated({ records: [], total: 42, limit: 20, offset: 0, page: 1 }, 42);
    expect(res.status).toBe(200);
    expect(res.headers.get("X-Total-Count")).toBe("42");
  });

  it("exposes X-Total-Count via Access-Control-Expose-Headers", () => {
    const res = jsonOkPaginated({ records: [] }, 0);
    expect(res.headers.get("Access-Control-Expose-Headers")).toContain("X-Total-Count");
  });

  it("returns JSON content-type", () => {
    const res = jsonOkPaginated({ records: [] }, 0);
    expect(res.headers.get("Content-Type")).toBe("application/json");
  });
});

describe("jsonOkWithEtag helper", () => {
  it("returns 200 with ETag header on first request", () => {
    const req = new Request("http://localhost/ap-api/v1/content/1");
    const res = jsonOkWithEtag({ id: 1, title: "Hello" }, req);
    expect(res.status).toBe(200);
    expect(res.headers.get("ETag")).toMatch(/^W\/"[0-9a-f]+"$/);
  });

  it("returns 304 when If-None-Match matches ETag", () => {
    const body = { id: 1, title: "Hello" };
    const req1 = new Request("http://localhost/ap-api/v1/content/1");
    const res1 = jsonOkWithEtag(body, req1);
    const etag = res1.headers.get("ETag") ?? "";

    const req2 = new Request("http://localhost/ap-api/v1/content/1", {
      headers: { "If-None-Match": etag },
    });
    const res2 = jsonOkWithEtag(body, req2);
    expect(res2.status).toBe(304);
  });

  it("returns 200 when If-None-Match does not match", () => {
    const req = new Request("http://localhost/ap-api/v1/content/1", {
      headers: { "If-None-Match": 'W/"00000000"' },
    });
    const res = jsonOkWithEtag({ id: 1, title: "Hello" }, req);
    expect(res.status).toBe(200);
  });
});

// ─── Migration runner ─────────────────────────────────────────────────────────

describe("runAstropressMigrations", () => {
  it("applies .sql files from a directory in lexicographic order", () => {
    const db = new DatabaseSync(":memory:");
    db.exec(readAstropressSqliteSchemaSql());

    const tmpDir = `/tmp/astropress-migration-test-${Date.now()}`;
    mkdirSync(tmpDir, { recursive: true });
    writeFileSync(`${tmpDir}/0001_create_foo.sql`, "CREATE TABLE IF NOT EXISTS foo (id INTEGER PRIMARY KEY);");
    writeFileSync(`${tmpDir}/0002_add_bar.sql`, "CREATE TABLE IF NOT EXISTS bar (id INTEGER PRIMARY KEY);");

    const result = runAstropressMigrations(db, tmpDir);
    expect(result.applied).toEqual(["0001_create_foo.sql", "0002_add_bar.sql"]);
    expect(result.skipped).toEqual([]);

    // Running again skips already-applied migrations
    const result2 = runAstropressMigrations(db, tmpDir);
    expect(result2.applied).toEqual([]);
    expect(result2.skipped).toEqual(["0001_create_foo.sql", "0002_add_bar.sql"]);

    rmSync(tmpDir, { recursive: true });
  });

  it("returns empty result when migrations directory does not exist", () => {
    const db = new DatabaseSync(":memory:");
    db.exec(readAstropressSqliteSchemaSql());
    const result = runAstropressMigrations(db, `/tmp/does-not-exist-${Date.now()}`);
    expect(result.applied).toEqual([]);
    expect(result.skipped).toEqual([]);
  });

  it("records applied migrations in schema_migrations table", () => {
    const db = new DatabaseSync(":memory:");
    db.exec(readAstropressSqliteSchemaSql());

    const tmpDir = `/tmp/astropress-migration-record-test-${Date.now()}`;
    mkdirSync(tmpDir, { recursive: true });
    writeFileSync(`${tmpDir}/0001_test.sql`, "CREATE TABLE IF NOT EXISTS test_tbl (id INTEGER PRIMARY KEY);");

    runAstropressMigrations(db, tmpDir);

    const rows = db.prepare("SELECT name FROM schema_migrations WHERE name = '0001_test.sql'").all();
    expect(rows).toHaveLength(1);

    rmSync(tmpDir, { recursive: true });
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
