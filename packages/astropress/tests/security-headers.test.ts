import { describe, expect, it } from "vitest";

import {
  applyAstropressSecurityHeaders,
  createAstropressSecureRedirect,
  createAstropressSecurityHeaders,
  isTrustedRequestOrigin,
} from "../src/security-headers.js";
import { resolveAstropressSecurityArea } from "../src/security-middleware.js";

describe("security headers", () => {
  it("builds a CSP that forbids inline scripts and framing by default", () => {
    const headers = createAstropressSecurityHeaders({ area: "admin" });
    const csp = headers.get("Content-Security-Policy") ?? "";

    expect(csp).toContain("script-src 'self' https://challenges.cloudflare.com");
    expect(csp).not.toContain("script-src 'self' 'unsafe-inline'");
    expect(csp).toContain("style-src 'self' 'unsafe-inline'");
    expect(csp).toContain("frame-ancestors 'none'");
    expect(headers.get("X-Frame-Options")).toBe("DENY");
    expect(headers.get("X-Content-Type-Options")).toBe("nosniff");
    expect(headers.get("Referrer-Policy")).toBe("strict-origin-when-cross-origin");
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

    expect(target.get("Cache-Control")).toBe("no-store");
    expect(target.get("Permissions-Policy")).toContain("camera=()");

    const response = createAstropressSecureRedirect("/wp-admin/login", 302);
    expect(response.status).toBe(302);
    expect(response.headers.get("Location")).toBe("/wp-admin/login");
    expect(response.headers.get("Content-Security-Policy")).toContain("default-src 'self'");
  });

  it("accepts same-origin form posts and rejects cross-origin origins", () => {
    expect(
      isTrustedRequestOrigin(
        new Request("https://example.com/wp-admin/actions/content-save", {
          method: "POST",
          headers: { origin: "https://example.com" },
        }),
      ),
    ).toBe(true);

    expect(
      isTrustedRequestOrigin(
        new Request("https://example.com/wp-admin/actions/content-save", {
          method: "POST",
          headers: { origin: "https://attacker.example" },
        }),
      ),
    ).toBe(false);
  });

  it("adds report-uri and Report-To header when reportUri option is set", () => {
    const reportUri = "/wp-admin/actions/csp-report";
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

  it("classifies public, auth, admin, and action routes for middleware application", () => {
    expect(resolveAstropressSecurityArea(new URL("https://example.com/"))).toBe("public");
    expect(resolveAstropressSecurityArea(new URL("https://example.com/wp-admin/login"))).toBe("auth");
    expect(resolveAstropressSecurityArea(new URL("https://example.com/wp-admin"))).toBe("admin");
    expect(resolveAstropressSecurityArea(new URL("https://example.com/wp-admin/actions/comment-moderate"))).toBe("api");
  });
});
