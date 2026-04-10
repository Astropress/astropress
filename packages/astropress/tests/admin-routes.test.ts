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

    expect(ASTROPRESS_ADMIN_BASE_PATH).toBe("/ap-admin");
    expect(routes).toHaveLength(64);
    expect(routes.filter((route) => route.kind === "page")).toHaveLength(31);
    expect(routes.filter((route) => route.kind === "action")).toHaveLength(32);
    expect(routes.filter((route) => route.kind === "endpoint")).toHaveLength(1);
    expect(routes.map((route) => route.pattern)).toEqual([
      "/ap-admin",
      "/ap-admin/login",
      "/ap-admin/accept-invite",
      "/ap-admin/reset-password",
      "/ap-admin/session",
      "/ap-admin/posts",
      "/ap-admin/posts/new",
      "/ap-admin/posts/[slug]",
      "/ap-admin/posts/[slug]/revisions",
      "/ap-admin/pages",
      "/ap-admin/pages/new",
      "/ap-admin/route-pages",
      "/ap-admin/route-pages/[...slug]",
      "/ap-admin/archives",
      "/ap-admin/archives/[...slug]",
      "/ap-admin/media",
      "/ap-admin/redirects",
      "/ap-admin/comments",
      "/ap-admin/translations",
      "/ap-admin/seo",
      "/ap-admin/authors",
      "/ap-admin/taxonomies",
      "/ap-admin/users",
      "/ap-admin/settings",
      "/ap-admin/system",
      "/ap-admin/services",
      "/ap-admin/services/[provider]",
      "/ap-admin/cms",
      "/ap-admin/host",
      "/ap-admin/preview/[...slug]",
      "/ap-admin/actions/publish",
      "/ap-admin/actions/accept-invite",
      "/ap-admin/actions/admin-slug-save",
      "/ap-admin/actions/archive-save",
      "/ap-admin/actions/author-delete",
      "/ap-admin/actions/author-save",
      "/ap-admin/actions/comment-moderate",
      "/ap-admin/actions/content-create",
      "/ap-admin/actions/content-save",
      "/ap-admin/actions/media-delete",
      "/ap-admin/actions/media-update",
      "/ap-admin/actions/media-upload",
      "/ap-admin/actions/redirect-create",
      "/ap-admin/actions/redirect-delete",
      "/ap-admin/actions/reset-password",
      "/ap-admin/actions/revision-restore",
      "/ap-admin/actions/route-page-create",
      "/ap-admin/actions/route-page-save",
      "/ap-admin/actions/settings-save",
      "/ap-admin/actions/system-route-save",
      "/ap-admin/actions/taxonomy-delete",
      "/ap-admin/actions/taxonomy-save",
      "/ap-admin/actions/translation-update",
      "/ap-admin/actions/user-invite",
      "/ap-admin/actions/user-reset-link",
      "/ap-admin/actions/user-suspend",
      "/ap-admin/actions/user-unsuspend",
      "/ap-admin/api-tokens",
      "/ap-admin/webhooks",
      "/ap-admin/actions/api-token-create",
      "/ap-admin/actions/api-token-revoke",
      "/ap-admin/actions/webhook-create",
      "/ap-admin/actions/webhook-delete",
      "/ap-admin/actions/schedule-publish",
    ]);
  });

  it("resolves entrypoints from a package pages directory", () => {
    const routeEntrypoints = resolveAstropressAdminRouteEntrypoints("/tmp/astropress/pages/ap-admin/");

    expect(routeEntrypoints[0]).toEqual({
      pattern: "/ap-admin",
      entrypoint: "/tmp/astropress/pages/ap-admin/index.astro",
      kind: "page",
    });
    expect(routeEntrypoints.at(-1)).toEqual({
      pattern: "/ap-admin/actions/schedule-publish",
      entrypoint: "/tmp/astropress/pages/ap-admin/actions/schedule-publish.ts",
      kind: "action",
    });
  });

  it("builds an injection plan from the same canonical route inventory", () => {
    expect(createAstropressAdminRouteInjectionPlan("/tmp/astropress/pages/ap-admin")).toEqual(
      resolveAstropressAdminRouteEntrypoints("/tmp/astropress/pages/ap-admin"),
    );
  });

  it("injects the full canonical route plan into a host callback", () => {
    const injectedRoutes: ReturnType<typeof createAstropressAdminRouteInjectionPlan> = [];
    const plan = injectAstropressAdminRoutes("/tmp/astropress/pages/ap-admin", (route) => {
      injectedRoutes.push(route);
    });

    expect(injectedRoutes).toEqual(plan);
    expect(injectedRoutes).toHaveLength(64);
  });
});
