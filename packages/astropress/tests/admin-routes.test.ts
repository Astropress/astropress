import { describe, expect, it } from "vitest";

import {
  ASTROPRESS_ADMIN_BASE_PATH,
  createAstropressAdminRouteInjectionPlan,
  injectAstropressAdminRoutes,
  listAstropressAdminRoutes,
  resolveAstropressAdminRouteEntrypoints,
} from "../src/admin-routes";

describe("admin routes", () => {
  it("defines the full package-owned admin surface", () => {
    const routes = listAstropressAdminRoutes();

    expect(ASTROPRESS_ADMIN_BASE_PATH).toBe("/wp-admin");
    expect(routes).toHaveLength(51);
    expect(routes.filter((route) => route.kind === "page")).toHaveLength(24);
    expect(routes.filter((route) => route.kind === "action")).toHaveLength(26);
    expect(routes.filter((route) => route.kind === "endpoint")).toHaveLength(1);
    expect(routes.map((route) => route.pattern)).toEqual([
      "/wp-admin",
      "/wp-admin/login",
      "/wp-admin/accept-invite",
      "/wp-admin/reset-password",
      "/wp-admin/session",
      "/wp-admin/posts",
      "/wp-admin/posts/new",
      "/wp-admin/posts/[slug]",
      "/wp-admin/posts/[slug]/revisions",
      "/wp-admin/pages",
      "/wp-admin/pages/new",
      "/wp-admin/route-pages",
      "/wp-admin/route-pages/[...slug]",
      "/wp-admin/archives",
      "/wp-admin/archives/[...slug]",
      "/wp-admin/media",
      "/wp-admin/redirects",
      "/wp-admin/comments",
      "/wp-admin/translations",
      "/wp-admin/seo",
      "/wp-admin/authors",
      "/wp-admin/taxonomies",
      "/wp-admin/users",
      "/wp-admin/settings",
      "/wp-admin/system",
      "/wp-admin/actions/accept-invite",
      "/wp-admin/actions/admin-slug-save",
      "/wp-admin/actions/archive-save",
      "/wp-admin/actions/author-delete",
      "/wp-admin/actions/author-save",
      "/wp-admin/actions/comment-moderate",
      "/wp-admin/actions/content-create",
      "/wp-admin/actions/content-save",
      "/wp-admin/actions/media-delete",
      "/wp-admin/actions/media-update",
      "/wp-admin/actions/media-upload",
      "/wp-admin/actions/redirect-create",
      "/wp-admin/actions/redirect-delete",
      "/wp-admin/actions/reset-password",
      "/wp-admin/actions/revision-restore",
      "/wp-admin/actions/route-page-create",
      "/wp-admin/actions/route-page-save",
      "/wp-admin/actions/settings-save",
      "/wp-admin/actions/system-route-save",
      "/wp-admin/actions/taxonomy-delete",
      "/wp-admin/actions/taxonomy-save",
      "/wp-admin/actions/translation-update",
      "/wp-admin/actions/user-invite",
      "/wp-admin/actions/user-reset-link",
      "/wp-admin/actions/user-suspend",
      "/wp-admin/actions/user-unsuspend",
    ]);
  });

  it("resolves entrypoints from a package pages directory", () => {
    const routeEntrypoints = resolveAstropressAdminRouteEntrypoints("/tmp/astropress/pages/wp-admin/");

    expect(routeEntrypoints[0]).toEqual({
      pattern: "/wp-admin",
      entrypoint: "/tmp/astropress/pages/wp-admin/index.astro",
      kind: "page",
    });
    expect(routeEntrypoints.at(-1)).toEqual({
      pattern: "/wp-admin/actions/user-unsuspend",
      entrypoint: "/tmp/astropress/pages/wp-admin/actions/user-unsuspend.ts",
      kind: "action",
    });
  });

  it("builds an injection plan from the same canonical route inventory", () => {
    expect(createAstropressAdminRouteInjectionPlan("/tmp/astropress/pages/wp-admin")).toEqual(
      resolveAstropressAdminRouteEntrypoints("/tmp/astropress/pages/wp-admin"),
    );
  });

  it("injects the full canonical route plan into a host callback", () => {
    const injectedRoutes: ReturnType<typeof createAstropressAdminRouteInjectionPlan> = [];
    const plan = injectAstropressAdminRoutes("/tmp/astropress/pages/wp-admin", (route) => {
      injectedRoutes.push(route);
    });

    expect(injectedRoutes).toEqual(plan);
    expect(injectedRoutes).toHaveLength(51);
  });
});
