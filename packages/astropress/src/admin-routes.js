const adminRouteDefinitions = [
  { pattern: "/ap-admin", entrypoint: "index.astro", kind: "page" },
  { pattern: "/ap-admin/login", entrypoint: "login.astro", kind: "page" },
  { pattern: "/ap-admin/accept-invite", entrypoint: "accept-invite.astro", kind: "page" },
  { pattern: "/ap-admin/reset-password", entrypoint: "reset-password.astro", kind: "page" },
  { pattern: "/ap-admin/session", entrypoint: "session.ts", kind: "endpoint" },
  { pattern: "/ap-admin/posts", entrypoint: "posts.astro", kind: "page" },
  { pattern: "/ap-admin/posts/new", entrypoint: "posts/new.astro", kind: "page" },
  { pattern: "/ap-admin/posts/[slug]", entrypoint: "posts/[slug].astro", kind: "page" },
  { pattern: "/ap-admin/posts/[slug]/revisions", entrypoint: "posts/[slug]/revisions.astro", kind: "page" },
  { pattern: "/ap-admin/pages", entrypoint: "pages.astro", kind: "page" },
  { pattern: "/ap-admin/pages/new", entrypoint: "pages/new.astro", kind: "page" },
  { pattern: "/ap-admin/route-pages", entrypoint: "route-pages.astro", kind: "page" },
  { pattern: "/ap-admin/route-pages/[...slug]", entrypoint: "route-pages/[...slug].astro", kind: "page" },
  { pattern: "/ap-admin/archives", entrypoint: "archives.astro", kind: "page" },
  { pattern: "/ap-admin/archives/[...slug]", entrypoint: "archives/[...slug].astro", kind: "page" },
  { pattern: "/ap-admin/media", entrypoint: "media.astro", kind: "page" },
  { pattern: "/ap-admin/redirects", entrypoint: "redirects.astro", kind: "page" },
  { pattern: "/ap-admin/comments", entrypoint: "comments.astro", kind: "page" },
  { pattern: "/ap-admin/translations", entrypoint: "translations.astro", kind: "page" },
  { pattern: "/ap-admin/seo", entrypoint: "seo.astro", kind: "page" },
  { pattern: "/ap-admin/authors", entrypoint: "authors.astro", kind: "page" },
  { pattern: "/ap-admin/taxonomies", entrypoint: "taxonomies.astro", kind: "page" },
  { pattern: "/ap-admin/users", entrypoint: "users.astro", kind: "page" },
  { pattern: "/ap-admin/settings", entrypoint: "settings.astro", kind: "page" },
  { pattern: "/ap-admin/system", entrypoint: "system.astro", kind: "page" },
  { pattern: "/ap-admin/services", entrypoint: "services.astro", kind: "page" },
  { pattern: "/ap-admin/services/[provider]", entrypoint: "services/[provider].astro", kind: "page" },
  { pattern: "/ap-admin/cms", entrypoint: "cms.astro", kind: "page" },
  { pattern: "/ap-admin/host", entrypoint: "host.astro", kind: "page" },
  { pattern: "/ap-admin/preview/[...slug]", entrypoint: "preview/[...slug].astro", kind: "page" },
  { pattern: "/ap-admin/actions/publish", entrypoint: "actions/publish.ts", kind: "action" },
  { pattern: "/ap-admin/actions/accept-invite", entrypoint: "actions/accept-invite.ts", kind: "action" },
  { pattern: "/ap-admin/actions/admin-slug-save", entrypoint: "actions/admin-slug-save.ts", kind: "action" },
  { pattern: "/ap-admin/actions/archive-save", entrypoint: "actions/archive-save.ts", kind: "action" },
  { pattern: "/ap-admin/actions/author-delete", entrypoint: "actions/author-delete.ts", kind: "action" },
  { pattern: "/ap-admin/actions/author-save", entrypoint: "actions/author-save.ts", kind: "action" },
  { pattern: "/ap-admin/actions/comment-moderate", entrypoint: "actions/comment-moderate.ts", kind: "action" },
  { pattern: "/ap-admin/actions/content-create", entrypoint: "actions/content-create.ts", kind: "action" },
  { pattern: "/ap-admin/actions/content-save", entrypoint: "actions/content-save.ts", kind: "action" },
  { pattern: "/ap-admin/actions/media-delete", entrypoint: "actions/media-delete.ts", kind: "action" },
  { pattern: "/ap-admin/actions/media-update", entrypoint: "actions/media-update.ts", kind: "action" },
  { pattern: "/ap-admin/actions/media-upload", entrypoint: "actions/media-upload.ts", kind: "action" },
  { pattern: "/ap-admin/actions/redirect-create", entrypoint: "actions/redirect-create.ts", kind: "action" },
  { pattern: "/ap-admin/actions/redirect-delete", entrypoint: "actions/redirect-delete.ts", kind: "action" },
  { pattern: "/ap-admin/actions/reset-password", entrypoint: "actions/reset-password.ts", kind: "action" },
  { pattern: "/ap-admin/actions/revision-restore", entrypoint: "actions/revision-restore.ts", kind: "action" },
  { pattern: "/ap-admin/actions/route-page-create", entrypoint: "actions/route-page-create.ts", kind: "action" },
  { pattern: "/ap-admin/actions/route-page-save", entrypoint: "actions/route-page-save.ts", kind: "action" },
  { pattern: "/ap-admin/actions/settings-save", entrypoint: "actions/settings-save.ts", kind: "action" },
  { pattern: "/ap-admin/actions/system-route-save", entrypoint: "actions/system-route-save.ts", kind: "action" },
  { pattern: "/ap-admin/actions/taxonomy-delete", entrypoint: "actions/taxonomy-delete.ts", kind: "action" },
  { pattern: "/ap-admin/actions/taxonomy-save", entrypoint: "actions/taxonomy-save.ts", kind: "action" },
  { pattern: "/ap-admin/actions/translation-update", entrypoint: "actions/translation-update.ts", kind: "action" },
  { pattern: "/ap-admin/actions/user-invite", entrypoint: "actions/user-invite.ts", kind: "action" },
  { pattern: "/ap-admin/actions/user-reset-link", entrypoint: "actions/user-reset-link.ts", kind: "action" },
  { pattern: "/ap-admin/actions/user-suspend", entrypoint: "actions/user-suspend.ts", kind: "action" },
  { pattern: "/ap-admin/actions/user-unsuspend", entrypoint: "actions/user-unsuspend.ts", kind: "action" },
];

