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

export async function withApiRequest(request, ctx, requiredScopes, handler) {
  const authHeader = request.headers.get("Authorization") ?? "";
  if (!authHeader.startsWith("Bearer ")) {
    return API_ERROR_SHAPES.unauthorized("Missing or invalid Authorization header. Use: Authorization: Bearer <token>");
  }

  const rawToken = authHeader.slice(7).trim();
  if (!rawToken) {
    return API_ERROR_SHAPES.unauthorized("Bearer token is empty.");
  }

  const result = await ctx.apiTokens.verify(rawToken);
  if (!result.valid) {
    return API_ERROR_SHAPES.unauthorized(result.reason);
  }

  const { record } = result;

  for (const scope of requiredScopes) {
    if (!record.scopes.includes(scope)) {
      return API_ERROR_SHAPES.forbidden(`Token lacks required scope: ${scope}`);
    }
  }

  const rateLimitKey = `api:${record.id}`;
  const rateLimit = ctx.rateLimit ?? 60;
  const allowed = ctx.checkRateLimit(rateLimitKey, rateLimit, 60_000);
  if (!allowed) {
    return API_ERROR_SHAPES.rateLimited();
  }

  return handler(record.id);
}

export const apiErrors = API_ERROR_SHAPES;
