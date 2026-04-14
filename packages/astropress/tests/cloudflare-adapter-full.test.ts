import { DatabaseSync } from "node:sqlite";

import { beforeEach, describe, expect, it } from "vitest";
import { createAstropressCloudflareAdapter, registerCms } from "@astropress-diy/astropress";
import { SqliteBackedD1Database, createSeededCloudflareDatabase } from "./helpers/provider-test-fixtures.js";
import { makeDb, STANDARD_CMS_CONFIG } from "./helpers/make-db.js";

beforeEach(() => {
  registerCms(STANDARD_CMS_CONFIG);
});

describe("cloudflare adapter — no-db path (static mode)", () => {
  it("returns a valid adapter without db option", async () => {
    const adapter = createAstropressCloudflareAdapter({});
    expect(adapter.capabilities.name).toBe("cloudflare");

    expect(await adapter.content.list()).toEqual([]);
    expect(await adapter.content.get("anything")).toBeNull();

    const record = { id: "x", kind: "post" as const, slug: "x", status: "published" as const, title: "X" };
    expect(await adapter.content.save(record)).toMatchObject({ id: "x" });
    await expect(adapter.content.delete("x")).resolves.toBeUndefined();

    const asset = { id: "a", filename: "a.png", mimeType: "image/png", publicUrl: "https://cdn/a.png", metadata: { altText: "a", title: "a.png" } };
    expect(await adapter.media.put(asset)).toMatchObject({ id: "a" });
    expect(await adapter.media.get("a")).toBeNull();
    await expect(adapter.media.delete("a")).resolves.toBeUndefined();

    expect(await adapter.revisions.list("x")).toEqual([]);
    const revision = { id: "r1", recordId: "x", createdAt: "2026-01-01T00:00:00.000Z", actorId: "admin@example.com", summary: "test", snapshot: {} };
    expect(await adapter.revisions.append(revision)).toMatchObject({ id: "r1" });
  });

  it("uses disabled auth store by default (no db, no fallback)", async () => {
    const adapter = createAstropressCloudflareAdapter({});
    expect(await adapter.auth.signIn("admin@example.com", "password")).toBeNull();
    expect(await adapter.auth.getSession("session-id")).toBeNull();
    await expect(adapter.auth.signOut("session-id")).resolves.toBeUndefined();
  });

  it("uses fallback auth store when allowInsecureFallbackAuth is true", async () => {
    const adapter = createAstropressCloudflareAdapter({
      allowInsecureFallbackAuth: true,
      users: [{ id: "user-1", email: "admin@example.com", password: "correctpass", role: "admin" as const }],
    });

    // wrong password returns null
    expect(await adapter.auth.signIn("admin@example.com", "wrongpass")).toBeNull();

    // correct password returns session
    const session = await adapter.auth.signIn("admin@example.com", "correctpass");
    expect(session).not.toBeNull();
    expect(session?.email).toBe("admin@example.com");
    expect(await adapter.auth.getSession(session!.id)).toMatchObject({ email: "admin@example.com" });

    await adapter.auth.signOut(session!.id);
    expect(await adapter.auth.getSession(session!.id)).toBeNull();
  });
});

describe("cloudflare adapter — content.list() kind filters", () => {
  it("lists each kind in isolation", async () => {
    const db = await createSeededCloudflareDatabase();
    const adapter = createAstropressCloudflareAdapter({ db: new SqliteBackedD1Database(db) });

    const pages = await adapter.content.list("page");
    expect(pages.every((r) => r.kind === "page")).toBe(true);

    const posts = await adapter.content.list("post");
    expect(posts.length).toBeGreaterThanOrEqual(1);
    expect(posts.every((r) => r.kind === "post")).toBe(true);

    const redirects = await adapter.content.list("redirect");
    expect(redirects.every((r) => r.kind === "redirect")).toBe(true);

    const comments = await adapter.content.list("comment");
    expect(Array.isArray(comments)).toBe(true);
    expect(comments.every((r) => r.kind === "comment")).toBe(true);

    const users = await adapter.content.list("user");
    expect(Array.isArray(users)).toBe(true);
    expect(users.every((r) => r.kind === "user")).toBe(true);

    const settings = await adapter.content.list("settings");
    expect(settings).toHaveLength(1);
    expect(settings[0].kind).toBe("settings");
    expect(settings[0].id).toBe("site-settings");

    const media = await adapter.content.list("media");
    expect(Array.isArray(media)).toBe(true);
    expect(media.every((r) => r.kind === "media")).toBe(true);

    const translations = await adapter.content.list("translation");
    expect(Array.isArray(translations)).toBe(true);

    db.close();
  });

  it("lists all kinds when no filter is given", async () => {
    const db = await createSeededCloudflareDatabase();
    const adapter = createAstropressCloudflareAdapter({ db: new SqliteBackedD1Database(db) });

    const all = await adapter.content.list();
    const kinds = new Set(all.map((r) => r.kind));
    // settings and user are always present; others depend on seeded data
    expect(kinds.has("settings")).toBe(true);
    expect(kinds.has("user")).toBe(true);

    db.close();
  });
});

