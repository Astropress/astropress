/**
 * GET /ap-api/v1/search?q=<query>[&kind=post|page][&limit=20]
 *
 * Full-text search across published content records using the FTS5 index.
 * Requires Bearer token authentication with the `content:read` scope.
 *
 * Response:
 * ```json
 * {
 *   "query": "hello world",
 *   "total": 3,
 *   "results": [{ "id": "...", "kind": "post", "slug": "...", "title": "...", ... }]
 * }
 * ```
 *
 * The `?q=` parameter on `GET /ap-api/v1/content` performs the same search but
 * returns paginated results in the standard content list shape. Use this endpoint
 * when you want a dedicated search response with a `total` count and `query` echo.
 */

import { getCmsConfig, searchRuntimeContentStates } from "@astropress-diy/astropress";
import { resolveApiRuntime } from "@astropress-diy/astropress/admin-store-dispatch.js";
import { apiErrors, jsonOk, withApiRequest } from "@astropress-diy/astropress/api-middleware.js";
import type { APIRoute } from "astro";

export const GET: APIRoute = async (context) => {
	if (!getCmsConfig().api?.enabled) {
		return apiErrors.notFound("REST API is not enabled.");
	}

	const runtime = await resolveApiRuntime(context.locals);
	if (!runtime.apiTokens) {
		return apiErrors.notFound("API token store unavailable.");
	}

	return withApiRequest(
		context.request,
		{
			apiTokens: runtime.apiTokens,
			checkRateLimit: runtime.checkRateLimit,
			rateLimit: getCmsConfig().api?.rateLimit,
		},
		["content:read"],
		async () => {
			const url = new URL(context.request.url);
			const q = url.searchParams.get("q")?.trim() ?? "";
			const kind = url.searchParams.get("kind") ?? undefined;
			const limit = Math.min(Number(url.searchParams.get("limit") ?? "20"), 100);

			if (!q) {
				return apiErrors.badRequest("Missing required query parameter: q");
			}

			const all = await searchRuntimeContentStates(q, context.locals);
			const filtered = kind ? all.filter((r) => r.kind === kind) : all;
			const results = filtered.slice(0, limit);

			return jsonOk({
				query: q,
				total: filtered.length,
				results,
			});
		},
	);
};
