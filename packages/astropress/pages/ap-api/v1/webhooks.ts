import type { APIRoute } from "astro";
import { withApiRequest, jsonOk, jsonOkPaginated, apiErrors } from "@astropress-diy/astropress/api-middleware.js";
import { loadLocalAdminStore } from "@astropress-diy/astropress/local-runtime-modules.js";
import { getCmsConfig } from "@astropress-diy/astropress";
import type { WebhookEvent } from "@astropress-diy/astropress/platform-contracts.js";

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
  if (!store.apiTokens || !store.webhooks) return apiErrors.notFound("Webhook store unavailable.");

  return withApiRequest(context.request, buildApiCtx(store, getCmsConfig()), ["webhooks:manage"], async () => {
    const url = new URL(context.request.url);
    const limit = Math.min(Number(url.searchParams.get("limit") ?? url.searchParams.get("per_page") ?? "20"), 100);
    const page = Math.max(Number(url.searchParams.get("page") ?? "1"), 1);
    const offset = Number(url.searchParams.get("offset") ?? String((page - 1) * limit));

    const all = await store.webhooks!.list();
    const pageRecords = all.slice(offset, offset + limit);
    return jsonOkPaginated({ records: pageRecords, total: all.length, limit, offset, page }, all.length);
  });
};

export const POST: APIRoute = async (context) => {
  if (!getCmsConfig().api?.enabled) return apiErrors.notFound("REST API is not enabled.");

  const store = await loadLocalAdminStore();
  if (!store.apiTokens || !store.webhooks) return apiErrors.notFound("Webhook store unavailable.");

  return withApiRequest(context.request, buildApiCtx(store, getCmsConfig()), ["webhooks:manage"], async () => {
    let body: Record<string, unknown>;
    try {
      body = await context.request.json() as Record<string, unknown>;
    } catch {
      return apiErrors.validationError("Request body must be valid JSON.");
    }

    const url = String(body.url ?? "").trim();
    if (!url) return apiErrors.validationError("url is required.");

    const events = Array.isArray(body.events) ? (body.events as WebhookEvent[]) : [];
    if (events.length === 0) return apiErrors.validationError("At least one event is required.");

    const { record, verification } = await store.webhooks!.create({ url, events });
    return jsonOk({ record, verification }, 201);
  });
};