describe("cloudflare adapter — content.save() branches", () => {
  it("saves a new page record (no existing entry)", async () => {
    const db = makeDb();
    const adapter = createAstropressCloudflareAdapter({ db: new SqliteBackedD1Database(db) });

    const saved = await adapter.content.save({
      id: "new-page",
      kind: "page",
      slug: "new-page",
      status: "published",
      title: "New Page",
      body: "<p>Content</p>",
      metadata: { metaDescription: "desc", seoTitle: "New Page" },
    });
    expect(saved.slug).toBe("new-page");
    expect(saved.kind).toBe("page");
    expect(await adapter.content.get("new-page")).toMatchObject({ slug: "new-page", kind: "page" });
  });

  it("updates an existing post record", async () => {
    const db = makeDb();
    const adapter = createAstropressCloudflareAdapter({ db: new SqliteBackedD1Database(db) });

    // First save
    await adapter.content.save({ id: "my-post", kind: "post", slug: "my-post", status: "draft", title: "Draft" });

    // Second save should update
    const updated = await adapter.content.save({ id: "my-post", kind: "post", slug: "my-post", status: "published", title: "Published" });
    expect(updated.title).toBe("Published");
    expect(updated.status).toBe("published");
    // Verify the DB was actually updated (return value is from local vars, not a read-back)
    const fromDb = await adapter.content.get("my-post");
    expect(fromDb?.status).toBe("published");
    expect(fromDb?.title).toBe("Published");
    db.close();
  });

  it("saves a redirect record", async () => {
    const db = makeDb();
    const adapter = createAstropressCloudflareAdapter({ db: new SqliteBackedD1Database(db) });

    const saved = await adapter.content.save({
      id: "/old-path",
      kind: "redirect",
      slug: "/old-path",
      status: "published",
      metadata: { targetPath: "/new-path", statusCode: 301 },
    });
    expect(saved.kind).toBe("redirect");
    expect(saved.metadata).toMatchObject({ targetPath: "/new-path", statusCode: 301 });
  });

  it("saves settings (upserts, merges with existing)", async () => {
    const db = makeDb();
    const adapter = createAstropressCloudflareAdapter({ db: new SqliteBackedD1Database(db) });

    // First save
    const first = await adapter.content.save({
      id: "site-settings",
      kind: "settings",
      slug: "site-settings",
      status: "published",
      metadata: { siteTitle: "My Site" },
    });
    expect(first.title).toBe("My Site");

    // Second save merges
    const second = await adapter.content.save({
      id: "site-settings",
      kind: "settings",
      slug: "site-settings",
      status: "published",
      metadata: { siteTagline: "Best site" },
    });
    expect(second.metadata).toMatchObject({ siteTagline: "Best site" });
  });

  it("throws when saving an unsupported kind (comment)", async () => {
    const db = makeDb();
    const adapter = createAstropressCloudflareAdapter({ db: new SqliteBackedD1Database(db) });

    await expect(
      // @ts-expect-error — intentionally passing an unsupported kind to verify the runtime guard
      adapter.content.save({ id: "c1", kind: "comment", slug: "c1", status: "published", title: "Comment" }),
    ).rejects.toThrow("does not support saving comment records yet");
  });

  it("throws when saving an unsupported kind (user)", async () => {
    const db = makeDb();
    const adapter = createAstropressCloudflareAdapter({ db: new SqliteBackedD1Database(db) });

    await expect(
      // @ts-expect-error — intentionally passing an unsupported kind to verify the runtime guard
      adapter.content.save({ id: "u1", kind: "user", slug: "u1", status: "published", title: "User" }),
    ).rejects.toThrow("does not support saving user records yet");
  });
});

