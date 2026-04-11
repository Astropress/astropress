import { DatabaseSync } from "node:sqlite";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import { registerCms } from "../src/config";
import { readAstropressSqliteSchemaSql } from "../src/sqlite-bootstrap.js";
import { createApiTokenStore } from "../src/sqlite-runtime/api-tokens.js";
import { makeLocals } from "./helpers/make-locals.js";

// ─── Hoisted mock functions ────────────────────────────────────────────────────

const mocks = vi.hoisted(() => ({
  loadLocalAdminStore: vi.fn(),
  listRuntimeContentStates: vi.fn(),
  createRuntimeContentRecord: vi.fn(),
  getRuntimeContentState: vi.fn(),
  saveRuntimeContentState: vi.fn(),
  getRuntimeContentRevisions: vi.fn(),
  webhooksDispatch: vi.fn(),
  webhooksList: vi.fn(),
  webhooksCreate: vi.fn(),
}));

// Mock the local-runtime-modules alias so loadLocalAdminStore is injectable
vi.mock("astropress/local-runtime-modules", () => ({
  loadLocalAdminStore: mocks.loadLocalAdminStore,
}));

// Partial mock of the astropress main module — keep getCmsConfig/registerCms real,
// replace the runtime content functions so tests don't hit real SQLite for writes.
vi.mock("astropress", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../index.js")>();
  return {
    ...actual,
    listRuntimeContentStates: mocks.listRuntimeContentStates,
    createRuntimeContentRecord: mocks.createRuntimeContentRecord,
    getRuntimeContentState: mocks.getRuntimeContentState,
    saveRuntimeContentState: mocks.saveRuntimeContentState,
    getRuntimeContentRevisions: mocks.getRuntimeContentRevisions,
  };
});

// ─── Page handler imports (after mocks are registered) ────────────────────────

import { GET as contentGET, POST as contentPOST } from "../pages/ap-api/v1/content.js";
import { GET as contentIdGET, PUT as contentIdPUT, DELETE as contentIdDELETE } from "../pages/ap-api/v1/content/[id].js";
import { GET as mediaGET } from "../pages/ap-api/v1/media.js";
import { GET as revisionsGET } from "../pages/ap-api/v1/revisions/[recordId].js";
import { GET as settingsGET } from "../pages/ap-api/v1/settings.js";
import { GET as webhooksGET, POST as webhooksPOST } from "../pages/ap-api/v1/webhooks.js";
import { GET as openapiGET } from "../pages/ap-api/v1/openapi.json.js";

// ─── Test state ───────────────────────────────────────────────────────────────

let db: DatabaseSync;
let locals: App.Locals;
let readToken: string;
let writeToken: string;
let mediaReadToken: string;
let settingsReadToken: string;
let webhooksManageToken: string;

const BASE = "http://localhost";

beforeAll(async () => {
  db = new DatabaseSync(":memory:");
  db.exec(readAstropressSqliteSchemaSql());
  locals = makeLocals(db);

  registerCms({
    templateKeys: ["content"],
    siteUrl: "https://example.com",
    seedPages: [],
    archives: [],
    translationStatus: [],
    api: { enabled: true },
  });

  const store = createApiTokenStore(db);
  readToken = (await store.create({ label: "read", scopes: ["content:read"] })).rawToken;
  writeToken = (await store.create({ label: "write", scopes: ["content:read", "content:write"] })).rawToken;
  mediaReadToken = (await store.create({ label: "media-read", scopes: ["media:read"] })).rawToken;
  settingsReadToken = (await store.create({ label: "settings-read", scopes: ["settings:read"] })).rawToken;
  webhooksManageToken = (await store.create({ label: "webhooks", scopes: ["webhooks:manage"] })).rawToken;
});

afterAll(() => {
  db.close();
});

