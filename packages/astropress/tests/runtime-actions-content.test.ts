import { DatabaseSync } from "node:sqlite";
import { beforeEach, describe, expect, it } from "vitest";

import { registerCms } from "../src/config";
import { readAstropressSqliteSchemaSql } from "../src/sqlite-bootstrap.js";
import { makeLocals } from "./helpers/make-locals.js";
import {
  createRuntimeContentRecord,
  restoreRuntimeRevision,
  saveRuntimeContentState,
} from "../src/runtime-actions-content";

function makeDb() {
  const db = new DatabaseSync(":memory:");
  db.exec(readAstropressSqliteSchemaSql());
  return db;
}

const actor = { email: "admin@test.local", role: "admin" as const, name: "Test Admin" };

let db: DatabaseSync;
let locals: App.Locals;

beforeEach(() => {
  db = makeDb();
  locals = makeLocals(db);
  registerCms({ templateKeys: ["content"], siteUrl: "https://example.com", seedPages: [], archives: [], translationStatus: [] });

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
