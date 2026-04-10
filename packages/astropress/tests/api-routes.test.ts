import { describe, expect, it } from "vitest";

// These tests verify the REST API route inventory shape.
// The api-routes.ts source file is created in Commit 6; until then these are todos.

describe("REST API route inventory", () => {
  it.todo("api-routes.ts defines GET /ap-api/v1/content");
  it.todo("api-routes.ts defines POST /ap-api/v1/content");
  it.todo("api-routes.ts defines GET /ap-api/v1/content/:id");
  it.todo("api-routes.ts defines PUT /ap-api/v1/content/:id");
  it.todo("api-routes.ts defines DELETE /ap-api/v1/content/:id");
  it.todo("api-routes.ts defines GET /ap-api/v1/media");
  it.todo("api-routes.ts defines POST /ap-api/v1/media");
  it.todo("api-routes.ts defines DELETE /ap-api/v1/media/:id");
  it.todo("api-routes.ts defines GET /ap-api/v1/revisions/:recordId");
  it.todo("api-routes.ts defines GET /ap-api/v1/settings");
  it.todo("api-routes.ts defines GET /ap-api/v1/webhooks");
  it.todo("api-routes.ts defines POST /ap-api/v1/webhooks");
  it.todo("api-routes.ts defines GET /ap-api/v1/openapi.json");
});

describe("API middleware (Bearer token auth)", () => {
  it.todo("withApiRequest rejects missing Authorization header with 401");
  it.todo("withApiRequest rejects malformed Bearer token with 401");
  it.todo("withApiRequest rejects token with insufficient scope with 403");
  it.todo("withApiRequest allows request when token is valid and scope matches");
  it.todo("withApiRequest rate-limits per-token at the configured rateLimit");
});

describe("Security area mapping for /ap-api/*", () => {
  it.todo("resolveAstropressSecurityArea returns 'api' for /ap-api/v1/content");
  it.todo("resolveAstropressSecurityArea returns 'api' for /ap-api/v1/openapi.json");
  it.todo("api area applies no-store Cache-Control");
  it.todo("api area does not set form-action CSP directive");
});
