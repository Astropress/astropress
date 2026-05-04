// Admin route definition table extracted from admin-routes.ts to keep
// that file under the 400-line arch-lint warning.

import type { AstropressAdminRouteDefinition } from "./admin-routes";

export const adminRouteDefinitions = [
	{ pattern: "/ap-admin", entrypoint: "index.astro", kind: "page" },
	{ pattern: "/ap-admin/login", entrypoint: "login.astro", kind: "page" },
	{
		pattern: "/ap-admin/accept-invite",
		entrypoint: "accept-invite.astro",
		kind: "page",
	},
	{
		pattern: "/ap-admin/reset-password",
		entrypoint: "reset-password.astro",
		kind: "page",
	},
	{ pattern: "/ap-admin/session", entrypoint: "session.ts", kind: "endpoint" },
	{ pattern: "/ap-admin/posts", entrypoint: "posts.astro", kind: "page" },
	{
		pattern: "/ap-admin/posts/new",
		entrypoint: "posts/new.astro",
		kind: "page",
	},
	{
		pattern: "/ap-admin/posts/[slug]",
		entrypoint: "posts/[slug].astro",
		kind: "page",
	},
	{
		pattern: "/ap-admin/posts/[slug]/revisions",
		entrypoint: "posts/[slug]/revisions.astro",
		kind: "page",
	},
	{ pattern: "/ap-admin/pages", entrypoint: "pages.astro", kind: "page" },
	{
		pattern: "/ap-admin/pages/new",
		entrypoint: "pages/new.astro",
		kind: "page",
	},
	{
		pattern: "/ap-admin/route-pages",
		entrypoint: "route-pages.astro",
		kind: "page",
	},
	{
		pattern: "/ap-admin/route-pages/[...slug]",
		entrypoint: "route-pages/[...slug].astro",
		kind: "page",
	},
	{ pattern: "/ap-admin/archives", entrypoint: "archives.astro", kind: "page" },
	{
		pattern: "/ap-admin/archives/[...slug]",
		entrypoint: "archives/[...slug].astro",
		kind: "page",
	},
	{ pattern: "/ap-admin/media", entrypoint: "media.astro", kind: "page" },
	{
		pattern: "/ap-admin/redirects",
		entrypoint: "redirects.astro",
		kind: "page",
	},
	{ pattern: "/ap-admin/comments", entrypoint: "comments.astro", kind: "page" },
	{
		pattern: "/ap-admin/translations",
		entrypoint: "translations.astro",
		kind: "page",
	},
	{ pattern: "/ap-admin/seo", entrypoint: "seo.astro", kind: "page" },
	{ pattern: "/ap-admin/authors", entrypoint: "authors.astro", kind: "page" },
	{
		pattern: "/ap-admin/taxonomies",
		entrypoint: "taxonomies.astro",
		kind: "page",
	},
	{ pattern: "/ap-admin/users", entrypoint: "users.astro", kind: "page" },
	{ pattern: "/ap-admin/settings", entrypoint: "settings.astro", kind: "page" },
	{ pattern: "/ap-admin/system", entrypoint: "system.astro", kind: "page" },
	{ pattern: "/ap-admin/services", entrypoint: "services.astro", kind: "page" },
	{
		pattern: "/ap-admin/services/[provider]",
		entrypoint: "services/[provider].astro",
		kind: "page",
	},
	{ pattern: "/ap-admin/cms", entrypoint: "cms.astro", kind: "page" },
	{ pattern: "/ap-admin/host", entrypoint: "host.astro", kind: "page" },
	{
		pattern: "/ap-admin/preview/[...slug]",
		entrypoint: "preview/[...slug].astro",
		kind: "page",
	},
	{
		pattern: "/ap-admin/actions/publish",
		entrypoint: "actions/publish.ts",
		kind: "action",
	},
	{
		pattern: "/ap-admin/actions/accept-invite",
		entrypoint: "actions/accept-invite.ts",
		kind: "action",
	},
	{
		pattern: "/ap-admin/actions/admin-slug-save",
		entrypoint: "actions/admin-slug-save.ts",
		kind: "action",
	},
	{
		pattern: "/ap-admin/actions/archive-save",
		entrypoint: "actions/archive-save.ts",
		kind: "action",
	},
	{
		pattern: "/ap-admin/actions/author-delete",
		entrypoint: "actions/author-delete.ts",
		kind: "action",
	},
	{
		pattern: "/ap-admin/actions/author-save",
		entrypoint: "actions/author-save.ts",
		kind: "action",
	},
	{
		pattern: "/ap-admin/actions/comment-moderate",
		entrypoint: "actions/comment-moderate.ts",
		kind: "action",
	},
	{
		pattern: "/ap-admin/testimonials",
		entrypoint: "testimonials.astro",
		kind: "page",
	},
	{
		pattern: "/ap-admin/actions/testimonial-moderate",
		entrypoint: "actions/testimonial-moderate.ts",
		kind: "action",
	},
	{
		pattern: "/ap-admin/actions/content-create",
		entrypoint: "actions/content-create.ts",
		kind: "action",
	},
	{
		pattern: "/ap-admin/actions/content-save",
		entrypoint: "actions/content-save.ts",
		kind: "action",
	},
	{
		pattern: "/ap-admin/actions/media-delete",
		entrypoint: "actions/media-delete.ts",
		kind: "action",
	},
	{
		pattern: "/ap-admin/actions/media-update",
		entrypoint: "actions/media-update.ts",
		kind: "action",
	},
	{
		pattern: "/ap-admin/actions/media-upload",
		entrypoint: "actions/media-upload.ts",
		kind: "action",
	},
	{
		pattern: "/ap-admin/actions/redirect-create",
		entrypoint: "actions/redirect-create.ts",
		kind: "action",
	},
	{
		pattern: "/ap-admin/actions/redirect-delete",
		entrypoint: "actions/redirect-delete.ts",
		kind: "action",
	},
	{
		pattern: "/ap-admin/actions/reset-password",
		entrypoint: "actions/reset-password.ts",
		kind: "action",
	},
	{
		pattern: "/ap-admin/actions/revision-restore",
		entrypoint: "actions/revision-restore.ts",
		kind: "action",
	},
	{
		pattern: "/ap-admin/actions/route-page-create",
		entrypoint: "actions/route-page-create.ts",
		kind: "action",
	},
	{
		pattern: "/ap-admin/actions/route-page-save",
		entrypoint: "actions/route-page-save.ts",
		kind: "action",
	},
	{
		pattern: "/ap-admin/actions/settings-save",
		entrypoint: "actions/settings-save.ts",
		kind: "action",
	},
	{
		pattern: "/ap-admin/actions/system-route-save",
		entrypoint: "actions/system-route-save.ts",
		kind: "action",
	},
	{
		pattern: "/ap-admin/actions/taxonomy-delete",
		entrypoint: "actions/taxonomy-delete.ts",
		kind: "action",
	},
	{
		pattern: "/ap-admin/actions/taxonomy-save",
		entrypoint: "actions/taxonomy-save.ts",
		kind: "action",
	},
	{
		pattern: "/ap-admin/actions/translation-update",
		entrypoint: "actions/translation-update.ts",
		kind: "action",
	},
	{
		pattern: "/ap-admin/actions/user-invite",
		entrypoint: "actions/user-invite.ts",
		kind: "action",
	},
	{
		pattern: "/ap-admin/actions/user-reset-link",
		entrypoint: "actions/user-reset-link.ts",
		kind: "action",
	},
	{
		pattern: "/ap-admin/actions/user-suspend",
		entrypoint: "actions/user-suspend.ts",
		kind: "action",
	},
	{
		pattern: "/ap-admin/actions/user-unsuspend",
		entrypoint: "actions/user-unsuspend.ts",
		kind: "action",
	},
	{
		pattern: "/ap-admin/api-tokens",
		entrypoint: "api-tokens.astro",
		kind: "page",
	},
	{ pattern: "/ap-admin/webhooks", entrypoint: "webhooks.astro", kind: "page" },
	{
		pattern: "/ap-admin/actions/api-token-create",
		entrypoint: "actions/api-token-create.ts",
		kind: "action",
	},
	{
		pattern: "/ap-admin/actions/api-token-revoke",
		entrypoint: "actions/api-token-revoke.ts",
		kind: "action",
	},
	{
		pattern: "/ap-admin/actions/webhook-create",
		entrypoint: "actions/webhook-create.ts",
		kind: "action",
	},
	{
		pattern: "/ap-admin/actions/webhook-delete",
		entrypoint: "actions/webhook-delete.ts",
		kind: "action",
	},
	{
		pattern: "/ap-admin/actions/schedule-publish",
		entrypoint: "actions/schedule-publish.ts",
		kind: "action",
	},
	{
		pattern: "/ap-admin/actions/user-purge",
		entrypoint: "actions/user-purge.ts",
		kind: "action",
	},
	{ pattern: "/ap-admin/access", entrypoint: "access.astro", kind: "page" },
	{ pattern: "/ap-admin/forms", entrypoint: "forms.astro", kind: "page" },
	{
		pattern: "/ap-admin/newsletter",
		entrypoint: "newsletter.astro",
		kind: "page",
	},
	{ pattern: "/ap-admin/events", entrypoint: "[stub].astro", kind: "page" },
	{ pattern: "/ap-admin/reviews", entrypoint: "[stub].astro", kind: "page" },
	{
		pattern: "/ap-admin/referrals",
		entrypoint: "[stub].astro",
		kind: "page",
	},
	{
		pattern: "/ap-admin/memberships",
		entrypoint: "[stub].astro",
		kind: "page",
	},
	{
		pattern: "/ap-admin/community",
		entrypoint: "[stub].astro",
		kind: "page",
	},
	{ pattern: "/ap-admin/shop", entrypoint: "[stub].astro", kind: "page" },
	{
		pattern: "/ap-admin/social-syndication",
		entrypoint: "[stub].astro",
		kind: "page",
	},
	{
		pattern: "/ap-admin/structured-data",
		entrypoint: "[stub].astro",
		kind: "page",
	},
	{
		pattern: "/ap-admin/sitemaps",
		entrypoint: "[stub].astro",
		kind: "page",
	},
	{
		pattern: "/ap-admin/maps-local",
		entrypoint: "[stub].astro",
		kind: "page",
	},
	{
		pattern: "/ap-admin/analytics",
		entrypoint: "analytics.astro",
		kind: "page",
	},
	{
		pattern: "/ap-admin/heatmaps",
		entrypoint: "[stub].astro",
		kind: "page",
	},
	{
		pattern: "/ap-admin/ab-testing",
		entrypoint: "[stub].astro",
		kind: "page",
	},
	{ pattern: "/ap-admin/email", entrypoint: "[stub].astro", kind: "page" },
	{
		pattern: "/ap-admin/live-chat",
		entrypoint: "[stub].astro",
		kind: "page",
	},
	{
		pattern: "/ap-admin/image-cdn",
		entrypoint: "[stub].astro",
		kind: "page",
	},
	{ pattern: "/ap-admin/search", entrypoint: "search.astro", kind: "page" },
	{
		pattern: "/ap-admin/cdn-purge",
		entrypoint: "cdn-purge.astro",
		kind: "page",
	},
	{
		pattern: "/ap-admin/monitoring",
		entrypoint: "[stub].astro",
		kind: "page",
	},
	{
		pattern: "/ap-admin/deploy-hooks",
		entrypoint: "[stub].astro",
		kind: "page",
	},
	{ pattern: "/ap-admin/plugins", entrypoint: "[stub].astro", kind: "page" },
	{ pattern: "/ap-admin/data", entrypoint: "[stub].astro", kind: "page" },
	{ pattern: "/ap-admin/backups", entrypoint: "[stub].astro", kind: "page" },
] as const satisfies readonly AstropressAdminRouteDefinition[];
