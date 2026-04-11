import type { APIRoute } from "astro";
import { withApiRequest, jsonOk, jsonOkPaginated, apiErrors } from "astropress/api-middleware.js";
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
    const url = new URL(context.request.url);
    const limit = Math.min(Number(url.searchParams.get("limit") ?? url.searchParams.get("per_page") ?? "20"), 100);
    const page = Math.max(Number(url.searchParams.get("page") ?? "1"), 1);
    const offset = Number(url.searchParams.get("offset") ?? String((page - 1) * limit));

    const all = store.listMediaAssets();
    const pageRecords = all.slice(offset, offset + limit);
    return jsonOkPaginated({ records: pageRecords, total: all.length, limit, offset, page }, all.length);
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

    // Enforce allowed MIME types (415 Unsupported Media Type)
    const ALLOWED_MIME_TYPES = [
      "image/jpeg", "image/png", "image/gif", "image/webp", "image/svg+xml",
      "image/avif", "image/tiff", "image/bmp",
      "video/mp4", "video/webm", "video/ogg",
      "audio/mpeg", "audio/ogg", "audio/wav", "audio/webm",
      "application/pdf",
      "application/zip", "application/gzip",
      "text/plain", "text/csv",
    ];
    const mimeType = file.type || "application/octet-stream";
    if (!ALLOWED_MIME_TYPES.includes(mimeType)) {
      return apiErrors.unsupportedMediaType(mimeType, ALLOWED_MIME_TYPES);
    }

    // Enforce maximum upload size (413 Request Entity Too Large)
    const maxUploadBytes = getCmsConfig().maxUploadBytes ?? 10 * 1024 * 1024;
    if (file.size > maxUploadBytes) {
      return apiErrors.fileTooLarge(maxUploadBytes, file.size);
    }

    const bytes = new Uint8Array(await file.arrayBuffer());
    const id = crypto.randomUUID();
    const asset = await store.createMediaAsset({
      id,
      filename: file.name,
      mimeType,
      bytes,
    });

    return jsonOk(asset, 201);
  });
};
