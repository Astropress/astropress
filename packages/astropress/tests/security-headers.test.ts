import { describe, expect, it } from "vitest";

import {
	applyAstropressSecurityHeaders,
	applyCacheHeaders,
	createAstropressSecureRedirect,
	createAstropressSecurityHeaders,
	isTrustedRequestOrigin,
	isTrustedStrictRequestOrigin,
} from "../src/security-headers.js";
import { resolveAstropressSecurityArea } from "../src/security-middleware.js";

describe("security headers", () => {
	it("builds a CSP that forbids inline scripts and framing by default", () => {
		// allowInlineStyles defaults to false — callers that need it must opt in explicitly
		const headers = createAstropressSecurityHeaders({
			area: "admin",
			allowInlineStyles: true,
		});
		const csp = headers.get("Content-Security-Policy") ?? "";

		expect(csp).toContain(
			"script-src 'self' https://challenges.cloudflare.com",
		);
		expect(csp).not.toContain("script-src 'self' 'unsafe-inline'");
		expect(csp).toContain("style-src 'self' 'unsafe-inline'");
		expect(csp).toContain("frame-ancestors 'none'");
		expect(headers.get("X-Frame-Options")).toBe("DENY");
		expect(headers.get("X-Content-Type-Options")).toBe("nosniff");
		expect(headers.get("Referrer-Policy")).toBe(
			"strict-origin-when-cross-origin",
		);
	});

	it("defaults allowInlineStyles to false — style-src excludes unsafe-inline without explicit opt-in", () => {
		const headers = createAstropressSecurityHeaders({ area: "admin" });
		const csp = headers.get("Content-Security-Policy") ?? "";
		expect(csp).toContain("style-src 'self'");
		expect(csp).not.toContain("'unsafe-inline'");
	});

	it("sets Cross-Origin-Resource-Policy: same-site for admin, auth, and api areas", () => {
		for (const area of ["admin", "auth", "api"] as const) {
			const headers = createAstropressSecurityHeaders({ area });
			expect(headers.get("Cross-Origin-Resource-Policy"), `area: ${area}`).toBe(
				"same-site",
			);
		}
		// Public area does NOT get CORP
		const publicHeaders = createAstropressSecurityHeaders({ area: "public" });
		expect(publicHeaders.has("Cross-Origin-Resource-Policy")).toBe(false);
	});

	it("adds HSTS only when explicitly requested", () => {
		const withoutHsts = createAstropressSecurityHeaders({ area: "auth" });
		const withHsts = createAstropressSecurityHeaders({
			area: "auth",
			forceHsts: true,
		});

		expect(withoutHsts.has("Strict-Transport-Security")).toBe(false);
		expect(withHsts.get("Strict-Transport-Security")).toContain(
			"max-age=31536000",
		);
	});

	it("applies headers onto an existing collection and secures redirects", () => {
		const target = new Headers({ "Cache-Control": "no-store" });
		applyAstropressSecurityHeaders(target, { area: "api" });

		// applyAstropressSecurityHeaders sets Cache-Control to 'private, no-store' for api area
		expect(target.get("Cache-Control")).toBe("private, no-store");
		expect(target.get("Permissions-Policy")).toContain("camera=()");

		const response = createAstropressSecureRedirect("/ap-admin/login", 302);
		expect(response.status).toBe(302);
		expect(response.headers.get("Location")).toBe("/ap-admin/login");
		expect(response.headers.get("Content-Security-Policy")).toContain(
			"default-src 'self'",
		);
		expect(response.headers.get("Cross-Origin-Resource-Policy")).toBe(
			"same-site",
		);
	});

	it("CSP includes all required default directives with proper separators", () => {
		const csp =
			createAstropressSecurityHeaders().get("Content-Security-Policy") ?? "";
		expect(csp).toContain("base-uri 'self'");
		expect(csp).toContain("img-src 'self' data: https:");
		expect(csp).toContain("font-src 'self' data: https:");
		expect(csp).toContain("connect-src 'self' https:");
		expect(csp).toContain("media-src 'self' data: https:");
		expect(csp).toContain("frame-src 'self' https://challenges.cloudflare.com");
		expect(csp).toContain("worker-src 'self' blob:");
		expect(csp).toContain("manifest-src 'self'");
		expect(csp).toContain("upgrade-insecure-requests");
		expect(csp).toContain("; base-uri 'self'");
	});

	it("default area is public — object-src self and COOP same-origin", () => {
		const headers = createAstropressSecurityHeaders();
		const csp = headers.get("Content-Security-Policy") ?? "";
		expect(csp).toContain("object-src 'self'");
		expect(headers.get("Cross-Origin-Opener-Policy")).toBe("same-origin");
	});

	it("accepts same-origin form posts and rejects cross-origin origins", () => {
		expect(
			isTrustedRequestOrigin(
				new Request("https://example.com/ap-admin/actions/content-save", {
					method: "POST",
					headers: { origin: "https://example.com" },
				}),
			),
		).toBe(true);

		expect(
			isTrustedRequestOrigin(
				new Request("https://example.com/ap-admin/actions/content-save", {
					method: "POST",
					headers: { origin: "https://attacker.example" },
				}),
			),
		).toBe(false);
	});

	it("adds report-uri and Report-To header when reportUri option is set", () => {
		const reportUri = "/ap-admin/actions/csp-report";
		const headers = createAstropressSecurityHeaders({
			area: "admin",
			reportUri,
		});
		const csp = headers.get("Content-Security-Policy") ?? "";

		expect(csp).toContain(`report-uri ${reportUri}`);
		expect(csp).toContain("report-to csp-endpoint");
		expect(headers.get("Report-To")).toContain("csp-endpoint");
		expect(headers.get("Report-To")).toContain(reportUri);
	});

	it("omits report-uri and Report-To when reportUri is not set", () => {
		const headers = createAstropressSecurityHeaders({ area: "admin" });
		const csp = headers.get("Content-Security-Policy") ?? "";

		expect(csp).not.toContain("report-uri");
		expect(csp).not.toContain("report-to");
		expect(headers.has("Report-To")).toBe(false);
	});

	it("rejects cross-origin requests and handles no-origin/no-referer (returns true)", () => {
		// referer check branch (origin absent, referer present)
		expect(
			isTrustedRequestOrigin(
				new Request("https://example.com/ap-admin/save", {
					method: "POST",
					headers: { referer: "https://example.com/ap-admin/page" },
				}),
			),
		).toBe(true); // same-origin referer → truthy

		expect(
			isTrustedRequestOrigin(
				new Request("https://example.com/ap-admin/save", {
					method: "POST",
					headers: { referer: "https://attacker.com/page" },
				}),
			),
		).toBe(false); // cross-origin referer → false

		// Lines 35-36: parseOrigin catch branch — invalid URL string in origin header
		expect(
			isTrustedRequestOrigin(
				new Request("https://example.com/ap-admin/save", {
					method: "POST",
					headers: { origin: "not-a-valid-url" },
				}),
			),
		).toBe(false); // origin header present but unparseable → return false (stricter: no fallback to referer)
	});

	it("uses SAMEORIGIN when frameAncestors option is not 'none'", () => {
		const headers = createAstropressSecurityHeaders({
			frameAncestors: "'self'",
		});
		expect(headers.get("X-Frame-Options")).toBe("SAMEORIGIN");
	});

	it("public area uses object-src self and form-action self https:", () => {
		const headers = createAstropressSecurityHeaders({ area: "public" });
		const csp = headers.get("Content-Security-Policy") ?? "";

		expect(csp).toContain("object-src 'self'");
		expect(csp).toContain("form-action 'self' https:");
	});

	it("admin/auth/api areas use object-src none and restricted form-action", () => {
		for (const area of ["admin", "auth", "api"] as const) {
			const csp =
				createAstropressSecurityHeaders({ area }).get(
					"Content-Security-Policy",
				) ?? "";
			expect(csp).toContain("object-src 'none'");
			expect(csp).toContain("form-action 'self'");
			expect(csp).not.toContain("form-action 'self' https:");
		}
	});

	it("disables inline styles when allowInlineStyles is false", () => {
		const csp =
			createAstropressSecurityHeaders({ allowInlineStyles: false }).get(
				"Content-Security-Policy",
			) ?? "";
		expect(csp).toContain("style-src 'self'");
		expect(csp).not.toContain("'unsafe-inline'");
	});

	it("applyCacheHeaders uses default 300/3600 TTL for public area", () => {
		const headers = new Headers();
		applyCacheHeaders(headers, "public");
		expect(headers.get("Cache-Control")).toBe(
			"public, max-age=300, s-maxage=3600, stale-while-revalidate=86400",
		);
	});

	it("applyCacheHeaders respects publicCacheTtl override for public area", () => {
		const headers = new Headers();
		applyCacheHeaders(headers, "public", 600);
		expect(headers.get("Cache-Control")).toBe(
			"public, max-age=600, s-maxage=7200, stale-while-revalidate=86400",
		);
	});

	it("applyCacheHeaders sets no-store for non-public areas regardless of publicCacheTtl", () => {
		for (const area of ["admin", "auth", "api"] as const) {
			const headers = new Headers();
			applyCacheHeaders(headers, area, 600);
			expect(headers.get("Cache-Control"), `area: ${area}`).toBe(
				"private, no-store",
			);
		}
	});

	it("isTrustedStrictRequestOrigin accepts same-origin origin header", () => {
		expect(
			isTrustedStrictRequestOrigin(
				new Request("https://example.com/ap-admin/actions/accept-invite", {
					method: "POST",
					headers: { origin: "https://example.com" },
				}),
			),
		).toBe(true);
	});

	it("isTrustedStrictRequestOrigin rejects cross-origin origin header", () => {
		expect(
			isTrustedStrictRequestOrigin(
				new Request("https://example.com/ap-admin/actions/accept-invite", {
					method: "POST",
					headers: { origin: "https://attacker.example" },
				}),
			),
		).toBe(false);
	});

	it("isTrustedStrictRequestOrigin accepts same-origin referer when origin absent", () => {
		expect(
			isTrustedStrictRequestOrigin(
				new Request("https://example.com/ap-admin/actions/reset-password", {
					method: "POST",
					headers: { referer: "https://example.com/ap-admin/reset-password" },
				}),
			),
		).toBe(true);
	});

	it("isTrustedStrictRequestOrigin rejects cross-origin referer", () => {
		expect(
			isTrustedStrictRequestOrigin(
				new Request("https://example.com/ap-admin/actions/reset-password", {
					method: "POST",
					headers: { referer: "https://attacker.example/page" },
				}),
			),
		).toBe(false);
	});

	it("isTrustedStrictRequestOrigin rejects requests with neither origin nor referer", () => {
		expect(
			isTrustedStrictRequestOrigin(
				new Request("https://example.com/ap-admin/actions/accept-invite", {
					method: "POST",
				}),
			),
		).toBe(false);
	});

	it("isTrustedStrictRequestOrigin rejects invalid URL in origin header", () => {
		expect(
			isTrustedStrictRequestOrigin(
				new Request("https://example.com/ap-admin/actions/accept-invite", {
					method: "POST",
					headers: { origin: "not-a-valid-url" },
				}),
			),
		).toBe(false);
	});

	it("classifies public, auth, admin, and action routes for middleware application", () => {
		expect(resolveAstropressSecurityArea(new URL("https://example.com/"))).toBe(
			"public",
		);
		expect(
			resolveAstropressSecurityArea(
				new URL("https://example.com/ap-admin/login"),
			),
		).toBe("auth");
		expect(
			resolveAstropressSecurityArea(new URL("https://example.com/ap-admin")),
		).toBe("admin");
		expect(
			resolveAstropressSecurityArea(
				new URL("https://example.com/ap-admin/actions/comment-moderate"),
			),
		).toBe("api");
	});
});
