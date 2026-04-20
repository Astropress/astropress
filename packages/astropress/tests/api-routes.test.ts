// @ts-nocheck
//
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";

import {
	apiErrors,
	handleCorsPreflightRequest,
	jsonOk,
	jsonOkPaginated,
	jsonOkWithEtag,
	withApiRequest,
} from "../src/api-middleware.js";
import { apiRouteDefinitions, injectApiRoutes } from "../src/api-routes.js";
import { resolveAstropressSecurityArea } from "../src/security-middleware.js";
import { runAstropressMigrations } from "../src/sqlite-bootstrap.js";
import { createApiTokenStore } from "../src/sqlite-runtime/api-tokens.js";
import { makeDb } from "./helpers/make-db.js";

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

describe("injectApiRoutes", () => {
	it("calls injector once per route definition with the full route object", () => {
		const collected: typeof apiRouteDefinitions = [];
		injectApiRoutes((route) => collected.push(route));
		expect(collected).toHaveLength(apiRouteDefinitions.length);
		expect(collected).toEqual(apiRouteDefinitions);
	});
});

// ─── API middleware ───────────────────────────────────────────────────────────

function makeCtx(options?: { rateLimit?: number }) {
	const db = makeDb();
	const apiTokens = createApiTokenStore(db);

	const rateLimitMap = new Map<
		string,
		{ count: number; windowStart: number }
	>();

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
		const res = await withApiRequest(
			req,
			ctx,
			["content:read"],
			async () => new Response("ok"),
		);
		expect(res.status).toBe(401);
		const body = (await res.json()) as Record<string, unknown>;
		expect(body.code).toBe("unauthorized");
	});

	it("withApiRequest rejects malformed Bearer token with 401", async () => {
		const ctx = makeCtx();
		const req = new Request("http://localhost/ap-api/v1/content", {
			headers: { Authorization: "Bearer completely-unknown-token" },
		});
		const res = await withApiRequest(
			req,
			ctx,
			["content:read"],
			async () => new Response("ok"),
		);
		expect(res.status).toBe(401);
	});

	it("withApiRequest rejects token with insufficient scope with 403", async () => {
		const ctx = makeCtx();
		const { rawToken } = await ctx.apiTokens.create({
			label: "limited",
			scopes: ["content:read"],
		});
		const req = new Request("http://localhost/ap-api/v1/content", {
			headers: { Authorization: `Bearer ${rawToken}` },
		});
		const res = await withApiRequest(
			req,
			ctx,
			["content:write"],
			async () => new Response("ok"),
		);
		expect(res.status).toBe(403);
		const body = (await res.json()) as Record<string, unknown>;
		expect(body.code).toBe("forbidden");
	});

	it("withApiRequest allows request when token is valid and scope matches", async () => {
		const ctx = makeCtx();
		const { rawToken } = await ctx.apiTokens.create({
			label: "full",
			scopes: ["content:read", "content:write"],
		});
		const req = new Request("http://localhost/ap-api/v1/content", {
			headers: { Authorization: `Bearer ${rawToken}` },
		});
		const res = await withApiRequest(
			req,
			ctx,
			["content:read"],
			async () => new Response("ok", { status: 200 }),
		);
		expect(res.status).toBe(200);
	});

	it("withApiRequest rate-limits per-token at the configured rateLimit", async () => {
		const ctx = makeCtx({ rateLimit: 2 });
		const { rawToken } = await ctx.apiTokens.create({
			label: "limited",
			scopes: ["content:read"],
		});

		const makeReq = () =>
			new Request("http://localhost/ap-api/v1/content", {
				headers: { Authorization: `Bearer ${rawToken}` },
			});

		const r1 = await withApiRequest(
			makeReq(),
			ctx,
			["content:read"],
			async () => new Response("ok"),
		);
		const r2 = await withApiRequest(
			makeReq(),
			ctx,
			["content:read"],
			async () => new Response("ok"),
		);
		const r3 = await withApiRequest(
			makeReq(),
			ctx,
			["content:read"],
			async () => new Response("ok"),
		);

		expect(r1.status).toBe(200);
		expect(r2.status).toBe(200);
		expect(r3.status).toBe(429);
		const body = (await r3.json()) as Record<string, unknown>;
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
		const res = jsonOkPaginated(
			{ records: [], total: 42, limit: 20, offset: 0, page: 1 },
			42,
		);
		expect(res.status).toBe(200);
		expect(res.headers.get("X-Total-Count")).toBe("42");
	});

	it("exposes X-Total-Count via Access-Control-Expose-Headers", () => {
		const res = jsonOkPaginated({ records: [] }, 0);
		expect(res.headers.get("Access-Control-Expose-Headers")).toContain(
			"X-Total-Count",
		);
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
		const db = makeDb();

		const tmpDir = `/tmp/astropress-migration-test-${Date.now()}`;
		mkdirSync(tmpDir, { recursive: true });
		writeFileSync(
			`${tmpDir}/0001_create_foo.sql`,
			"CREATE TABLE IF NOT EXISTS foo (id INTEGER PRIMARY KEY);",
		);
		writeFileSync(
			`${tmpDir}/0002_add_bar.sql`,
			"CREATE TABLE IF NOT EXISTS bar (id INTEGER PRIMARY KEY);",
		);

		const result = runAstropressMigrations(db, tmpDir);
		expect(result.applied).toEqual(["0001_create_foo.sql", "0002_add_bar.sql"]);
		expect(result.skipped).toEqual([]);

		// Running again skips already-applied migrations
		const result2 = runAstropressMigrations(db, tmpDir);
		expect(result2.applied).toEqual([]);
		expect(result2.skipped).toEqual([
			"0001_create_foo.sql",
			"0002_add_bar.sql",
		]);

		rmSync(tmpDir, { recursive: true });
	});

	it("returns empty result when migrations directory does not exist", () => {
		const db = makeDb();
		const result = runAstropressMigrations(
			db,
			`/tmp/does-not-exist-${Date.now()}`,
		);
		expect(result.applied).toEqual([]);
		expect(result.skipped).toEqual([]);
	});

	it("records applied migrations in schema_migrations table", () => {
		const db = makeDb();

		const tmpDir = `/tmp/astropress-migration-record-test-${Date.now()}`;
		mkdirSync(tmpDir, { recursive: true });
		writeFileSync(
			`${tmpDir}/0001_test.sql`,
			"CREATE TABLE IF NOT EXISTS test_tbl (id INTEGER PRIMARY KEY);",
		);

		runAstropressMigrations(db, tmpDir);

		const rows = db
			.prepare(
				"SELECT name FROM schema_migrations WHERE name = '0001_test.sql'",
			)
			.all();
		expect(rows).toHaveLength(1);

		rmSync(tmpDir, { recursive: true });
	});
});

