import { describe, it } from "vitest";

// Integration tests for /ap-api/v1/* REST endpoints.
// These run against real SQLite using the seeded test database.
// Implemented in Commit 7 and 8; all todos until then.

describe("GET /ap-api/v1/content", () => {
  it.todo("returns 200 with paginated records for content:read scope");
  it.todo("returns 401 with no Authorization header");
  it.todo("returns 403 when token lacks content:read scope");
  it.todo("filters by kind query parameter");
  it.todo("filters by status query parameter");
  it.todo("honours limit and offset query parameters");
});

describe("POST /ap-api/v1/content", () => {
  it.todo("returns 201 Created with the saved record for content:write scope");
  it.todo("returns 403 when token has only content:read scope");
  it.todo("returns 422 for invalid request body");
  it.todo("dispatches content.published webhook when status is published");
});

describe("GET /ap-api/v1/content/:id", () => {
  it.todo("returns 200 with the record for content:read scope");
  it.todo("returns 404 for unknown id");
});

describe("PUT /ap-api/v1/content/:id", () => {
  it.todo("returns 200 with updated record for content:write scope");
  it.todo("dispatches content.updated webhook on save");
});

describe("DELETE /ap-api/v1/content/:id", () => {
  it.todo("returns 204 for content:write scope");
  it.todo("dispatches content.deleted webhook");
});

describe("GET /ap-api/v1/media", () => {
  it.todo("returns 200 with media records for media:read scope");
});

describe("GET /ap-api/v1/revisions/:recordId", () => {
  it.todo("returns 200 with revision list for content:read scope");
});

describe("GET /ap-api/v1/settings", () => {
  it.todo("returns 200 with site settings for settings:read scope");
});

describe("GET /ap-api/v1/webhooks + POST /ap-api/v1/webhooks", () => {
  it.todo("returns 200 with webhook list for webhooks:manage scope");
  it.todo("POST creates a webhook and returns signing secret once");
});

describe("GET /ap-api/v1/openapi.json", () => {
  it.todo("returns 200 with a valid OpenAPI 3.1 JSON object");
  it.todo("includes securitySchemes with BearerAuth");
  it.todo("includes all /ap-api/v1/* paths");
  it.todo("does not require Authorization header");
});
