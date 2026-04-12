import type { APIRoute } from "astro";
import { withApiRequest, jsonOk, jsonOkPaginated, apiErrors } from "astropress/api-middleware.js";
import { loadLocalAdminStore } from "astropress/local-runtime-modules.js";
import { listRuntimeContentStates, searchRuntimeContentStates, createRuntimeContentRecord } from "astropress";
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
    const q = url.searchParams.get("q") ?? undefined;
    const limit = Math.min(Number(url.searchParams.get("limit") ?? url.searchParams.get("per_page") ?? "20"), 100);
    const page = Math.max(Number(url.searchParams.get("page") ?? "1"), 1);
    const cursor = url.searchParams.get("cursor") ?? undefined;
    const offset = Number(url.searchParams.get("offset") ?? String((page - 1) * limit));

    const all = q
      ? await searchRuntimeContentStates(q, context.locals)
      : await listRuntimeContentStates(context.locals);
    const filtered = all.filter((r) => {
      if (kind && r.kind !== kind) return false;
      if (status && r.status !== status) return false;
      return true;
    });

    // Cursor-based pagination: cursor is a base64-encoded offset index
    let effectiveOffset = offset;
    if (cursor) {
      try {
        const decoded = Number(Buffer.from(cursor, "base64url").toString("utf8"));
        if (!Number.isNaN(decoded)) effectiveOffset = decoded;
      } catch { /* ignore invalid cursor — fall back to offset */ }
    }

    const pageRecords = filtered.slice(effectiveOffset, effectiveOffset + limit);
    const nextOffset = effectiveOffset + limit;
    const prevOffset = Math.max(effectiveOffset - limit, 0);
    const hasNext = nextOffset < filtered.length;
    const hasPrev = effectiveOffset > 0;

    const nextCursor = hasNext ? Buffer.from(String(nextOffset)).toString("base64url") : null;
    const prevCursor = hasPrev ? Buffer.from(String(prevOffset)).toString("base64url") : null;

    const baseUrl = `${url.origin}${url.pathname}`;
    const selfParams = new URLSearchParams(url.searchParams);
    selfParams.delete("cursor");
    selfParams.delete("offset");

    const nextParams = new URLSearchParams(selfParams);
    if (nextCursor) nextParams.set("cursor", nextCursor);

    const prevParams = new URLSearchParams(selfParams);
    if (prevCursor) prevParams.set("cursor", prevCursor);

    const _links = {
      self: `${baseUrl}?${selfParams.toString()}`,
      ...(hasNext ? { next: `${baseUrl}?${nextParams.toString()}` } : {}),
      ...(hasPrev ? { prev: `${baseUrl}?${prevParams.toString()}` } : {}),
    };

    return jsonOkPaginated(
      { records: pageRecords, total: filtered.length, limit, offset: effectiveOffset, page, nextCursor, _links },
      filtered.length,
    );
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