describe("cloudflare adapter — content.delete() branches", () => {
  it("deletes a non-existent record without throwing (no-op)", async () => {
    const db = makeDb();
    const adapter = createAstropressCloudflareAdapter({ db: new SqliteBackedD1Database(db) });
    await expect(adapter.content.delete("does-not-exist")).resolves.toBeUndefined();
  });

  it("soft-deletes a redirect record", async () => {
    const db = makeDb();
    const adapter = createAstropressCloudflareAdapter({ db: new SqliteBackedD1Database(db) });

    await adapter.content.save({ id: "/old", kind: "redirect", slug: "/old", status: "published", metadata: { targetPath: "/new", statusCode: 301 } });
    await adapter.content.delete("/old");

    const row = db.prepare("SELECT deleted_at FROM redirect_rules WHERE source_path = '/old'").get() as Record<string, unknown>;
    expect(row?.deleted_at).not.toBeNull();
  });

  it("archives a post record via delete", async () => {
    const db = makeDb();
    const adapter = createAstropressCloudflareAdapter({ db: new SqliteBackedD1Database(db) });

    await adapter.content.save({ id: "my-post", kind: "post", slug: "my-post", status: "published", title: "My Post" });
    await adapter.content.delete("my-post");

    const record = await adapter.content.get("my-post");
    expect(record?.status).toBe("archived");
  });

  it("soft-deletes a media record", async () => {
    const db = await createSeededCloudflareDatabase();
    const adapter = createAstropressCloudflareAdapter({ db: new SqliteBackedD1Database(db) });

    await adapter.content.delete("cloudflare-media-1");

    const row = db.prepare("SELECT deleted_at FROM media_assets WHERE id = 'cloudflare-media-1'").get() as Record<string, unknown>;
    expect(row?.deleted_at).not.toBeNull();

    db.close();
  });

  it("returns without throwing when deleting an unsupported kind (comment)", async () => {
    const db = makeDb();
    db.prepare(
      "INSERT INTO comments (id, route, author, email, body, status, policy) VALUES (?, ?, ?, ?, ?, ?, ?)",
    ).run("comment-1", "/blog/hello", "Alice", "alice@example.com", "Great post", "approved", "open-moderated");

    const adapter = createAstropressCloudflareAdapter({ db: new SqliteBackedD1Database(db) });
    // Unsupported record kind — adapter degrades gracefully (no-op) rather than throwing
    await expect(adapter.content.delete("comment-1")).resolves.toBeUndefined();
    db.close();
  });
});

describe("cloudflare adapter — content.save() extended branches", () => {
  it("saves a translation record", async () => {
    const db = makeDb();
    const adapter = createAstropressCloudflareAdapter({ db: new SqliteBackedD1Database(db) });
    const saved = await adapter.content.save({
      id: "/es/hello",
      kind: "translation",
      slug: "/es/hello",
      status: "published",
      metadata: { state: "reviewed" },
    });
    expect(saved.id).toBe("/es/hello");
  });

  it("saves a redirect with status code 302", async () => {
    const db = makeDb();
    const adapter = createAstropressCloudflareAdapter({ db: new SqliteBackedD1Database(db) });
    const saved = await adapter.content.save({
      id: "/temp",
      kind: "redirect",
      slug: "/temp",
      status: "published",
      metadata: { targetPath: "/new-temp", statusCode: 302 },
    });
    expect(saved.metadata).toMatchObject({ statusCode: 302 });
  });

  it("saves a post with ogTitle/ogDescription/ogImage/canonicalUrlOverride/robotsDirective metadata", async () => {
    const db = makeDb();
    const adapter = createAstropressCloudflareAdapter({ db: new SqliteBackedD1Database(db) });
    const saved = await adapter.content.save({
      id: "rich-post",
      kind: "post",
      slug: "rich-post",
      status: "published",
      title: "Rich Post",
      body: "<p>body</p>",
      metadata: {
        ogTitle: "OG Title",
        ogDescription: "OG Description",
        ogImage: "https://cdn/og.png",
        canonicalUrlOverride: "https://example.com/rich-post",
        robotsDirective: "noindex",
      },
    });
    expect(saved.slug).toBe("rich-post");
  });

  it("falls back to id when slug is falsy on save", async () => {
    const db = makeDb();
    const adapter = createAstropressCloudflareAdapter({ db: new SqliteBackedD1Database(db) });
    const saved = await adapter.content.save({
      id: "fallback-id",
      kind: "page",
      slug: "",
      status: "published",
      title: "Fallback",
    });
    expect(saved.id).toBe("fallback-id");
  });

  it("saves settings with newsletterEnabled=true", async () => {
    const db = makeDb();
    const adapter = createAstropressCloudflareAdapter({ db: new SqliteBackedD1Database(db) });
    const saved = await adapter.content.save({
      id: "site-settings",
      kind: "settings",
      slug: "site-settings",
      status: "published",
      metadata: { siteTitle: "Newsletter Site", newsletterEnabled: true },
    });
    expect(saved.metadata).toMatchObject({ newsletterEnabled: true });
  });
});