beforeEach(() => {
  // Default mock store returned by loadLocalAdminStore
  const apiTokens = createApiTokenStore(db);
  mocks.loadLocalAdminStore.mockResolvedValue({
    apiTokens,
    checkRateLimit: () => true,
    listMediaAssets: () => [{ id: "m-1", filename: "photo.jpg", mimeType: "image/jpeg", publicUrl: "/uploads/photo.jpg" }],
    getSettings: () => ({ siteTitle: "Test Site", siteTagline: "", donationUrl: "", newsletterEnabled: false, commentsDefaultPolicy: "legacy-readonly", adminSlug: "ap-admin" }),
    webhooks: {
      dispatch: mocks.webhooksDispatch,
      list: mocks.webhooksList,
      create: mocks.webhooksCreate,
    },
  });

  // Default return values for content runtime functions
  mocks.listRuntimeContentStates.mockResolvedValue([
    { slug: "post-1", kind: "post", status: "draft", title: "Post 1" },
    { slug: "post-2", kind: "post", status: "published", title: "Post 2" },
    { slug: "page-1", kind: "page", status: "published", title: "Page 1" },
  ]);
  mocks.createRuntimeContentRecord.mockResolvedValue({
    ok: true,
    state: { slug: "new-post", kind: "post", status: "draft", title: "New Post" },
  });
  mocks.getRuntimeContentState.mockResolvedValue({
    slug: "post-1", kind: "post", status: "draft", title: "Post 1", body: "Hello",
  });
  mocks.saveRuntimeContentState.mockResolvedValue({
    ok: true,
    state: { slug: "post-1", kind: "post", status: "published", title: "Updated Post" },
  });
  mocks.getRuntimeContentRevisions.mockResolvedValue([
    { id: "rev-1", slug: "post-1", createdAt: "2024-01-01T00:00:00Z", status: "draft" },
  ]);
  mocks.webhooksList.mockResolvedValue([]);
  mocks.webhooksCreate.mockResolvedValue({
    record: { id: "wh-1", url: "https://example.com/hook", events: ["content.published"], active: true },
    signingSecret: "test-secret-xyz",
  });
  mocks.webhooksDispatch.mockResolvedValue(undefined);
});

// ─── Context builder ───────────────────────────────────────────────────────────

type AnyAPIContext = Parameters<typeof contentGET>[0];

function ctx(request: Request, params: Record<string, string> = {}): AnyAPIContext {
  return { request, params, locals } as unknown as AnyAPIContext;
}

function req(method: string, path: string, opts?: { token?: string; body?: unknown }): Request {
  const headers: Record<string, string> = {};
  if (opts?.token) headers["Authorization"] = `Bearer ${opts.token}`;
  if (opts?.body !== undefined) headers["Content-Type"] = "application/json";
  return new Request(`${BASE}${path}`, {
    method,
    headers,
    body: opts?.body !== undefined ? JSON.stringify(opts.body) : undefined,
  });
}

// ─── GET /ap-api/v1/content ───────────────────────────────────────────────────

describe("GET /ap-api/v1/content", () => {
  it("returns 200 with paginated records for content:read scope", async () => {
    const res = await contentGET(ctx(req("GET", "/ap-api/v1/content", { token: readToken })));
    expect(res.status).toBe(200);
    const body = await res.json() as Record<string, unknown>;
    expect(Array.isArray(body.records)).toBe(true);
    expect((body.records as unknown[]).length).toBe(3);
  });

  it("returns 401 with no Authorization header", async () => {
    const res = await contentGET(ctx(req("GET", "/ap-api/v1/content")));
    expect(res.status).toBe(401);
  });

  it("returns 403 when token lacks content:read scope", async () => {
    const res = await contentGET(ctx(req("GET", "/ap-api/v1/content", { token: mediaReadToken })));
    expect(res.status).toBe(403);
  });

  it("filters by kind query parameter", async () => {
    const res = await contentGET(ctx(req("GET", "/ap-api/v1/content?kind=post", { token: readToken })));
    expect(res.status).toBe(200);
    const body = await res.json() as { records: Array<{ kind: string }> };
    expect(body.records.every((r) => r.kind === "post")).toBe(true);
    expect(body.records.length).toBe(2);
  });

  it("filters by status query parameter", async () => {
    const res = await contentGET(ctx(req("GET", "/ap-api/v1/content?status=draft", { token: readToken })));
    expect(res.status).toBe(200);
    const body = await res.json() as { records: Array<{ status: string }> };
    expect(body.records.every((r) => r.status === "draft")).toBe(true);
    expect(body.records.length).toBe(1);
  });

  it("honours limit and offset query parameters", async () => {
    const res = await contentGET(ctx(req("GET", "/ap-api/v1/content?limit=2&offset=1", { token: readToken })));
    expect(res.status).toBe(200);
    const body = await res.json() as { records: unknown[]; total: number };
    expect(body.records.length).toBe(2);
    expect(body.total).toBe(3);
  });
});

