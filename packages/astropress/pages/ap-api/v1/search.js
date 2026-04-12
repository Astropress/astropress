/**
 * GET /ap-api/v1/search?q=<query>[&kind=post|page][&limit=20]
 *
 * Full-text search across published content records using the FTS5 index.
 * Requires Bearer token authentication with the `content:read` scope.
 */

import { withApiRequest, jsonOk, apiErrors } from "astropress/api-middleware.js";
import { loadLocalAdminStore } from "astropress/local-runtime-modules.js";
import { searchRuntimeContentStates } from "astropress";
import { getCmsConfig } from "astropress";

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
