import { API_ERROR_SHAPES } from "./api-middleware-error-shapes";
import { peekCmsConfig } from "./config";
import type { JsonValue } from "./json-types";
import type { ApiScope, ApiTokenStore } from "./platform-contracts";
import { createAstropressSecurityHeaders } from "./security-headers";

/**
 * Merges the shared `api`-area security headers (Referrer-Policy,
 * X-Content-Type-Options, Permissions-Policy, Cross-Origin-Resource-Policy, CSP,
 * …) into a Headers object. Cache-Control is intentionally left untouched so the
 * ETag/conditional-GET semantics of `jsonOkWithEtag` survive — only the security
 * envelope is applied here (#119).
 */
function withApiSecurityHeaders(headers: Headers): Headers {
	const security = createAstropressSecurityHeaders({ area: "api" });
	security.forEach((value, key) => {
		headers.set(key, value);
	});
	return headers;
}

export interface ApiRequestContext {
	apiTokens: ApiTokenStore;
	// Sync-or-async: the local sqlite store returns synchronously while the D1
	// rate-limit part is promise-returning. `withApiRequest` awaits the result.
	checkRateLimit: (key: string, max: number, windowMs: number) => boolean | Promise<boolean>;
	rateLimit?: number; // requests per minute per token, default 60
}

export function jsonOk(body: JsonValue, status = 200) {
	const headers = withApiSecurityHeaders(new Headers({ "Content-Type": "application/json" }));
	return new Response(JSON.stringify(body), { status, headers });
}

/** Generate a weak ETag from the serialized body using a fast djb2-style hash. */
function weakEtag(serialized: string): string {
	let h = 5381;
	for (let i = 0; i < serialized.length; i++) {
		h = ((h << 5) + h) ^ serialized.charCodeAt(i);
		h >>>= 0; // keep unsigned 32-bit
	}
	return `W/"${h.toString(16)}"`;
}

export function jsonOkWithEtag(body: JsonValue, request: Request, status = 200): Response {
	const serialized = JSON.stringify(body);
	const etag = weakEtag(serialized);
	const ifNoneMatch = request.headers.get("If-None-Match");
	if (ifNoneMatch === etag) {
		return new Response(null, {
			status: 304,
			headers: withApiSecurityHeaders(new Headers({ ETag: etag })),
		});
	}
	return new Response(serialized, {
		status,
		headers: withApiSecurityHeaders(
			new Headers({ "Content-Type": "application/json", ETag: etag }),
		),
	});
}

export function jsonOkPaginated(body: JsonValue, total: number, status = 200) {
	const headers = withApiSecurityHeaders(
		new Headers({
			"Content-Type": "application/json",
			"X-Total-Count": String(total),
			"Access-Control-Expose-Headers": "X-Total-Count",
		}),
	);
	return new Response(JSON.stringify(body), { status, headers });
}

function resolveCorsOrigin(request: Request): string | null {
	const corsConfig = peekCmsConfig()?.api?.cors;
	if (!corsConfig) return null;
	const { origin } = corsConfig;
	const requestOrigin = request.headers.get("Origin");
	if (requestOrigin === null) return null;
	if (origin === "*") return "*";
	if (Array.isArray(origin)) {
		return origin.includes(requestOrigin) ? requestOrigin : null;
	}
	return origin === requestOrigin ? requestOrigin : null;
}

// Single egress for every withApiRequest response: applies the shared API
// security envelope unconditionally (#119), then layers CORS when the request
// origin is allowed. Error shapes, paginated, conditional-GET, and handler
// output all flow through here, so none can leave the envelope.
function applyCorsHeaders(response: Response, request: Request): Response {
	const headers = withApiSecurityHeaders(new Headers(response.headers));
	const allowedOrigin = resolveCorsOrigin(request);
	if (allowedOrigin) {
		headers.set("Access-Control-Allow-Origin", allowedOrigin);
		headers.set("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
		headers.set("Access-Control-Allow-Headers", "Authorization, Content-Type");
		if (allowedOrigin !== "*") {
			headers.set("Vary", "Origin");
		}
	}
	return new Response(response.body, {
		status: response.status,
		statusText: response.statusText,
		headers,
	});
}

export function handleCorsPreflightRequest(request: Request): Response | null {
	if (request.method !== "OPTIONS") return null;
	const allowedOrigin = resolveCorsOrigin(request);
	if (!allowedOrigin) return null;
	const headers = withApiSecurityHeaders(
		new Headers({
			"Access-Control-Allow-Origin": allowedOrigin,
			"Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
			"Access-Control-Allow-Headers": "Authorization, Content-Type",
			"Access-Control-Max-Age": "86400",
			...(allowedOrigin !== "*" ? { Vary: "Origin" } : {}),
		}),
	);
	return new Response(null, { status: 204, headers });
}

export async function withApiRequest(
	request: Request,
	ctx: ApiRequestContext,
	requiredScopes: ApiScope[],
	handler: (tokenId: string) => Promise<Response>,
): Promise<Response> {
	const preflight = handleCorsPreflightRequest(request);
	if (preflight) return preflight;

	const authHeader = request.headers.get("Authorization");
	if (!authHeader?.startsWith("Bearer ")) {
		return applyCorsHeaders(
			API_ERROR_SHAPES.unauthorized(
				"Missing or invalid Authorization header. Use: Authorization: Bearer <token>",
			),
			request,
		);
	}

	const [, rawToken] = authHeader.split("Bearer ");
	const result = await ctx.apiTokens.verify(rawToken);
	if (!result.valid) {
		return applyCorsHeaders(API_ERROR_SHAPES.unauthorized(result.reason), request);
	}

	const { record } = result;

	for (const scope of requiredScopes) {
		if (!record.scopes.includes(scope)) {
			return applyCorsHeaders(
				API_ERROR_SHAPES.forbidden(`Token lacks required scope: ${scope}`),
				request,
			);
		}
	}

	const rateLimitKey = `api:${record.id}`;
	const rateLimit = ctx.rateLimit ?? 60;
	const allowed = await ctx.checkRateLimit(rateLimitKey, rateLimit, 60_000);
	if (!allowed) {
		return applyCorsHeaders(API_ERROR_SHAPES.rateLimited(), request);
	}

	const response = await handler(record.id);
	return applyCorsHeaders(response, request);
}

export const apiErrors = API_ERROR_SHAPES;