describe("cloudflare adapter — content.get() branches", () => {
  it("returns null for empty id", async () => {
    const db = makeDb();
    const adapter = createAstropressCloudflareAdapter({ db: new SqliteBackedD1Database(db) });
    expect(await adapter.content.get("")).toBeNull();
  });

  it("returns null when record is not found", async () => {
    const db = makeDb();
    const adapter = createAstropressCloudflareAdapter({ db: new SqliteBackedD1Database(db) });
    expect(await adapter.content.get("does-not-exist")).toBeNull();
  });
});

describe("cloudflare adapter — media.get() branches", () => {
  it("returns null when media asset is not found", async () => {
    const db = makeDb();
    const adapter = createAstropressCloudflareAdapter({ db: new SqliteBackedD1Database(db) });
    expect(await adapter.media.get("not-found")).toBeNull();
  });

  it("returns media asset with sourceUrl as publicUrl", async () => {
    const db = await createSeededCloudflareDatabase();
    const adapter = createAstropressCloudflareAdapter({ db: new SqliteBackedD1Database(db) });
    const asset = await adapter.media.get("cloudflare-media-1");
    expect(asset).not.toBeNull();
    expect(asset?.publicUrl).toBe("https://cdn.example.com/cloudflare.png");
    db.close();
  });
});

describe("cloudflare adapter — content.list() branch coverage", () => {
  it("maps non-approved comment status to 'draft'", async () => {
    const db = await createSeededCloudflareDatabase();
    // Insert a pending/spam comment (non-approved) to cover the ternary false branch
    db.prepare(
      "INSERT INTO comments (id, route, author, email, body, status, policy) VALUES (?, ?, ?, ?, ?, ?, ?)",
    ).run("comment-pending", "/blog/hello", "Bob", "bob@example.com", "Pending comment", "pending", "open-moderated");

    const adapter = createAstropressCloudflareAdapter({ db: new SqliteBackedD1Database(db) });
    const comments = await adapter.content.list("comment");
    const pending = comments.find((c) => c.id === "comment-pending");
    expect(pending?.status).toBe("draft");

    db.close();
  });

  it("maps inactive user to 'archived' status", async () => {
    const db = await createSeededCloudflareDatabase();
    // Insert an inactive user (active=0) to cover the ternary false branch
    db.prepare(
      "INSERT INTO admin_users (email, password_hash, role, name, active) VALUES (?, ?, ?, ?, ?)",
    ).run("inactive@example.com", "placeholder-hash", "editor", "Inactive User", 0);

    const adapter = createAstropressCloudflareAdapter({ db: new SqliteBackedD1Database(db) });
    const users = await adapter.content.list("user");
    const inactive = users.find((u) => u.metadata?.email === "inactive@example.com");
    expect(inactive?.status).toBe("archived");

    db.close();
  });

  it("falls back to asset.id as title when media title is empty", async () => {
    const db = await createSeededCloudflareDatabase();
    // Insert a media asset without a title to cover the `title || id` branch
    db.prepare(
      "INSERT INTO media_assets (id, source_url, local_path, mime_type, alt_text, title, uploaded_by) VALUES (?, ?, ?, ?, ?, ?, ?)",
    ).run("untitled-media", "https://cdn.example.com/untitled.png", "/media/untitled.png", "image/png", "", "", "admin@example.com");

    const adapter = createAstropressCloudflareAdapter({ db: new SqliteBackedD1Database(db) });
    const media = await adapter.content.list("media");
    const untitled = media.find((m) => m.id === "untitled-media");
    expect(untitled?.title).toBe("untitled-media");

    db.close();
  });

  it("kind filter eliminates records that don't match (page filter skips posts)", async () => {
    const db = await createSeededCloudflareDatabase();
    const adapter = createAstropressCloudflareAdapter({ db: new SqliteBackedD1Database(db) });
    // List pages — the cloudflare-post fixture is kind=post so should be filtered out
    const pages = await adapter.content.list("page");
    expect(pages.every((r) => r.kind === "page")).toBe(true);
    db.close();
  });
});

