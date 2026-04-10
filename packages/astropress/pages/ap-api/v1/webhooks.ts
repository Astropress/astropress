import type { APIRoute } from "astro";
import { withApiRequest, jsonOk, apiErrors } from "astropress/api-middleware.js";
import { loadLocalAdminStore } from "astropress/local-runtime-modules.js";
import { getCmsConfig } from "astropress";
import type { WebhookEvent } from "astropress/platform-contracts.js";

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
    const webhooks = await store.webhooks!.list();
    return jsonOk({ records: webhooks, total: webhooks.length });
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

    const { record, signingSecret } = await store.webhooks!.create({ url, events });
    return jsonOk({ record, signingSecret }, 201);
  });
};
