import type { APIRoute } from "astro";
import { withApiRequest, jsonOk, apiErrors } from "@astropress-diy/astropress/api-middleware.js";
import { loadLocalAdminStore } from "@astropress-diy/astropress/local-runtime-modules.js";
import { getRuntimeContentRevisions } from "@astropress-diy/astropress";
import { getCmsConfig } from "@astropress-diy/astropress";

function buildApiCtx(store: Awaited<ReturnType<typeof loadLocalAdminStore>>, config: ReturnType<typeof getCmsConfig>) {
  return {
    apiTokens: store.apiTokens!,
    checkRateLimit: store.checkRateLimit,
    rateLimit: config.api?.rateLimit,
  };
}

export const GET: APIRoute = async (context) => {
  if (!getCmsConfig().api?.enabled) return apiErrors.notFound("REST API is not enabled.");

  const store = await loadLocalAdminStore();
  if (!store.apiTokens) return apiErrors.notFound("API token store unavailable.");

  return withApiRequest(context.request, buildApiCtx(store, getCmsConfig()), ["content:read"], async () => {
    const recordId = context.params.recordId ?? "";
    const revisions = await getRuntimeContentRevisions(recordId, context.locals);
    return jsonOk({ records: revisions, total: revisions.length });
  });
};
