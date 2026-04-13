import type { DatabaseSync } from "node:sqlite";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createAstropressSqliteAdminRuntime } from "../src/sqlite-admin-runtime.js";
import { createRuntimeFixture, makePasswordHash, type RuntimeFixture } from "./helpers/sqlite-admin-runtime-fixture.js";
import { makeDb } from "./helpers/make-db.js";

let fixture: RuntimeFixture;

beforeAll(() => {
  fixture = createRuntimeFixture();
});

afterAll(() => {
  fixture.db.close();
});

// ─── Media helpers ────────────────────────────────────────────────────────────

/** Minimal 1-pixel transparent PNG (67 bytes) */
function makePngBytes(): Buffer {
  return Buffer.from(
    "89504e470d0a1a0a0000000d49484452000000010000000108060000001f15c489000000" +
    "0a49444154789c6260000000000200010e0221630000000049454e44ae426082",
    "hex",
  );
}

// ─── Media ────────────────────────────────────────────────────────────────────

describe("media", () => {
  it("listMediaAssets returns empty initially", () => {
    expect(fixture.store.media.listMediaAssets()).toBeInstanceOf(Array);
  });

  it("updateMediaAsset returns error for empty id (empty-id branch)", () => {
    const result = fixture.store.media.updateMediaAsset({ id: "  " }, fixture.actor);
    expect(result.ok).toBe(false);
    expect(result.error).toMatch(/id is required/i);
  });

  it("updateMediaAsset returns error for non-existent asset (not-found branch)", () => {
    const result = fixture.store.media.updateMediaAsset({ id: "does-not-exist", title: "New Title" }, fixture.actor);
    expect(result.ok).toBe(false);
    expect(result.error).toMatch(/could not be updated/i);
  });

  it("updateMediaAsset succeeds for an existing asset (success branch)", () => {
    fixture.db.prepare(
      `INSERT INTO media_assets (id, local_path, mime_type, file_size, alt_text, title, uploaded_by) VALUES (?, ?, ?, ?, ?, ?, ?)`,
    ).run("media-test-1", "/uploads/img.png", "image/png", 1024, "old alt", "Old Title", "seed");

    const result = fixture.store.media.updateMediaAsset({ id: "media-test-1", title: "New Title", altText: "new alt" }, fixture.actor);
    expect(result.ok).toBe(true);
    const asset = fixture.store.media.listMediaAssets().find((a) => a.id === "media-test-1");
    expect(asset?.title).toBe("New Title");
    expect(asset?.altText).toBe("new alt");
  });

  it("createMediaAsset: empty filename returns error (buildLocalMediaDescriptor !filename branch)", () => {
    const result = fixture.store.media.createMediaAsset({ filename: "", bytes: makePngBytes() }, fixture.actor);
    expect(result.ok).toBe(false);
    expect(result.error).toMatch(/select a file/i);
  });

  it("createMediaAsset: zero-byte file returns error (byteLength === 0 branch)", () => {
    const result = fixture.store.media.createMediaAsset({ filename: "empty.png", bytes: Buffer.alloc(0) }, fixture.actor);
    expect(result.ok).toBe(false);
    expect(result.error).toMatch(/select a file/i);
  });

  it("createMediaAsset: file too large returns error (> maxUploadBytes branch)", () => {
    const result = fixture.store.media.createMediaAsset({ filename: "big.png", bytes: Buffer.alloc(11 * 1024 * 1024) }, fixture.actor);
    expect(result.ok).toBe(false);
    expect(result.error).toMatch(/10 MB/i);
  });

  it("createMediaAsset: invalid extension returns error (!allowedExtensions branch)", () => {
    const result = fixture.store.media.createMediaAsset({ filename: "script.exe", bytes: makePngBytes() }, fixture.actor);
    expect(result.ok).toBe(false);
    expect(result.error).toMatch(/not allowed/i);
  });

  it("createMediaAsset: .png file succeeds (covers guessImageMimeType png branch, insertStoredMediaAsset, recordMediaAudit)", () => {
    const result = fixture.store.media.createMediaAsset({ filename: "photo.png", bytes: makePngBytes(), title: "Test Photo", altText: "A photo" }, fixture.actor);
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error("unreachable");
    expect(fixture.store.media.listMediaAssets().some((a) => a.id === result.id)).toBe(true);
  });

  it("createMediaAsset: .jpg file succeeds (covers guessImageMimeType jpeg fallback branch)", () => {
    expect(fixture.store.media.createMediaAsset({ filename: "photo.jpg", bytes: makePngBytes() }, fixture.actor).ok).toBe(true);
  });

  it("createMediaAsset: .svg file succeeds — no mimeType forces guessImageMimeType svg branch", () => {
    const svgBytes = Buffer.from("<svg xmlns='http://www.w3.org/2000/svg'><rect/></svg>");
    expect(fixture.store.media.createMediaAsset({ filename: "icon.svg", bytes: svgBytes }, fixture.actor).ok).toBe(true);
  });

  it("createMediaAsset: .webp file succeeds — no mimeType forces guessImageMimeType webp branch", () => {
    expect(fixture.store.media.createMediaAsset({ filename: "img.webp", bytes: makePngBytes() }, fixture.actor).ok).toBe(true);
  });

  it("createMediaAsset: .gif file succeeds — no mimeType forces guessImageMimeType gif branch", () => {
    const gifBytes = Buffer.from("47494638396101000100800000ffffff00000021f90400000000002c00000000010001000002024401003b", "hex");
    expect(fixture.store.media.createMediaAsset({ filename: "anim.gif", bytes: gifBytes }, fixture.actor).ok).toBe(true);
  });

  it("createMediaAsset: .avif file succeeds — no mimeType forces guessImageMimeType avif branch", () => {
    expect(fixture.store.media.createMediaAsset({ filename: "img.avif", bytes: makePngBytes() }, fixture.actor).ok).toBe(true);
  });

  it("createMediaAsset: .jpeg file succeeds (covers jpeg extension alias)", () => {
    expect(fixture.store.media.createMediaAsset({ filename: "photo.jpeg", bytes: makePngBytes() }, fixture.actor).ok).toBe(true);
  });

  it("createMediaAsset: explicit mimeType provided (covers guessedMime = mimeType branch)", () => {
    expect(fixture.store.media.createMediaAsset({ filename: "explicit.png", bytes: makePngBytes(), mimeType: "image/png" }, fixture.actor).ok).toBe(true);
  });

  it("createMediaAsset: invalid explicit mimeType with valid extension returns error", () => {
    const result = fixture.store.media.createMediaAsset({ filename: "bad-mime.png", bytes: makePngBytes(), mimeType: "application/octet-stream" }, fixture.actor);
    expect(result.ok).toBe(false);
    expect(result.error).toMatch(/not allowed/i);
  });

  it("createMediaAsset: filename with no extension (covers .bin fallback branch)", () => {
    const result = fixture.store.media.createMediaAsset({ filename: "noextension", bytes: makePngBytes() }, fixture.actor);
    expect(result.ok).toBe(false);
    expect(result.error).toMatch(/not allowed/i);
  });

  it("createMediaAsset: filename with special-chars-only base uses 'upload' as the base name", () => {
    expect(fixture.store.media.createMediaAsset({ filename: "----.png", bytes: makePngBytes() }, fixture.actor).ok).toBe(true);
  });

  it("deleteMediaAsset: empty id returns error", () => {
    const result = fixture.store.media.deleteMediaAsset("  ", fixture.actor);
    expect(result.ok).toBe(false);
    expect(result.error).toMatch(/id is required/i);
  });

  it("deleteMediaAsset: non-existent asset returns error", () => {
    const result = fixture.store.media.deleteMediaAsset("does-not-exist", fixture.actor);
    expect(result.ok).toBe(false);
    expect(result.error).toMatch(/could not be deleted/i);
  });

  it("deleteMediaAsset: /images/uploads/ path deleted via createMediaAsset flow (covers markStoredMediaDeleted, recordMediaAudit, deleteLocalMediaUpload)", () => {
    const created = fixture.store.media.createMediaAsset({ filename: "to-delete.png", bytes: makePngBytes() }, fixture.actor);
    expect(created.ok).toBe(true);
    if (!created.ok) throw new Error("unreachable");
    const result = fixture.store.media.deleteMediaAsset(created.id, fixture.actor);
    expect(result.ok).toBe(true);
    expect(fixture.store.media.listMediaAssets().some((a) => a.id === created.id)).toBe(false);
  });

  it("deleteMediaAsset: non-uploads local_path skips file deletion (deleteLocalMediaUpload !startsWith branch)", () => {
    fixture.db.prepare(
      `INSERT INTO media_assets (id, local_path, mime_type, file_size, alt_text, title, uploaded_by) VALUES (?, ?, ?, ?, ?, ?, ?)`,
    ).run("media-other-path", "/some/other/path.png", "image/png", 512, "", "Other Path", "seed");
    expect(fixture.store.media.deleteMediaAsset("media-other-path", fixture.actor).ok).toBe(true);
  });

  it("getLocalImageRoot uses ASTROPRESS_LOCAL_IMAGE_ROOT env var (branch 1)", () => {
    const prev = process.env.ASTROPRESS_LOCAL_IMAGE_ROOT;
    process.env.ASTROPRESS_LOCAL_IMAGE_ROOT = "/tmp/test-astropress-uploads";
    try {
      const testDb = makeDb();
      testDb.prepare("INSERT INTO admin_users (email, password_hash, role, name, active) VALUES (?, ?, ?, ?, 1)").run(
        "env@test.local", makePasswordHash("password"), "admin", "Env Test",
      );
      const rt = createAstropressSqliteAdminRuntime({ getDatabase: () => testDb });
      expect(rt.sqliteAdminStore.media.createMediaAsset({ filename: "env-test.png", bytes: makePngBytes() }, fixture.actor).ok).toBe(true);
      testDb.close();
    } finally {
      if (prev === undefined) delete process.env.ASTROPRESS_LOCAL_IMAGE_ROOT;
      else process.env.ASTROPRESS_LOCAL_IMAGE_ROOT = prev;
    }
  });
});

