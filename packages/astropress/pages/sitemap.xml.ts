import { listRuntimeContentStates, resolveCanonicalOrigin } from "@astropress-diy/astropress";
import type { APIRoute } from "astro";

/**
 * GET /sitemap.xml
 *
 * Generates a sitemap for published posts and pages.
 * Works in both SSR (called at request time) and static (called at build time) modes.
 *
 * The origin is the configured canonical site origin (CmsConfig.siteUrl), falling
 * back to the request origin only when no siteUrl is registered. This keeps the
 * sitemap stable behind proxies/alternate hosts and prevents host-header poisoning.
 */
export const GET: APIRoute = async ({ request, locals }) => {
	const origin = resolveCanonicalOrigin(request);

	const all = await listRuntimeContentStates(locals);
	const published = all.filter((r) => r.status === "published");

	// Only "page" records are advertised: they render at /<slug>/ via the injected
	// /[...slug] structured-page route. Posts (and untyped records) are omitted on
	// purpose — Astropress ships no public post renderer, so advertising
	// /blog/<slug>/ produced 404s that actively harmed SEO (#201). When a public
	// post renderer lands (#194), re-add post URLs here.
	const pages = published.filter((r) => r.kind === "page");

	const entries: Array<{
		loc: string;
		lastmod?: string;
		changefreq: string;
		priority: string;
	}> = [{ loc: `${origin}/`, changefreq: "weekly", priority: "1.0" }];

	for (const page of pages) {
		entries.push({
			loc: `${origin}/${page.slug}/`,
			lastmod: page.updatedAt ? page.updatedAt.slice(0, 10) : undefined,
			changefreq: "monthly",
			priority: "0.8",
		});
	}

	const urlElements = entries
		.map((e) => {
			const parts = ["  <url>", `    <loc>${escapeXml(e.loc)}</loc>`];
			if (e.lastmod) parts.push(`    <lastmod>${e.lastmod}</lastmod>`);
			parts.push(`    <changefreq>${e.changefreq}</changefreq>`);
			parts.push(`    <priority>${e.priority}</priority>`);
			parts.push("  </url>");
			return parts.join("\n");
		})
		.join("\n");

	const xml = [
		`<?xml version="1.0" encoding="UTF-8"?>`,
		`<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">`,
		urlElements,
		"</urlset>",
	].join("\n");

	return new Response(xml, {
		headers: {
			"Content-Type": "application/xml; charset=utf-8",
			"Cache-Control": "public, max-age=3600",
		},
	});
};

function escapeXml(str: string): string {
	return str
		.replace(/&/g, "&amp;")
		.replace(/</g, "&lt;")
		.replace(/>/g, "&gt;")
		.replace(/"/g, "&quot;")
		.replace(/'/g, "&apos;");
}