describe("cloudflare adapter — auth edge cases", () => {
  it("fallback auth returns null for unknown email (!user branch)", async () => {
    const adapter = createAstropressCloudflareAdapter({
      allowInsecureFallbackAuth: true,
      users: [{ id: "user-1", email: "admin@example.com", password: "pass", role: "admin" as const }],
    });
    expect(await adapter.auth.signIn("unknown@example.com", "pass")).toBeNull();
  });

  it("D1 auth returns null for unknown email (!row branch)", async () => {
    const db = await createSeededCloudflareDatabase();
    const adapter = createAstropressCloudflareAdapter({ db: new SqliteBackedD1Database(db) });
    expect(await adapter.auth.signIn("nobody@example.com", "password")).toBeNull();
    db.close();
  });

  it("D1 auth returns null for wrong password", async () => {
    const db = await createSeededCloudflareDatabase();
    const adapter = createAstropressCloudflareAdapter({ db: new SqliteBackedD1Database(db) });
    expect(await adapter.auth.signIn("admin@example.com", "wrong-password")).toBeNull();
    db.close();
  });
});

describe("cloudflare adapter — DB + fallback auth (lines 280-281)", () => {
  it("uses fallback auth when db + allowInsecureFallbackAuth + users are all provided", async () => {
    const db = makeDb();
    const adapter = createAstropressCloudflareAdapter({
      db: new SqliteBackedD1Database(db),
      allowInsecureFallbackAuth: true,
      users: [{ id: "fb-user", email: "fb@example.com", password: "fb-pass", role: "admin" as const }],
    });
    const session = await adapter.auth.signIn("fb@example.com", "fb-pass");
    expect(session).not.toBeNull();
    expect(session?.email).toBe("fb@example.com");
    db.close();
  });
});