// ─── POST /ap-api/v1/content ──────────────────────────────────────────────────

describe("POST /ap-api/v1/content", () => {
  it("returns 201 Created with the saved record for content:write scope", async () => {
    const res = await contentPOST(ctx(req("POST", "/ap-api/v1/content", {
      token: writeToken,
      body: { slug: "new-post", title: "New Post", kind: "post" },
    })));
    expect(res.status).toBe(201);
    const body = await res.json() as { slug: string };
    expect(body.slug).toBe("new-post");
  });

  it("returns 403 when token has only content:read scope", async () => {
    const res = await contentPOST(ctx(req("POST", "/ap-api/v1/content", {
      token: readToken,
      body: { slug: "test", title: "Test", kind: "post" },
    })));
    expect(res.status).toBe(403);
  });

  it("returns 422 for invalid request body", async () => {
    // Non-JSON body → parse error → 422
    const request = new Request(`${BASE}/ap-api/v1/content`, {
      method: "POST",
      headers: { Authorization: `Bearer ${writeToken}`, "Content-Type": "application/json" },
      body: "not-valid-json",
    });
    const res = await contentPOST(ctx(request));
    expect(res.status).toBe(422);
  });

  it("dispatches content.published webhook when status is published", async () => {
    mocks.createRuntimeContentRecord.mockResolvedValueOnce({
      ok: true,
      state: { slug: "pub-post", kind: "post", status: "published", title: "Published Post" },
    });
    await contentPOST(ctx(req("POST", "/ap-api/v1/content", {
      token: writeToken,
      body: { slug: "pub-post", title: "Published Post", kind: "post" },
    })));
    expect(mocks.webhooksDispatch).toHaveBeenCalledWith("content.published", expect.objectContaining({ slug: "pub-post" }));
  });
});

// ─── GET /ap-api/v1/content/:id ───────────────────────────────────────────────

describe("GET /ap-api/v1/content/:id", () => {
  it("returns 200 with the record for content:read scope", async () => {
    const res = await contentIdGET(ctx(
      req("GET", "/ap-api/v1/content/post-1", { token: readToken }),
      { id: "post-1" },
    ));
    expect(res.status).toBe(200);
    const body = await res.json() as { slug: string };
    expect(body.slug).toBe("post-1");
  });

  it("returns 404 for unknown id", async () => {
    mocks.getRuntimeContentState.mockResolvedValueOnce(null);
    const res = await contentIdGET(ctx(
      req("GET", "/ap-api/v1/content/ghost", { token: readToken }),
      { id: "ghost" },
    ));
    expect(res.status).toBe(404);
  });
});

// ─── PUT /ap-api/v1/content/:id ───────────────────────────────────────────────

describe("PUT /ap-api/v1/content/:id", () => {
  it("returns 200 with updated record for content:write scope", async () => {
    const res = await contentIdPUT(ctx(
      req("PUT", "/ap-api/v1/content/post-1", {
        token: writeToken,
        body: { title: "Updated Post" },
      }),
      { id: "post-1" },
    ));
    expect(res.status).toBe(200);
  });

  it("dispatches content.updated webhook on save", async () => {
    mocks.saveRuntimeContentState.mockResolvedValueOnce({
      ok: true,
      state: { slug: "post-1", status: "published" },
    });
    await contentIdPUT(ctx(
      req("PUT", "/ap-api/v1/content/post-1", {
        token: writeToken,
        body: { title: "Updated Post" },
      }),
      { id: "post-1" },
    ));
    expect(mocks.webhooksDispatch).toHaveBeenCalledWith("content.updated", expect.objectContaining({ id: "post-1" }));
  });
});

// ─── DELETE /ap-api/v1/content/:id ───────────────────────────────────────────

describe("DELETE /ap-api/v1/content/:id", () => {
  it("returns 204 for content:write scope", async () => {
    const res = await contentIdDELETE(ctx(
      req("DELETE", "/ap-api/v1/content/post-1", { token: writeToken }),
      { id: "post-1" },
    ));
    expect(res.status).toBe(204);
  });

  it("dispatches content.deleted webhook", async () => {
    await contentIdDELETE(ctx(
      req("DELETE", "/ap-api/v1/content/post-1", { token: writeToken }),
      { id: "post-1" },
    ));
    expect(mocks.webhooksDispatch).toHaveBeenCalledWith("content.deleted", expect.objectContaining({ id: "post-1" }));
  });
});

