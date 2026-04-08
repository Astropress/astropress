import { DatabaseSync } from "node:sqlite";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { registerCms } from "../src/config";
import { readAstropressSqliteSchemaSql } from "../src/sqlite-bootstrap.js";
import { SqliteBackedD1Database } from "./helpers/provider-test-fixtures.js";
import {
  consumeRuntimeInviteToken,
  consumeRuntimePasswordResetToken,
  createRuntimeAuthor,
  createRuntimeCategory,
  createRuntimeContentRecord,
  createRuntimeMediaAsset,
  createRuntimePasswordResetToken,
  createRuntimeRedirectRule,
  createRuntimeTag,
  deleteRuntimeAuthor,
  deleteRuntimeCategory,
  deleteRuntimeMediaAsset,
  deleteRuntimeRedirectRule,
  deleteRuntimeTag,
  getRuntimeInviteRequest,
  getRuntimePasswordResetRequest,
  inviteRuntimeAdminUser,
  moderateRuntimeComment,
  restoreRuntimeRevision,
  saveRuntimeContentState,
  saveRuntimeSettings,
  suspendRuntimeAdminUser,
  unsuspendRuntimeAdminUser,
  updateRuntimeAuthor,
  updateRuntimeCategory,
  updateRuntimeMediaAsset,
  updateRuntimeTag,
  updateRuntimeTranslationState,
} from "../src/runtime-admin-actions";

// ---------------------------------------------------------------------------
// Mock runtime media storage for media asset tests
// ---------------------------------------------------------------------------

const { mockStoreMedia, mockDeleteMedia } = vi.hoisted(() => ({
  mockStoreMedia: vi.fn(),
  mockDeleteMedia: vi.fn(),
}));

vi.mock("../src/runtime-media-storage", () => ({
  storeRuntimeMediaObject: mockStoreMedia,
  deleteRuntimeMediaObject: mockDeleteMedia,
}));

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeDb() {
  const db = new DatabaseSync(":memory:");
  db.exec(readAstropressSqliteSchemaSql());
  return db;
}

function makeLocals(db: DatabaseSync) {
  return {
    runtime: { env: { DB: new SqliteBackedD1Database(db) } },
  } as unknown as App.Locals;
}

