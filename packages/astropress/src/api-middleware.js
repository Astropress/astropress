import { peekCmsConfig } from "./config.js";

const API_ERROR_SHAPES = {
  unauthorized: (detail) =>
    jsonError(401, { error: detail, code: "unauthorized" }),
  forbidden: (detail) =>
    jsonError(403, { error: detail, code: "forbidden" }),
  rateLimited: () =>
    jsonError(429, { error: "Too many requests.", code: "rate_limited" }),
  notFound: (detail = "Not found.") =>
    jsonError(404, { error: detail, code: "not_found" }),
  validationError: (detail) =>
    jsonError(422, { error: detail, code: "validation_error" }),
  fileTooLarge: (maxBytes, uploadedBytes) =>
    jsonError(413, {
      error: "FILE_TOO_LARGE",
      code: "file_too_large",
      maxBytes,
      uploadedBytes,
    }),
  unsupportedMediaType: (mimeType, allowed) =>
    jsonError(415, {
      error: "UNSUPPORTED_MEDIA_TYPE",
      code: "unsupported_media_type",
      mimeType,
      allowed,
    }),
};

function jsonError(status, body) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

export function jsonOk(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function weakEtag(serialized) {
  let h = 5381;
  for (let i = 0; i < serialized.length; i++) {
    h = ((h << 5) + h) ^ serialized.charCodeAt(i);
    h = h >>> 0;
  }
  return `W/"${h.toString(16)}"`;
}

export function jsonOkWithEtag(body, request, status = 200) {
  const serialized = JSON.stringify(body);
  const etag = weakEtag(serialized);
  const ifNoneMatch = request.headers.get("If-None-Match");
  if (ifNoneMatch === etag) {
    return new Response(null, { status: 304, headers: { ETag: etag } });
  }
  return new Response(serialized, {
    status,
    headers: { "Content-Type": "application/json", ETag: etag },
  });
}

export function jsonOkPaginated(body, total, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json",
      "X-Total-Count": String(total),
      "Access-Control-Expose-Headers": "X-Total-Count",
    },
  });
}

function resolveCorsOrigin(request) {
  const corsConfig = peekCmsConfig()?.api?.cors;
  if (!corsConfig) return null;
  const { origin } = corsConfig;
  if (origin === "*") return "*";
  const requestOrigin = request.headers.get("Origin") ?? "";
  if (!requestOrigin) return null;
  if (Array.isArray(origin)) {
    return origin.includes(requestOrigin) ? requestOrigin : null;
  }
  return origin === requestOrigin ? requestOrigin : null;
}

function applyCorsHeaders(response, request) {
  const allowedOrigin = resolveCorsOrigin(request);
  if (!allowedOrigin) return response;
  const headers = new Headers(response.headers);
  headers.set("Access-Control-Allow-Origin", allowedOrigin);
  headers.set("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
  headers.set("Access-Control-Allow-Headers", "Authorization, Content-Type");
  if (allowedOrigin !== "*") {
    headers.set("Vary", "Origin");
  }
  return new Response(response.body, { status: response.status, statusText: response.statusText, headers });
}

export function handleCorsPreflightRequest(request) {
  if (request.method !== "OPTIONS") return null;
  const allowedOrigin = resolveCorsOrigin(request);
  if (!allowedOrigin) return null;
  return new Response(null, {
    status: 204,
    headers: {
      "Access-Control-Allow-Origin": allowedOrigin,
      "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
      "Access-Control-Allow-Headers": "Authorization, Content-Type",
      "Access-Control-Max-Age": "86400",
      ...(allowedOrigin !== "*" ? { Vary: "Origin" } : {}),
    },
  });
}

export async function withApiRequest(request, ctx, requiredScopes, handler) {
  const preflight = handleCorsPreflightRequest(request);
  if (preflight) return preflight;

  const authHeader = request.headers.get("Authorization") ?? "";
  if (!authHeader.startsWith("Bearer ")) {
    return applyCorsHeaders(
      API_ERROR_SHAPES.unauthorized("Missing or invalid Authorization header. Use: Authorization: Bearer <token>"),
      request,
    );
  }

  const rawToken = authHeader.slice(7).trim();
  if (!rawToken) {
    return applyCorsHeaders(API_ERROR_SHAPES.unauthorized("Bearer token is empty."), request);
  }

  const result = await ctx.apiTokens.verify(rawToken);
  if (!result.valid) {
    return applyCorsHeaders(API_ERROR_SHAPES.unauthorized(result.reason), request);
  }

  const { record } = result;

  for (const scope of requiredScopes) {
    if (!record.scopes.includes(scope)) {
      return applyCorsHeaders(API_ERROR_SHAPES.forbidden(`Token lacks required scope: ${scope}`), request);
    }
  }

  const rateLimitKey = `api:${record.id}`;
  const rateLimit = ctx.rateLimit ?? 60;
  const allowed = ctx.checkRateLimit(rateLimitKey, rateLimit, 60_000);
  if (!allowed) {
    return applyCorsHeaders(API_ERROR_SHAPES.rateLimited(), request);
  }

  const response = await handler(record.id);
  return applyCorsHeaders(response, request);
}

export const apiErrors = API_ERROR_SHAPES;