// ─── Typed error shapes (413 / 415) ──────────────────────────────────────────

describe("apiErrors.fileTooLarge (413)", () => {
	it("returns 413 status", () => {
		const res = apiErrors.fileTooLarge(10 * 1024 * 1024, 15 * 1024 * 1024);
		expect(res.status).toBe(413);
	});

	it("returns typed error body with FILE_TOO_LARGE code", async () => {
		const res = apiErrors.fileTooLarge(10485760, 15728640);
		const body = (await res.json()) as Record<string, unknown>;
		expect(body.error).toBe("FILE_TOO_LARGE");
		expect(body.code).toBe("file_too_large");
		expect(body.maxBytes).toBe(10485760);
		expect(body.uploadedBytes).toBe(15728640);
	});

	it("returns JSON content-type", () => {
		const res = apiErrors.fileTooLarge(1024, 2048);
		expect(res.headers.get("Content-Type")).toBe("application/json");
	});
});

describe("apiErrors.unsupportedMediaType (415)", () => {
	it("returns 415 status", () => {
		const res = apiErrors.unsupportedMediaType("application/x-evil", [
			"image/jpeg",
			"image/png",
		]);
		expect(res.status).toBe(415);
	});

	it("returns typed error body with UNSUPPORTED_MEDIA_TYPE code", async () => {
		const allowed = ["image/jpeg", "image/png", "application/pdf"];
		const res = apiErrors.unsupportedMediaType("application/x-custom", allowed);
		const body = (await res.json()) as Record<string, unknown>;
		expect(body.error).toBe("UNSUPPORTED_MEDIA_TYPE");
		expect(body.code).toBe("unsupported_media_type");
		expect(body.mimeType).toBe("application/x-custom");
		expect(body.allowed).toEqual(allowed);
	});

	it("returns JSON content-type", () => {
		const res = apiErrors.unsupportedMediaType("text/html", ["image/png"]);
		expect(res.headers.get("Content-Type")).toBe("application/json");
	});
});

// ─── Empty Bearer token ───────────────────────────────────────────────────────