// ─── CMS routes ───────────────────────────────────────────────────────────────

describe("CMS routes", () => {
  describe("system routes", () => {
    it("listSystemRoutes returns seeded routes with null settings_json (parseSystemSettings null branch)", () => {
      expect(fixture.registry.listSystemRoutes().some((r) => r.path === "/sitemap.xml" && r.settings === null)).toBe(true);
    });

    it("listSystemRoutes handles malformed settings_json (parseSystemSettings catch branch)", () => {
      expect(fixture.registry.listSystemRoutes().some((r) => r.path === "/robots.txt" && r.settings === null)).toBe(true);
    });

    it("getSystemRoute with already-normalized path (normalizeSystemRoutePath branch 2)", () => {
      expect(fixture.registry.getSystemRoute("/sitemap.xml")?.path).toBe("/sitemap.xml");
    });

    it("getSystemRoute with un-prefixed path (normalizeSystemRoutePath branch 3)", () => {
      expect(fixture.registry.getSystemRoute("sitemap.xml")?.path).toBe("/sitemap.xml");
    });

    it("getSystemRoute returns null for unknown path", () => {
      expect(fixture.registry.getSystemRoute("/does-not-exist")).toBeNull();
    });

    it("saveSystemRoute: non-es path exercises localeFromPath 'en' branch", () => {
      expect(fixture.registry.saveSystemRoute("/sitemap.xml", { title: "Updated Sitemap", summary: "All pages" }, fixture.actor).ok).toBe(true);
    });

    it("saveSystemRoute: /es/ path exercises localeFromPath 'es' branch", () => {
      expect(fixture.registry.saveSystemRoute("/es/feed.xml", { title: "ES Feed Updated" }, fixture.actor).ok).toBe(true);
    });

    it("saveSystemRoute returns error for empty path", () => {
      expect(fixture.registry.saveSystemRoute("", { title: "X" }, fixture.actor).ok).toBe(false);
    });

    it("saveSystemRoute returns error for non-existent path", () => {
      expect(fixture.registry.saveSystemRoute("/does-not-exist.xml", { title: "X" }, fixture.actor).ok).toBe(false);
    });
  });

  describe("structured page routes", () => {
    it("listStructuredPageRoutes filters out routes with non-string templateKey (normalizeStructuredTemplateKey branch 1)", () => {
      expect(fixture.registry.listStructuredPageRoutes().every((r) => r.path !== "/numeric-key")).toBe(true);
    });

    it("listStructuredPageRoutes filters out routes where getCmsConfig throws (normalizeStructuredTemplateKey catch branch)", () => {
      expect(fixture.registry.listStructuredPageRoutes().every((r) => r.path !== "/string-key")).toBe(true);
    });

    it("getStructuredPageRoute returns null for unknown path", () => {
      expect(fixture.registry.getStructuredPageRoute("/not-a-page")).toBeNull();
    });

    it("createStructuredPageRoute inserts route rows (exercises insertStructuredRoute with sections)", () => {
      fixture.registry.createStructuredPageRoute(
        "/new-page",
        { title: "New Page", templateKey: "hero", metaDescription: "A new page", sections: { hero: "content" } },
        fixture.actor,
      );
      expect(fixture.db.prepare("SELECT id FROM cms_route_groups WHERE canonical_path = '/new-page'").get()).not.toBeNull();
    });

    it("createStructuredPageRoute with no sections (insertStructuredRoute sections=null branch)", () => {
      fixture.registry.createStructuredPageRoute("/no-sections-page", { title: "No Sections", templateKey: "hero" }, fixture.actor);
      expect(fixture.db.prepare("SELECT id FROM cms_route_groups WHERE canonical_path = '/no-sections-page'").get()).not.toBeNull();
    });

    it("createStructuredPageRoute returns error for path already in use", () => {
      fixture.registry.createStructuredPageRoute("/dup-page", { title: "Dup", templateKey: "hero" }, fixture.actor);
      expect(fixture.registry.createStructuredPageRoute("/dup-page", { title: "Dup Again", templateKey: "hero" }, fixture.actor).ok).toBe(false);
    });

    it("saveStructuredPageRoute exercises persistStructuredRoute and appendStructuredRouteRevision", () => {
      const result = fixture.registry.saveStructuredPageRoute(
        "/numeric-key",
        { title: "Numeric Key Updated", templateKey: "hero", sections: { hero: "updated" } },
        fixture.actor,
      );
      expect(result.ok).toBeDefined();
    });

    it("saveStructuredPageRoute returns error for non-existent route", () => {
      expect(fixture.registry.saveStructuredPageRoute("/not-a-page", { title: "X", templateKey: "hero" }, fixture.actor).ok).toBe(false);
    });
  });

  describe("archive routes", () => {
    it("listArchiveRoutes returns seeded archive routes", () => {
      expect(fixture.registry.listArchiveRoutes().some((r) => r.path === "/blog")).toBe(true);
    });

    it("getArchiveRoute returns the route", () => {
      expect(fixture.registry.getArchiveRoute("/blog")?.path).toBe("/blog");
    });

    it("getArchiveRoute returns null for unknown path", () => {
      expect(fixture.registry.getArchiveRoute("/unknown-archive")).toBeNull();
    });

    it("saveArchiveRoute updates the seeded /blog archive route", () => {
      expect(fixture.registry.saveArchiveRoute("/blog", { title: "Blog Archive Updated", summary: "All blog posts" }, fixture.actor).ok).toBe(true);
    });

    it("saveArchiveRoute returns error for non-existent path", () => {
      expect(fixture.registry.saveArchiveRoute("/not-an-archive", { title: "X" }, fixture.actor).ok).toBe(false);
    });
  });
});

