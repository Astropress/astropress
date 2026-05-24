import type { APIRoute } from "astro";
import { peekCmsConfig } from "../../src/config.js";
import { getRuntimeMediaAssets, listRuntimeContentStates } from "../../src/runtime-page-store.js";

const startTime = Date.now();

export const GET: APIRoute = async (context) => {
	if (!peekCmsConfig()?.monitoring?.prometheusEnabled) {
		return new Response("Not found", { status: 404 });
	}

	// Read content AND media through the same host-agnostic runtime seam
	// (`getReadStore` dispatches D1 vs local), so a host without the local
	// runtime alias reports its real media count instead of a misleading 0.
	const [allContent, mediaAssets] = await Promise.all([
		listRuntimeContentStates(context.locals).catch(
			() => [] as Awaited<ReturnType<typeof listRuntimeContentStates>>,
		),
		getRuntimeMediaAssets(context.locals).catch(
			() => [] as Awaited<ReturnType<typeof getRuntimeMediaAssets>>,
		),
	]);

	const posts = allContent.filter((r) => r.kind === "post").length;
	const pages = allContent.filter((r) => r.kind === "page").length;
	const media = mediaAssets.length;
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
