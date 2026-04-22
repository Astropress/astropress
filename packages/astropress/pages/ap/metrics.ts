import type { APIRoute } from "astro";
import { safeLoadLocalAdminStore } from "../../src/admin-store-dispatch.js";
import { peekCmsConfig } from "../../src/config.js";
import { listRuntimeContentStates } from "../../src/runtime-page-store.js";

const startTime = Date.now();

export const GET: APIRoute = async (context) => {
	if (!peekCmsConfig()?.monitoring?.prometheusEnabled) {
		return new Response("Not found", { status: 404 });
	}

	const [allContent, store] = await Promise.all([
		listRuntimeContentStates(context.locals).catch(
			() => [] as Awaited<ReturnType<typeof listRuntimeContentStates>>,
		),
		safeLoadLocalAdminStore(),
	]);

	const posts = allContent.filter((r) => r.kind === "post").length;
	const pages = allContent.filter((r) => r.kind === "page").length;
	const media = store ? store.listMediaAssets().length : 0;
	const uptimeSeconds = Math.round((Date.now() - startTime) / 1000);

	const body = [
		"# HELP ap_content_total Content records by kind",
		"# TYPE ap_content_total gauge",
		`ap_content_total{kind="post"} ${posts}`,
		`ap_content_total{kind="page"} ${pages}`,
		"# HELP ap_media_total Total media assets",
		"# TYPE ap_media_total gauge",
		`ap_media_total ${media}`,
		"# HELP ap_uptime_seconds Process uptime in seconds",
		"# TYPE ap_uptime_seconds gauge",
		`ap_uptime_seconds ${uptimeSeconds}`,
		"",
	].join("\n");

	return new Response(body, {
		headers: {
			"Content-Type": "text/plain; version=0.0.4",
			"Cache-Control": "no-store",
		},
	});
};
