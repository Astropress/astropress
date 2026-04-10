import type { ApiScope, ApiTokenStore } from "./platform-contracts";

export interface ApiRequestContext {
  apiTokens: ApiTokenStore;
  checkRateLimit: (key: string, max: number, windowMs: number) => boolean;
  rateLimit?: number; // requests per minute per token, default 60
}

type JsonValue = string | number | boolean | null | JsonValue[] | { [key: string]: JsonValue };

const API_ERROR_SHAPES = {
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
};

function jsonError(status: number, body: Record<string, JsonValue>) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

export function jsonOk(body: JsonValue, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

export async function withApiRequest(
  request: Request,
  ctx: ApiRequestContext,
  requiredScopes: ApiScope[],
  handler: (tokenId: string) => Promise<Response>,
): Promise<Response> {
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
