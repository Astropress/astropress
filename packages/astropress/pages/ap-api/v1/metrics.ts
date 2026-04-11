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

import type { APIRoute } from "astro";
import { withApiRequest, jsonOk, apiErrors } from "astropress/api-middleware.js";
import { loadLocalAdminStore } from "astropress/local-runtime-modules.js";
import { getCmsConfig } from "astropress";
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
      apiTokens: store.apiTokens!,
      checkRateLimit: store.checkRateLimit,
      rateLimit: getCmsConfig().api?.rateLimit,
    },
    ["content:read"],
    async () => {
      // Use existing repository abstractions to get counts across all adapters
      const [allContent, allMedia] = await Promise.all([
        listRuntimeContentStates(context.locals).catch(() => []),
        store.media?.list?.().catch(() => []) ?? Promise.resolve([]),
      ]);

      const posts = allContent.filter((r) => r.kind === "post").length;
      const pages = allContent.filter((r) => r.kind === "page").length;
      const comments = allContent.filter((r) => r.kind === "comment").length;
      const media = (allMedia as unknown[]).length;

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
