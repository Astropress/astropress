import { describe, expect, it, vi } from "vitest";
import { createAstropressPublicSiteIntegration } from "astropress";
import { injectAstropressAdminRoutes, listAstropressAdminRoutes } from "../src/admin-routes";

describe("createAstropressPublicSiteIntegration", () => {
  it("returns a valid AstroIntegration with the correct name", () => {
    const integration = createAstropressPublicSiteIntegration();
    expect(integration.name).toBe("astropress-public-site");
  });

  it("has an astro:config:setup hook", () => {
    const integration = createAstropressPublicSiteIntegration();
    expect(typeof integration.hooks["astro:config:setup"]).toBe("function");
  });

  it("accepts buildHookSecret without error", () => {
    expect(() =>
      createAstropressPublicSiteIntegration({ buildHookSecret: "abc123" }),
    ).not.toThrow();
  });

  it("does not inject any ap-admin routes when hook is called", () => {
    const integration = createAstropressPublicSiteIntegration();
    const injectedPatterns: string[] = [];

    const hook = integration.hooks["astro:config:setup"];
    if (typeof hook !== "function") throw new Error("Expected hook to be a function");

    // Call the hook with a spy injectRoute — public site should call it zero times
    hook({
      _config: {},
      injectRoute: (route: { pattern: string }) => {
        injectedPatterns.push(route.pattern);
      },
      addMiddleware: vi.fn(),
    } as never);

    expect(injectedPatterns).toHaveLength(0);
    expect(injectedPatterns.some((p) => p.includes("ap-admin"))).toBe(false);
  });

  it("does not register any admin middleware when hook is called", () => {
    const integration = createAstropressPublicSiteIntegration();
    const addMiddleware = vi.fn();

    const hook = integration.hooks["astro:config:setup"];
    if (typeof hook !== "function") throw new Error("Expected hook to be a function");

    hook({ _config: {}, injectRoute: vi.fn(), addMiddleware } as never);

    expect(addMiddleware).not.toHaveBeenCalled();
  });

  it("public integration injects zero routes while admin routes are non-empty", () => {
    const publicIntegration = createAstropressPublicSiteIntegration();
    const publicInjected: string[] = [];

    const hook = publicIntegration.hooks["astro:config:setup"];
    if (typeof hook !== "function") throw new Error("Expected hook to be a function");

    hook({
      _config: {},
      injectRoute: (route: { pattern: string }) => {
        publicInjected.push(route.pattern);
      },
      addMiddleware: vi.fn(),
    } as never);

    const adminRoutes = listAstropressAdminRoutes();

    expect(publicInjected).toHaveLength(0);
    expect(adminRoutes.length).toBeGreaterThan(0);
    expect(adminRoutes.every((r) => r.pattern.startsWith("/ap-admin"))).toBe(true);
  });

  it("injectAstropressAdminRoutes injects all admin routes with correct patterns", () => {
    const injected: Array<{ pattern: string; entrypoint: string }> = [];
    injectAstropressAdminRoutes("/pages/ap-admin", (route) => injected.push(route));

    expect(injected.length).toBeGreaterThan(0);
    expect(injected.every((r) => r.pattern.startsWith("/ap-admin"))).toBe(true);
    expect(injected.every((r) => r.entrypoint.startsWith("/pages/ap-admin/"))).toBe(true);
  });
});
