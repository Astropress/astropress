import { describe, expect, it, vi } from "vitest";
import { createAstropressCmsRouteRegistry } from "../src/cms-route-registry-factory";

const actor = { email: "admin@example.com", role: "admin" as const, name: "Admin" };

describe("createAstropressCmsRouteRegistry", () => {
  it("saves a system route through injected persistence", () => {
    const persistSystemRoute = vi.fn();
    const appendSystemRouteRevision = vi.fn();
    const recordRouteAudit = vi.fn();
    const registry = createAstropressCmsRouteRegistry({
      normalizePath: (pathname) => pathname.startsWith("/") ? pathname : `/${pathname}`,
      localeFromPath: () => "en",
      listSystemRoutes: () => [],
      getSystemRoute: () => null,
      listStructuredPageRoutes: () => [],
      getStructuredPageRoute: () => null,
      getArchiveRoute: () => null,
      listArchiveRoutes: () => [],
      findSystemRouteForUpdate: () => ({ id: "route-1", renderStrategy: "generated_text" }),
      persistSystemRoute,
      appendSystemRouteRevision,
      isRoutePathTaken: () => false,
      findStructuredRouteForUpdate: () => null,
      insertStructuredRoute: vi.fn(),
      persistStructuredRoute: vi.fn(),
      appendStructuredRouteRevision: vi.fn(),
      findArchiveRouteForUpdate: () => null,
      persistArchiveRoute: vi.fn(),
      appendArchiveRouteRevision: vi.fn(),
      recordRouteAudit,
    });

    const result = registry.saveSystemRoute("/about", { title: "About", summary: "Body" }, actor);
    expect(result.ok).toBe(true);
    expect(persistSystemRoute).toHaveBeenCalled();
    expect(appendSystemRouteRevision).toHaveBeenCalled();
    expect(recordRouteAudit).toHaveBeenCalled();
  });

  it("creates a structured page route", () => {
    const insertStructuredRoute = vi.fn();
    const appendStructuredRouteRevision = vi.fn();
    const registry = createAstropressCmsRouteRegistry({
      normalizePath: (pathname) => pathname.startsWith("/") ? pathname : `/${pathname}`,
      localeFromPath: () => "en",
      listSystemRoutes: () => [],
      getSystemRoute: () => null,
      listStructuredPageRoutes: () => [],
      getStructuredPageRoute: () => ({
        path: "/programs",
        title: "Programs",
        templateKey: "content",
        alternateLinks: [],
        sections: null,
      }),
      getArchiveRoute: () => null,
      listArchiveRoutes: () => [],
      findSystemRouteForUpdate: () => null,
      persistSystemRoute: vi.fn(),
      appendSystemRouteRevision: vi.fn(),
      isRoutePathTaken: () => false,
      findStructuredRouteForUpdate: () => ({ id: "route-2" }),
      insertStructuredRoute,
      persistStructuredRoute: vi.fn(),
      appendStructuredRouteRevision,
      findArchiveRouteForUpdate: () => null,
      persistArchiveRoute: vi.fn(),
      appendArchiveRouteRevision: vi.fn(),
      recordRouteAudit: vi.fn(),
    });

    const result = registry.createStructuredPageRoute("/programs", { title: "Programs", templateKey: "content" }, actor);
    expect(result.ok).toBe(true);
    expect(insertStructuredRoute).toHaveBeenCalled();
    expect(appendStructuredRouteRevision).toHaveBeenCalled();
  });

  it("saves an archive route", () => {
    const persistArchiveRoute = vi.fn();
    const appendArchiveRouteRevision = vi.fn();
    const registry = createAstropressCmsRouteRegistry({
      normalizePath: (pathname) => pathname.startsWith("/") ? pathname : `/${pathname}`,
      localeFromPath: () => "en",
      listSystemRoutes: () => [],
      getSystemRoute: () => null,
      listStructuredPageRoutes: () => [],
      getStructuredPageRoute: () => null,
      getArchiveRoute: () => ({ path: "/blog", title: "Blog" }),
      listArchiveRoutes: () => [],
      findSystemRouteForUpdate: () => null,
      persistSystemRoute: vi.fn(),
      appendSystemRouteRevision: vi.fn(),
      isRoutePathTaken: () => false,
      findStructuredRouteForUpdate: () => null,
      insertStructuredRoute: vi.fn(),
      persistStructuredRoute: vi.fn(),
      appendStructuredRouteRevision: vi.fn(),
      findArchiveRouteForUpdate: () => ({ id: "route-3" }),
      persistArchiveRoute,
      appendArchiveRouteRevision,
      recordRouteAudit: vi.fn(),
    });

    const result = registry.saveArchiveRoute("/blog", { title: "Blog" }, actor);
    expect(result.ok).toBe(true);
    expect(persistArchiveRoute).toHaveBeenCalled();
    expect(appendArchiveRouteRevision).toHaveBeenCalled();
  });
});
