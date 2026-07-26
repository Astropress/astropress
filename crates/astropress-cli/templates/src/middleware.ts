import { registerCms } from "@astropress-diy/astropress";
import { createAstropressSecurityMiddleware } from "@astropress-diy/astropress/integration";

// Register CMS — edit siteUrl and templateKeys to match your site.
// `templateKeys` are the structured-page layouts the admin can create; the
// defaults below let "New page" work out of the box. See docs/guides/QUICK_START.md
registerCms({
	siteUrl: import.meta.env.SITE ?? "https://example.com",
	templateKeys: ["landing", "content"],
	seedPages: [],
	archives: [],
	translationStatus: [],
});

// Applies security headers on every response:
// CSP, X-Frame-Options, Permissions-Policy, Referrer-Policy, Cache-Control, X-Request-Id.
// Options: https://astropress.dev/docs/reference/API_REFERENCE.md#security-middleware
export const onRequest = createAstropressSecurityMiddleware();
