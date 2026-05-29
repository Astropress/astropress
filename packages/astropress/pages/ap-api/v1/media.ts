import {
	createRuntimeMediaAsset,
	getCmsConfig,
	getRuntimeMediaAssets,
} from "@astropress-diy/astropress";
import { resolveApiRuntime } from "@astropress-diy/astropress/admin-store-dispatch.js";
import {
	apiErrors,
	type JsonValue,
	jsonOk,
	jsonOkPaginated,
	withApiRequest,
} from "@astropress-diy/astropress/api-middleware.js";
import type { APIRoute } from "astro";

export const GET: APIRoute = async (context) => {
	if (!getCmsConfig().api?.enabled) return apiErrors.notFound("REST API is not enabled.");

	const runtime = await resolveApiRuntime(context.locals);
	if (!runtime.apiTokens) return apiErrors.notFound("API token store unavailable.");

	return withApiRequest(
		context.request,
		{
			apiTokens: runtime.apiTokens,
			checkRateLimit: runtime.checkRateLimit,
			rateLimit: getCmsConfig().api?.rateLimit,
		},
		["media:read"],
		async () => {
			const url = new URL(context.request.url);
			const limit = Math.min(
				Number(url.searchParams.get("limit") ?? url.searchParams.get("per_page") ?? "20"),
				100,
			);
			const page = Math.max(Number(url.searchParams.get("page") ?? "1"), 1);
			const offset = Number(url.searchParams.get("offset") ?? String((page - 1) * limit));

			const all = await getRuntimeMediaAssets(context.locals);
			const pageRecords = all.slice(offset, offset + limit);
			return jsonOkPaginated(
				{ records: pageRecords, total: all.length, limit, offset, page } as unknown as JsonValue,
				all.length,
			);
		},
	);
};

export const POST: APIRoute = async (context) => {
	if (!getCmsConfig().api?.enabled) return apiErrors.notFound("REST API is not enabled.");

	const runtime = await resolveApiRuntime(context.locals);
	if (!runtime.apiTokens) return apiErrors.notFound("API token store unavailable.");

	return withApiRequest(
		context.request,
		{
			apiTokens: runtime.apiTokens,
			checkRateLimit: runtime.checkRateLimit,
			rateLimit: getCmsConfig().api?.rateLimit,
		},
		["media:write"],
		async (tokenId) => {
			// Multipart upload — extract file from form data
			let formData: FormData;
			try {
				formData = await context.request.formData();
			} catch {
				return apiErrors.validationError(
					"Request must be multipart/form-data with a 'file' field.",
				);
			}

			const file = formData.get("file");
			if (!(file instanceof File)) {
				return apiErrors.validationError("A 'file' field is required in the multipart body.");
			}

			// Enforce allowed MIME types (415 Unsupported Media Type)
			const ALLOWED_MIME_TYPES = [
				"image/jpeg",
				"image/png",
				"image/gif",
				"image/webp",
				"image/svg+xml",
				"image/avif",
				"image/tiff",
				"image/bmp",
				"video/mp4",
				"video/webm",
				"video/ogg",
				"audio/mpeg",
				"audio/ogg",
				"audio/wav",
				"audio/webm",
				"application/pdf",
				"application/zip",
				"application/gzip",
				"text/plain",
				"text/csv",
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
			const actor = {
				email: `api-token:${tokenId}`,
				role: "editor" as const,
				name: "API Token",
			};
			const result = (await createRuntimeMediaAsset(
				{ filename: file.name, mimeType, bytes },
				actor,
				context.locals,
			)) as { ok: true; id: string } | { ok: false; error: string };
			if (!result.ok) return apiErrors.validationError(result.error);

			return jsonOk(result as unknown as Parameters<typeof jsonOk>[0], 201);
		},
	);
};