// ─── GET /ap-api/v1/media ─────────────────────────────────────────────────────

describe("GET /ap-api/v1/media", () => {
  it("returns 200 with media records for media:read scope", async () => {
    const res = await mediaGET(ctx(req("GET", "/ap-api/v1/media", { token: mediaReadToken })));
    expect(res.status).toBe(200);
    const body = await res.json() as { records: unknown[] };
    expect(Array.isArray(body.records)).toBe(true);
    expect(body.records.length).toBe(1);
  });
});

// ─── GET /ap-api/v1/revisions/:recordId ──────────────────────────────────────

describe("GET /ap-api/v1/revisions/:recordId", () => {
  it("returns 200 with revision list for content:read scope", async () => {
    const res = await revisionsGET(ctx(
      req("GET", "/ap-api/v1/revisions/post-1", { token: readToken }),
      { recordId: "post-1" },
    ));
    expect(res.status).toBe(200);
    const body = await res.json() as { records: unknown[]; total: number };
    expect(Array.isArray(body.records)).toBe(true);
    expect(body.total).toBe(1);
  });
});

// ─── GET /ap-api/v1/settings ─────────────────────────────────────────────────

describe("GET /ap-api/v1/settings", () => {
  it("returns 200 with site settings for settings:read scope", async () => {
    const res = await settingsGET(ctx(req("GET", "/ap-api/v1/settings", { token: settingsReadToken })));
    expect(res.status).toBe(200);
    const body = await res.json() as { siteTitle: string };
    expect(body.siteTitle).toBe("Test Site");
  });
});

// ─── GET + POST /ap-api/v1/webhooks ──────────────────────────────────────────

describe("GET /ap-api/v1/webhooks + POST /ap-api/v1/webhooks", () => {
  it("returns 200 with webhook list for webhooks:manage scope", async () => {
    const res = await webhooksGET(ctx(req("GET", "/ap-api/v1/webhooks", { token: webhooksManageToken })));
    expect(res.status).toBe(200);
    const body = await res.json() as { records: unknown[] };
    expect(Array.isArray(body.records)).toBe(true);
  });

  it("POST creates a webhook and returns signing secret once", async () => {
    const res = await webhooksPOST(ctx(req("POST", "/ap-api/v1/webhooks", {
      token: webhooksManageToken,
      body: { url: "https://example.com/hook", events: ["content.published"] },
    })));
    expect(res.status).toBe(201);
    const body = await res.json() as { signingSecret: string };
    expect(typeof body.signingSecret).toBe("string");
    expect(body.signingSecret.length).toBeGreaterThan(0);
  });
});

// ─── GET /ap-api/v1/openapi.json ─────────────────────────────────────────────

describe("GET /ap-api/v1/openapi.json", () => {
  it("returns 200 with a valid OpenAPI 3.1 JSON object", async () => {
    const res = await openapiGET(ctx(req("GET", "/ap-api/v1/openapi.json")));
    expect(res.status).toBe(200);
    const body = await res.json() as { openapi: string };
    expect(body.openapi).toBe("3.1.0");
  });

  it("includes securitySchemes with BearerAuth", async () => {
    const res = await openapiGET(ctx(req("GET", "/ap-api/v1/openapi.json")));
    const body = await res.json() as { components: { securitySchemes: Record<string, unknown> } };
    expect(body.components.securitySchemes.BearerAuth).toBeDefined();
  });

  it("includes all /ap-api/v1/* paths", async () => {
    const res = await openapiGET(ctx(req("GET", "/ap-api/v1/openapi.json")));
    const body = await res.json() as { paths: Record<string, unknown> };
    const paths = Object.keys(body.paths);
    expect(paths).toContain("/content");
    expect(paths).toContain("/content/{id}");
    expect(paths).toContain("/media");
    expect(paths).toContain("/revisions/{recordId}");
    expect(paths).toContain("/settings");
    expect(paths).toContain("/webhooks");
    expect(paths).toContain("/openapi.json");
  });

  it("does not require Authorization header", async () => {
    // No token provided — openapi endpoint has no auth check
    const res = await openapiGET(ctx(req("GET", "/ap-api/v1/openapi.json")));
    expect(res.status).toBe(200);
  });
});
