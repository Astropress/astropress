import { createAstropressSecurityMiddleware } from "astropress/integration";
import { registerCms } from "astropress";

// Register CMS — edit siteUrl and templateKeys to match your site.
// See: docs/guides/QUICK_START.md
registerCms({
  siteUrl: import.meta.env.SITE ?? "https://example.com",
  templateKeys: [],
  seedPages: [],
  archives: [],
  translationStatus: [],
});

// Applies security headers on every response:
// CSP, X-Frame-Options, Permissions-Policy, Referrer-Policy, Cache-Control, X-Request-Id.
// Options: https://astropress.dev/docs/reference/API_REFERENCE.md#security-middleware
export const onRequest = createAstropressSecurityMiddleware();
