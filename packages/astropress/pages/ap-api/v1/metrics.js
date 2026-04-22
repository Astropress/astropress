/**
 * GET /ap-api/v1/metrics
 *
 * Returns basic content, media, and comment counts for monitoring dashboards.
 * Requires Bearer token authentication with the `content:read` scope.
 */

import { getCmsConfig } from "@astropress-diy/astropress";
import {
	apiErrors,
	jsonOk,
	withApiRequest,
} from "@astropress-diy/astropress/api-middleware.js";
import { loadLocalAdminStore } from "@astropress-diy/astropress/local-runtime-modules.js";
import { listRuntimeContentStates } from "../../src/runtime-page-store.js";

const startTime = Date.now();

export const GET = async (context) => {
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
			const [allContent, allMedia] = await Promise.all([
				listRuntimeContentStates(context.locals).catch(() => []),
				store.media?.list?.().catch(() => []) ?? Promise.resolve([]),
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
