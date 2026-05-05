// stryker-disable-file: data-only — pure error-response shape table.
// Each entry is a thin Response builder: HTTP status + machine-readable
// `code` + the supplied detail. Mutating the literals here would only
// change the wire shape; behavioral coverage lives in the consumer
// (api-middleware.ts authorize/rate-limit paths) which already exercises
// representative shapes through integration tests.

import type { JsonValue } from "./json-types";

function jsonError(status: number, body: Record<string, JsonValue>) {
	return new Response(JSON.stringify(body), {
		status,
		headers: { "Content-Type": "application/json" },
	});
}

export const API_ERROR_SHAPES = {
	unauthorized: (detail: string) =>
		jsonError(401, { error: detail, code: "unauthorized" }),
	forbidden: (detail: string) =>
		jsonError(403, { error: detail, code: "forbidden" }),
	rateLimited: () =>
		jsonError(429, { error: "Too many requests.", code: "rate_limited" }),
	notFound: (detail = "Not found.") =>
		jsonError(404, { error: detail, code: "not_found" }),
	validationError: (detail: string) =>
		jsonError(422, { error: detail, code: "validation_error" }),
	fileTooLarge: (maxBytes: number, uploadedBytes: number) =>
		jsonError(413, {
			error: "FILE_TOO_LARGE",
			code: "file_too_large",
			maxBytes,
			uploadedBytes,
		}),
	unsupportedMediaType: (mimeType: string, allowed: string[]) =>
		jsonError(415, {
			error: "UNSUPPORTED_MEDIA_TYPE",
			code: "unsupported_media_type",
			mimeType,
			allowed: allowed as unknown as JsonValue,
		}),
};
