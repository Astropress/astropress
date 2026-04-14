import { listRuntimeContentStates } from "@astropress-diy/astropress";

/**
 * GET /llms.txt
 *
 * Generates an llms.txt file for AI crawlers listing published content.
 * This makes content discoverable by AI agents and answer engines.
 * See: https://llmstxt.org
 */
export const GET = async ({ request, locals }) => {
  const origin = new URL(request.url).origin;

  const all = await listRuntimeContentStates(locals);
  const published = all.filter((r) => r.status === "published");

  const posts = published.filter((r) => r.kind === "post" || r.kind == null);
  const pages = published.filter((r) => r.kind === "page");

  const lines = [
    `# ${origin}`,
    "",
    "> Content site powered by Astropress.",
    "",
  ];

  if (posts.length > 0) {
    lines.push("## Posts", "");
    for (const post of posts) {
      const url = `${origin}/blog/${post.slug}/`;
      const desc = post.metaDescription || post.excerpt || post.summary || "";
      lines.push(`- [${post.title}](${url})${desc ? `: ${desc}` : ""}`);
    }
    lines.push("");
  }

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
