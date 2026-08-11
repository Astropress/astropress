import { listRuntimeContentStates, resolveCanonicalOrigin } from "@astropress-diy/astropress";
import type { APIRoute } from "astro";

/**
 * GET /llms.txt
 *
 * Generates an llms.txt file for AI crawlers listing published content.
 * This makes content discoverable by AI agents and answer engines.
 * See: https://llmstxt.org
 *
 * Uses the configured canonical site origin (CmsConfig.siteUrl), falling back
 * to the request origin only when no siteUrl is registered. See issue #124.
 */
export const GET: APIRoute = async ({ request, locals }) => {
	const origin = resolveCanonicalOrigin(request);

	const all = await listRuntimeContentStates(locals);
	const published = all.filter((r) => r.status === "published");

	// Only "page" records are advertised: they render at /<slug>/ via the injected
	// /[...slug] structured-page route. Posts (and untyped records) are omitted on
	// purpose — Astropress ships no public post renderer, so advertising
	// /blog/<slug>/ produced 404s that harmed AEO/SEO (#201). When a public post
	// renderer lands (#194), re-add a "## Posts" section here.
	const pages = published.filter((r) => r.kind === "page");

	const lines = [`# ${origin}`, "", "> Content site powered by Astropress.", ""];

	if (pages.length > 0) {
		lines.push("## Pages", "");
		for (const page of pages) {
			const url = `${origin}/${page.slug}/`;
			const desc = page.metaDescription || page.excerpt || page.summary || "";
			lines.push(`- [${page.title}](${url})${desc ? `: ${desc}` : ""}`);
		}
		lines.push("");
	}

	return new Response(lines.join("\n"), {
		headers: {
			"Content-Type": "text/plain; charset=utf-8",
			"Cache-Control": "public, max-age=3600",
		},
	});
};
