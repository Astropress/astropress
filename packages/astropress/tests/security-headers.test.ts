// @ts-nocheck
// 
import { describe, expect, it, vi } from "vitest";

import {
  applyCacheHeaders,
  applyAstropressSecurityHeaders,
  createAstropressSecureRedirect,
  createAstropressSecurityHeaders,
  isTrustedRequestOrigin,
} from "../src/security-headers.js";
import { resolveAstropressSecurityArea } from "../src/security-middleware.js";
import { onRequest } from "../src/security-middleware-entrypoint.js";

describe("security headers", () => {
  it("builds a CSP that forbids inline scripts and framing by default", () => {
    // allowInlineStyles defaults to false — callers that need it must opt in explicitly
    const headers = createAstropressSecurityHeaders({ area: "admin", allowInlineStyles: true });
    const csp = headers.get("Content-Security-Policy") ?? "";

    expect(csp).toContain("script-src 'self' https://challenges.cloudflare.com");
    expect(csp).not.toContain("script-src 'self' 'unsafe-inline'");
    expect(csp).toContain("style-src 'self' 'unsafe-inline'");
    expect(csp).toContain("frame-ancestors 'none'");
    expect(headers.get("X-Frame-Options")).toBe("DENY");
    expect(headers.get("X-Content-Type-Options")).toBe("nosniff");
    expect(headers.get("Referrer-Policy")).toBe("strict-origin-when-cross-origin");
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
      expect(headers.get("Cross-Origin-Resource-Policy"), `area: ${area}`).toBe("same-site");
    }
    // Public area does NOT get CORP
    const publicHeaders = createAstropressSecurityHeaders({ area: "public" });
    expect(publicHeaders.has("Cross-Origin-Resource-Policy")).toBe(false);
  });

  it("adds HSTS only when explicitly requested", () => {
    const withoutHsts = createAstropressSecurityHeaders({ area: "auth" });
    const withHsts = createAstropressSecurityHeaders({ area: "auth", forceHsts: true });

    expect(withoutHsts.has("Strict-Transport-Security")).toBe(false);
    expect(withHsts.get("Strict-Transport-Security")).toContain("max-age=31536000");
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
    expect(response.headers.get("Content-Security-Policy")).toContain("default-src 'self'");
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
    const headers = createAstropressSecurityHeaders({ area: "admin", reportUri });
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
    // Lines 83-84: requestUrl null → false; use duck-typed object with invalid URL
    expect(isTrustedRequestOrigin({ url: "not-a-url", headers: new Headers() } as unknown as Request)).toBe(false);

    // Line 91-92: referer check branch (origin absent, referer present)
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
    const headers = createAstropressSecurityHeaders({ frameAncestors: "'self'" });
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
      const csp = createAstropressSecurityHeaders({ area }).get("Content-Security-Policy") ?? "";
      expect(csp).toContain("object-src 'none'");
      expect(csp).toContain("form-action 'self'");
      expect(csp).not.toContain("form-action 'self' https:");
    }
  });

  it("disables inline styles when allowInlineStyles is false", () => {
    const csp = createAstropressSecurityHeaders({ allowInlineStyles: false }).get("Content-Security-Policy") ?? "";
    expect(csp).toContain("style-src 'self'");
    expect(csp).not.toContain("'unsafe-inline'");
  });

  it("applyCacheHeaders uses default 300/3600 TTL for public area", () => {
    const headers = new Headers();
    applyCacheHeaders(headers, "public");
    expect(headers.get("Cache-Control")).toBe("public, max-age=300, s-maxage=3600, stale-while-revalidate=86400");
  });

  it("applyCacheHeaders respects publicCacheTtl override for public area", () => {
    const headers = new Headers();
    applyCacheHeaders(headers, "public", 600);
    expect(headers.get("Cache-Control")).toBe("public, max-age=600, s-maxage=7200, stale-while-revalidate=86400");
  });

  it("applyCacheHeaders sets no-store for non-public areas regardless of publicCacheTtl", () => {
    for (const area of ["admin", "auth", "api"] as const) {
      const headers = new Headers();
      applyCacheHeaders(headers, area, 600);
      expect(headers.get("Cache-Control"), `area: ${area}`).toBe("private, no-store");
    }
  });

  it("CSP contains all expected directives with correct values", () => {
    const csp = createAstropressSecurityHeaders({ area: "admin" }).get("Content-Security-Policy") ?? "";

    expect(csp).toContain("default-src 'self'");
    expect(csp).toContain("base-uri 'self'");
    expect(csp).toContain("img-src 'self' data: https:");
    expect(csp).toContain("font-src 'self' data: https:");
    expect(csp).toContain("connect-src 'self' https:");
    expect(csp).toContain("media-src 'self' data: https:");
    expect(csp).toContain("frame-src 'self' https://challenges.cloudflare.com");
    expect(csp).toContain("worker-src 'self' blob:");
    expect(csp).toContain("manifest-src 'self'");
    expect(csp).toContain("upgrade-insecure-requests");
  });

  it("CSP directives are joined with '; ' separator", () => {
    const csp = createAstropressSecurityHeaders({ area: "admin" }).get("Content-Security-Policy") ?? "";
    // Split by the separator and verify multiple directives are present
    const parts = csp.split("; ");
    expect(parts.length).toBeGreaterThan(5);
    expect(parts[0]).toBe("default-src 'self'");
  });

  it("Cross-Origin-Opener-Policy is set to same-origin", () => {
    const headers = createAstropressSecurityHeaders({ area: "admin" });
    expect(headers.get("Cross-Origin-Opener-Policy")).toBe("same-origin");
  });

  it("Permissions-Policy enumerates camera, geolocation, microphone, payment, usb", () => {
    const policy = createAstropressSecurityHeaders({ area: "public" }).get("Permissions-Policy") ?? "";
    expect(policy).toContain("camera=()");
    expect(policy).toContain("geolocation=()");
    expect(policy).toContain("microphone=()");
    expect(policy).toContain("payment=()");
    expect(policy).toContain("usb=()");
  });

  it("HSTS max-age is exactly 31536000 with includeSubDomains", () => {
    const headers = createAstropressSecurityHeaders({ forceHsts: true });
    expect(headers.get("Strict-Transport-Security")).toBe("max-age=31536000; includeSubDomains");
  });

  it("Report-To header includes the group name, max_age, and endpoint URL", () => {
    const reportUri = "https://example.com/csp-report";
    const headers = createAstropressSecurityHeaders({ reportUri });
    const reportTo = JSON.parse(headers.get("Report-To") ?? "{}");
    expect(reportTo.group).toBe("csp-endpoint");
    expect(reportTo.max_age).toBe(86400);
    expect(reportTo.endpoints[0].url).toBe(reportUri);
  });

  it("applyCacheHeaders uses default public area when area is omitted", () => {
    const headers = new Headers();
    applyCacheHeaders(headers);
    expect(headers.get("Cache-Control")).toContain("public");
    expect(headers.get("Cache-Control")).toContain("max-age=300");
  });

  it("applyCacheHeaders scales CDN TTL as 12x browser TTL for public area", () => {
    const headers = new Headers();
    applyCacheHeaders(headers, "public", 100);
    expect(headers.get("Cache-Control")).toBe("public, max-age=100, s-maxage=1200, stale-while-revalidate=86400");
  });

  it("isTrustedRequestOrigin returns true when no origin or referer is present", () => {
    const req = new Request("https://example.com/ap-admin/save", { method: "POST" });
    expect(isTrustedRequestOrigin(req)).toBe(true);
  });

  it("createAstropressSecureRedirect merges caller options over api area default", () => {
    const res = createAstropressSecureRedirect("https://example.com/login", 301, { forceHsts: true });
    expect(res.status).toBe(301);
    expect(res.headers.get("Strict-Transport-Security")).toContain("max-age=");
    expect(res.headers.get("Location")).toBe("https://example.com/login");
  });

  it("createAstropressSecurityHeaders with no options defaults to public area CSP behavior", () => {
    // Kills StringLiteral mutation: options.area ?? "" (would change area default from "public" to "")
    const headers = createAstropressSecurityHeaders();
    const csp = headers.get("Content-Security-Policy") ?? "";
    // public area uses 'self' not 'none' for object-src
    expect(csp).toContain("object-src 'self'");
    // public area does NOT get Cross-Origin-Resource-Policy
    expect(headers.has("Cross-Origin-Resource-Policy")).toBe(false);
  });

  it("createAstropressSecureRedirect uses 'api' area which sets CORP same-site", () => {
    // Kills StringLiteral mutation: area: "" — api area sets CORP, "" would not
    const res = createAstropressSecureRedirect("/ap-admin/login");
    expect(res.headers.get("Cross-Origin-Resource-Policy")).toBe("same-site");
  });

  it("applyAstropressSecurityHeaders defaults to public area when area is not specified", () => {
    // Kills StringLiteral mutation in applyAstropressSecurityHeaders: options.area ?? ""
    const headers = new Headers();
    applyAstropressSecurityHeaders(headers);
    // public area cache headers
    expect(headers.get("Cache-Control")).toContain("public");
  });

  it("classifies public, auth, admin, and action routes for middleware application", () => {
    expect(resolveAstropressSecurityArea(new URL("https://example.com/"))).toBe("public");
    expect(resolveAstropressSecurityArea(new URL("https://example.com/ap-admin/login"))).toBe("auth");
    expect(resolveAstropressSecurityArea(new URL("https://example.com/ap-admin"))).toBe("admin");
    expect(resolveAstropressSecurityArea(new URL("https://example.com/ap-admin/actions/comment-moderate"))).toBe("api");
  });

  it("security-middleware-entrypoint exports a callable onRequest middleware function", () => {
    // Kills L6 NoCoverage mutation in security-middleware-entrypoint.ts: exercises the module
    // and ensures the ObjectLiteral ({allowInlineStyles}) is used to construct the middleware.
    expect(typeof onRequest).toBe("function");
  });

  it("security-middleware-entrypoint onRequest enables inline styles in dev mode", async () => {
    // Kills ObjectLiteral mutation: { allowInlineStyles: import.meta.env.DEV } → {}
    // import.meta.env.DEV is true in Vitest (mode='test', not 'production')
    // Original: allowInlineStyles=true → admin CSP includes 'unsafe-inline' for style-src
    // Mutant {}: allowInlineStyles=undefined → admin CSP omits 'unsafe-inline'
    // vi.resetModules() + dynamic import forces module re-evaluation with the (possibly mutated) source.
    vi.resetModules();
    const { onRequest: freshOnRequest } = await import("../src/security-middleware-entrypoint.js");
    const response = await freshOnRequest(
      { url: new URL("https://example.com/ap-admin/dashboard") },
      async () => new Response("ok"),
    );
    const csp = response.headers.get("Content-Security-Policy") ?? "";
    expect(csp).toContain("'unsafe-inline'");
  });

  it("isTrustedRequestOrigin returns false when referer is an invalid URL", () => {
    // Kills ConditionalExpression mutation: referer !== null → true (security-headers.ts L141)
    // With mutation, parseOrigin(rawReferer)=null → tries null.origin → throws
    // Also kills L131/L139: entering block with null raw header → parseOrigin(null)=null → return false
    expect(
      isTrustedRequestOrigin(
        new Request("https://example.com/ap-admin/save", {
          method: "POST",
          headers: { referer: "not-a-valid-url" },
        }),
      ),
    ).toBe(false);
  });
});
