/**
 * GET /robots.txt
 *
 * Generates a robots.txt with a pointer to the sitemap.
 * Works in both SSR (request-time) and static (build-time) modes.
 */
export const GET = async ({ request }) => {
	const origin = new URL(request.url).origin;

	const content = [
		"User-agent: *",
		"Allow: /",
		"",
		`Sitemap: ${origin}/sitemap.xml`,
	].join("\n");

	return new Response(content, {
		headers: {
			"Content-Type": "text/plain; charset=utf-8",
			"Cache-Control": "public, max-age=86400",
		},
	});
};