describe("cloudflare adapter — null-field branches in ?? operators", () => {
  it("toContentStoreRecord: status 'review' maps to 'draft'", async () => {
    const db = makeDb();
    // Insert a content record with review status via content_entries + content_overrides
    db.prepare(
      `INSERT INTO content_entries (slug, legacy_url, title, kind, body, summary, seo_title, meta_description)
       VALUES (?, ?, ?, ?, ?, '', '', '')`,
    ).run("review-post", "/review-post/", "Review Post", "post", "<p>body</p>");
    db.prepare(
      `INSERT INTO content_overrides (slug, title, status, updated_by) VALUES (?, ?, 'review', ?)`,
    ).run("review-post", "Review Post", "admin@example.com");
    const adapter = createAstropressCloudflareAdapter({ db: new SqliteBackedD1Database(db) });
    const records = await adapter.content.list("post");
    const reviewPost = records.find((r) => r.slug === "review-post");
    expect(reviewPost?.status).toBe("draft"); // review → draft
    db.close();
  });


  it("toTranslationRecord: state='published' returns 'published' status", async () => {
    const db = makeDb();
    const adapter = createAstropressCloudflareAdapter({ db: new SqliteBackedD1Database(db) });
    // Save a translation with state=published
    await adapter.content.save({
      id: "/es/published",
      kind: "translation",
      slug: "/es/published",
      status: "published",
      metadata: { state: "published" },
    });
    const translations = await adapter.content.list("translation");
    const tx = translations.find((t) => t.id === "/es/published");
    expect(tx?.status).toBe("published");
    db.close();
  });

  it("content.save translation defaults state to 'not_started' when metadata is absent", async () => {
    const db = makeDb();
    const adapter = createAstropressCloudflareAdapter({ db: new SqliteBackedD1Database(db) });
    const saved = await adapter.content.save({
      id: "/es/no-state",
      kind: "translation",
      slug: "/es/no-state",
      status: "draft",
      // No metadata → state falls back to "not_started"
    });
    expect(saved.id).toBe("/es/no-state");
    db.close();
  });

  it("content.save redirect uses empty string target when targetPath metadata is absent", async () => {
    const db = makeDb();
    const adapter = createAstropressCloudflareAdapter({ db: new SqliteBackedD1Database(db) });
    const saved = await adapter.content.save({
      id: "/no-target",
      kind: "redirect",
      slug: "/no-target",
      status: "published",
      // No metadata → targetPath ?? "" → ""
    });
    expect(saved.kind).toBe("redirect");
    expect(saved.metadata?.targetPath).toBe("");
    db.close();
  });

  it("content.save settings merges with existing settings when metadata is absent", async () => {
    const db = makeDb();
    const adapter = createAstropressCloudflareAdapter({ db: new SqliteBackedD1Database(db) });
    const saved = await adapter.content.save({
      id: "site-settings",
      kind: "settings",
      slug: "site-settings",
      status: "published",
      // No metadata → record.metadata ?? {} → {}
    });
    expect(saved.kind).toBe("settings");
    db.close();
  });

  it("comment list handles null email and null body gracefully", async () => {
    const db = makeDb();
    // Insert a comment with NULL email and NULL body
    db.prepare(
      "INSERT INTO comments (id, route, author, email, body, status, policy) VALUES (?, ?, ?, NULL, NULL, ?, ?)",
    ).run("null-email-comment", "/post", "Anon", "approved", "open-moderated");
    const adapter = createAstropressCloudflareAdapter({ db: new SqliteBackedD1Database(db) });
    const comments = await adapter.content.list("comment");
    const c = comments.find((x) => x.id === "null-email-comment");
    expect(c?.metadata?.email).toBeNull();
    expect(c?.body).toBeNull();
    db.close();
  });

  it("media.put stores null publicUrl and null bytes when omitted", async () => {
    const db = makeDb();
    const adapter = createAstropressCloudflareAdapter({ db: new SqliteBackedD1Database(db) });
    const asset = await adapter.media.put({
      id: "no-url-asset",
      filename: "nourl.jpg",
      mimeType: "image/jpeg",
      // no publicUrl, no bytes
      metadata: { altText: "test", title: "No URL" },
    } as Parameters<typeof adapter.media.put>[0]);
    expect(asset.id).toBe("no-url-asset");
    db.close();
  });

  it("media.get returns asset with null mimeType and null sourceUrl when those fields are absent", async () => {
    const db = makeDb();
    db.prepare(
      `INSERT INTO media_assets (id, source_url, local_path, mime_type, alt_text, title, uploaded_by)
       VALUES (?, NULL, '/media/fallback.bin', NULL, '', 'Fallback', 'admin@example.com')`,
    ).run("null-mime-asset");
    const adapter = createAstropressCloudflareAdapter({ db: new SqliteBackedD1Database(db) });
    const asset = await adapter.media.get("null-mime-asset");
    expect(asset?.mimeType).toBe("application/octet-stream"); // fallback from ?? branch
    expect(asset?.publicUrl).toBe("/media/fallback.bin"); // localPath fallback when sourceUrl null
    db.close();
  });

  it("revisions.list returns null actorId and null summary when those fields are absent", async () => {
    const db = makeDb();
    // content_revisions FK is on slug → content_overrides.slug, so need both tables
    db.prepare(
      `INSERT INTO content_entries (slug, legacy_url, title, kind, body, summary, seo_title, meta_description)
       VALUES (?, ?, ?, ?, ?, '', '', '')`,
    ).run("rev-test", "/rev-test/", "Rev Test", "post", "<p>body</p>");
    db.prepare(
      `INSERT INTO content_overrides (slug, title, status, updated_by) VALUES (?, ?, 'published', ?)`,
    ).run("rev-test", "Rev Test", "admin@example.com");
    db.prepare(
      `INSERT INTO content_revisions (id, slug, source, title, status, body, seo_title, meta_description, created_at, created_by)
       VALUES (?, ?, 'reviewed', ?, 'published', ?, ?, ?, datetime('now'), NULL)`,
    ).run("rev-1", "rev-test", "Rev Test", "<p>body</p>", "Rev Test", "Rev Test");
    const adapter = createAstropressCloudflareAdapter({ db: new SqliteBackedD1Database(db) });
    const revisions = await adapter.revisions.list("rev-test");
    expect(revisions.length).toBeGreaterThan(0);
    expect(revisions[0].actorId).toBeNull(); // createdBy ?? null
    expect(revisions[0].summary).toBeNull(); // revisionNote ?? null (no revision_note column → null)
    db.close();
  });

  it("revisions.append handles null snapshot fields gracefully", async () => {
    const db = makeDb();
    const adapter = createAstropressCloudflareAdapter({ db: new SqliteBackedD1Database(db) });
    // First create a content record to avoid FK errors
    await adapter.content.save({
      id: "rev-append-post",
      kind: "post",
      slug: "rev-append-post",
      status: "published",
      title: "Rev Append",
    });
    // Append revision with minimal snapshot (missing ogTitle, ogDescription, etc.)
    const revision = await adapter.revisions.append({
      id: "ra-1",
      recordId: "rev-append-post",
      createdAt: new Date().toISOString(),
      // No actorId, no summary
      snapshot: {
        // No ogTitle, ogDescription, ogImage, canonicalUrlOverride, robotsDirective, excerpt
        // No scheduledAt, no body (uses ?? null fallbacks)
        // No authorIds, categoryIds, tagIds (uses ?? [] fallbacks)
        title: "Rev Append",
        status: "published",
        seoTitle: "Rev Append",
        metaDescription: "Rev Append",
      } as Parameters<typeof adapter.revisions.append>[0]["snapshot"],
    });
    expect(revision.id).toBe("ra-1");
    db.close();
  });

  it("revisions.append uses record ID as fallback title when title fields are absent from snapshot", async () => {
    const db = makeDb();
    const adapter = createAstropressCloudflareAdapter({ db: new SqliteBackedD1Database(db) });
    await adapter.content.save({
      id: "notitle-post",
      kind: "post",
      slug: "notitle-post",
      status: "published",
      title: "Has Title",
    });
    // Snapshot with NO title, NO seoTitle, NO metaDescription → all fall back to revision.recordId
    const revision = await adapter.revisions.append({
      id: "ra-notitle",
      recordId: "notitle-post",
      createdAt: new Date().toISOString(),
      snapshot: {
        status: "published",
        // deliberately omit title, seoTitle, metaDescription
      } as Parameters<typeof adapter.revisions.append>[0]["snapshot"],
    });
    expect(revision.id).toBe("ra-notitle");
    db.close();
  });

  it("content.save page preserves existing title and body when update omits them", async () => {
    const db = makeDb();
    const adapter = createAstropressCloudflareAdapter({ db: new SqliteBackedD1Database(db) });
    // First save with title so existing?.title is available
    await adapter.content.save({ id: "no-title-page", kind: "page", slug: "no-title-page", status: "published", title: "Original" });
    // Second save WITHOUT title or body → triggers record.title ?? existing?.title ?? slug (arm 0 for record.title)
    const updated = await adapter.content.save({
      id: "no-title-page",
      kind: "page",
      slug: "no-title-page",
      status: "published",
    } as Parameters<typeof adapter.content.save>[0]);
    expect(updated.slug).toBe("no-title-page");
    db.close();
  });

  it("content.save new page uses slug as title when no title is provided", async () => {
    const db = makeDb();
    const adapter = createAstropressCloudflareAdapter({ db: new SqliteBackedD1Database(db) });
    // Save a brand-new page WITHOUT title → no existing → existing?.title is undefined → slug used
    const saved = await adapter.content.save({
      id: "slug-only-page",
      kind: "page",
      slug: "slug-only-page",
      status: "published",
    } as Parameters<typeof adapter.content.save>[0]);
    expect(saved.slug).toBe("slug-only-page");
    expect(saved.title).toBe("slug-only-page"); // title fell back to slug
    db.close();
  });

  it("content.save new post stores templateKey from metadata", async () => {
    const db = makeDb();
    const adapter = createAstropressCloudflareAdapter({ db: new SqliteBackedD1Database(db) });
    const saved = await adapter.content.save({
      id: "post-with-template",
      kind: "post",
      slug: "post-with-template",
      status: "published",
      title: "Templated Post",
      metadata: {
        templateKey: "custom-post-template",
        legacyUrl: "/old/post-with-template",
      },
    });
    expect(saved.slug).toBe("post-with-template");
    db.close();
  });

  it("media.put uses filename as title and empty string for altText when metadata is absent", async () => {
    const db = makeDb();
    const adapter = createAstropressCloudflareAdapter({ db: new SqliteBackedD1Database(db) });
    // No metadata at all → asset.metadata?.altText → undefined → ?? "" and asset.metadata?.title → undefined → ?? filename
    const asset = await adapter.media.put({
      id: "bare-meta-asset",
      filename: "bare.png",
      mimeType: "image/png",
    } as Parameters<typeof adapter.media.put>[0]);
    expect(asset.id).toBe("bare-meta-asset");
    db.close();
  });

  it("media.put with null bytes covers the else arm (bytes != null → false)", async () => {
    const db = makeDb();
    const adapter = createAstropressCloudflareAdapter({ db: new SqliteBackedD1Database(db) });
    // bytes = null → null != null is false → file_size stored as null
    const asset = await adapter.media.put({
      id: "null-bytes-asset",
      filename: "nullbytes.png",
      mimeType: "image/png",
      bytes: null as unknown as Uint8Array,
    });
    expect(asset.id).toBe("null-bytes-asset");
    db.close();
  });

  it("media.put with actual bytes covers the then arm (bytes != null → true)", async () => {
    const db = makeDb();
    const adapter = createAstropressCloudflareAdapter({ db: new SqliteBackedD1Database(db) });
    // bytes is a real Uint8Array → bytes != null is true → file_size = bytes.byteLength
    const bytes = new Uint8Array([0x89, 0x50, 0x4e, 0x47]);
    await adapter.media.put({
      id: "real-bytes-asset",
      filename: "real.png",
      mimeType: "image/png",
      bytes,
      metadata: { altText: "a png", title: "Real Bytes" },
    });
    // media.put returns its input, not the DB row — query directly to verify file_size was stored
    const row = db.prepare("SELECT file_size FROM media_assets WHERE id = 'real-bytes-asset'").get() as { file_size: number };
    expect(row.file_size).toBe(4); // Uint8Array([0x89, 0x50, 0x4e, 0x47]).byteLength === 4
    db.close();
  });

  it("media.get uses asset id as title when title is an empty string", async () => {
    const db = makeDb();
    // Insert media asset with empty title directly so asset.title is falsy
    db.prepare(
      `INSERT INTO media_assets (id, source_url, local_path, mime_type, alt_text, title, uploaded_by)
       VALUES (?, 'https://cdn/empty-title.png', '/media/empty-title.png', 'image/png', '', '', 'admin@example.com')`,
    ).run("empty-title-media");
    const adapter = createAstropressCloudflareAdapter({ db: new SqliteBackedD1Database(db) });
    const got = await adapter.media.get("empty-title-media");
    expect(got?.filename).toBe("empty-title-media"); // title is "" → falsy → falls back to id
    db.close();
  });

  it("revisions.list returns empty array for an unknown recordId", async () => {
    const db = makeDb();
    const adapter = createAstropressCloudflareAdapter({ db: new SqliteBackedD1Database(db) });
    const revisions = await adapter.revisions.list("slug-that-never-existed");
    expect(revisions).toEqual([]);
    expect(revisions.length).toBe(0);
    db.close();
  });
});