describe("API middleware — edge cases", () => {
	it("withApiRequest rejects Authorization header with empty Bearer token", async () => {
		const ctx = makeCtx();
		const req = new Request("http://localhost/ap-api/v1/content", {
			headers: { Authorization: "Bearer " },
		});
		const res = await withApiRequest(
			req,
			ctx,
			["content:read"],
			async () => new Response("ok"),
		);
		expect(res.status).toBe(401);
		const body = (await res.json()) as Record<string, unknown>;
		expect(body.code).toBe("unauthorized");
	});

	it("withApiRequest trims whitespace from bearer token before validation", async () => {
		// Kills MethodExpression mutation: .trim() removed from rawToken
		const ctx = makeCtx();
		const req = new Request("http://localhost/ap-api/v1/content", {
			headers: { Authorization: "Bearer   " },
		});
		const res = await withApiRequest(
			req,
			ctx,
			["content:read"],
			async () => new Response("ok"),
		);
		// whitespace-only token should be rejected as empty
		expect(res.status).toBe(401);
	});

	it("withApiRequest rejects non-Bearer Authorization scheme with 401", async () => {
		// Kills StringLiteral mutation: startsWith("Bearer ") → startsWith("")
		const ctx = makeCtx();
		const req = new Request("http://localhost/ap-api/v1/content", {
			headers: { Authorization: "Basic dXNlcjpwYXNz" },
		});
		const res = await withApiRequest(
			req,
			ctx,
			["content:read"],
			async () => new Response("ok"),
		);
		expect(res.status).toBe(401);
	});

	it("withApiRequest rejects Authorization where Bearer appears after other text", async () => {
		// Kills ConditionalExpression mutation: !authHeader.startsWith("Bearer ") → false
		// Without the guard, split("Bearer ")[1] extracts the valid token and verify succeeds → 200
		const ctx = makeCtx();
		const { rawToken } = await ctx.apiTokens.create({
			label: "test",
			scopes: ["content:read"],
		});
		const req = new Request("http://localhost/ap-api/v1/content", {
			headers: { Authorization: `Scheme Bearer ${rawToken}` },
		});
		const res = await withApiRequest(
			req,
			ctx,
			["content:read"],
			async () => new Response("ok"),
		);
		expect(res.status).toBe(401);
	});

	it("rate limit key uses 'api:' prefix with the token id", async () => {
		// Kills StringLiteral mutation: `api:${record.id}` → ``
		const ctx = makeCtx();
		const capturedKeys: string[] = [];
		const origCheckRateLimit = ctx.checkRateLimit;
		ctx.checkRateLimit = (key, max, window) => {
			capturedKeys.push(key);
			return origCheckRateLimit(key, max, window);
		};

		const { rawToken } = await ctx.apiTokens.create({
			label: "test",
			scopes: ["content:read"],
		});
		await withApiRequest(
			new Request("http://localhost/api", {
				headers: { Authorization: `Bearer ${rawToken}` },
			}),
			ctx,
			["content:read"],
			async () => new Response("ok"),
		);

		expect(capturedKeys).toHaveLength(1);
		expect(capturedKeys[0]).toMatch(/^api:/);
	});

	it("withApiRequest passes token id to handler", async () => {
		const ctx = makeCtx();
		const { rawToken } = await ctx.apiTokens.create({
			label: "test",
			scopes: ["content:read"],
		});
		const req = new Request("http://localhost/ap-api/v1/content", {
			headers: { Authorization: `Bearer ${rawToken}` },
		});
		let receivedId: string | undefined;
		await withApiRequest(req, ctx, ["content:read"], async (id) => {
			receivedId = id;
			return new Response("ok");
		});
		expect(receivedId).toBeDefined();
		expect(typeof receivedId).toBe("string");
	});

	it("withApiRequest uses default rateLimit of 60 when not configured", async () => {
		const ctx = makeCtx(); // rateLimit is undefined → should default to 60
		const { rawToken } = await ctx.apiTokens.create({
			label: "test",
			scopes: ["content:read"],
		});

		// 60 requests should all succeed
		let lastRes: Response | null = null;
		for (let i = 0; i < 60; i++) {
			lastRes = await withApiRequest(
				new Request("http://localhost/test", {
					headers: { Authorization: `Bearer ${rawToken}` },
				}),
				ctx,
				["content:read"],
				async () => new Response("ok"),
			);
		}
		expect(lastRes?.status).toBe(200);

		// 61st request should be rate-limited
		const r61 = await withApiRequest(
			new Request("http://localhost/test", {
				headers: { Authorization: `Bearer ${rawToken}` },
			}),
			ctx,
			["content:read"],
			async () => new Response("ok"),
		);
		expect(r61.status).toBe(429);
	});

	it("withApiRequest returns 403 for each missing scope", async () => {
		const ctx = makeCtx();
		const { rawToken } = await ctx.apiTokens.create({
			label: "test",
			scopes: ["content:read"],
		});
		const req = new Request("http://localhost/ap-api/v1/content", {
			headers: { Authorization: `Bearer ${rawToken}` },
		});
		const res = await withApiRequest(
			req,
			ctx,
			["content:write", "media:write"],
			async () => new Response("ok"),
		);
		expect(res.status).toBe(403);
		const body = (await res.json()) as Record<string, unknown>;
		expect(body.code).toBe("forbidden");
		expect(body.error as string).toContain("content:write");
	});
});

