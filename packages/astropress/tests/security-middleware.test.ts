import { describe, expect, it, vi } from "vitest";
import { resolveAstropressSecurityArea, createAstropressSecurityMiddleware } from "../src/security-middleware.js";

describe("resolveAstropressSecurityArea", () => {
  it("returns public for root path", () => {
    expect(resolveAstropressSecurityArea(new URL("http://localhost/"))).toBe("public");
  });

  it("returns public for non-admin paths", () => {
    expect(resolveAstropressSecurityArea(new URL("http://localhost/about"))).toBe("public");
    expect(resolveAstropressSecurityArea(new URL("http://localhost/blog/post-slug"))).toBe("public");
  });

  it("returns auth for /wp-admin/login", () => {
    expect(resolveAstropressSecurityArea(new URL("http://localhost/wp-admin/login"))).toBe("auth");
  });

  it("returns auth for /wp-admin/reset-password", () => {
    expect(resolveAstropressSecurityArea(new URL("http://localhost/wp-admin/reset-password"))).toBe("auth");
  });

  it("returns auth for /wp-admin/accept-invite", () => {
    expect(resolveAstropressSecurityArea(new URL("http://localhost/wp-admin/accept-invite"))).toBe("auth");
  });

  it("returns api for paths under /wp-admin/actions/", () => {
    expect(resolveAstropressSecurityArea(new URL("http://localhost/wp-admin/actions/save-post"))).toBe("api");
    expect(resolveAstropressSecurityArea(new URL("http://localhost/wp-admin/actions/redirect-create"))).toBe("api");
  });

  it("returns admin for other /wp-admin paths", () => {
    expect(resolveAstropressSecurityArea(new URL("http://localhost/wp-admin/settings"))).toBe("admin");
    expect(resolveAstropressSecurityArea(new URL("http://localhost/wp-admin/users"))).toBe("admin");
    expect(resolveAstropressSecurityArea(new URL("http://localhost/wp-admin/posts"))).toBe("admin");
  });

  it("supports a custom adminBasePath", () => {
    expect(resolveAstropressSecurityArea(new URL("http://localhost/admin/login"), "/admin")).toBe("auth");
    expect(resolveAstropressSecurityArea(new URL("http://localhost/admin/settings"), "/admin")).toBe("admin");
    expect(resolveAstropressSecurityArea(new URL("http://localhost/wp-admin/login"), "/admin")).toBe("public");
  });
});

describe("createAstropressSecurityMiddleware", () => {
  function makeNext(status = 200): () => Promise<Response> {
    return () => Promise.resolve(new Response(null, { status }));
  }

  it("applies security headers to the response", async () => {
    const middleware = createAstropressSecurityMiddleware();
    const response = await middleware({ url: new URL("http://localhost/") }, makeNext());
    expect(response.headers.get("content-security-policy")).toBeTruthy();
    expect(response.headers.get("x-content-type-options")).toBe("nosniff");
  });

  it("uses custom resolveArea when provided", async () => {
    const resolveArea = vi.fn(() => "api" as const);
    const middleware = createAstropressSecurityMiddleware({ resolveArea });
    await middleware({ url: new URL("http://localhost/custom") }, makeNext());
    expect(resolveArea).toHaveBeenCalledWith(new URL("http://localhost/custom"));
  });

  it("falls back to resolveAstropressSecurityArea when resolveArea is not provided", async () => {
    const middleware = createAstropressSecurityMiddleware({ adminBasePath: "/admin" });
    const adminResponse = await middleware({ url: new URL("http://localhost/admin/posts") }, makeNext());
    // admin area — form-action should be restricted to 'self'
    const csp = adminResponse.headers.get("content-security-policy") ?? "";
    expect(csp).toContain("form-action 'self'");
    expect(csp).not.toContain("form-action 'self' https:");
  });

  it("public area CSP permits https: in form-action", async () => {
    const middleware = createAstropressSecurityMiddleware();
    const response = await middleware({ url: new URL("http://localhost/") }, makeNext());
    const csp = response.headers.get("content-security-policy") ?? "";
    expect(csp).toContain("form-action 'self' https:");
  });
});