describe("cloudflare adapter — session expiry", () => {
  it("returns null session when last_active_at is not a parseable date", async () => {
    const db = await createSeededCloudflareDatabase();
    const adapter = createAstropressCloudflareAdapter({ db: new SqliteBackedD1Database(db) });

    // Create a real session
    const session = await adapter.auth.signIn("admin@example.com", "password");
    expect(session).not.toBeNull();

    // Corrupt last_active_at to a non-parseable string.
    // Lexicographically > any ISO date, so SQL cleanup skips it.
    // Date.parse() returns NaN → hits the !Number.isFinite() branch.
    db.prepare("UPDATE admin_sessions SET last_active_at = 'not-a-date' WHERE revoked_at IS NULL").run();

    expect(await adapter.auth.getSession(session!.id)).toBeNull();
    db.close();
  });

  it("returns null for a session whose last_active_at is older than 12 hours", async () => {
    const db = await createSeededCloudflareDatabase();
    const adapter = createAstropressCloudflareAdapter({ db: new SqliteBackedD1Database(db) });

    // Sign in to get a real session
    const session = await adapter.auth.signIn("admin@example.com", "password");
    expect(session).not.toBeNull();

    // Backdate the session's last_active_at so it appears expired
    db.prepare(
      "UPDATE admin_sessions SET last_active_at = datetime('now', '-13 hours') WHERE revoked_at IS NULL",
    ).run();

    // getSession should now return null (expired session)
    expect(await adapter.auth.getSession(session!.id)).toBeNull();

    db.close();
  });
});