// ─── CORS ────────────────────────────────────────────────────────────────────

describe("CORS preflight and response headers", () => {
	beforeEach(() => {
		vi.resetModules();
	});

	afterAll(() => {
		vi.resetModules();
	});

	it("handleCorsPreflightRequest returns null for non-OPTIONS requests", () => {
		const req = new Request("http://localhost/ap-api/v1/content", {
			method: "GET",
		});
		expect(handleCorsPreflightRequest(req)).toBeNull();
	});

	it("handleCorsPreflightRequest returns null when no CORS config is present", () => {
		const req = new Request("http://localhost/ap-api/v1/content", {
			method: "OPTIONS",
		});
		expect(handleCorsPreflightRequest(req)).toBeNull();
	});

	it("withApiRequest returns 204 preflight response when CORS config allows the origin", async () => {
		const { registerCms } = await import("../src/config.js");
		registerCms({
			templateKeys: ["content"],
			siteUrl: "https://example.com",
			seedPages: [],
			archives: [],
			translationStatus: [],
			api: { enabled: true, cors: { origin: "https://app.example.com" } },
		});

		const ctx = makeCtx();
		const req = new Request("http://localhost/ap-api/v1/content", {
			method: "OPTIONS",
			headers: {
				Origin: "https://app.example.com",
				"Access-Control-Request-Method": "GET",
			},
		});
		const res = await withApiRequest(
			req,
			ctx,
			["content:read"],
			async () => new Response("ok"),
		);
		expect(res.status).toBe(204);
		expect(res.headers.get("Access-Control-Allow-Origin")).toBe(
			"https://app.example.com",
		);
	});

	it("withApiRequest adds CORS headers to responses when origin matches", async () => {
		const { registerCms } = await import("../src/config.js");
		registerCms({
			templateKeys: ["content"],
			siteUrl: "https://example.com",
			seedPages: [],
			archives: [],
			translationStatus: [],
			api: { enabled: true, cors: { origin: "https://app.example.com" } },
		});

		const ctx = makeCtx();
		const { rawToken } = await ctx.apiTokens.create({
			label: "test",
			scopes: ["content:read"],
		});
		const req = new Request("http://localhost/ap-api/v1/content", {
			headers: {
				Authorization: `Bearer ${rawToken}`,
				Origin: "https://app.example.com",
			},
		});
		const res = await withApiRequest(
			req,
			ctx,
			["content:read"],
			async () => new Response("ok"),
		);
		expect(res.headers.get("Access-Control-Allow-Origin")).toBe(
			"https://app.example.com",
		);
		expect(res.headers.get("Access-Control-Allow-Methods")).toContain("GET");
		expect(res.headers.get("Access-Control-Allow-Headers")).toBe(
			"Authorization, Content-Type",
		);
		expect(res.headers.get("Vary")).toBe("Origin");
	});

	it("withApiRequest does not add CORS headers when origin does not match", async () => {
		const { registerCms } = await import("../src/config.js");
		registerCms({
			templateKeys: ["content"],
			siteUrl: "https://example.com",
			seedPages: [],
			archives: [],
			translationStatus: [],
			api: { enabled: true, cors: { origin: "https://app.example.com" } },
		});

		const ctx = makeCtx();
		const { rawToken } = await ctx.apiTokens.create({
			label: "test",
			scopes: ["content:read"],
		});
		const req = new Request("http://localhost/ap-api/v1/content", {
			headers: {
				Authorization: `Bearer ${rawToken}`,
				Origin: "https://evil.example.com",
			},
		});
		const res = await withApiRequest(
			req,
			ctx,
			["content:read"],
			async () => new Response("ok"),
		);
		expect(res.headers.get("Access-Control-Allow-Origin")).toBeNull();
	});

	it("withApiRequest handles wildcard CORS origin", async () => {
		const { registerCms } = await import("../src/config.js");
		registerCms({
			templateKeys: ["content"],
			siteUrl: "https://example.com",
			seedPages: [],
			archives: [],
			translationStatus: [],
			api: { enabled: true, cors: { origin: "*" } },
		});

		const ctx = makeCtx();
		const { rawToken } = await ctx.apiTokens.create({
			label: "test",
			scopes: ["content:read"],
		});
		const req = new Request("http://localhost/ap-api/v1/content", {
			headers: {
				Authorization: `Bearer ${rawToken}`,
				Origin: "https://any.example.com",
			},
		});
		const res = await withApiRequest(
			req,
			ctx,
			["content:read"],
			async () => new Response("ok"),
		);
		expect(res.headers.get("Access-Control-Allow-Origin")).toBe("*");
		// Vary header should NOT be set for wildcard
		expect(res.headers.get("Vary")).toBeNull();
	});

	it("withApiRequest handles array of allowed origins — matched", async () => {
		const { registerCms } = await import("../src/config.js");
		registerCms({
			templateKeys: ["content"],
			siteUrl: "https://example.com",
			seedPages: [],
			archives: [],
			translationStatus: [],
			api: {
				enabled: true,
				cors: {
					origin: ["https://app1.example.com", "https://app2.example.com"],
				},
			},
		});

		const ctx = makeCtx();
		const { rawToken } = await ctx.apiTokens.create({
			label: "test",
			scopes: ["content:read"],
		});
		const req = new Request("http://localhost/ap-api/v1/content", {
			headers: {
				Authorization: `Bearer ${rawToken}`,
				Origin: "https://app2.example.com",
			},
		});
		const res = await withApiRequest(
			req,
			ctx,
			["content:read"],
			async () => new Response("ok"),
		);
		expect(res.headers.get("Access-Control-Allow-Origin")).toBe(
			"https://app2.example.com",
		);
	});

	it("withApiRequest handles array of allowed origins — not matched", async () => {
		const { registerCms } = await import("../src/config.js");
		registerCms({
			templateKeys: ["content"],
			siteUrl: "https://example.com",
			seedPages: [],
			archives: [],
			translationStatus: [],
			api: {
				enabled: true,
				cors: {
					origin: ["https://app1.example.com", "https://app2.example.com"],
				},
			},
		});

		const ctx = makeCtx();
		const { rawToken } = await ctx.apiTokens.create({
			label: "test",
			scopes: ["content:read"],
		});
		const req = new Request("http://localhost/ap-api/v1/content", {
			headers: {
				Authorization: `Bearer ${rawToken}`,
				Origin: "https://evil.example.com",
			},
		});
		const res = await withApiRequest(
			req,
			ctx,
			["content:read"],
			async () => new Response("ok"),
		);
		expect(res.headers.get("Access-Control-Allow-Origin")).toBeNull();
	});

	it("withApiRequest returns null from resolveCorsOrigin when no Origin header is present", async () => {
		const { registerCms } = await import("../src/config.js");
		registerCms({
			templateKeys: ["content"],
			siteUrl: "https://example.com",
			seedPages: [],
			archives: [],
			translationStatus: [],
			api: { enabled: true, cors: { origin: "https://app.example.com" } },
		});

		const ctx = makeCtx();
		const { rawToken } = await ctx.apiTokens.create({
			label: "test",
			scopes: ["content:read"],
		});
		// No Origin header — CORS should not apply
		const req = new Request("http://localhost/ap-api/v1/content", {
			headers: { Authorization: `Bearer ${rawToken}` },
		});
		const res = await withApiRequest(
			req,
			ctx,
			["content:read"],
			async () => new Response("ok"),
		);
		expect(res.headers.get("Access-Control-Allow-Origin")).toBeNull();
	});

	it("handleCorsPreflightRequest returns 204 with correct headers for OPTIONS with matching origin", async () => {
		// Kills ConditionalExpression mutation: if(false) on `if (request.method !== "OPTIONS")`
		const { registerCms } = await import("../src/config.js");
		registerCms({
			templateKeys: ["content"],
			siteUrl: "https://example.com",
			seedPages: [],
			archives: [],
			translationStatus: [],
			api: { enabled: true, cors: { origin: "https://trusted.example.com" } },
		});

		const req = new Request("http://localhost/ap-api/v1/content", {
			method: "OPTIONS",
			headers: { Origin: "https://trusted.example.com" },
		});
		const res = handleCorsPreflightRequest(req);
		expect(res).not.toBeNull();
		expect(res?.status).toBe(204);
		expect(res?.headers.get("Access-Control-Allow-Origin")).toBe(
			"https://trusted.example.com",
		);
		expect(res?.headers.get("Access-Control-Allow-Methods")).toBe(
			"GET, POST, PUT, DELETE, OPTIONS",
		);
		expect(res?.headers.get("Access-Control-Allow-Headers")).toBe(
			"Authorization, Content-Type",
		);
		expect(res?.headers.get("Access-Control-Max-Age")).toBe("86400");
		expect(res?.headers.get("Vary")).toBe("Origin");
	});

	it("handleCorsPreflightRequest returns null for GET request even when CORS config is present", async () => {
		// Kills ConditionalExpression mutation: if(false) — without early return, GET would trigger preflight
		const { registerCms } = await import("../src/config.js");
		registerCms({
			templateKeys: ["content"],
			siteUrl: "https://example.com",
			seedPages: [],
			archives: [],
			translationStatus: [],
			api: { enabled: true, cors: { origin: "https://trusted.example.com" } },
		});

		const req = new Request("http://localhost/ap-api/v1/content", {
			method: "GET",
			headers: { Origin: "https://trusted.example.com" },
		});
		expect(handleCorsPreflightRequest(req)).toBeNull();
	});

	it("preflight for wildcard origin does not set Vary header", async () => {
		// Kills all `allowedOrigin !== "*"` mutations in handleCorsPreflightRequest
		const { registerCms } = await import("../src/config.js");
		registerCms({
			templateKeys: ["content"],
			siteUrl: "https://example.com",
			seedPages: [],
			archives: [],
			translationStatus: [],
			api: { enabled: true, cors: { origin: "*" } },
		});

		const req = new Request("http://localhost/api", {
			method: "OPTIONS",
			headers: { Origin: "https://any.example.com" },
		});
		const res = handleCorsPreflightRequest(req);
		expect(res?.status).toBe(204);
		expect(res?.headers.get("Access-Control-Allow-Origin")).toBe("*");
		expect(res?.headers.has("Vary")).toBe(false);
	});

	it("no CORS headers when request has no Origin header even with wildcard config", async () => {
		// Kills ConditionalExpression mutation: requestOrigin === null → false
		// (null check moved before wildcard; without it, wildcard returns "*" even when no Origin)
		const { registerCms } = await import("../src/config.js");
		registerCms({
			templateKeys: ["content"],
			siteUrl: "https://example.com",
			seedPages: [],
			archives: [],
			translationStatus: [],
			api: { enabled: true, cors: { origin: "*" } },
		});

		const ctx = makeCtx();
		const { rawToken } = await ctx.apiTokens.create({
			label: "test",
			scopes: ["content:read"],
		});
		const req = new Request("http://localhost/ap-api/v1/content", {
			headers: { Authorization: `Bearer ${rawToken}` }, // No Origin header
		});
		const res = await withApiRequest(
			req,
			ctx,
			["content:read"],
			async () => new Response("ok"),
		);
		expect(res.headers.get("Access-Control-Allow-Origin")).toBeNull();
	});

	it("no CORS headers when cms config has no api key", async () => {
		// Kills OptionalChaining mutation: ?.api?.cors → ?.api.cors
		// (without second ?., undefined.cors throws when api key is absent)
		const { registerCms } = await import("../src/config.js");
		registerCms({
			templateKeys: ["content"],
			siteUrl: "https://example.com",
			seedPages: [],
			archives: [],
			translationStatus: [],
			// No api key at all
		});

		const ctx = makeCtx();
		const { rawToken } = await ctx.apiTokens.create({
			label: "test",
			scopes: ["content:read"],
		});
		const req = new Request("http://localhost/ap-api/v1/content", {
			headers: {
				Authorization: `Bearer ${rawToken}`,
				Origin: "https://example.com",
			},
		});
		const res = await withApiRequest(
			req,
			ctx,
			["content:read"],
			async () => new Response("ok"),
		);
		expect(res.headers.get("Access-Control-Allow-Origin")).toBeNull();
	});
});

