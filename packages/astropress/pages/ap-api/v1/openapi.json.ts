import type { APIRoute } from "astro";

const OPENAPI_SPEC = {
  openapi: "3.1.0",
  info: {
    title: "Astropress REST API",
    version: "1.0.0",
    description: "REST API for programmatic access to Astropress CMS. All endpoints (except /openapi.json) require Bearer token authentication.",
  },
  servers: [{ url: "/ap-api/v1", description: "Astropress API v1" }],
  components: {
    securitySchemes: {
      BearerAuth: {
        type: "http",
        scheme: "bearer",
        description: "API token created via Admin → API Tokens. Include as: Authorization: Bearer <token>",
      },
    },
    schemas: {
      ContentRecord: {
        type: "object",
        properties: {
          id: { type: "string" },
          slug: { type: "string" },
          kind: { type: "string", enum: ["post", "page"] },
          title: { type: "string" },
          status: { type: "string", enum: ["draft", "review", "published", "archived"] },
          body: { type: "string" },
          scheduledAt: { type: "string", format: "date-time", nullable: true },
          seoTitle: { type: "string" },
          metaDescription: { type: "string" },
        },
      },
      MediaAssetRecord: {
        type: "object",
        properties: {
          id: { type: "string" },
          filename: { type: "string" },
          mimeType: { type: "string" },
          publicUrl: { type: "string", nullable: true },
        },
      },
      RevisionRecord: {
        type: "object",
        properties: {
          id: { type: "string" },
          slug: { type: "string" },
          createdAt: { type: "string", format: "date-time" },
          status: { type: "string" },
        },
      },
      WebhookRecord: {
        type: "object",
        properties: {
          id: { type: "string" },
          url: { type: "string", format: "uri" },
          events: { type: "array", items: { type: "string" } },
          active: { type: "boolean" },
          createdAt: { type: "string", format: "date-time" },
        },
      },
      PaginatedContent: {
        type: "object",
        properties: {
          records: { type: "array", items: { "$ref": "#/components/schemas/ContentRecord" } },
          total: { type: "integer" },
          limit: { type: "integer" },
          offset: { type: "integer" },
        },
      },
      ApiError: {
        type: "object",
        properties: {
          error: { type: "string" },
          code: { type: "string", enum: ["unauthorized", "forbidden", "not_found", "validation_error", "rate_limited"] },
        },
      },
    },
  },
  security: [{ BearerAuth: [] }],
  paths: {
    "/content": {
      get: {
        summary: "List content records",
        operationId: "listContent",
        parameters: [
          { name: "kind", in: "query", schema: { type: "string" } },
          { name: "status", in: "query", schema: { type: "string" } },
          { name: "limit", in: "query", schema: { type: "integer", default: 20, maximum: 100 }, description: "Records per page (alias: per_page)" },
          { name: "per_page", in: "query", schema: { type: "integer", default: 20, maximum: 100 }, description: "Alias for limit" },
          { name: "page", in: "query", schema: { type: "integer", default: 1 }, description: "1-based page number (alternative to offset)" },
          { name: "offset", in: "query", schema: { type: "integer", default: 0 }, description: "Zero-based record offset (alternative to page)" },
        ],
        responses: {
          200: {
            description: "Paginated content records",
            headers: { "X-Total-Count": { schema: { type: "integer" }, description: "Total number of records matching the filter" } },
            content: { "application/json": { schema: { "$ref": "#/components/schemas/PaginatedContent" } } },
          },
          401: { description: "Unauthorized" },
          403: { description: "Forbidden — insufficient scope (requires content:read)" },
        },
        security: [{ BearerAuth: ["content:read"] }],
      },
      post: {
        summary: "Create a content record",
        operationId: "createContent",
        requestBody: { required: true, content: { "application/json": { schema: { type: "object", required: ["slug", "title", "kind"], properties: { slug: { type: "string" }, title: { type: "string" }, kind: { type: "string" }, body: { type: "string" }, status: { type: "string" } } } } } },
        responses: {
          201: { description: "Created content record" },
          401: { description: "Unauthorized" },
          403: { description: "Forbidden — requires content:write scope" },
          422: { description: "Validation error" },
        },
        security: [{ BearerAuth: ["content:write"] }],
      },
    },
    "/content/{id}": {
      get: { summary: "Get content by ID", operationId: "getContent", parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }], responses: { 200: { description: "Content record" }, 401: { description: "Unauthorized" }, 404: { description: "Not found" } }, security: [{ BearerAuth: ["content:read"] }] },
      put: { summary: "Update content", operationId: "updateContent", parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }], responses: { 200: { description: "Updated record" }, 401: { description: "Unauthorized" }, 404: { description: "Not found" } }, security: [{ BearerAuth: ["content:write"] }] },
      delete: { summary: "Delete content (archives it)", operationId: "deleteContent", parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }], responses: { 204: { description: "Deleted" }, 401: { description: "Unauthorized" }, 404: { description: "Not found" } }, security: [{ BearerAuth: ["content:write"] }] },
    },
    "/media": {
      get: { summary: "List media assets", operationId: "listMedia", parameters: [
        { name: "limit", in: "query", schema: { type: "integer", default: 20, maximum: 100 }, description: "Records per page (alias: per_page)" },
        { name: "per_page", in: "query", schema: { type: "integer", default: 20, maximum: 100 }, description: "Alias for limit" },
        { name: "page", in: "query", schema: { type: "integer", default: 1 }, description: "1-based page number" },
        { name: "offset", in: "query", schema: { type: "integer", default: 0 }, description: "Zero-based record offset" },
      ], responses: { 200: { description: "Media assets", headers: { "X-Total-Count": { schema: { type: "integer" }, description: "Total number of media assets" } } } }, security: [{ BearerAuth: ["media:read"] }] },
      post: { summary: "Upload media", operationId: "uploadMedia", requestBody: { required: true, content: { "multipart/form-data": { schema: { type: "object", required: ["file"], properties: { file: { type: "string", format: "binary" } } } } } }, responses: { 201: { description: "Uploaded asset" } }, security: [{ BearerAuth: ["media:write"] }] },
    },
    "/media/{id}": {
      delete: { summary: "Delete media asset", operationId: "deleteMedia", parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }], responses: { 204: { description: "Deleted" } }, security: [{ BearerAuth: ["media:write"] }] },
    },
    "/revisions/{recordId}": {
      get: { summary: "List revisions for a content record", operationId: "listRevisions", parameters: [{ name: "recordId", in: "path", required: true, schema: { type: "string" } }], responses: { 200: { description: "Revision list" } }, security: [{ BearerAuth: ["content:read"] }] },
    },
    "/settings": {
      get: { summary: "Get site settings", operationId: "getSettings", responses: { 200: { description: "Site settings" } }, security: [{ BearerAuth: ["settings:read"] }] },
    },
    "/webhooks": {
      get: { summary: "List webhooks", operationId: "listWebhooks", parameters: [
        { name: "limit", in: "query", schema: { type: "integer", default: 20, maximum: 100 }, description: "Records per page (alias: per_page)" },
        { name: "per_page", in: "query", schema: { type: "integer", default: 20, maximum: 100 }, description: "Alias for limit" },
        { name: "page", in: "query", schema: { type: "integer", default: 1 }, description: "1-based page number" },
        { name: "offset", in: "query", schema: { type: "integer", default: 0 }, description: "Zero-based record offset" },
      ], responses: { 200: { description: "Webhook list", headers: { "X-Total-Count": { schema: { type: "integer" }, description: "Total number of webhooks" } } } }, security: [{ BearerAuth: ["webhooks:manage"] }] },
      post: { summary: "Register a webhook", operationId: "createWebhook", requestBody: { required: true, content: { "application/json": { schema: { type: "object", required: ["url", "events"], properties: { url: { type: "string", format: "uri" }, events: { type: "array", items: { type: "string" } } } } } } }, responses: { 201: { description: "Created webhook with signing secret (shown once)" } }, security: [{ BearerAuth: ["webhooks:manage"] }] },
    },
    "/openapi.json": {
      get: { summary: "OpenAPI specification", operationId: "getOpenApiSpec", security: [], responses: { 200: { description: "OpenAPI 3.1 JSON spec" } } },
    },
  },
};

export const GET: APIRoute = () => {
  return new Response(JSON.stringify(OPENAPI_SPEC, null, 2), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
};
