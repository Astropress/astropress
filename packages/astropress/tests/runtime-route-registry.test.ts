import { DatabaseSync } from "node:sqlite";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { registerCms } from "../src/config";
import { makeLocals } from "./helpers/make-locals.js";
import { makeDb, STANDARD_ACTOR } from "./helpers/make-db.js";
import {
  createRuntimeStructuredPageRoute,
  getRuntimeArchiveRoute,
  getRuntimeStructuredPageRoute,
  getRuntimeSystemRoute,
  listRuntimeStructuredPageRoutes,
  listRuntimeSystemRoutes,
  saveRuntimeArchiveRoute,
  saveRuntimeStructuredPageRoute,
  saveRuntimeSystemRoute,
} from "../src/runtime-route-registry";

// ---------------------------------------------------------------------------
// Mock local CMS registry — by default throws (mimicking real test env where
// the local runtime alias is unavailable). Individual tests use mockResolvedValueOnce
// to simulate the registry being available, covering the if(!local) false branch.
// ---------------------------------------------------------------------------

const { mockLoadLocalCmsRegistry, mockLocalRegistry } = vi.hoisted(() => {
  const registry = {
    listSystemRoutes: vi.fn().mockResolvedValue([]),
    getSystemRoute: vi.fn().mockResolvedValue(null),
    saveSystemRoute: vi.fn().mockResolvedValue({ ok: true }),
    listStructuredPageRoutes: vi.fn().mockResolvedValue([]),
    getStructuredPageRoute: vi.fn().mockResolvedValue(null),
    saveStructuredPageRoute: vi.fn().mockResolvedValue({ ok: true }),
    createStructuredPageRoute: vi.fn().mockResolvedValue({ ok: true }),
    getArchiveRoute: vi.fn().mockResolvedValue(null),
    saveArchiveRoute: vi.fn().mockResolvedValue({ ok: true }),
  };
  return {
    mockLoadLocalCmsRegistry: vi.fn().mockRejectedValue(new Error("Local runtime modules are only available inside an Astro host")),
    mockLocalRegistry: registry,
  };
});

vi.mock("../src/local-runtime-modules", () => ({
  loadLocalCmsRegistry: mockLoadLocalCmsRegistry,
}));

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const actor = STANDARD_ACTOR;

let db: DatabaseSync;
let locals: App.Locals;

beforeEach(() => {
  db = makeDb();
  locals = makeLocals(db);

  registerCms({
    templateKeys: ["content"],
    siteUrl: "https://example.com",
    seedPages: [],
    archives: [],
    translationStatus: [],
  });
});

// ---------------------------------------------------------------------------
// Helpers for seeding routes
// ---------------------------------------------------------------------------

function seedSystemRoute(db: DatabaseSync, path: string, renderStrategy = "structured_sections") {
  const groupId = `group:${path}`;
  const variantId = `variant:${path}`;
  db.prepare(
    `INSERT INTO cms_route_groups (id, kind, render_strategy, canonical_locale, canonical_path)
     VALUES (?, 'system', ?, 'en', ?)`,
  ).run(groupId, renderStrategy, path);
  db.prepare(
    `INSERT INTO cms_route_variants (id, group_id, locale, path, status, title, updated_by)
     VALUES (?, ?, 'en', ?, 'published', ?, ?)`,
  ).run(variantId, groupId, path, `Title for ${path}`, "admin@test.local");
  return variantId;
}

function seedArchiveRoute(db: DatabaseSync, path: string) {
  const groupId = `group:${path}`;
  const variantId = `variant:${path}`;
  db.prepare(
    `INSERT INTO cms_route_groups (id, kind, render_strategy, canonical_locale, canonical_path)
     VALUES (?, 'archive', 'archive_listing', 'en', ?)`,
  ).run(groupId, path);
  db.prepare(
    `INSERT INTO cms_route_variants (id, group_id, locale, path, status, title, updated_by)
     VALUES (?, ?, 'en', ?, 'published', ?, ?)`,
  ).run(variantId, groupId, path, `Archive for ${path}`, "admin@test.local");
  return variantId;
}

