import { listRuntimeContentStates } from "@astropress-diy/astropress";

/**
 * GET /sitemap.xml
 *
 * Generates a sitemap for published posts and pages.
 * Works in both SSR (called at request time) and static (called at build time) modes.
 */
export const GET = async ({ request, locals }) => {
  const origin = new URL(request.url).origin;

  const all = await listRuntimeContentStates(locals);
  const published = all.filter((r) => r.status === "published");

  const posts = published.filter((r) => r.kind === "post" || r.kind == null);
  const pages = published.filter((r) => r.kind === "page");

  const entries = [{ loc: `${origin}/`, changefreq: "weekly", priority: "1.0" }];

  for (const post of posts) {
    entries.push({
      loc: `${origin}/blog/${post.slug}/`,
      lastmod: post.updatedAt ? post.updatedAt.slice(0, 10) : undefined,
      changefreq: "monthly",
      priority: "0.7",
    });
  }

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
      const parts = [`  <url>`, `    <loc>${escapeXml(e.loc)}</loc>`];
      if (e.lastmod) parts.push(`    <lastmod>${e.lastmod}</lastmod>`);
      parts.push(`    <changefreq>${e.changefreq}</changefreq>`);
      parts.push(`    <priority>${e.priority}</priority>`);
      parts.push(`  </url>`);
      return parts.join("\n");
    })
    .join("\n");

  const xml = [
    `<?xml version="1.0" encoding="UTF-8"?>`,
    `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">`,
    urlElements,
    `</urlset>`,
  ].join("\n");

  return new Response(xml, {
    headers: {
      "Content-Type": "application/xml; charset=utf-8",
      "Cache-Control": "public, max-age=3600",
    },
  });
};

function escapeXml(str) {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}
