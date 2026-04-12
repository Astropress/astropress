import { DatabaseSync } from "node:sqlite";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { registerCms } from "../src/config";
import { makeLocals } from "./helpers/make-locals.js";
import { makeDb, STANDARD_ACTOR, STANDARD_CMS_CONFIG } from "./helpers/make-db.js";
import {
  createRuntimeContentRecord,
  restoreRuntimeRevision,
  saveRuntimeContentState,
} from "../src/runtime-actions-content";

const actor = STANDARD_ACTOR;

let db: DatabaseSync;
let locals: App.Locals;

beforeEach(() => {
  db = makeDb();
  locals = makeLocals(db);
  registerCms(STANDARD_CMS_CONFIG);

  db.prepare(
    `INSERT INTO content_entries (slug, legacy_url, title, kind, template_key, source_html_path, body, summary, seo_title, meta_description)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  ).run("hello-world", "/hello-world", "Hello World", "post", "content", "runtime://content/hello-world", "<p>Body</p>", "Summary", "Hello SEO", "Hello meta");
  db.prepare(
    `INSERT INTO content_overrides (slug, title, status, body, seo_title, meta_description, updated_by)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
  ).run("hello-world", "Hello World", "published", "<p>Body</p>", "Hello SEO", "Hello meta", "admin@test.local");
  db.prepare(
    `INSERT INTO content_revisions (id, slug, source, title, status, body, seo_title, meta_description, created_by)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  ).run("rev-1", "hello-world", "reviewed", "Hello World", "published", "<p>Body</p>", "Hello SEO", "Hello meta", "admin@test.local");
});

describe("saveRuntimeContentState", () => {
  it("updates override and creates a revision", async () => {
    const result = await saveRuntimeContentState(
      "hello-world",
      { title: "Updated", status: "published", seoTitle: "SEO Updated", metaDescription: "Meta updated" },
      actor,
      locals,
    );
    expect(result).toMatchObject({ ok: true });
    const override = db.prepare("SELECT title FROM content_overrides WHERE slug = 'hello-world'").get() as { title: string };
    expect(override.title).toBe("Updated");
    const revCount = (db.prepare("SELECT COUNT(*) as n FROM content_revisions WHERE slug = 'hello-world'").get() as { n: number }).n;
    expect(revCount).toBeGreaterThanOrEqual(2);
  });

  it("normalises draft status", async () => {
    const result = await saveRuntimeContentState(
      "hello-world",
      { title: "Draft", status: "draft", seoTitle: "SEO", metaDescription: "Meta" },
      actor,
      locals,
    );
    expect(result).toMatchObject({ ok: true });
    const override = db.prepare("SELECT status FROM content_overrides WHERE slug = 'hello-world'").get() as { status: string };
    expect(override.status).toBe("draft");
  });

  it("returns not-ok for missing required fields", async () => {
    const result = await saveRuntimeContentState(
      "hello-world",
      { title: "", status: "published", seoTitle: "X", metaDescription: "X" },
      actor,
      locals,
    );
    expect(result).toMatchObject({ ok: false });
  });

  it("returns not-ok for unknown slug", async () => {
    const result = await saveRuntimeContentState(
      "no-such-slug",
      { title: "X", status: "published", seoTitle: "X", metaDescription: "X" },
      actor,
      locals,
    );
    expect(result).toMatchObject({ ok: false });
  });

  it("returns conflict error when lastKnownUpdatedAt does not match stored updated_at", async () => {
    // First, save once to establish an updated_at
    await saveRuntimeContentState(
      "hello-world",
      { title: "First save", status: "published", seoTitle: "SEO", metaDescription: "Meta" },
      actor,
      locals,
    );
    // Now simulate a second editor submitting with a stale timestamp
    const result = await saveRuntimeContentState(
      "hello-world",
      { title: "Conflict save", status: "published", seoTitle: "SEO", metaDescription: "Meta", lastKnownUpdatedAt: "2000-01-01 00:00:00" },
      actor,
      locals,
    );
    expect(result).toMatchObject({ ok: false, conflict: true });
    expect((result as { error: string }).error).toMatch(/modified by another editor/);
  });

  it("succeeds when lastKnownUpdatedAt matches stored updated_at", async () => {
    const currentOverride = db.prepare("SELECT updated_at FROM content_overrides WHERE slug = 'hello-world'").get() as { updated_at: string };
    const result = await saveRuntimeContentState(
      "hello-world",
      { title: "Matching save", status: "published", seoTitle: "SEO", metaDescription: "Meta", lastKnownUpdatedAt: currentOverride.updated_at },
      actor,
      locals,
    );
    expect(result).toMatchObject({ ok: true });
  });

  it("rejects save when a required content type field is missing from metadata", async () => {
    registerCms({
      templateKeys: ["content"],
      siteUrl: "https://example.com",
      seedPages: [],
      archives: [],
      translationStatus: [],
      contentTypes: [
        {
          key: "content",
          label: "Content",
          fields: [
            { name: "subtitle", label: "Subtitle", type: "text", required: true },
          ],
        },
      ],
    });
    const result = await saveRuntimeContentState(
      "hello-world",
      { title: "Missing field", status: "published", seoTitle: "SEO", metaDescription: "Meta", metadata: {} },
      actor,
      locals,
    );
    expect(result).toMatchObject({ ok: false });
    expect((result as { error: string }).error).toMatch(/Subtitle.*required/);
  });

  it("accepts save when content type metadata passes field validation", async () => {
    registerCms({
      templateKeys: ["content"],
      siteUrl: "https://example.com",
      seedPages: [],
      archives: [],
      translationStatus: [],
      contentTypes: [
        {
          key: "content",
          label: "Content",
          fields: [
            { name: "subtitle", label: "Subtitle", type: "text", required: true },
          ],
        },
      ],
    });
    const result = await saveRuntimeContentState(
      "hello-world",
      { title: "Valid field", status: "published", seoTitle: "SEO", metaDescription: "Meta", metadata: { subtitle: "My Subtitle" } },
      actor,
      locals,
    );
    expect(result).toMatchObject({ ok: true });
    const saved = db.prepare("SELECT metadata FROM content_overrides WHERE slug = 'hello-world'").get() as { metadata: string };
    expect(JSON.parse(saved.metadata)).toMatchObject({ subtitle: "My Subtitle" });
  });

  it("rejects save when a custom validate function returns an error string", async () => {
    registerCms({
      templateKeys: ["content"],
      siteUrl: "https://example.com",
      seedPages: [],
      archives: [],
      translationStatus: [],
      contentTypes: [
        {
          key: "content",
          label: "Content",
          fields: [
            {
              name: "capacity",
              label: "Max Capacity",
              type: "number",
              validate: (v) => Number(v) > 0 || "Capacity must be a positive number",
            },
          ],
        },
      ],
    });
    const result = await saveRuntimeContentState(
      "hello-world",
      { title: "Bad capacity", status: "published", seoTitle: "SEO", metaDescription: "Meta", metadata: { capacity: -5 } },
      actor,
      locals,
    );
    expect(result).toMatchObject({ ok: false });
    expect((result as { error: string }).error).toContain("Capacity must be a positive number");
  });

  it("saves with all optional fields populated", async () => {
    const result = await saveRuntimeContentState(
      "hello-world",
      {
        title: "Full Save",
        status: "draft",
        body: "<p>Rich body</p>",
        scheduledAt: "2026-06-01T12:00:00.000Z",
        revisionNote: "test revision",
        seoTitle: "SEO Full",
        metaDescription: "Meta full",
        excerpt: "Short excerpt",
        ogTitle: "OG Title",
        ogDescription: "OG Desc",
        ogImage: "https://example.com/img.jpg",
        canonicalUrlOverride: "https://example.com/canonical",
        robotsDirective: "noindex",
      },
      actor,
      locals,
    );
    expect(result).toMatchObject({ ok: true });
  });

  it("saves author/category/tag assignments", async () => {
    const { lastInsertRowid: authorId } = db.prepare("INSERT INTO authors (name, slug) VALUES (?, ?)").run("Author A", "author-a");
    const { lastInsertRowid: catId } = db.prepare("INSERT INTO categories (name, slug) VALUES (?, ?)").run("Cat A", "cat-a");
    const { lastInsertRowid: tagId } = db.prepare("INSERT INTO tags (name, slug) VALUES (?, ?)").run("Tag A", "tag-a");

    const result = await saveRuntimeContentState(
      "hello-world",
      {
        title: "With Assignments",
        status: "published",
        seoTitle: "SEO",
        metaDescription: "Meta",
        authorIds: [Number(authorId)],
        categoryIds: [Number(catId)],
        tagIds: [Number(tagId)],
      },
      actor,
      locals,
    );
    expect(result).toMatchObject({ ok: true });
    const authorRow = db.prepare("SELECT author_id FROM content_authors WHERE slug = 'hello-world'").get() as { author_id: number } | undefined;
    expect(authorRow?.author_id).toBe(Number(authorId));
  });
});

describe("createRuntimeContentRecord", () => {
  it("creates a new content entry with override and revision", async () => {
    const result = await createRuntimeContentRecord(
      { title: "New Post", slug: "new-post", status: "draft", seoTitle: "SEO", metaDescription: "Meta" },
      actor,
      locals,
    );
    expect(result).toMatchObject({ ok: true });
    const entry = db.prepare("SELECT slug FROM content_entries WHERE slug = 'new-post'").get() as { slug: string } | undefined;
    expect(entry?.slug).toBe("new-post");
  });

  it("slugifies the slug input", async () => {
    const result = await createRuntimeContentRecord(
      { title: "My Post", slug: "My Post Title!", status: "published", seoTitle: "SEO", metaDescription: "Meta" },
      actor,
      locals,
    );
    expect(result).toMatchObject({ ok: true });
    expect((result as { state: { slug: string } }).state.slug).toBe("my-post-title");
  });

  it("returns not-ok for missing required fields", async () => {
    const result = await createRuntimeContentRecord(
      { title: "", slug: "empty-title", status: "published", seoTitle: "SEO", metaDescription: "Meta" },
      actor,
      locals,
    );
    expect(result).toMatchObject({ ok: false });
  });

  it("returns not-ok for duplicate slug", async () => {
    const result = await createRuntimeContentRecord(
      { title: "Duplicate", slug: "hello-world", status: "draft", seoTitle: "SEO", metaDescription: "Meta" },
      actor,
      locals,
    );
    expect(result).toMatchObject({ ok: false });
  });

  it("normalises legacyUrl by prepending slash when missing", async () => {
    const result = await createRuntimeContentRecord(
      { title: "No Slash", slug: "no-slash-url", legacyUrl: "no-slash-url", status: "draft", seoTitle: "SEO", metaDescription: "Meta" },
      actor,
      locals,
    );
    expect(result).toMatchObject({ ok: true });
    expect((result as { state: { legacyUrl: string } }).state.legacyUrl).toBe("/no-slash-url");
  });

  it("falls back to title when seoTitle is empty", async () => {
    const result = await createRuntimeContentRecord(
      { title: "Fallback Title", slug: "fallback-seo", status: "draft", seoTitle: "  ", metaDescription: "Meta" },
      actor,
      locals,
    );
    expect(result).toMatchObject({ ok: true });
  });

  it("creates with all optional fields populated", async () => {
    const result = await createRuntimeContentRecord(
      {
        title: "Full Record",
        slug: "full-record",
        legacyUrl: "/full-record",
        status: "published",
        body: "<p>Body</p>",
        summary: "Summary text",
        seoTitle: "SEO",
        metaDescription: "Meta",
        excerpt: "Short",
        ogTitle: "OG Title",
        ogDescription: "OG Desc",
        ogImage: "https://example.com/img.jpg",
        canonicalUrlOverride: "https://example.com/canonical",
        robotsDirective: "noindex",
      },
      actor,
      locals,
    );
    expect(result).toMatchObject({ ok: true });
  });
});

describe("restoreRuntimeRevision", () => {
  it("restores an existing revision into the override", async () => {
    const result = await restoreRuntimeRevision("hello-world", "rev-1", actor, locals);
    expect(result).toMatchObject({ ok: true });
  });

  it("returns not-ok for unknown revision id", async () => {
    const result = await restoreRuntimeRevision("hello-world", "rev-ghost", actor, locals);
    expect(result).toMatchObject({ ok: false });
  });

  it("returns not-ok for unknown slug", async () => {
    const result = await restoreRuntimeRevision("no-such-slug", "rev-1", actor, locals);
    expect(result).toMatchObject({ ok: false });
  });
});

describe("purgeCdnCache", () => {
  it("is a no-op and resolves successfully when no cdnPurgeWebhook is configured", async () => {
    const { purgeCdnCache } = await import("../src/cache-purge");
    registerCms({
      templateKeys: ["home"],
      siteUrl: "https://example.com",
      seedPages: [],
      archives: [],
      translationStatus: [],
    });
    // Should resolve without throwing (no webhook configured, no CF env vars)
    await expect(purgeCdnCache("my-slug", { siteUrl: "https://example.com", templateKeys: ["home"], seedPages: [], archives: [], translationStatus: [] })).resolves.toBeUndefined();
  });

  it("POSTs to cdnPurgeWebhook with slug and purgedAt when configured", async () => {
    const { purgeCdnCache } = await import("../src/cache-purge");
    const requests: { url: string; body: unknown }[] = [];
    vi.stubGlobal("fetch", async (url: string, init: RequestInit) => {
      requests.push({ url, body: JSON.parse(init.body as string) });
      return new Response(null, { status: 200 });
    });

    await purgeCdnCache("test-slug", {
      siteUrl: "https://example.com",
      templateKeys: ["home"],
      seedPages: [],
      archives: [],
      translationStatus: [],
      cdnPurgeWebhook: "https://hooks.example.com/purge",
    });

    vi.unstubAllGlobals();
    expect(requests).toHaveLength(1);
    expect(requests[0].url).toBe("https://hooks.example.com/purge");
    expect((requests[0].body as Record<string, unknown>).slug).toBe("test-slug");
    expect(typeof (requests[0].body as Record<string, unknown>).purgedAt).toBe("string");
  });

  it("does not throw when the webhook returns a non-200 status", async () => {
    const { purgeCdnCache } = await import("../src/cache-purge");
    vi.stubGlobal("fetch", async () => new Response("Server Error", { status: 500 }));

    await expect(
      purgeCdnCache("test-slug", {
        siteUrl: "https://example.com",
        templateKeys: ["home"],
        seedPages: [],
        archives: [],
        translationStatus: [],
        cdnPurgeWebhook: "https://hooks.example.com/purge",
      }),
    ).resolves.toBeUndefined();

    vi.unstubAllGlobals();
  });
});
