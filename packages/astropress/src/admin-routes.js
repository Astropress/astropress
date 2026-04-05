const adminRouteDefinitions = [
  { pattern: "/wp-admin", entrypoint: "index.astro", kind: "page" },
  { pattern: "/wp-admin/login", entrypoint: "login.astro", kind: "page" },
  { pattern: "/wp-admin/accept-invite", entrypoint: "accept-invite.astro", kind: "page" },
  { pattern: "/wp-admin/reset-password", entrypoint: "reset-password.astro", kind: "page" },
  { pattern: "/wp-admin/session", entrypoint: "session.ts", kind: "endpoint" },
  { pattern: "/wp-admin/posts", entrypoint: "posts.astro", kind: "page" },
  { pattern: "/wp-admin/posts/new", entrypoint: "posts/new.astro", kind: "page" },
  { pattern: "/wp-admin/posts/[slug]", entrypoint: "posts/[slug].astro", kind: "page" },
  { pattern: "/wp-admin/posts/[slug]/revisions", entrypoint: "posts/[slug]/revisions.astro", kind: "page" },
  { pattern: "/wp-admin/pages", entrypoint: "pages.astro", kind: "page" },
  { pattern: "/wp-admin/pages/new", entrypoint: "pages/new.astro", kind: "page" },
  { pattern: "/wp-admin/route-pages", entrypoint: "route-pages.astro", kind: "page" },
  { pattern: "/wp-admin/route-pages/[...slug]", entrypoint: "route-pages/[...slug].astro", kind: "page" },
  { pattern: "/wp-admin/archives", entrypoint: "archives.astro", kind: "page" },
  { pattern: "/wp-admin/archives/[...slug]", entrypoint: "archives/[...slug].astro", kind: "page" },
  { pattern: "/wp-admin/media", entrypoint: "media.astro", kind: "page" },
  { pattern: "/wp-admin/redirects", entrypoint: "redirects.astro", kind: "page" },
  { pattern: "/wp-admin/comments", entrypoint: "comments.astro", kind: "page" },
  { pattern: "/wp-admin/translations", entrypoint: "translations.astro", kind: "page" },
  { pattern: "/wp-admin/seo", entrypoint: "seo.astro", kind: "page" },
  { pattern: "/wp-admin/authors", entrypoint: "authors.astro", kind: "page" },
  { pattern: "/wp-admin/taxonomies", entrypoint: "taxonomies.astro", kind: "page" },
  { pattern: "/wp-admin/users", entrypoint: "users.astro", kind: "page" },
  { pattern: "/wp-admin/settings", entrypoint: "settings.astro", kind: "page" },
  { pattern: "/wp-admin/system", entrypoint: "system.astro", kind: "page" },
  { pattern: "/wp-admin/actions/accept-invite", entrypoint: "actions/accept-invite.ts", kind: "action" },
  { pattern: "/wp-admin/actions/admin-slug-save", entrypoint: "actions/admin-slug-save.ts", kind: "action" },
  { pattern: "/wp-admin/actions/archive-save", entrypoint: "actions/archive-save.ts", kind: "action" },
  { pattern: "/wp-admin/actions/author-delete", entrypoint: "actions/author-delete.ts", kind: "action" },
  { pattern: "/wp-admin/actions/author-save", entrypoint: "actions/author-save.ts", kind: "action" },
  { pattern: "/wp-admin/actions/comment-moderate", entrypoint: "actions/comment-moderate.ts", kind: "action" },
  { pattern: "/wp-admin/actions/content-create", entrypoint: "actions/content-create.ts", kind: "action" },
  { pattern: "/wp-admin/actions/content-save", entrypoint: "actions/content-save.ts", kind: "action" },
  { pattern: "/wp-admin/actions/media-delete", entrypoint: "actions/media-delete.ts", kind: "action" },
  { pattern: "/wp-admin/actions/media-update", entrypoint: "actions/media-update.ts", kind: "action" },
  { pattern: "/wp-admin/actions/media-upload", entrypoint: "actions/media-upload.ts", kind: "action" },
  { pattern: "/wp-admin/actions/redirect-create", entrypoint: "actions/redirect-create.ts", kind: "action" },
  { pattern: "/wp-admin/actions/redirect-delete", entrypoint: "actions/redirect-delete.ts", kind: "action" },
  { pattern: "/wp-admin/actions/reset-password", entrypoint: "actions/reset-password.ts", kind: "action" },
  { pattern: "/wp-admin/actions/revision-restore", entrypoint: "actions/revision-restore.ts", kind: "action" },
  { pattern: "/wp-admin/actions/route-page-create", entrypoint: "actions/route-page-create.ts", kind: "action" },
  { pattern: "/wp-admin/actions/route-page-save", entrypoint: "actions/route-page-save.ts", kind: "action" },
  { pattern: "/wp-admin/actions/settings-save", entrypoint: "actions/settings-save.ts", kind: "action" },
  { pattern: "/wp-admin/actions/system-route-save", entrypoint: "actions/system-route-save.ts", kind: "action" },
  { pattern: "/wp-admin/actions/taxonomy-delete", entrypoint: "actions/taxonomy-delete.ts", kind: "action" },
  { pattern: "/wp-admin/actions/taxonomy-save", entrypoint: "actions/taxonomy-save.ts", kind: "action" },
  { pattern: "/wp-admin/actions/translation-update", entrypoint: "actions/translation-update.ts", kind: "action" },
  { pattern: "/wp-admin/actions/user-invite", entrypoint: "actions/user-invite.ts", kind: "action" },
  { pattern: "/wp-admin/actions/user-reset-link", entrypoint: "actions/user-reset-link.ts", kind: "action" },
  { pattern: "/wp-admin/actions/user-suspend", entrypoint: "actions/user-suspend.ts", kind: "action" },
  { pattern: "/wp-admin/actions/user-unsuspend", entrypoint: "actions/user-unsuspend.ts", kind: "action" },
];

export const ASTROPRESS_ADMIN_BASE_PATH = "/wp-admin";

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

export function createAstropressAdminRouteInjectionPlan(pagesDirectory) {
  return resolveAstropressAdminRouteEntrypoints(pagesDirectory);
}
