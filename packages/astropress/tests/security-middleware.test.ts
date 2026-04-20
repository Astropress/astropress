import { describe, expect, it, vi } from "vitest";
import {
	createAstropressSecurityMiddleware,
	resolveAstropressSecurityArea,
} from "../src/security-middleware.js";

describe("resolveAstropressSecurityArea", () => {
	it("returns public for root path", () => {
		expect(resolveAstropressSecurityArea(new URL("http://localhost/"))).toBe(
			"public",
		);
	});

	it("returns public for non-admin paths", () => {
		expect(
			resolveAstropressSecurityArea(new URL("http://localhost/about")),
		).toBe("public");
		expect(
			resolveAstropressSecurityArea(new URL("http://localhost/blog/post-slug")),
		).toBe("public");
	});

	it("returns auth for /ap-admin/login", () => {
		expect(
			resolveAstropressSecurityArea(new URL("http://localhost/ap-admin/login")),
		).toBe("auth");
	});

	it("returns auth for /ap-admin/reset-password", () => {
		expect(
			resolveAstropressSecurityArea(
				new URL("http://localhost/ap-admin/reset-password"),
			),
		).toBe("auth");
	});

	it("returns auth for /ap-admin/accept-invite", () => {
		expect(
			resolveAstropressSecurityArea(
				new URL("http://localhost/ap-admin/accept-invite"),
			),
		).toBe("auth");
	});

	it("returns api for paths under /ap-admin/actions/", () => {
		expect(
			resolveAstropressSecurityArea(
				new URL("http://localhost/ap-admin/actions/save-post"),
			),
		).toBe("api");
		expect(
			resolveAstropressSecurityArea(
				new URL("http://localhost/ap-admin/actions/redirect-create"),
			),
		).toBe("api");
	});

	it("returns admin for other /ap-admin paths", () => {
		expect(
			resolveAstropressSecurityArea(
				new URL("http://localhost/ap-admin/settings"),
			),
		).toBe("admin");
		expect(
			resolveAstropressSecurityArea(new URL("http://localhost/ap-admin/users")),
		).toBe("admin");
		expect(
			resolveAstropressSecurityArea(new URL("http://localhost/ap-admin/posts")),
		).toBe("admin");
	});

	it("supports a custom adminBasePath", () => {
		expect(
			resolveAstropressSecurityArea(
				new URL("http://localhost/admin/login"),
				"/admin",
			),
		).toBe("auth");
		expect(
			resolveAstropressSecurityArea(
				new URL("http://localhost/admin/settings"),
				"/admin",
			),
		).toBe("admin");
		expect(
			resolveAstropressSecurityArea(
				new URL("http://localhost/ap-admin/login"),
				"/admin",
			),
		).toBe("public");
	});

	it("returns api for /ap-api/ paths regardless of adminBasePath", () => {
		// The /ap-api/ prefix check runs BEFORE the adminBasePath check
		expect(
			resolveAstropressSecurityArea(
				new URL("http://localhost/ap-api/v1/content"),
			),
		).toBe("api");
		expect(
			resolveAstropressSecurityArea(
				new URL("http://localhost/ap-api/v1/media"),
			),
		).toBe("api");
		expect(
			resolveAstropressSecurityArea(
				new URL("http://localhost/ap-api/v1/health"),
			),
		).toBe("api");
		// Custom adminBasePath does not affect /ap-api/ classification
		expect(
			resolveAstropressSecurityArea(
				new URL("http://localhost/ap-api/v1/content"),
				"/admin",
			),
		).toBe("api");
	});
});

