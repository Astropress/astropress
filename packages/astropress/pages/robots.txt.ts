import { resolveCanonicalOrigin } from "@astropress-diy/astropress";
import type { APIRoute } from "astro";

/**
 * GET /robots.txt
 *
 * Generates a robots.txt with a pointer to the sitemap.
 * Works in both SSR (request-time) and static (build-time) modes.
 *
 * Uses the configured canonical site origin (CmsConfig.siteUrl) for the
 * Sitemap directive, falling back to the request origin only when no siteUrl
 * is registered. See issue #124.
 */
export const GET: APIRoute = async ({ request }) => {
	const origin = resolveCanonicalOrigin(request);

	const content = ["User-agent: *", "Allow: /", "", `Sitemap: ${origin}/sitemap.xml`].join("\n");

	return new Response(content, {
		headers: {
			"Content-Type": "text/plain; charset=utf-8",
			"Cache-Control": "public, max-age=86400",
		},
	});
};