/**
 * The base URL path for all Astropress admin routes.
 *
 * @example
 * ```ts
 * import { ASTROPRESS_ADMIN_BASE_PATH } from "astropress";
 *
 * const adminUrl = `${siteUrl}${ASTROPRESS_ADMIN_BASE_PATH}`; // "https://example.com/ap-admin"
 * ```
 */
export const ASTROPRESS_ADMIN_BASE_PATH = "/ap-admin";

export function listAstropressAdminRoutes() {
  return adminRouteDefinitions.map((route) => ({ ...route }));
}

export function resolveAstropressAdminRouteEntrypoints(basePath) {
  const normalizedBasePath = basePath.replace(/\/+$/, "");
  return listAstropressAdminRoutes().map((route) => ({
    ...route,
    entrypoint: `${normalizedBasePath}/${route.entrypoint}`,
  }));
}

/**
 * Generate the list of admin route definitions with resolved entrypoints for
 * a given pages directory. Pass the result to your framework's route injector.
 *
 * @example
 * ```ts
 * import { createAstropressAdminRouteInjectionPlan } from "astropress";
 *
 * const routes = createAstropressAdminRouteInjectionPlan("src/pages");
 * for (const route of routes) {
 *   console.log(route.pattern, route.entrypoint);
 *   // e.g. "/ap-admin/posts" "src/pages/ap-admin/posts/index.astro"
 * }
 * ```
 */
export function createAstropressAdminRouteInjectionPlan(pagesDirectory) {
  return resolveAstropressAdminRouteEntrypoints(pagesDirectory);
}

export function injectAstropressAdminRoutes(pagesDirectory, injectRoute) {
  const plan = createAstropressAdminRouteInjectionPlan(pagesDirectory);
  for (const route of plan) {
    injectRoute(route);
  }
  return plan;
}
