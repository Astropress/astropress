import type { APIRoute } from "astro";
import { withApiRequest, jsonOk, jsonOkWithEtag, apiErrors } from "astropress/api-middleware.js";
import { loadLocalAdminStore } from "astropress/local-runtime-modules.js";
import { getRuntimeContentState, saveRuntimeContentState } from "astropress";
import { getCmsConfig } from "astropress";

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
    const id = context.params.id ?? "";
    const record = await getRuntimeContentState(id, context.locals);
    if (!record) return apiErrors.notFound(`Content '${id}' not found.`);
    return jsonOkWithEtag(record as Parameters<typeof jsonOkWithEtag>[0], context.request);
  });
};

export const PUT: APIRoute = async (context) => {
  if (!getCmsConfig().api?.enabled) return apiErrors.notFound("REST API is not enabled.");

  const store = await loadLocalAdminStore();
  if (!store.apiTokens) return apiErrors.notFound("API token store unavailable.");

  return withApiRequest(context.request, buildApiCtx(store, getCmsConfig()), ["content:write"], async (tokenId) => {
    const id = context.params.id ?? "";
    const existing = await getRuntimeContentState(id, context.locals);
    if (!existing) return apiErrors.notFound(`Content '${id}' not found.`);

    let body: Record<string, unknown>;
    try {
      body = await context.request.json() as Record<string, unknown>;
    } catch {
      return apiErrors.validationError("Request body must be valid JSON.");
    }

    const actor = { email: `api-token:${tokenId}`, role: "editor" as const, name: "API Token" };
    const result = await saveRuntimeContentState(
      id,
      {
        title: String(body.title ?? existing.title ?? ""),
        status: String(body.status ?? existing.status ?? "draft"),
        body: String(body.body ?? existing.body ?? ""),
        seoTitle: String(body.seoTitle ?? existing.seoTitle ?? ""),
        metaDescription: String(body.metaDescription ?? existing.metaDescription ?? ""),
        excerpt: String(body.excerpt ?? existing.excerpt ?? ""),
        ogTitle: String(body.ogTitle ?? ""),
        ogDescription: String(body.ogDescription ?? ""),
        ogImage: String(body.ogImage ?? ""),
        canonicalUrlOverride: String(body.canonicalUrlOverride ?? ""),
        robotsDirective: String(body.robotsDirective ?? ""),
        revisionNote: "API update",
      },
      actor,
      context.locals,
    );

    if (!result.ok) return apiErrors.validationError(result.error);

    if (store.webhooks) {
      const event = result.state?.status === "published" ? "content.updated" : null;
      if (event) await store.webhooks.dispatch(event, { id });
    }

    return jsonOk(result.state);
  });
};

export const DELETE: APIRoute = async (context) => {
  if (!getCmsConfig().api?.enabled) return apiErrors.notFound("REST API is not enabled.");

  const store = await loadLocalAdminStore();
  if (!store.apiTokens) return apiErrors.notFound("API token store unavailable.");

  return withApiRequest(context.request, buildApiCtx(store, getCmsConfig()), ["content:write"], async () => {
    const id = context.params.id ?? "";
    const existing = await getRuntimeContentState(id, context.locals);
    if (!existing) return apiErrors.notFound(`Content '${id}' not found.`);

    // Mark as archived (soft-delete approach consistent with admin UI)
    const actor = { email: "api", role: "editor" as const, name: "API" };
    await saveRuntimeContentState(id, { title: existing.title ?? id, status: "archived", seoTitle: "", metaDescription: "", excerpt: "", ogTitle: "", ogDescription: "", ogImage: "", canonicalUrlOverride: "", robotsDirective: "", revisionNote: "Deleted via API", body: existing.body ?? "" }, actor, context.locals);

    if (store.webhooks) {
      await store.webhooks.dispatch("content.deleted", { id });
    }

    return new Response(null, { status: 204 });
  });
};