// ─── CMS route error guards (factory validation branches) ─────────────────────

describe("CMS route factory error guards", () => {
  it("saveSystemRoute: empty title returns error", () => {
    expect(fixture.registry.saveSystemRoute("/sitemap.xml", { title: "" }, fixture.actor).ok).toBe(false);
  });

  it("saveSystemRoute: all optional fields provided (covers bodyHtml, settings branches)", () => {
    expect(fixture.registry.saveSystemRoute(
      "/sitemap.xml",
      { title: "Sitemap Full", summary: "Full summary", bodyHtml: "<p>Body</p>", settings: { crawl: true }, revisionNote: "Full update" },
      fixture.actor,
    ).ok).toBe(true);
  });

  it("createStructuredPageRoute: empty path returns error", () => {
    expect(fixture.registry.createStructuredPageRoute("/", { title: "Root", templateKey: "hero" }, fixture.actor).ok).toBe(false);
    expect(fixture.registry.createStructuredPageRoute("", { title: "Empty", templateKey: "hero" }, fixture.actor).ok).toBe(false);
  });

  it("createStructuredPageRoute: empty title returns error", () => {
    expect(fixture.registry.createStructuredPageRoute("/no-title-page", { title: "", templateKey: "hero" }, fixture.actor).ok).toBe(false);
  });

  it("createStructuredPageRoute: all optional fields provided", () => {
    fixture.registry.createStructuredPageRoute(
      "/full-options-page",
      {
        title: "Full Options",
        templateKey: "hero",
        summary: "A summary",
        seoTitle: "Full Options SEO",
        metaDescription: "Full meta",
        canonicalUrlOverride: "https://example.com/full",
        robotsDirective: "noindex",
        ogImage: "/img.png",
        alternateLinks: [{ locale: "es", path: "/es/full" }],
        sections: { hero: "content" },
        revisionNote: "Created with all options",
      },
      fixture.actor,
    );
  });

  it("saveStructuredPageRoute: empty title returns error", () => {
    expect(fixture.registry.saveStructuredPageRoute("/numeric-key", { title: "", templateKey: "hero" }, fixture.actor).ok).toBe(false);
  });

  it("saveStructuredPageRoute: all optional fields provided", () => {
    fixture.registry.saveStructuredPageRoute(
      "/numeric-key",
      {
        title: "Full Save",
        templateKey: "hero",
        summary: "Summary",
        seoTitle: "Full Save SEO",
        metaDescription: "Full meta",
        canonicalUrlOverride: "https://example.com/save",
        robotsDirective: "noindex",
        ogImage: "/img.png",
        alternateLinks: [{ locale: "es", path: "/es/save" }],
        sections: { hero: "updated" },
        revisionNote: "Saved with all options",
      },
      fixture.actor,
    );
  });

  it("saveArchiveRoute: empty title returns error", () => {
    expect(fixture.registry.saveArchiveRoute("/blog", { title: "" }, fixture.actor).ok).toBe(false);
  });

  it("saveArchiveRoute: all optional fields provided", () => {
    expect(fixture.registry.saveArchiveRoute(
      "/blog",
      { title: "Blog Full", summary: "Summary", seoTitle: "Blog SEO", metaDescription: "Blog meta", canonicalUrlOverride: "https://example.com/blog", robotsDirective: "noindex", revisionNote: "Full archive update" },
      fixture.actor,
    ).ok).toBe(true);
  });
});