// ─── apiErrors shape completeness ────────────────────────────────────────────

describe("apiErrors — remaining shapes", () => {
	it("notFound returns 404 with default message", async () => {
		const res = apiErrors.notFound();
		expect(res.status).toBe(404);
		const body = (await res.json()) as Record<string, unknown>;
		expect(body.code).toBe("not_found");
		expect(body.error).toBe("Not found.");
	});

	it("notFound returns 404 with custom detail", async () => {
		const res = apiErrors.notFound("Record not found");
		expect(res.status).toBe(404);
		const body = (await res.json()) as Record<string, unknown>;
		expect(body.error).toBe("Record not found");
	});

	it("validationError returns 422 with the provided detail", async () => {
		const res = apiErrors.validationError("Field 'slug' is required.");
		expect(res.status).toBe(422);
		const body = (await res.json()) as Record<string, unknown>;
		expect(body.code).toBe("validation_error");
		expect(body.error).toBe("Field 'slug' is required.");
	});

	it("rateLimited returns 429 with rate_limited code and exact error message", async () => {
		// Kills StringLiteral mutation: "Too many requests." → ""
		const res = apiErrors.rateLimited();
		expect(res.status).toBe(429);
		const body = (await res.json()) as Record<string, unknown>;
		expect(body.code).toBe("rate_limited");
		expect(body.error).toBe("Too many requests.");
	});

	it("unauthorized returns 401 with the provided detail", async () => {
		const res = apiErrors.unauthorized("Token expired.");
		expect(res.status).toBe(401);
		const body = (await res.json()) as Record<string, unknown>;
		expect(body.code).toBe("unauthorized");
		expect(body.error).toBe("Token expired.");
	});

	it("forbidden returns 403 with the provided detail", async () => {
		const res = apiErrors.forbidden("Insufficient scope.");
		expect(res.status).toBe(403);
		const body = (await res.json()) as Record<string, unknown>;
		expect(body.code).toBe("forbidden");
		expect(body.error).toBe("Insufficient scope.");
	});
});