function seedStructuredPageRoute(db: DatabaseSync, path: string, templateKey = "content") {
  const groupId = `group:${path}`;
  const variantId = `variant:${path}`;
  const settingsJson = JSON.stringify({ templateKey, alternateLinks: [] });
  db.prepare(
    `INSERT INTO cms_route_groups (id, kind, render_strategy, canonical_locale, canonical_path)
     VALUES (?, 'page', 'structured_sections', 'en', ?)`,
  ).run(groupId, path);
  db.prepare(
    `INSERT INTO cms_route_variants (id, group_id, locale, path, status, title, settings_json, updated_by)
     VALUES (?, ?, 'en', ?, 'published', ?, ?, ?)`,
  ).run(variantId, groupId, path, `Page at ${path}`, settingsJson, "admin@test.local");
  return variantId;
}

// ---------------------------------------------------------------------------
// listRuntimeSystemRoutes
// ---------------------------------------------------------------------------

describe("listRuntimeSystemRoutes", () => {
  it("returns empty array for empty DB", async () => {
    const routes = await listRuntimeSystemRoutes(locals);
    expect(routes).toEqual([]);
  });

  it("returns seeded system routes", async () => {
    seedSystemRoute(db, "/contact", "structured_sections");
    const routes = await listRuntimeSystemRoutes(locals);
    expect(routes).toHaveLength(1);
    expect(routes[0].path).toBe("/contact");
    expect(routes[0].renderStrategy).toBe("structured_sections");
  });

  it("returns empty array when locals are null (no registry)", async () => {
    const routes = await listRuntimeSystemRoutes(null);
    expect(routes).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// getRuntimeSystemRoute
// ---------------------------------------------------------------------------

describe("getRuntimeSystemRoute", () => {
  it("returns null for non-existent path", async () => {
    const route = await getRuntimeSystemRoute("/no-such-route", locals);
    expect(route).toBeNull();
  });

  it("returns route for existing system path", async () => {
    seedSystemRoute(db, "/sitemap.xml", "generated_xml");
    const route = await getRuntimeSystemRoute("/sitemap.xml", locals);
    expect(route).not.toBeNull();
    expect(route!.path).toBe("/sitemap.xml");
    expect(route!.renderStrategy).toBe("generated_xml");
  });

  it("normalises path without leading slash", async () => {
    seedSystemRoute(db, "/contact");
    const route = await getRuntimeSystemRoute("contact", locals);
    expect(route).not.toBeNull();
    expect(route!.path).toBe("/contact");
  });

  it("returns null when locals are null (no registry)", async () => {
    const route = await getRuntimeSystemRoute("/anything", null);
    expect(route).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// saveRuntimeSystemRoute
// ---------------------------------------------------------------------------

describe("saveRuntimeSystemRoute", () => {
  it("returns not-ok for non-existent path", async () => {
    const result = await saveRuntimeSystemRoute(
      "/no-such-path",
      { title: "X" },
      actor,
      locals,
    );
    expect(result).toMatchObject({ ok: false });
    expect((result as { error: string }).error).toContain("could not be found");
  });

  it("returns not-ok for empty title", async () => {
    seedSystemRoute(db, "/contact");
    const result = await saveRuntimeSystemRoute("/contact", { title: "   " }, actor, locals);
    expect(result).toMatchObject({ ok: false });
    expect((result as { error: string }).error).toContain("title is required");
  });

  it("updates an existing system route", async () => {
    seedSystemRoute(db, "/contact", "structured_sections");
    const result = await saveRuntimeSystemRoute(
      "/contact",
      { title: "Get in Touch", summary: "Contact us" },
      actor,
      locals,
    );
    expect(result).toMatchObject({ ok: true });
    const row = db.prepare("SELECT title FROM cms_route_variants WHERE path = '/contact'").get() as { title: string };
    expect(row.title).toBe("Get in Touch");
  });

  it("stores settings JSON when settings provided", async () => {
    seedSystemRoute(db, "/feed.xml", "generated_xml");
    const result = await saveRuntimeSystemRoute(
      "/feed.xml",
      { title: "RSS Feed", settings: { limit: 20 } },
      actor,
      locals,
    );
    expect(result).toMatchObject({ ok: true });
    const row = db.prepare("SELECT settings_json FROM cms_route_variants WHERE path = '/feed.xml'").get() as { settings_json: string };
    expect(JSON.parse(row.settings_json)).toMatchObject({ limit: 20 });
  });

  it("updates with all optional fields and reads back non-null summary/bodyHtml", async () => {
    seedSystemRoute(db, "/about-all", "structured_sections");
    await saveRuntimeSystemRoute(
      "/about-all",
      {
        title: "About All",
        summary: "A summary",
        bodyHtml: "<p>Content</p>",
        settings: { key: "value" },
        revisionNote: "Full update",
      },
      actor,
      locals,
    );
    const route = await getRuntimeSystemRoute("/about-all", locals);
    expect(route?.summary).toBe("A summary");
    expect(route?.bodyHtml).toBe("<p>Content</p>");
  });

  it("returns not-ok when locals are null and no local registry is available", async () => {
    const result = await saveRuntimeSystemRoute("/contact", { title: "T" }, actor, null);
    expect(result).toMatchObject({ ok: false });
  });

  it("delegates to local registry when locals=null and local registry is available", async () => {
    mockLoadLocalCmsRegistry.mockResolvedValueOnce(mockLocalRegistry);
    const result = await saveRuntimeSystemRoute("/contact", { title: "T" }, actor, null);
    expect(result).toMatchObject({ ok: true });
  });
});

// ---------------------------------------------------------------------------
// listRuntimeStructuredPageRoutes
// ---------------------------------------------------------------------------

describe("listRuntimeStructuredPageRoutes", () => {
  it("returns empty array when locals are null (no registry)", async () => {
    const routes = await listRuntimeStructuredPageRoutes(null);
    expect(routes).toEqual([]);
  });

  it("returns empty array for empty DB", async () => {
    const routes = await listRuntimeStructuredPageRoutes(locals);
    expect(routes).toEqual([]);
  });

  it("returns seeded structured page routes", async () => {
    seedStructuredPageRoute(db, "/about");
    const routes = await listRuntimeStructuredPageRoutes(locals);
    expect(routes).toHaveLength(1);
    expect(routes[0].path).toBe("/about");
    expect(routes[0].templateKey).toBe("content");
  });

  it("excludes routes with invalid/missing templateKey", async () => {
    // Seed a route with no settings_json — mapStructuredPageRow returns null
    const groupId = "group-no-key";
    db.prepare(
      `INSERT INTO cms_route_groups (id, kind, render_strategy, canonical_locale, canonical_path)
       VALUES (?, 'page', 'structured_sections', 'en', '/no-key')`,
    ).run(groupId);
    db.prepare(
      `INSERT INTO cms_route_variants (id, group_id, locale, path, status, title, updated_by)
       VALUES (?, ?, 'en', '/no-key', 'published', 'No Key', 'admin@test.local')`,
    ).run("variant-no-key", groupId);
    const routes = await listRuntimeStructuredPageRoutes(locals);
    expect(routes.find((r) => r.path === "/no-key")).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// getRuntimeStructuredPageRoute
// ---------------------------------------------------------------------------

describe("getRuntimeStructuredPageRoute", () => {
  it("returns null when locals are null (no registry)", async () => {
    const route = await getRuntimeStructuredPageRoute("/ghost", null);
    expect(route).toBeNull();
  });

  it("returns null for non-existent path", async () => {
    const route = await getRuntimeStructuredPageRoute("/ghost", locals);
    expect(route).toBeNull();
  });

  it("returns route for seeded structured page", async () => {
    seedStructuredPageRoute(db, "/about");
    const route = await getRuntimeStructuredPageRoute("/about", locals);
    expect(route).not.toBeNull();
    expect(route!.path).toBe("/about");
    expect(route!.templateKey).toBe("content");
  });
});

// ---------------------------------------------------------------------------
// saveRuntimeStructuredPageRoute
// ---------------------------------------------------------------------------

describe("saveRuntimeStructuredPageRoute", () => {
  it("returns not-ok for non-existent path", async () => {
    const result = await saveRuntimeStructuredPageRoute(
      "/no-page",
      { title: "T", templateKey: "content" },
      actor,
      locals,
    );
    expect(result).toMatchObject({ ok: false });
  });

  it("returns not-ok for empty title", async () => {
    seedStructuredPageRoute(db, "/about");
    const result = await saveRuntimeStructuredPageRoute(
      "/about",
      { title: "   ", templateKey: "content" },
      actor,
      locals,
    );
    expect(result).toMatchObject({ ok: false });
  });

  it("updates a structured page route", async () => {
    seedStructuredPageRoute(db, "/about");
    const result = await saveRuntimeStructuredPageRoute(
      "/about",
      {
        title: "About Us",
        summary: "Our story",
        templateKey: "content",
        sections: { hero: { text: "Welcome" } },
        alternateLinks: [{ hreflang: "es", href: "/es/about" }],
      },
      actor,
      locals,
    );
    expect(result).toMatchObject({ ok: true });
    const row = db.prepare("SELECT title FROM cms_route_variants WHERE path = '/about'").get() as { title: string };
    expect(row.title).toBe("About Us");
  });

  it("updates with all optional fields and reads back non-null values", async () => {
    seedStructuredPageRoute(db, "/full-opts");
    const result = await saveRuntimeStructuredPageRoute(
      "/full-opts",
      {
        title: "Full Options",
        summary: "A rich page",
        seoTitle: "Custom SEO",
        metaDescription: "Custom meta",
        canonicalUrlOverride: "https://example.com/full-opts",
        robotsDirective: "noindex",
        ogImage: "/img/og.jpg",
        templateKey: "content",
        alternateLinks: [{ hreflang: "es", href: "/es/full-opts" }],
        sections: { hero: { text: "Hello" } },
        revisionNote: "All fields updated",
      },
      actor,
      locals,
    );
    expect(result).toMatchObject({ ok: true });
    const route = await getRuntimeStructuredPageRoute("/full-opts", locals);
    expect(route?.summary).toBe("A rich page");
    expect(route?.seoTitle).toBe("Custom SEO");
    expect(route?.canonicalUrlOverride).toBe("https://example.com/full-opts");
  });

  it("returns not-ok when locals are null and no local registry is available", async () => {
    const result = await saveRuntimeStructuredPageRoute("/about", { title: "T", templateKey: "content" }, actor, null);
    expect(result).toMatchObject({ ok: false });
  });

  it("saves without optional fields and reads back with undefined for omitted values", async () => {
    seedStructuredPageRoute(db, "/minimal-page");
    const result = await saveRuntimeStructuredPageRoute(
      "/minimal-page",
      { title: "Minimal", templateKey: "content" },
      actor,
      locals,
    );
    expect(result).toMatchObject({ ok: true });
    const route = await getRuntimeStructuredPageRoute("/minimal-page", locals);
    expect(route?.summary).toBeUndefined();
    expect(route?.seoTitle).toBe("Minimal");
  });

  it("delegates to local registry when locals=null and local registry is available", async () => {
    mockLoadLocalCmsRegistry.mockResolvedValueOnce(mockLocalRegistry);
    const result = await saveRuntimeStructuredPageRoute("/about", { title: "T", templateKey: "content" }, actor, null);
    expect(result).toMatchObject({ ok: true });
  });
});

// ---------------------------------------------------------------------------
// createRuntimeStructuredPageRoute
// ---------------------------------------------------------------------------

describe("createRuntimeStructuredPageRoute", () => {
  it("creates a new structured page route", async () => {
    const result = await createRuntimeStructuredPageRoute(
      "/new-page",
      { title: "New Page", templateKey: "content" },
      actor,
      locals,
    );
    expect(result).toMatchObject({ ok: true });
    const row = db.prepare("SELECT path FROM cms_route_variants WHERE path = '/new-page'").get() as { path: string } | undefined;
    expect(row?.path).toBe("/new-page");
  });

  it("normalises path without leading slash", async () => {
    const result = await createRuntimeStructuredPageRoute(
      "services",
      { title: "Services", templateKey: "content" },
      actor,
      locals,
    );
    expect(result).toMatchObject({ ok: true });
    const row = db.prepare("SELECT path FROM cms_route_variants WHERE path = '/services'").get() as { path: string } | undefined;
    expect(row?.path).toBe("/services");
  });

  it("rejects duplicate path", async () => {
    seedStructuredPageRoute(db, "/about");
    const result = await createRuntimeStructuredPageRoute(
      "/about",
      { title: "About", templateKey: "content" },
      actor,
      locals,
    );
    expect(result).toMatchObject({ ok: false });
    expect((result as { error: string }).error).toContain("already in use");
  });

  it("rejects empty title", async () => {
    const result = await createRuntimeStructuredPageRoute(
      "/blank-title",
      { title: "   ", templateKey: "content" },
      actor,
      locals,
    );
    expect(result).toMatchObject({ ok: false });
  });

  it("returns not-ok when locals are null and no local registry is available", async () => {
    const result = await createRuntimeStructuredPageRoute("/x", { title: "X", templateKey: "content" }, actor, null);
    expect(result).toMatchObject({ ok: false });
  });

  it("creates without optional fields and reads back with undefined for omitted values", async () => {
    const result = await createRuntimeStructuredPageRoute(
      "/minimal-create",
      { title: "Minimal Create", templateKey: "content" },
      actor,
      locals,
    );
    expect(result).toMatchObject({ ok: true });
    const route = await getRuntimeStructuredPageRoute("/minimal-create", locals);
    expect(route?.summary).toBeUndefined();
    expect(route?.seoTitle).toBe("Minimal Create");
  });

  it("delegates to local registry when locals=null and local registry is available", async () => {
    mockLoadLocalCmsRegistry.mockResolvedValueOnce(mockLocalRegistry);
    const result = await createRuntimeStructuredPageRoute("/z", { title: "Z", templateKey: "content" }, actor, null);
    expect(result).toMatchObject({ ok: true });
  });

  it("creates a Spanish locale route from /es/ path", async () => {
    const result = await createRuntimeStructuredPageRoute(
      "/es/nueva-pagina",
      { title: "Nueva Pagina", templateKey: "content" },
      actor,
      locals,
    );
    expect(result).toMatchObject({ ok: true });
  });

  it("creates a route with all optional fields and reads back non-null values", async () => {
    const result = await createRuntimeStructuredPageRoute(
      "/complete-page",
      {
        title: "Complete Page",
        summary: "Page summary",
        seoTitle: "SEO Title Override",
        metaDescription: "Custom meta description",
        canonicalUrlOverride: "https://example.com/complete-page",
        robotsDirective: "noindex,nofollow",
        ogImage: "/images/og-complete.jpg",
        templateKey: "content",
        alternateLinks: [{ hreflang: "es", href: "/es/complete-page" }],
        sections: { hero: { text: "Welcome" }, body: { text: "Content" } },
        revisionNote: "Initial creation with all fields",
      },
      actor,
      locals,
    );
    expect(result).toMatchObject({ ok: true });
    const route = await getRuntimeStructuredPageRoute("/complete-page", locals);
    expect(route?.summary).toBe("Page summary");
    expect(route?.seoTitle).toBe("SEO Title Override");
    expect(route?.canonicalUrlOverride).toBe("https://example.com/complete-page");
    expect(route?.robotsDirective).toBe("noindex,nofollow");
    expect(route?.ogImage).toBe("/images/og-complete.jpg");
  });
});

// ---------------------------------------------------------------------------
// getRuntimeArchiveRoute
// ---------------------------------------------------------------------------

describe("getRuntimeArchiveRoute", () => {
  it("returns null for non-existent archive", async () => {
    const route = await getRuntimeArchiveRoute("/blog", locals);
    expect(route).toBeNull();
  });

  it("returns archive for seeded route", async () => {
    seedArchiveRoute(db, "/blog");
    const route = await getRuntimeArchiveRoute("/blog", locals);
    expect(route).not.toBeNull();
    expect(route!.path).toBe("/blog");
  });

  it("returns null when locals are null (no registry)", async () => {
    const route = await getRuntimeArchiveRoute("/blog", null);
    expect(route).toBeNull();
  });

  it("delegates to local registry when locals=null and local registry is available", async () => {
    mockLoadLocalCmsRegistry.mockResolvedValueOnce(mockLocalRegistry);
    const route = await getRuntimeArchiveRoute("/blog", null);
    expect(route).toBeNull(); // mock returns null
  });
});

// ---------------------------------------------------------------------------
// saveRuntimeArchiveRoute
// ---------------------------------------------------------------------------

describe("saveRuntimeArchiveRoute", () => {
  it("returns not-ok for non-existent archive", async () => {
    const result = await saveRuntimeArchiveRoute("/no-archive", { title: "T" }, actor, locals);
    expect(result).toMatchObject({ ok: false });
  });

  it("returns not-ok for empty title", async () => {
    seedArchiveRoute(db, "/blog");
    const result = await saveRuntimeArchiveRoute("/blog", { title: "   " }, actor, locals);
    expect(result).toMatchObject({ ok: false });
  });

  it("updates a seeded archive route", async () => {
    seedArchiveRoute(db, "/blog");
    const result = await saveRuntimeArchiveRoute(
      "/blog",
      {
        title: "The Blog",
        summary: "Latest posts",
        seoTitle: "Blog SEO",
        metaDescription: "All the posts",
        robotsDirective: "index,follow",
      },
      actor,
      locals,
    );
    expect(result).toMatchObject({ ok: true });
    const row = db.prepare("SELECT title FROM cms_route_variants WHERE path = '/blog'").get() as { title: string };
    expect(row.title).toBe("The Blog");
  });

  it("updates archive with all optional fields and reads back non-null values", async () => {
    seedArchiveRoute(db, "/full-archive");
    const result = await saveRuntimeArchiveRoute(
      "/full-archive",
      {
        title: "Full Archive",
        summary: "All posts",
        seoTitle: "Archive SEO Title",
        metaDescription: "Archive meta description",
        canonicalUrlOverride: "https://example.com/archive",
        robotsDirective: "index,follow",
        revisionNote: "Complete archive update",
      },
      actor,
      locals,
    );
    expect(result).toMatchObject({ ok: true });
    const route = await getRuntimeArchiveRoute("/full-archive", locals);
    expect(route?.summary).toBe("All posts");
    expect(route?.seoTitle).toBe("Archive SEO Title");
    expect(route?.canonicalUrlOverride).toBe("https://example.com/archive");
  });

  it("saves without optional fields and reads back with undefined for omitted values", async () => {
    seedArchiveRoute(db, "/minimal-archive");
    const result = await saveRuntimeArchiveRoute("/minimal-archive", { title: "Minimal" }, actor, locals);
    expect(result).toMatchObject({ ok: true });
    const route = await getRuntimeArchiveRoute("/minimal-archive", locals);
    expect(route?.summary).toBeUndefined();
    expect(route?.robotsDirective).toBeUndefined();
  });

  it("returns not-ok when locals are null and no local registry is available", async () => {
    const result = await saveRuntimeArchiveRoute("/blog", { title: "T" }, actor, null);
    expect(result).toMatchObject({ ok: false });
  });

  it("delegates to local registry when locals=null and local registry is available", async () => {
    mockLoadLocalCmsRegistry.mockResolvedValueOnce(mockLocalRegistry);
    const result = await saveRuntimeArchiveRoute("/blog", { title: "T" }, actor, null);
    expect(result).toMatchObject({ ok: true });
  });
});
