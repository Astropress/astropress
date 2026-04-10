import type { APIRoute } from "astro";
import { withApiRequest, jsonOk, apiErrors } from "astropress/api-middleware.js";
import { loadLocalAdminStore } from "astropress/local-runtime-modules.js";
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

  return withApiRequest(context.request, buildApiCtx(store, getCmsConfig()), ["media:read"], async () => {
    const assets = store.listMediaAssets();
    return jsonOk({ records: assets, total: assets.length });
  });
};

export const POST: APIRoute = async (context) => {
  if (!getCmsConfig().api?.enabled) return apiErrors.notFound("REST API is not enabled.");

  const store = await loadLocalAdminStore();
  if (!store.apiTokens) return apiErrors.notFound("API token store unavailable.");

  return withApiRequest(context.request, buildApiCtx(store, getCmsConfig()), ["media:write"], async () => {
    // Multipart upload — extract file from form data
    let formData: FormData;
    try {
      formData = await context.request.formData();
    } catch {
      return apiErrors.validationError("Request must be multipart/form-data with a 'file' field.");
    }

    const file = formData.get("file");
    if (!(file instanceof File)) {
      return apiErrors.validationError("A 'file' field is required in the multipart body.");
    }

    const bytes = new Uint8Array(await file.arrayBuffer());
    const id = crypto.randomUUID();
    const asset = await store.createMediaAsset({
      id,
      filename: file.name,
      mimeType: file.type || "application/octet-stream",
      bytes,
    });

    return jsonOk(asset, 201);
  });
};
