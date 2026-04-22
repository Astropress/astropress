/**
 * Sitemap generator for Astropress sites.
 *
 * Generates a sitemap.xml string from published content records.
 * In SSR mode call this from a `/sitemap.xml` Astro endpoint.
 * In static mode the same endpoint runs at build time.
 */

import type { AstropressPlatformAdapter } from "./platform-contracts";

export interface SitemapEntry {
	url: string;
	lastmod?: string;
	changefreq?:
		| "always"
		| "hourly"
		| "daily"
		| "weekly"
		| "monthly"
		| "yearly"
		| "never";
	priority?: number;
}

/**
 * Generate a sitemap.xml body from the platform adapter's published content.
 *
 * @param adapter  The platform adapter (read-only ContentStore is sufficient).
 * @param baseUrl  The canonical origin, e.g. "https://example.com".
 * @returns        A UTF-8 sitemap XML string.
 */
export async function generateAstropressSitemap(
	adapter: Pick<AstropressPlatformAdapter, "content">,
	baseUrl: string,
): Promise<string> {
	const origin = baseUrl.replace(/\/$/, "");

	// Fetch published posts and pages
	const [posts, pages] = await Promise.all([
		adapter.content.list("post", { status: "published" }),
		adapter.content.list("page", { status: "published" }),
	]);

	const entries: SitemapEntry[] = [
		// Homepage
		{ url: `${origin}/`, priority: 1.0, changefreq: "weekly" },
	];

	for (const post of posts) {
		entries.push({
			url: `${origin}/blog/${post.slug}/`,
			lastmod:
				typeof post.metadata?.updatedAt === "string"
					? post.metadata.updatedAt.slice(0, 10)
					: undefined,
			changefreq: "monthly",
			priority: 0.7,
		});
	}

	for (const page of pages) {
		entries.push({
			url: `${origin}/${page.slug}/`,
			lastmod:
				typeof page.metadata?.updatedAt === "string"
					? page.metadata.updatedAt.slice(0, 10)
					: undefined,
			changefreq: "monthly",
			priority: 0.8,
		});
	}

	return buildSitemapXml(entries);
}

function buildSitemapXml(entries: SitemapEntry[]): string {
	const urlElements = entries
		.map((entry) => {
			const parts = ["  <url>", `    <loc>${escapeXml(entry.url)}</loc>`];
			if (entry.lastmod) parts.push(`    <lastmod>${entry.lastmod}</lastmod>`);
			if (entry.changefreq)
				parts.push(`    <changefreq>${entry.changefreq}</changefreq>`);
			if (entry.priority !== undefined)
				parts.push(`    <priority>${entry.priority.toFixed(1)}</priority>`);
			parts.push("  </url>");
			return parts.join("\n");
		})
		.join("\n");

	return [
		`<?xml version="1.0" encoding="UTF-8"?>`,
		`<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">`,
		urlElements,
		"</urlset>",
	].join("\n");
}

function escapeXml(str: string): string {
	return str
		.replace(/&/g, "&amp;")
		.replace(/</g, "&lt;")
		.replace(/>/g, "&gt;")
		.replace(/"/g, "&quot;")
		.replace(/'/g, "&apos;");
}