// ─── jsonOkWithEtag — ETag collision and hash stability ──────────────────────

describe("jsonOkWithEtag — ETag determinism", () => {
	it("produces the same ETag for the same body on repeated calls", () => {
		const body = { id: 42, title: "Stable" };
		const req1 = new Request("http://localhost/api");
		const req2 = new Request("http://localhost/api");
		const etag1 = jsonOkWithEtag(body, req1).headers.get("ETag");
		const etag2 = jsonOkWithEtag(body, req2).headers.get("ETag");
		expect(etag1).toBe(etag2);
	});

	it("produces different ETags for different bodies", () => {
		const req1 = new Request("http://localhost/api");
		const req2 = new Request("http://localhost/api");
		const etag1 = jsonOkWithEtag({ id: 1 }, req1).headers.get("ETag");
		const etag2 = jsonOkWithEtag({ id: 2 }, req2).headers.get("ETag");
		expect(etag1).not.toBe(etag2);
	});

	it("returns 304 with ETag header on cache hit", () => {
		const body = { id: 1 };
		const req = new Request("http://localhost/api");
		const etag = jsonOkWithEtag(body, req).headers.get("ETag") ?? "";
		const cachedReq = new Request("http://localhost/api", {
			headers: { "If-None-Match": etag },
		});
		const res = jsonOkWithEtag(body, cachedReq);
		expect(res.status).toBe(304);
		expect(res.headers.get("ETag")).toBe(etag);
	});

	it("accepts a custom status code", () => {
		const req = new Request("http://localhost/api");
		const res = jsonOkWithEtag({ created: true }, req, 201);
		expect(res.status).toBe(201);
	});

	it("returns Content-Type application/json for the 200 path", () => {
		// Kills StringLiteral mutation: removes "Content-Type": "application/json" from ETag 200 response
		const req = new Request("http://localhost/api");
		const res = jsonOkWithEtag({ id: 1 }, req);
		expect(res.status).toBe(200);
		expect(res.headers.get("Content-Type")).toBe("application/json");
	});

	it("produces a stable ETag value for a known input — kills arithmetic mutation (h<<5)+h vs (h<<5)-h", () => {
		// weakEtag("{}") with djb2 (33*h): h0=5381, '{':33*5381^123=177630, '}':33*177630^125=5861859=0x5971e3
		// With mutation (31*h): different hash → different ETag → test fails → mutation killed
		const req = new Request("http://localhost/api");
		const res = jsonOkWithEtag({}, req);
		expect(res.headers.get("ETag")).toBe('W/"5971e3"');
	});
});