// ─── Additional route branches ────────────────────────────────────────────────

describe("additional route branches", () => {
  it("saveStructuredPageRoute: stores null sections when sections are omitted", () => {
    fixture.registry.saveStructuredPageRoute("/numeric-key", { title: "No Sections Save", templateKey: "hero" }, fixture.actor);
  });

  it("saveArchiveRoute: saves with null values for omitted optional fields", () => {
    expect(fixture.registry.saveArchiveRoute("/blog", { title: "Minimal Archive Save" }, fixture.actor).ok).toBe(true);
  });
});

// ─── CMS config registered: normalizeStructuredTemplateKey success paths ──────

describe("CMS config registered: structured template key branches", () => {
  let cmsStore: RuntimeFixture["store"];
  let cmsRegistry: RuntimeFixture["registry"];
  let cmsDb: DatabaseSync;

  beforeAll(() => {
    (globalThis as Record<symbol, unknown>)[Symbol.for("astropress.cms-config")] = {
      templateKeys: ["hero", "blog"],
      seedPages: [],
    };

    cmsDb = makeDb();
    cmsDb.prepare("INSERT INTO admin_users (email, password_hash, role, name, active) VALUES (?, ?, ?, ?, 1)").run(
      "cms@test.local", makePasswordHash("password"), "admin", "CMS Test",
    );

    cmsDb.prepare("INSERT INTO cms_route_groups (id, kind, render_strategy, canonical_locale, canonical_path) VALUES (?, ?, ?, ?, ?)").run(
      "group-hero-page", "page", "structured_sections", "en", "/hero-page",
    );
    cmsDb.prepare("INSERT INTO cms_route_variants (id, group_id, locale, path, status, title, sections_json, settings_json, updated_by) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)").run(
      "variant-hero-page", "group-hero-page", "en", "/hero-page", "published", "Hero Page",
      '{"hero":"content"}', '{"templateKey":"hero","alternateLinks":[]}', "seed",
    );
    cmsDb.prepare("INSERT INTO cms_route_groups (id, kind, render_strategy, canonical_locale, canonical_path) VALUES (?, ?, ?, ?, ?)").run(
      "group-full-page", "page", "structured_sections", "en", "/full-page",
    );
    cmsDb.prepare("INSERT INTO cms_route_variants (id, group_id, locale, path, status, title, summary, seo_title, meta_description, og_image, settings_json, sections_json, updated_by) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)").run(
      "variant-full-page", "group-full-page", "en", "/full-page", "published", "Full Page",
      "Page summary", "Full Page SEO", "Full page meta", "/img.png",
      '{"templateKey":"hero","alternateLinks":[{"locale":"es","path":"/es/full"}]}', '{"hero":"full content"}', "seed",
    );
    cmsDb.prepare("INSERT INTO cms_route_groups (id, kind, render_strategy, canonical_locale, canonical_path) VALUES (?, ?, ?, ?, ?)").run(
      "group-rich-archive", "archive", "archive_listing", "en", "/rich-blog",
    );
    cmsDb.prepare("INSERT INTO cms_route_variants (id, group_id, locale, path, status, title, summary, seo_title, meta_description, updated_by) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)").run(
      "variant-rich-archive", "group-rich-archive", "en", "/rich-blog", "published", "Rich Blog", "Blog summary", "Rich Blog SEO", "Blog meta", "seed",
    );
    cmsDb.prepare("INSERT INTO cms_route_groups (id, kind, render_strategy, canonical_locale, canonical_path) VALUES (?, ?, ?, ?, ?)").run(
      "group-rich-sitemap", "system", "generated_xml", "en", "/rich-sitemap.xml",
    );
    cmsDb.prepare("INSERT INTO cms_route_variants (id, group_id, locale, path, status, title, summary, body_html, settings_json, updated_by) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)").run(
      "variant-rich-sitemap", "group-rich-sitemap", "en", "/rich-sitemap.xml", "published", "Rich Sitemap", "A summary", "<p>Body</p>", '{"crawl":true}', "seed",
    );

    const cmsRuntime = createAstropressSqliteAdminRuntime({ getDatabase: () => cmsDb });
    cmsStore = cmsRuntime.sqliteAdminStore;
    cmsRegistry = cmsRuntime.sqliteCmsRegistryModule;
  });

  afterAll(() => {
    delete (globalThis as Record<symbol, unknown>)[Symbol.for("astropress.cms-config")];
    cmsDb.close();
  });

  it("getCmsConfig success path: normalizeStructuredTemplateKey returns known key (branch includes=true)", () => {
    expect(cmsRegistry.listStructuredPageRoutes().some((r) => r.path === "/hero-page")).toBe(true);
  });

  it("normalizeStructuredTemplateKey returns null for unknown templateKey (branch includes=false)", () => {
    expect(fixture.registry.listStructuredPageRoutes().every((r) => r.path !== "/string-key")).toBe(true);
  });

  it("listStructuredPageRoutes returns routes with all optional fields populated", () => {
    const full = cmsRegistry.listStructuredPageRoutes().find((r) => r.path === "/full-page");
    expect(full?.summary).toBe("Page summary");
    expect(full?.seoTitle).toBe("Full Page SEO");
    expect(full?.metaDescription).toBe("Full page meta");
    expect(full?.ogImage).toBe("/img.png");
    expect(Array.isArray(full?.alternateLinks)).toBe(true);
    expect(full?.sections).not.toBeNull();
  });

  it("listSystemRoutes returns summary and body_html when populated", () => {
    const rich = cmsRegistry.listSystemRoutes().find((r) => r.path === "/rich-sitemap.xml");
    expect(rich?.summary).toBe("A summary");
    expect(rich?.settings).toMatchObject({ crawl: true });
  });

  it("listArchiveRoutes returns all optional fields when populated", () => {
    const rich = cmsRegistry.listArchiveRoutes().find((r) => r.path === "/rich-blog");
    expect(rich?.summary).toBe("Blog summary");
    expect(rich?.seoTitle).toBe("Rich Blog SEO");
    expect(rich?.metaDescription).toBe("Blog meta");
  });

  it("createStructuredPageRoute succeeds when cms config is available", () => {
    const result = cmsRegistry.createStructuredPageRoute(
      "/new-hero-page",
      { title: "New Hero Page", templateKey: "hero", sections: { hero: "hello" } },
      fixture.actor,
    );
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error("unreachable");
    expect(result.route.path).toBe("/new-hero-page");
  });

  it("createStructuredPageRoute: all optional fields with getCmsConfig working", () => {
    const result = cmsRegistry.createStructuredPageRoute(
      "/hero-full-options",
      {
        title: "Full Hero",
        templateKey: "hero",
        summary: "Summary",
        seoTitle: "Full Hero SEO",
        metaDescription: "Full meta",
        canonicalUrlOverride: "https://example.com/hero",
        robotsDirective: "noindex",
        ogImage: "/hero.png",
        alternateLinks: [{ locale: "es", path: "/es/hero" }],
        sections: { hero: "full" },
        revisionNote: "Full creation",
      },
      fixture.actor,
    );
    expect(result.ok).toBe(true);
  });
});