describe("createAstropressSecurityMiddleware", () => {
	function makeNext(status = 200): () => Promise<Response> {
		return () => Promise.resolve(new Response(null, { status }));
	}

	it("applies security headers to the response", async () => {
		const middleware = createAstropressSecurityMiddleware();
		const response = await middleware(
			{ url: new URL("http://localhost/") },
			makeNext(),
		);
		expect(response.headers.get("content-security-policy")).toBeTruthy();
		expect(response.headers.get("x-content-type-options")).toBe("nosniff");
	});

	it("uses custom resolveArea when provided", async () => {
		const resolveArea = vi.fn(() => "api" as const);
		const middleware = createAstropressSecurityMiddleware({ resolveArea });
		await middleware({ url: new URL("http://localhost/custom") }, makeNext());
		expect(resolveArea).toHaveBeenCalledWith(
			new URL("http://localhost/custom"),
		);
	});

	it("falls back to resolveAstropressSecurityArea when resolveArea is not provided", async () => {
		const middleware = createAstropressSecurityMiddleware({
			adminBasePath: "/admin",
		});
		const adminResponse = await middleware(
			{ url: new URL("http://localhost/admin/posts") },
			makeNext(),
		);
		// admin area — form-action should be restricted to 'self'
		const csp = adminResponse.headers.get("content-security-policy") ?? "";
		expect(csp).toContain("form-action 'self'");
		expect(csp).not.toContain("form-action 'self' https:");
	});

	it("public area CSP permits https: in form-action", async () => {
		const middleware = createAstropressSecurityMiddleware();
		const response = await middleware(
			{ url: new URL("http://localhost/") },
			makeNext(),
		);
		const csp = response.headers.get("content-security-policy") ?? "";
		expect(csp).toContain("form-action 'self' https:");
	});

	it("attaches a unique X-Request-Id header to every response", async () => {
		const middleware = createAstropressSecurityMiddleware();
		const r1 = await middleware(
			{ url: new URL("http://localhost/") },
			makeNext(),
		);
		const r2 = await middleware(
			{ url: new URL("http://localhost/") },
			makeNext(),
		);
		const id1 = r1.headers.get("x-request-id");
		const id2 = r2.headers.get("x-request-id");
		expect(id1).toBeTruthy();
		expect(id2).toBeTruthy();
		expect(id1).not.toBe(id2);
	});

	it("applies allowInlineStyles option to the CSP", async () => {
		const middleware = createAstropressSecurityMiddleware({
			allowInlineStyles: true,
		});
		const response = await middleware(
			{ url: new URL("http://localhost/ap-admin/settings") },
			makeNext(),
		);
		const csp = response.headers.get("content-security-policy") ?? "";
		expect(csp).toContain("'unsafe-inline'");
	});

	it("applies forceHsts option when set", async () => {
		const middleware = createAstropressSecurityMiddleware({ forceHsts: true });
		const response = await middleware(
			{ url: new URL("http://localhost/") },
			makeNext(),
		);
		expect(response.headers.get("strict-transport-security")).toContain(
			"max-age=31536000",
		);
	});

	it("applies frameAncestors option to X-Frame-Options", async () => {
		const middleware = createAstropressSecurityMiddleware({
			frameAncestors: "'self'",
		});
		const response = await middleware(
			{ url: new URL("http://localhost/") },
			makeNext(),
		);
		expect(response.headers.get("x-frame-options")).toBe("SAMEORIGIN");
	});

	it("classifies /ap-api/ paths as api area (applyAstropressSecurityHeaders branch)", async () => {
		const middleware = createAstropressSecurityMiddleware();
		const response = await middleware(
			{ url: new URL("http://localhost/ap-api/v1/content") },
			makeNext(),
		);
		// API area: Cross-Origin-Resource-Policy must be set
		expect(response.headers.get("cross-origin-resource-policy")).toBe(
			"same-site",
		);
		// API area: Cache-Control must be no-store
		expect(response.headers.get("cache-control")).toBe("private, no-store");
	});

	// Regression: /ap-admin/login is classified as "auth", which previously received
	// style-src 'self' (no unsafe-inline). In Vite dev mode Astro injects inline
	// <style> blocks, so the middleware must opt into allowInlineStyles: DEV to
	// avoid an unstyled login page during development.
	it("auth-area routes do NOT include unsafe-inline in style-src by default", async () => {
		const middleware = createAstropressSecurityMiddleware();
		const response = await middleware(
			{ url: new URL("http://localhost/ap-admin/login") },
			makeNext(),
		);
		const csp = response.headers.get("content-security-policy") ?? "";
		expect(csp).toContain("style-src 'self'");
		expect(csp).not.toContain("'unsafe-inline'");
	});

	it("auth-area routes include unsafe-inline in style-src when allowInlineStyles is true", async () => {
		const middleware = createAstropressSecurityMiddleware({
			allowInlineStyles: true,
		});
		const loginResponse = await middleware(
			{ url: new URL("http://localhost/ap-admin/login") },
			makeNext(),
		);
		const resetResponse = await middleware(
			{ url: new URL("http://localhost/ap-admin/reset-password") },
			makeNext(),
		);
		expect(loginResponse.headers.get("content-security-policy")).toContain(
			"'unsafe-inline'",
		);
		expect(resetResponse.headers.get("content-security-policy")).toContain(
			"'unsafe-inline'",
		);
	});
});