const actor = { email: "admin@test.local", role: "admin" as const, name: "Test Admin" };
const editorActor = { email: "editor@test.local", role: "editor" as const, name: "Test Editor" };

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

  // Seed two admin users
  db.prepare(
    "INSERT INTO admin_users (email, password_hash, role, name, active) VALUES (?, ?, ?, ?, ?)",
  ).run("admin@test.local", "hash", "admin", "Test Admin", 1);
  db.prepare(
    "INSERT INTO admin_users (email, password_hash, role, name, active) VALUES (?, ?, ?, ?, ?)",
  ).run("editor@test.local", "hash", "editor", "Test Editor", 1);

  // Seed one content entry + override
  db.prepare(
    `INSERT INTO content_entries
     (slug, legacy_url, title, kind, template_key, source_html_path, body, summary, seo_title, meta_description)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  ).run("hello-world", "/hello-world", "Hello World", "post", "content", "runtime://content/hello-world",
    "<p>Body</p>", "A summary", "Hello SEO", "Hello meta");
  db.prepare(
    `INSERT INTO content_overrides
     (slug, title, status, body, seo_title, meta_description, updated_by)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
  ).run("hello-world", "Hello World", "published", "<p>Body</p>", "Hello SEO", "Hello meta", "admin@test.local");
  db.prepare(
    `INSERT INTO content_revisions
     (id, slug, source, title, status, body, seo_title, meta_description, created_by)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  ).run("rev-hello-1", "hello-world", "reviewed", "Hello World", "published",
    "<p>Body</p>", "Hello SEO", "Hello meta", "admin@test.local");

  // Seed a comment
  db.prepare(
    `INSERT INTO comments
     (id, route, author, email, body, status)
     VALUES (?, ?, ?, ?, ?, ?)`,
  ).run("comment-1", "/hello-world", "Commenter", "commenter@example.com", "Nice post!", "pending");

  // Seed a content entry with all NULL optional fields (covers ?? fallback branches in getCustomContentEntries)
  db.prepare(
    `INSERT INTO content_entries (slug, legacy_url, title, kind, template_key, source_html_path)
     VALUES (?, ?, ?, ?, ?, ?)`,
  ).run("null-fields", "/null-fields", "Null Fields", "post", "content", "runtime://content/null-fields");
  db.prepare(
    `INSERT INTO content_overrides (slug, title, status, seo_title, meta_description, updated_by)
     VALUES (?, ?, ?, ?, ?, ?)`,
  ).run("null-fields", "Null Fields", "published", "Null SEO", "Null meta", "admin@test.local");
  // Revision with author_ids as a non-null JSON string — exercises parseIdList try-catch path
  db.prepare(
    `INSERT INTO content_revisions (id, slug, source, title, status, seo_title, meta_description, author_ids, created_by)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  ).run("rev-null-1", "null-fields", "reviewed", "Null Fields", "published", "Null SEO", "Null meta", "[]", "admin@test.local");
  // Revision with non-array JSON — exercises parseIdList non-array branch
  db.prepare(
    `INSERT INTO content_revisions (id, slug, source, title, status, seo_title, meta_description, author_ids, created_by)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  ).run("rev-null-2", "null-fields", "reviewed", "Null Fields", "published", "Null SEO", "Null meta", '"not-array"', "admin@test.local");
  // Revision with invalid JSON — exercises parseIdList catch branch
  db.prepare(
    `INSERT INTO content_revisions (id, slug, source, title, status, seo_title, meta_description, author_ids, created_by)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  ).run("rev-null-3", "null-fields", "reviewed", "Null Fields", "published", "Null SEO", "Null meta", "not{json", "admin@test.local");

  // Seed a redirect rule
  db.prepare(
    `INSERT INTO redirect_rules (source_path, target_path, status_code, created_by)
     VALUES (?, ?, ?, ?)`,
  ).run("/old-path", "/new-path", 301, "admin@test.local");

  // Seed a media asset
  db.prepare(
    `INSERT INTO media_assets
     (id, source_url, local_path, mime_type, alt_text, title, uploaded_by)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
  ).run("media-1", null, "/images/uploads/test.png", "image/png", "Alt", "test.png", "admin@test.local");
});

// ---------------------------------------------------------------------------
// Translation state
// ---------------------------------------------------------------------------

describe("updateRuntimeTranslationState", () => {
  it("updates a valid translation state", async () => {
    const result = await updateRuntimeTranslationState("/about", "translated", actor, locals);
    expect(result).toMatchObject({ ok: true });

    const row = db.prepare("SELECT state FROM translation_overrides WHERE route = ?").get("/about") as { state: string };
    expect(row.state).toBe("translated");
  });

  it("rejects an invalid translation state", async () => {
    const result = await updateRuntimeTranslationState("/about", "not-a-real-state", actor, locals);
    expect(result).toMatchObject({ ok: false });
    expect((result as { error: string }).error).toContain("Invalid translation state");
  });

  it("upserts on re-update of same route", async () => {
    await updateRuntimeTranslationState("/about", "partial", actor, locals);
    await updateRuntimeTranslationState("/about", "translated", actor, locals);
    const row = db.prepare("SELECT state FROM translation_overrides WHERE route = ?").get("/about") as { state: string };
    expect(row.state).toBe("translated");
  });
});

// ---------------------------------------------------------------------------
// Redirect rules
// ---------------------------------------------------------------------------

describe("createRuntimeRedirectRule", () => {
  it("creates a new redirect rule", async () => {
    const result = await createRuntimeRedirectRule(
      { sourcePath: "/from", targetPath: "/to", statusCode: 301 },
      actor,
      locals,
    );
    expect(result).toMatchObject({ ok: true });
    const row = db.prepare("SELECT * FROM redirect_rules WHERE source_path = '/from'").get() as { target_path: string };
    expect(row.target_path).toBe("/to");
  });

  it("auto-prepends leading slash to paths", async () => {
    const result = await createRuntimeRedirectRule(
      { sourcePath: "no-slash", targetPath: "also-no-slash", statusCode: 301 },
      actor,
      locals,
    );
    expect(result).toMatchObject({ ok: true });
    const row = db.prepare("SELECT * FROM redirect_rules WHERE source_path = '/no-slash'").get() as { target_path: string } | undefined;
    expect(row?.target_path).toBe("/also-no-slash");
  });

  it("rejects same source and target path", async () => {
    const result = await createRuntimeRedirectRule(
      { sourcePath: "/same", targetPath: "/same", statusCode: 301 },
      actor,
      locals,
    );
    expect(result).toMatchObject({ ok: false });
  });

  it("returns not-ok when sourcePath is empty or whitespace", async () => {
    const result = await createRuntimeRedirectRule(
      { sourcePath: "   ", targetPath: "/dest", statusCode: 301 },
      actor,
      locals,
    );
    expect(result).toMatchObject({ ok: false });
  });

  it("rejects protocol-relative source path (open redirect vector)", async () => {
    const result = await createRuntimeRedirectRule(
      { sourcePath: "//evil.example/x", targetPath: "/safe", statusCode: 301 },
      actor,
      locals,
    );
    expect(result).toMatchObject({ ok: false });
  });

  it("rejects duplicate active redirect", async () => {
    const result = await createRuntimeRedirectRule(
      { sourcePath: "/old-path", targetPath: "/other", statusCode: 301 },
      actor,
      locals,
    );
    expect(result).toMatchObject({ ok: false });
    expect((result as { error: string }).error).toContain("already has a reviewed redirect rule");
  });

  it("allows recreating a previously deleted redirect", async () => {
    db.prepare("UPDATE redirect_rules SET deleted_at = CURRENT_TIMESTAMP WHERE source_path = '/old-path'").run();
    const result = await createRuntimeRedirectRule(
      { sourcePath: "/old-path", targetPath: "/new-target", statusCode: 302 },
      actor,
      locals,
    );
    expect(result).toMatchObject({ ok: true });
  });

  it("normalises 302 status code and defaults others to 301", async () => {
    const r302 = await createRuntimeRedirectRule(
      { sourcePath: "/a302", targetPath: "/b", statusCode: 302 },
      actor,
      locals,
    );
    expect(r302).toMatchObject({ ok: true, rule: { statusCode: 302 } });

    const r301 = await createRuntimeRedirectRule(
      { sourcePath: "/a303", targetPath: "/b", statusCode: 303 },
      actor,
      locals,
    );
    expect(r301).toMatchObject({ ok: true, rule: { statusCode: 301 } });
  });
});

describe("deleteRuntimeRedirectRule", () => {
  it("soft-deletes an active redirect", async () => {
    const result = await deleteRuntimeRedirectRule("/old-path", actor, locals);
    expect(result).toMatchObject({ ok: true });
    const row = db.prepare("SELECT deleted_at FROM redirect_rules WHERE source_path = '/old-path'").get() as { deleted_at: string | null };
    expect(row.deleted_at).not.toBeNull();
  });

  it("returns not-ok for a non-existent source path", async () => {
    const result = await deleteRuntimeRedirectRule("/does-not-exist", actor, locals);
    expect(result).toMatchObject({ ok: false });
  });
});

// ---------------------------------------------------------------------------
// Comments
// ---------------------------------------------------------------------------

describe("moderateRuntimeComment", () => {
  it("approves a pending comment", async () => {
    const result = await moderateRuntimeComment("comment-1", "approved", actor, locals);
    expect(result).toMatchObject({ ok: true });
    const row = db.prepare("SELECT status FROM comments WHERE id = 'comment-1'").get() as { status: string };
    expect(row.status).toBe("approved");
  });

  it("rejects a pending comment", async () => {
    await moderateRuntimeComment("comment-1", "rejected", actor, locals);
    const row = db.prepare("SELECT status FROM comments WHERE id = 'comment-1'").get() as { status: string };
    expect(row.status).toBe("rejected");
  });

  it("returns not-ok for non-existent comment id", async () => {
    const result = await moderateRuntimeComment("comment-ghost", "approved", actor, locals);
    expect(result).toMatchObject({ ok: false });
  });
});

// ---------------------------------------------------------------------------
// Settings
// ---------------------------------------------------------------------------

describe("saveRuntimeSettings", () => {
  it("creates site settings row when none exists", async () => {
    const result = await saveRuntimeSettings({ siteTitle: "My Blog" }, actor, locals);
    expect(result).toMatchObject({ ok: true });
    expect((result as { settings: { siteTitle: string } }).settings.siteTitle).toBe("My Blog");
  });

  it("partial update preserves other fields", async () => {
    await saveRuntimeSettings({ siteTitle: "Original", siteTagline: "Tagline" }, actor, locals);
    await saveRuntimeSettings({ siteTitle: "Updated" }, actor, locals);
    const row = db.prepare("SELECT site_title, site_tagline FROM site_settings WHERE id = 1").get() as { site_title: string; site_tagline: string };
    expect(row.site_title).toBe("Updated");
    expect(row.site_tagline).toBe("Tagline");
  });

  it("saves with newsletterEnabled true", async () => {
    const result = await saveRuntimeSettings({ siteTitle: "Blog", newsletterEnabled: true }, actor, locals);
    expect(result).toMatchObject({ ok: true });
    const row = db.prepare("SELECT newsletter_enabled FROM site_settings WHERE id = 1").get() as { newsletter_enabled: number };
    expect(row.newsletter_enabled).toBe(1);
  });

  it("partial update without siteTitle preserves existing title", async () => {
    await saveRuntimeSettings({ siteTitle: "Original Title" }, actor, locals);
    await saveRuntimeSettings({ siteTagline: "New Tagline" }, actor, locals);
    const row = db.prepare("SELECT site_title, site_tagline FROM site_settings WHERE id = 1").get() as { site_title: string; site_tagline: string };
    expect(row.site_title).toBe("Original Title");
    expect(row.site_tagline).toBe("New Tagline");
  });

  it("records an audit event", async () => {
    await saveRuntimeSettings({ siteTitle: "Audited" }, actor, locals);
    const row = db.prepare("SELECT action FROM audit_events WHERE action = 'settings.update' LIMIT 1").get() as { action: string } | undefined;
    expect(row?.action).toBe("settings.update");
  });
});

// ---------------------------------------------------------------------------
// Content state
// ---------------------------------------------------------------------------

describe("saveRuntimeContentState", () => {
  it("updates content metadata and creates a revision", async () => {
    const result = await saveRuntimeContentState(
      "hello-world",
      {
        title: "Updated Title",
        status: "published",
        seoTitle: "Updated SEO",
        metaDescription: "Updated meta",
      },
      actor,
      locals,
    );
    expect(result).toMatchObject({ ok: true });
    const override = db.prepare("SELECT title FROM content_overrides WHERE slug = 'hello-world'").get() as { title: string };
    expect(override.title).toBe("Updated Title");
  });

  it("fails with missing required fields", async () => {
    const result = await saveRuntimeContentState(
      "hello-world",
      { title: "", status: "published", seoTitle: "x", metaDescription: "x" },
      actor,
      locals,
    );
    expect(result).toMatchObject({ ok: false });
  });

  it("returns not-ok for unknown slug", async () => {
    const result = await saveRuntimeContentState(
      "unknown-slug",
      { title: "X", status: "published", seoTitle: "X", metaDescription: "X" },
      actor,
      locals,
    );
    expect(result).toMatchObject({ ok: false });
  });

  it("saves null-field entry with all optional inputs (covers ?? fallbacks and loop bodies)", async () => {
    const { lastInsertRowid: authorId } = db.prepare("INSERT INTO authors (name, slug) VALUES (?, ?)").run("Author A", "author-a");
    const { lastInsertRowid: catId } = db.prepare("INSERT INTO categories (name, slug) VALUES (?, ?)").run("Cat A", "cat-a");
    const { lastInsertRowid: tagId } = db.prepare("INSERT INTO tags (name, slug) VALUES (?, ?)").run("Tag A", "tag-a");

    const result = await saveRuntimeContentState(
      "null-fields",
      {
        title: "Null Fields Updated",
        status: "published",
        seoTitle: "SEO Title",
        metaDescription: "Meta description",
        scheduledAt: "2025-06-01T00:00:00Z",
        body: "<p>Now has body</p>",
        excerpt: "excerpt text",
        ogTitle: "OG Title",
        ogDescription: "OG Desc",
        ogImage: "/og.jpg",
        canonicalUrlOverride: "/canonical",
        robotsDirective: "noindex",
        revisionNote: "Test note",
        authorIds: [Number(authorId)],
        categoryIds: [Number(catId)],
        tagIds: [Number(tagId)],
      },
      actor,
      locals,
    );
    expect(result).toMatchObject({ ok: true });
    const row = db.prepare("SELECT title FROM content_overrides WHERE slug = 'null-fields'").get() as { title: string };
    expect(row.title).toBe("Null Fields Updated");
  });

  it("normalises unknown statuses to published", async () => {
    await saveRuntimeContentState(
      "hello-world",
      { title: "T", status: "not-a-real-status", seoTitle: "S", metaDescription: "M" },
      actor,
      locals,
    );
    const row = db.prepare("SELECT status FROM content_overrides WHERE slug = 'hello-world'").get() as { status: string };
    expect(row.status).toBe("published");
  });

  it("uses empty string body when input.body and pageRecord.body are both absent (covers body || '' branch)", async () => {
    // null-fields has NULL body in content_entries → mapped to "" by getCustomContentEntries
    // calling without input.body exercises: input.body?.trim() → undefined, pageRecord.body → "", || "" right branch
    const result = await saveRuntimeContentState(
      "null-fields",
      { title: "Null Fields", status: "published", seoTitle: "Null SEO", metaDescription: "Null meta" },
      actor,
      locals,
    );
    expect(result).toMatchObject({ ok: true });
  });

  it("covers ensureD1BaselineRevision ?? branches via seed page with undefined optional fields", async () => {
    // Register a seed page with no optional fields — status/seoTitle/metaDescription/summary are all undefined
    registerCms({
      templateKeys: ["content"],
      siteUrl: "https://example.com",
      seedPages: [{ slug: "seed-minimal", legacyUrl: "/seed-minimal", title: "Seed Minimal", sourceHtmlPath: "runtime://content/seed-minimal", updatedAt: "2025-01-01T00:00:00Z" }],
      archives: [],
      translationStatus: [],
    });
    // Insert content_entries row so content_overrides FK constraint is satisfied
    db.prepare(`INSERT INTO content_entries (slug, legacy_url, title, kind, template_key, source_html_path) VALUES (?, ?, ?, ?, ?, ?)`)
      .run("seed-minimal", "/seed-minimal", "Seed Minimal", "post", "content", "runtime://content/seed-minimal");

    // findPageRecord finds the seed page first (from getPageRecords()) since it precedes customEntries in the spread
    // ensureD1BaselineRevision receives pageRecord with undefined optional fields → ?? right branches covered
    const result = await saveRuntimeContentState(
      "seed-minimal",
      { title: "Seed Minimal", status: "published", seoTitle: "Seed SEO", metaDescription: "Seed meta" },
      actor,
      locals,
    );
    expect(result).toMatchObject({ ok: true });
  });
});

// ---------------------------------------------------------------------------
// Content creation
// ---------------------------------------------------------------------------

describe("createRuntimeContentRecord", () => {
  it("creates a new post with a content entry and revision", async () => {
    const result = await createRuntimeContentRecord(
      {
        title: "New Post",
        slug: "new-post",
        status: "draft",
        seoTitle: "New Post SEO",
        metaDescription: "New meta",
      },
      actor,
      locals,
    );
    expect(result).toMatchObject({ ok: true });
    const entry = db.prepare("SELECT slug FROM content_entries WHERE slug = 'new-post'").get() as { slug: string } | undefined;
    expect(entry?.slug).toBe("new-post");
    const revision = db.prepare("SELECT id FROM content_revisions WHERE slug = 'new-post'").get() as unknown;
    expect(revision).not.toBeNull();
  });

  it("slugifies the slug input", async () => {
    await createRuntimeContentRecord(
      {
        title: "Slug Test",
        slug: "Has Spaces & Symbols!",
        status: "draft",
        seoTitle: "S",
        metaDescription: "M",
      },
      actor,
      locals,
    );
    const entry = db.prepare("SELECT slug FROM content_entries WHERE slug = 'has-spaces-symbols'").get() as { slug: string } | undefined;
    expect(entry?.slug).toBe("has-spaces-symbols");
  });

  it("rejects duplicate slug", async () => {
    const result = await createRuntimeContentRecord(
      {
        title: "Hello World Dup",
        slug: "hello-world",
        status: "draft",
        seoTitle: "S",
        metaDescription: "M",
      },
      actor,
      locals,
    );
    expect(result).toMatchObject({ ok: false });
  });

  it("creates post with legacyUrl, body, summary and og fields", async () => {
    const result = await createRuntimeContentRecord(
      {
        title: "Full Post",
        slug: "full-post",
        legacyUrl: "/full-post",
        status: "draft",
        body: "<p>Body content</p>",
        summary: "Post summary",
        seoTitle: "Full Post SEO",
        metaDescription: "Full meta",
        ogTitle: "OG Title",
        ogDescription: "OG Desc",
        ogImage: "/og.jpg",
      },
      actor,
      locals,
    );
    expect(result).toMatchObject({ ok: true });
    const entry = db.prepare("SELECT slug, legacy_url FROM content_entries WHERE slug = 'full-post'").get() as { slug: string; legacy_url: string } | undefined;
    expect(entry?.legacy_url).toBe("/full-post");
  });

  it("rejects empty required fields", async () => {
    const result = await createRuntimeContentRecord(
      { title: "", slug: "empty-title", status: "draft", seoTitle: "S", metaDescription: "M" },
      actor,
      locals,
    );
    expect(result).toMatchObject({ ok: false });
  });

  it("falls back to title when seoTitle is empty (covers seoTitle || title right branch)", async () => {
    const result = await createRuntimeContentRecord(
      {
        title: "Title As SEO",
        slug: "title-as-seo",
        seoTitle: "",
        metaDescription: "Some meta",
        status: "draft",
      },
      actor,
      locals,
    );
    expect(result).toMatchObject({ ok: true });
    const entry = db.prepare("SELECT seo_title FROM content_entries WHERE slug = 'title-as-seo'").get() as { seo_title: string } | undefined;
    expect(entry?.seo_title).toBe("Title As SEO");
  });

  it("prepends slash when legacyUrl has no leading slash (covers rawLegacyUrl false branch)", async () => {
    const result = await createRuntimeContentRecord(
      {
        title: "No Slash Post",
        slug: "no-slash-post",
        legacyUrl: "no-leading-slash",
        status: "draft",
        seoTitle: "No Slash SEO",
        metaDescription: "No slash meta",
      },
      actor,
      locals,
    );
    expect(result).toMatchObject({ ok: true });
    const entry = db.prepare("SELECT legacy_url FROM content_entries WHERE slug = 'no-slash-post'").get() as { legacy_url: string } | undefined;
    expect(entry?.legacy_url).toBe("/no-leading-slash");
  });

  it("creates post with excerpt, canonicalUrlOverride, and robotsDirective (covers optional field branches)", async () => {
    const result = await createRuntimeContentRecord(
      {
        title: "Optional Fields Post",
        slug: "optional-fields-post",
        status: "draft",
        seoTitle: "Optional SEO",
        metaDescription: "Optional meta",
        excerpt: "Short excerpt",
        canonicalUrlOverride: "/canonical",
        robotsDirective: "noindex",
      },
      actor,
      locals,
    );
    expect(result).toMatchObject({ ok: true });
    const override = db.prepare("SELECT excerpt, canonical_url_override, robots_directive FROM content_overrides WHERE slug = 'optional-fields-post'").get() as { excerpt: string; canonical_url_override: string; robots_directive: string } | undefined;
    expect(override?.excerpt).toBe("Short excerpt");
    expect(override?.canonical_url_override).toBe("/canonical");
    expect(override?.robots_directive).toBe("noindex");
  });
});

// ---------------------------------------------------------------------------
// Revision restore
// ---------------------------------------------------------------------------

describe("restoreRuntimeRevision", () => {
  it("restores content from an existing revision", async () => {
    const result = await restoreRuntimeRevision("hello-world", "rev-hello-1", actor, locals);
    expect(result).toMatchObject({ ok: true });
  });

  it("returns not-ok for unknown revision id", async () => {
    const result = await restoreRuntimeRevision("hello-world", "rev-ghost", actor, locals);
    expect(result).toMatchObject({ ok: false });
    expect((result as { error: string }).error).toContain("Revision not found");
  });

  it("returns not-ok for unknown slug", async () => {
    const result = await restoreRuntimeRevision("ghost-slug", "rev-hello-1", actor, locals);
    expect(result).toMatchObject({ ok: false });
  });

  it("restores revision with JSON author_ids (covers parseIdList try-catch path)", async () => {
    const result = await restoreRuntimeRevision("null-fields", "rev-null-1", actor, locals);
    expect(result).toMatchObject({ ok: true });
  });

  it("restores revision with non-array JSON author_ids (covers parseIdList non-array branch)", async () => {
    const result = await restoreRuntimeRevision("null-fields", "rev-null-2", actor, locals);
    expect(result).toMatchObject({ ok: true });
  });

  it("restores revision with invalid JSON author_ids (covers parseIdList catch branch)", async () => {
    const result = await restoreRuntimeRevision("null-fields", "rev-null-3", actor, locals);
    expect(result).toMatchObject({ ok: true });
  });
});

// ---------------------------------------------------------------------------
// User invitations
// ---------------------------------------------------------------------------

describe("inviteRuntimeAdminUser", () => {
  it("creates an invited user and returns an invite URL", async () => {
    const result = await inviteRuntimeAdminUser(
      { name: "New Editor", email: "newedit@test.local", role: "editor" },
      actor,
      locals,
    );
    expect(result).toMatchObject({ ok: true });
    expect((result as { inviteUrl: string }).inviteUrl).toContain("/ap-admin/accept-invite");
  });

  it("rejects duplicate email", async () => {
    const result = await inviteRuntimeAdminUser(
      { name: "Dup", email: "admin@test.local", role: "editor" },
      actor,
      locals,
    );
    expect(result).toMatchObject({ ok: false });
  });

  it("rejects invalid email format", async () => {
    const result = await inviteRuntimeAdminUser(
      { name: "Bad", email: "not-an-email", role: "editor" },
      actor,
      locals,
    );
    expect(result).toMatchObject({ ok: false });
  });

  it("rejects unknown role", async () => {
    const result = await inviteRuntimeAdminUser(
      { name: "Bad Role", email: "badrole@test.local", role: "superuser" },
      actor,
      locals,
    );
    expect(result).toMatchObject({ ok: false });
  });

  it("invites a user with admin role", async () => {
    const result = await inviteRuntimeAdminUser(
      { name: "Admin Two", email: "admin2@test.local", role: "admin" },
      actor,
      locals,
    );
    expect(result).toMatchObject({ ok: true });
  });

  it("rejects empty name or email", async () => {
    const r1 = await inviteRuntimeAdminUser({ name: "", email: "x@y.com", role: "editor" }, actor, locals);
    expect(r1).toMatchObject({ ok: false });
    const r2 = await inviteRuntimeAdminUser({ name: "X", email: "", role: "editor" }, actor, locals);
    expect(r2).toMatchObject({ ok: false });
  });
});

describe("getRuntimeInviteRequest + consumeRuntimeInviteToken", () => {
  it("returns null for empty token", async () => {
    const result = await getRuntimeInviteRequest("", locals);
    expect(result).toBeNull();
  });

  it("round-trips invite: create → get → consume", async () => {
    const invite = await inviteRuntimeAdminUser(
      { name: "Roundtrip", email: "rt@test.local", role: "editor" },
      actor,
      locals,
    ) as { ok: true; inviteUrl: string };
    expect(invite.ok).toBe(true);

    const rawToken = new URL(invite.inviteUrl, "https://x").searchParams.get("token")!;
    const req = await getRuntimeInviteRequest(rawToken, locals);
    expect(req?.email).toBe("rt@test.local");

    const consumed = await consumeRuntimeInviteToken(rawToken, "secure-passphrase-12", locals);
    expect(consumed).toMatchObject({ ok: true });

    // Token is now spent
    const req2 = await getRuntimeInviteRequest(rawToken, locals);
    expect(req2).toBeNull();
  });

  it("rejects short password on consume", async () => {
    const invite = await inviteRuntimeAdminUser(
      { name: "Short PW", email: "short@test.local", role: "editor" },
      actor,
      locals,
    ) as { ok: true; inviteUrl: string };
    const rawToken = new URL(invite.inviteUrl, "https://x").searchParams.get("token")!;
    const result = await consumeRuntimeInviteToken(rawToken, "tooshort", locals);
    expect(result).toMatchObject({ ok: false });
    expect((result as { error: string }).error).toContain("at least 12 characters");
  });
});

// ---------------------------------------------------------------------------
// Password reset
// ---------------------------------------------------------------------------

describe("createRuntimePasswordResetToken + getRuntimePasswordResetRequest + consumeRuntimePasswordResetToken", () => {
  it("returns null for empty reset token", async () => {
    const result = await getRuntimePasswordResetRequest("", locals);
    expect(result).toBeNull();
  });

  it("returns ok with null resetUrl for unknown email (self-service: no leak)", async () => {
    const result = await createRuntimePasswordResetToken("ghost@test.local", null, locals);
    expect(result).toMatchObject({ ok: true, resetUrl: null });
  });

  it("returns error for unknown email when actor is set (admin-issued reset)", async () => {
    const result = await createRuntimePasswordResetToken("ghost@test.local", actor, locals);
    expect(result).toMatchObject({ ok: false });
  });

  it("round-trips reset: create → get → consume", async () => {
    const tokenResult = await createRuntimePasswordResetToken("editor@test.local", null, locals) as { ok: true; resetUrl: string };
    const rawToken = new URL(tokenResult.resetUrl, "https://x").searchParams.get("token")!;

    const req = await getRuntimePasswordResetRequest(rawToken, locals);
    expect(req?.email).toBe("editor@test.local");

    const consumed = await consumeRuntimePasswordResetToken(rawToken, "new-password-secure-123", locals);
    expect(consumed).toMatchObject({ ok: true });

    // Token now spent
    const req2 = await getRuntimePasswordResetRequest(rawToken, locals);
    expect(req2).toBeNull();
  });

  it("rejects short password on reset consume", async () => {
    const tokenResult = await createRuntimePasswordResetToken("editor@test.local", null, locals) as { ok: true; resetUrl: string };
    const rawToken = new URL(tokenResult.resetUrl, "https://x").searchParams.get("token")!;
    const result = await consumeRuntimePasswordResetToken(rawToken, "short", locals);
    expect(result).toMatchObject({ ok: false });
  });

  it("creates reset token for valid user when actor is set (records audit event)", async () => {
    const result = await createRuntimePasswordResetToken("editor@test.local", actor, locals);
    expect(result).toMatchObject({ ok: true });
    const row = db.prepare("SELECT * FROM audit_events WHERE action = 'auth.password_reset_issue' LIMIT 1").get();
    expect(row).not.toBeNull();
  });

  it("returns error for empty email", async () => {
    const result = await createRuntimePasswordResetToken("", actor, locals);
    expect(result).toMatchObject({ ok: false, error: "Email is required." });
  });

  it("returns error for expired or invalid reset token on consume", async () => {
    const result = await consumeRuntimePasswordResetToken("non-existent-token", "securepassword123", locals);
    expect(result).toMatchObject({ ok: false });
  });
});

// ---------------------------------------------------------------------------
// User suspension
// ---------------------------------------------------------------------------

describe("suspendRuntimeAdminUser + unsuspendRuntimeAdminUser", () => {
  it("suspends an active user", async () => {
    const result = await suspendRuntimeAdminUser("editor@test.local", actor, locals);
    expect(result).toMatchObject({ ok: true });
    const row = db.prepare("SELECT active FROM admin_users WHERE email = 'editor@test.local'").get() as { active: number };
    expect(row.active).toBe(0);
  });

  it("rejects suspending self", async () => {
    const result = await suspendRuntimeAdminUser("admin@test.local", actor, locals);
    expect(result).toMatchObject({ ok: false });
    expect((result as { error: string }).error).toContain("cannot suspend the account you are currently using");
  });

  it("rejects suspending an already-suspended or non-existent user", async () => {
    db.prepare("UPDATE admin_users SET active = 0 WHERE email = 'editor@test.local'").run();
    const result = await suspendRuntimeAdminUser("editor@test.local", actor, locals);
    expect(result).toMatchObject({ ok: false });
  });

  it("restores a suspended user", async () => {
    await suspendRuntimeAdminUser("editor@test.local", actor, locals);
    const result = await unsuspendRuntimeAdminUser("editor@test.local", actor, locals);
    expect(result).toMatchObject({ ok: true });
    const row = db.prepare("SELECT active FROM admin_users WHERE email = 'editor@test.local'").get() as { active: number };
    expect(row.active).toBe(1);
  });

  it("rejects unsuspending an already-active user", async () => {
    const result = await unsuspendRuntimeAdminUser("editor@test.local", actor, locals);
    expect(result).toMatchObject({ ok: false });
  });

  it("rejects suspending when email is empty", async () => {
    const result = await suspendRuntimeAdminUser("", actor, locals);
    expect(result).toMatchObject({ ok: false });
    expect((result as { error: string }).error).toContain("Email is required");
  });

  it("rejects unsuspending when email is empty", async () => {
    const result = await unsuspendRuntimeAdminUser("", actor, locals);
    expect(result).toMatchObject({ ok: false });
    expect((result as { error: string }).error).toContain("Email is required");
  });
});

// ---------------------------------------------------------------------------
// Media assets
// ---------------------------------------------------------------------------

describe("updateRuntimeMediaAsset", () => {
  it("updates title and alt text", async () => {
    const result = await updateRuntimeMediaAsset(
      { id: "media-1", title: "New Title", altText: "New Alt" },
      actor,
      locals,
    );
    expect(result).toMatchObject({ ok: true });
    const row = db.prepare("SELECT title, alt_text FROM media_assets WHERE id = 'media-1'").get() as { title: string; alt_text: string };
    expect(row.title).toBe("New Title");
    expect(row.alt_text).toBe("New Alt");
  });

  it("updates without title or altText clears both fields", async () => {
    const result = await updateRuntimeMediaAsset({ id: "media-1" }, actor, locals);
    expect(result).toMatchObject({ ok: true });
    const row = db.prepare("SELECT title, alt_text FROM media_assets WHERE id = 'media-1'").get() as { title: string; alt_text: string };
    expect(row.title).toBe("");
    expect(row.alt_text).toBe("");
  });

  it("returns not-ok for non-existent asset", async () => {
    const result = await updateRuntimeMediaAsset({ id: "ghost-media" }, actor, locals);
    expect(result).toMatchObject({ ok: false });
  });

  it("rejects empty id", async () => {
    const result = await updateRuntimeMediaAsset({ id: "  " }, actor, locals);
    expect(result).toMatchObject({ ok: false });
  });
});

describe("createRuntimeMediaAsset", () => {
  beforeEach(() => {
    mockStoreMedia.mockResolvedValue({
      ok: true as const,
      asset: {
        id: "stored-media-123",
        storedFilename: "test-image.png",
        publicPath: "/images/uploads/test-image.png",
        r2Key: "uploads/test-image.png",
        mimeType: "image/png",
        fileSize: 1024,
        title: "Test Image",
        altText: "A test image",
      },
      storage: "local" as const,
    });
    mockDeleteMedia.mockResolvedValue(undefined);
  });

  it("creates a new media asset via storeRuntimeMediaObject", async () => {
    const result = await createRuntimeMediaAsset(
      {
        filename: "test-image.png",
        bytes: new Uint8Array([1, 2, 3]),
        mimeType: "image/png",
        title: "Test Image",
        altText: "A test image",
      },
      actor,
      locals,
    );
    expect(result).toMatchObject({ ok: true, id: "stored-media-123" });
    const row = db.prepare("SELECT id FROM media_assets WHERE id = 'stored-media-123'").get() as { id: string } | undefined;
    expect(row?.id).toBe("stored-media-123");
  });

  it("returns error when storeRuntimeMediaObject fails", async () => {
    mockStoreMedia.mockResolvedValue({ ok: false as const, error: "Storage full" });
    const result = await createRuntimeMediaAsset(
      { filename: "fail.png", bytes: new Uint8Array([1]), mimeType: "image/png" },
      actor,
      locals,
    );
    expect(result).toMatchObject({ ok: false, error: "Storage full" });
  });
});

describe("deleteRuntimeMediaAsset", () => {
  beforeEach(() => {
    mockDeleteMedia.mockResolvedValue(undefined);
  });

  it("soft-deletes a media asset and removes the object", async () => {
    const result = await deleteRuntimeMediaAsset("media-1", actor, locals);
    expect(result).toMatchObject({ ok: true });
    const row = db.prepare("SELECT deleted_at FROM media_assets WHERE id = 'media-1'").get() as { deleted_at: string | null };
    expect(row.deleted_at).not.toBeNull();
    expect(mockDeleteMedia).toHaveBeenCalled();
  });

  it("returns not-ok for non-existent asset", async () => {
    const result = await deleteRuntimeMediaAsset("ghost-id", actor, locals);
    expect(result).toMatchObject({ ok: false });
  });

  it("rejects empty id", async () => {
    const result = await deleteRuntimeMediaAsset("", actor, locals);
    expect(result).toMatchObject({ ok: false });
  });
});

// ---------------------------------------------------------------------------
// Authors
// ---------------------------------------------------------------------------

describe("createRuntimeAuthor + updateRuntimeAuthor + deleteRuntimeAuthor", () => {
  it("creates an author", async () => {
    const result = await createRuntimeAuthor({ name: "Jane Doe", slug: "jane-doe" }, actor, locals);
    expect(result).toMatchObject({ ok: true });
    const row = db.prepare("SELECT name FROM authors WHERE slug = 'jane-doe'").get() as { name: string } | undefined;
    expect(row?.name).toBe("Jane Doe");
  });

  it("updates an author name", async () => {
    await createRuntimeAuthor({ name: "Original Name", slug: "update-author" }, actor, locals);
    const created = db.prepare("SELECT id FROM authors WHERE slug = 'update-author'").get() as { id: number };
    const result = await updateRuntimeAuthor({ id: created.id, name: "Updated Name" }, actor, locals);
    expect(result).toMatchObject({ ok: true });
  });

  it("deletes an author", async () => {
    await createRuntimeAuthor({ name: "To Delete", slug: "to-delete" }, actor, locals);
    const created = db.prepare("SELECT id FROM authors WHERE slug = 'to-delete'").get() as { id: number };
    const result = await deleteRuntimeAuthor(created.id, actor, locals);
    expect(result).toMatchObject({ ok: true });
  });

  it("creates author without slug (uses name as audit resource id)", async () => {
    const result = await createRuntimeAuthor({ name: "No Slug Author" }, actor, locals);
    expect(result).toMatchObject({ ok: true });
  });

  it("is a no-op (ok: true) when updating non-existent author id", async () => {
    // The D1 store issues UPDATE ... WHERE id = ? AND deleted_at IS NULL — if no
    // rows match, it silently succeeds rather than returning an error.
    const result = await updateRuntimeAuthor({ id: 99999, name: "Ghost" }, actor, locals);
    expect(result).toMatchObject({ ok: true });
  });

  it("is a no-op (ok: true) when deleting non-existent author id", async () => {
    // Same as above — soft-delete WHERE clause simply matches zero rows.
    const result = await deleteRuntimeAuthor(99999, actor, locals);
    expect(result).toMatchObject({ ok: true });
  });
});

// ---------------------------------------------------------------------------
// Categories
// ---------------------------------------------------------------------------

describe("createRuntimeCategory + updateRuntimeCategory + deleteRuntimeCategory", () => {
  it("creates a category", async () => {
    const result = await createRuntimeCategory({ name: "Technology", slug: "technology" }, actor, locals);
    expect(result).toMatchObject({ ok: true });
  });

  it("updates a category", async () => {
    await createRuntimeCategory({ name: "Old Name", slug: "cat-update" }, actor, locals);
    const created = db.prepare("SELECT id FROM categories WHERE slug = 'cat-update'").get() as { id: number };
    expect(await updateRuntimeCategory({ id: created.id, name: "New Name" }, actor, locals)).toMatchObject({ ok: true });
  });

  it("creates category without slug", async () => {
    const result = await createRuntimeCategory({ name: "No Slug Category" }, actor, locals);
    expect(result).toMatchObject({ ok: true });
  });

  it("deletes a category", async () => {
    await createRuntimeCategory({ name: "Delete Me", slug: "cat-delete" }, actor, locals);
    const created = db.prepare("SELECT id FROM categories WHERE slug = 'cat-delete'").get() as { id: number };
    expect(await deleteRuntimeCategory(created.id, actor, locals)).toMatchObject({ ok: true });
  });
});

// ---------------------------------------------------------------------------
// Tags
// ---------------------------------------------------------------------------

describe("createRuntimeTag + updateRuntimeTag + deleteRuntimeTag", () => {
  it("creates a tag", async () => {
    const result = await createRuntimeTag({ name: "Rust", slug: "rust" }, actor, locals);
    expect(result).toMatchObject({ ok: true });
  });

  it("updates a tag", async () => {
    await createRuntimeTag({ name: "Old Tag", slug: "tag-update" }, actor, locals);
    const created = db.prepare("SELECT id FROM tags WHERE slug = 'tag-update'").get() as { id: number };
    expect(await updateRuntimeTag({ id: created.id, name: "New Tag" }, actor, locals)).toMatchObject({ ok: true });
  });

  it("creates tag without slug", async () => {
    const result = await createRuntimeTag({ name: "No Slug Tag" }, actor, locals);
    expect(result).toMatchObject({ ok: true });
  });

  it("deletes a tag", async () => {
    await createRuntimeTag({ name: "Delete Tag", slug: "tag-delete" }, actor, locals);
    const created = db.prepare("SELECT id FROM tags WHERE slug = 'tag-delete'").get() as { id: number };
    expect(await deleteRuntimeTag(created.id, actor, locals)).toMatchObject({ ok: true });
  });
});

// ---------------------------------------------------------------------------
// No-DB fallback path (locals = null → local admin store)
// NOTE: loadLocalAdminStore() throws in test context because the local
// runtime alias is only available inside a host Astro app. These tests
// verify that the functions surface the error rather than crashing silently.
// ---------------------------------------------------------------------------

describe("no-db fallback (null locals)", () => {
  it("updateRuntimeTranslationState throws without runtime alias", async () => {
    await expect(updateRuntimeTranslationState("/about", "needs-review", actor, null)).rejects.toThrow(
      "Local runtime modules are only available",
    );
  });

  it("saveRuntimeSettings throws without runtime alias", async () => {
    await expect(saveRuntimeSettings({ siteTitle: "Local" }, actor, null)).rejects.toThrow(
      "Local runtime modules are only available",
    );
  });

  it("createRuntimeRedirectRule throws without runtime alias", async () => {
    await expect(
      createRuntimeRedirectRule({ sourcePath: "/local", targetPath: "/dest", statusCode: 301 }, actor, null),
    ).rejects.toThrow("Local runtime modules are only available");
  });
});