// ─── Auth error messages ──────────────────────────────────────────────────────

describe("API middleware — auth error messages", () => {
	it("missing Authorization header error message mentions Authorization", async () => {
		// Kills StringLiteral mutation: error message → "" (empty)
		const ctx = makeCtx();
		const req = new Request("http://localhost/ap-api/v1/content");
		const res = await withApiRequest(
			req,
			ctx,
			["content:read"],
			async () => new Response("ok"),
		);
		const body = (await res.json()) as Record<string, unknown>;
		expect(body.error as string).toContain("Authorization");
	});

	it("missing Authorization header error text differs from empty string", async () => {
		// The missing-auth error message and the empty-Bearer error message must both be non-empty.
		// A second check that the missing-auth code path sets a non-empty error.
		const ctx = makeCtx();
		const req = new Request("http://localhost/ap-api/v1/content");
		const res = await withApiRequest(
			req,
			ctx,
			["content:read"],
			async () => new Response("ok"),
		);
		const body = (await res.json()) as Record<string, unknown>;
		expect(body.error as string).not.toBe("");
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
		const { applyAstropressSecurityHeaders } = await import(
			"../src/security-headers.js"
		);
		const headers = new Headers();
		applyAstropressSecurityHeaders(headers, { area: "api" });
		expect(headers.get("Cache-Control")).toContain("no-store");
	});

	it("api area sets default-src 'self' CSP", async () => {
		const { applyAstropressSecurityHeaders } = await import(
			"../src/security-headers.js"
		);
		const headers = new Headers();
		applyAstropressSecurityHeaders(headers, { area: "api" });
		const csp = headers.get("Content-Security-Policy") ?? "";
		expect(csp).toContain("default-src 'self'");
	});
});

