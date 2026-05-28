/**
 * GET /ap-api/v1/metrics
 *
 * Returns basic content, media, and comment counts for monitoring dashboards.
 * Requires Bearer token authentication with the `content:read` scope.
 *
 * Response:
 * ```json
 * {
 *   "posts": 42,
 *   "pages": 5,
 *   "media": 128,
 *   "comments": 17,
 *   "uptime": 3600.5
 * }
 * ```
 */

import { getCmsConfig, getRuntimeMediaAssets } from "@astropress-diy/astropress";
import { apiErrors, jsonOk, withApiRequest } from "@astropress-diy/astropress/api-middleware.js";
import { loadLocalAdminStore } from "@astropress-diy/astropress/local-runtime-modules.js";
import type { APIRoute } from "astro";
import { listRuntimeContentStates } from "../../src/runtime-page-store.js";

const startTime = Date.now();

export const GET: APIRoute = async (context) => {
	if (!getCmsConfig().api?.enabled) {
		return apiErrors.notFound("REST API is not enabled.");
	}

	const store = await loadLocalAdminStore();
	if (!store.apiTokens) {
		return apiErrors.notFound("API token store unavailable.");
	}

	return withApiRequest(
		context.request,
		{
			apiTokens: store.apiTokens,
			checkRateLimit: store.checkRateLimit,
			rateLimit: getCmsConfig().api?.rateLimit,
		},
		["content:read"],
		async () => {
			// Use existing repository abstractions to get counts across all adapters.
			// Media uses the canonical runtime listing (getReadStore().media.listMediaAssets),
			// the same surface the admin media page uses — not an undocumented store.media.list()
			// shape that no adapter implements (which silently reported 0). See issue #120.
			const [allContent, allMedia] = await Promise.all([
				listRuntimeContentStates(context.locals).catch(() => []),
				getRuntimeMediaAssets(context.locals).catch(() => []),
			]);

			const posts = allContent.filter((r) => r.kind === "post").length;
			const pages = allContent.filter((r) => r.kind === "page").length;
			const comments = allContent.filter((r) => r.kind === "comment").length;
			const media = allMedia.length;

			const uptimeSeconds = (Date.now() - startTime) / 1000;

			return jsonOk({
				posts,
				pages,
				media,
				comments,
				uptime: Math.round(uptimeSeconds * 10) / 10,
			});
		},
	);
};
