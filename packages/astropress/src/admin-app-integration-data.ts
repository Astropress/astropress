// stryker-disable-file: data-only — static catalog used by createAstropressAdminAppIntegration: package-relative asset paths and the (pattern, entrypoint) route registrations injected via Astro's `astro:config:setup` hook. No conditional branches; mutating any literal here just changes which file is served at which URL — covered by integration-level smoke tests in tests/admin-app-integration.test.ts that assert injectRoute call shapes, not by re-asserting the literal pattern strings.

export const ADMIN_APP_ASSET_PATHS = {
	adminCss: "public/admin.css",
	sectionsCss: "public/sections.css",
} as const;

export const ADMIN_APP_DEV_SERVE_ROUTES = [
	{ url: "/admin.css", asset: "adminCss" as const },
	{ url: "/sections.css", asset: "sectionsCss" as const },
];

export const ADMIN_APP_INJECTED_ROUTES = [
	{ pattern: "/ap/health", entrypoint: "pages/ap/health.js" },
	{ pattern: "/sitemap.xml", entrypoint: "pages/sitemap.xml.js" },
	{ pattern: "/robots.txt", entrypoint: "pages/robots.txt.js" },
	{ pattern: "/llms.txt", entrypoint: "pages/llms.txt.js" },
	{ pattern: "/ap-api/v1/metrics", entrypoint: "pages/ap-api/v1/metrics.js" },
	{
		pattern: "/ap-api/v1/og-image/[slug].png",
		entrypoint: "pages/ap-api/v1/og-image/[slug].png.js",
	},
];

export const ADMIN_APP_PAGES_DIRECTORY = "pages/ap-admin";
export const ADMIN_APP_INTEGRATION_NAME = "astropress-admin-app";
export const ADMIN_APP_SECURITY_MIDDLEWARE_ENTRYPOINT = "./security-middleware-entrypoint.js";