// ─── CORS header behaviour (mutation kill tests) ─────────────────────────────

describe("CORS header behaviour (mutation kills)", () => {
	beforeEach(() => {
		vi.resetModules();
	});

	afterAll(() => {
		vi.resetModules();
	});

	it("does not set CORS headers when api.cors is missing from config", async () => {
		// Kills L88 OptionalChaining: ?.api?.cors → ?.api.cors
		// Mutation would throw when api exists but has no cors property.
		const { registerCms } = await import("../src/config.js");
		registerCms({
			templateKeys: ["content"],
			siteUrl: "https://example.com",
			seedPages: [],
			archives: [],
			translationStatus: [],
			api: { enabled: true }, // no cors key
		});
		const ctx = makeCtx();
		const { rawToken } = await ctx.apiTokens.create({
			label: "t",
			scopes: ["content:read"],
		});
		const req = new Request("https://app.example.com/ap-api/v1/content", {
			headers: {
				Authorization: `Bearer ${rawToken}`,
				Origin: "https://app.example.com",
			},
		});
		const res = await withApiRequest(req, ctx, ["content:read"], async () =>
			jsonOk({ ok: true }),
		);
		expect(res.headers.get("Access-Control-Allow-Origin")).toBeNull();
	});

	it("does not grant CORS when request origin is a substring of the configured string origin", async () => {
		// Kills L94 ConditionalExpression: Array.isArray(origin) → true
		// Mutation treats string as array; String.includes() matches substrings, so "https://app.example"
		// would be included in "https://app.example.com" and incorrectly get CORS headers.
		const { registerCms } = await import("../src/config.js");
		registerCms({
			templateKeys: ["content"],
			siteUrl: "https://example.com",
			seedPages: [],
			archives: [],
			translationStatus: [],
			api: { enabled: true, cors: { origin: "https://app.example.com" } },
		});
		const ctx = makeCtx();
		const { rawToken } = await ctx.apiTokens.create({
			label: "t",
			scopes: ["content:read"],
		});
		const req = new Request("https://app.example.com/ap-api/v1/content", {
			headers: {
				Authorization: `Bearer ${rawToken}`,
				Origin: "https://app.example",
			},
		});
		const res = await withApiRequest(req, ctx, ["content:read"], async () =>
			jsonOk({ ok: true }),
		);
		expect(res.headers.get("Access-Control-Allow-Origin")).toBeNull();
	});

	it("includes correct Allow-Methods value on OPTIONS preflight response", async () => {
		// Kills L106 StringLiteral: "GET, POST, PUT, DELETE, OPTIONS" → ""
		const { registerCms } = await import("../src/config.js");
		registerCms({
			templateKeys: ["content"],
			siteUrl: "https://example.com",
			seedPages: [],
			archives: [],
			translationStatus: [],
			api: { enabled: true, cors: { origin: "*" } },
		});
		const req = new Request("https://app.example.com/ap-api/v1/content", {
			method: "OPTIONS",
			headers: { Origin: "https://app.example.com" },
		});
		const res = handleCorsPreflightRequest(req);
		expect(res).not.toBeNull();
		expect(res?.headers.get("Access-Control-Allow-Methods")).toBe(
			"GET, POST, PUT, DELETE, OPTIONS",
		);
	});
});
