import type { APIRoute } from "astro";
import { withApiRequest, jsonOk, apiErrors } from "astropress/api-middleware.js";
import { loadLocalAdminStore } from "astropress/local-runtime-modules.js";
import { listRuntimeContentStates, createRuntimeContentRecord } from "astropress";
import { getCmsConfig } from "astropress";

function buildApiCtx(store: Awaited<ReturnType<typeof loadLocalAdminStore>>, config: ReturnType<typeof getCmsConfig>) {
  return {
    apiTokens: store.apiTokens!,
    checkRateLimit: store.checkRateLimit,
    rateLimit: config.api?.rateLimit,
  };
}

export const GET: APIRoute = async (context) => {
  if (!getCmsConfig().api?.enabled) {
    return apiErrors.notFound("REST API is not enabled.");
  }

  const store = await loadLocalAdminStore();
  if (!store.apiTokens) {
    return apiErrors.notFound("API token store unavailable.");
  }

  return withApiRequest(context.request, buildApiCtx(store, getCmsConfig()), ["content:read"], async () => {
    const url = new URL(context.request.url);
    const kind = url.searchParams.get("kind") ?? undefined;
    const status = url.searchParams.get("status") ?? undefined;
    const limit = Math.min(Number(url.searchParams.get("limit") ?? "20"), 100);
    const offset = Number(url.searchParams.get("offset") ?? "0");

    const all = await listRuntimeContentStates(context.locals);
    const filtered = all.filter((r) => {
      if (kind && r.kind !== kind) return false;
      if (status && r.status !== status) return false;
      return true;
    });

    const page = filtered.slice(offset, offset + limit);
    return jsonOk({ records: page, total: filtered.length, limit, offset });
  });
};

export const POST: APIRoute = async (context) => {
  if (!getCmsConfig().api?.enabled) {
    return apiErrors.notFound("REST API is not enabled.");
  }

  const store = await loadLocalAdminStore();
  if (!store.apiTokens) {
    return apiErrors.notFound("API token store unavailable.");
  }

  return withApiRequest(context.request, buildApiCtx(store, getCmsConfig()), ["content:write"], async (tokenId) => {
    let body: Record<string, unknown>;
    try {
      body = await context.request.json() as Record<string, unknown>;
    } catch {
      return apiErrors.validationError("Request body must be valid JSON.");
    }

    const slug = String(body.slug ?? "").trim();
    const title = String(body.title ?? "").trim();
    const kind = String(body.kind ?? "post");

    if (!slug) return apiErrors.validationError("slug is required.");
    if (!title) return apiErrors.validationError("title is required.");

    const actor = { email: `api-token:${tokenId}`, role: "editor" as const, name: "API Token" };
    const result = await createRuntimeContentRecord({ kind, slug, title, body: String(body.body ?? "") }, actor, context.locals);
    if (!result.ok) {
      return apiErrors.validationError(result.error);
    }

    if (store.webhooks && result.state?.status === "published") {
      await store.webhooks.dispatch("content.published", { slug, title });
    }

    return jsonOk(result.state, 201);
  });
};
