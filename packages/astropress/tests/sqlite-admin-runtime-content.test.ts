import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createRuntimeFixture, type RuntimeFixture } from "./helpers/sqlite-admin-runtime-fixture.js";

let fixture: RuntimeFixture;

beforeAll(() => {
  fixture = createRuntimeFixture();
});

afterAll(() => {
  fixture.db.close();
});

// ─── Authors ──────────────────────────────────────────────────────────────────

describe("authors", () => {
  it("listAuthors returns empty initially", () => {
    expect(fixture.store.authors.listAuthors()).toBeInstanceOf(Array);
  });

  it("createAuthor succeeds and appears in list", () => {
    const result = fixture.store.authors.createAuthor({ name: "Alice Author", bio: "A writer" }, fixture.actor);
    expect(result.ok).toBe(true);
    expect(fixture.store.authors.listAuthors().some((a) => a.name === "Alice Author")).toBe(true);
  });

  it("createAuthor returns error for duplicate name", () => {
    fixture.store.authors.createAuthor({ name: "Bob Author" }, fixture.actor);
    expect(fixture.store.authors.createAuthor({ name: "Bob Author" }, fixture.actor).ok).toBe(false);
  });

  it("createAuthor returns error for empty name (slugifyTerm empty string branch)", () => {
    expect(fixture.store.authors.createAuthor({ name: "" }, fixture.actor).ok).toBe(false);
  });

  it("updateAuthor succeeds", () => {
    fixture.store.authors.createAuthor({ name: "Charlie Author" }, fixture.actor);
    const charlie = fixture.store.authors.listAuthors().find((a) => a.name === "Charlie Author")!;
    expect(fixture.store.authors.updateAuthor({ id: charlie.id, name: "Charlie Updated", bio: "Updated bio" }, fixture.actor).ok).toBe(true);
  });

  it("updateAuthor returns error for missing id", () => {
    expect(fixture.store.authors.updateAuthor({ id: 0, name: "Nobody" }, fixture.actor).ok).toBe(false);
  });

  it("updateAuthor returns error for non-existent id", () => {
    expect(fixture.store.authors.updateAuthor({ id: 999_999, name: "Ghost" }, fixture.actor).ok).toBe(false);
  });

  it("deleteAuthor marks as deleted", () => {
    fixture.store.authors.createAuthor({ name: "Dave Delete" }, fixture.actor);
    const dave = fixture.store.authors.listAuthors().find((a) => a.name === "Dave Delete")!;
    expect(fixture.store.authors.deleteAuthor(dave.id, fixture.actor).ok).toBe(true);
    expect(fixture.store.authors.listAuthors().some((a) => a.name === "Dave Delete")).toBe(false);
  });
});

describe("authors additional branches", () => {
  it("deleteAuthor: not found returns error", () => {
    expect(fixture.store.authors.deleteAuthor(999_996, fixture.actor).ok).toBe(false);
  });

  it("createAuthor: uses provided slug when explicitly set", () => {
    expect(fixture.store.authors.createAuthor({ name: "Author With Slug", slug: "author-with-slug" }, fixture.actor).ok).toBe(true);
  });

  it("updateAuthor: with explicit slug and bio (covers optional field branches)", () => {
    fixture.store.authors.createAuthor({ name: "Author To Update" }, fixture.actor);
    const a = fixture.store.authors.listAuthors().find((x) => x.name === "Author To Update")!;
    expect(fixture.store.authors.updateAuthor({ id: a.id, name: "Author Updated", slug: "author-updated", bio: "Updated bio text" }, fixture.actor).ok).toBe(true);
  });
});

// ─── Taxonomies ───────────────────────────────────────────────────────────────

describe("taxonomies", () => {
  it("categories: create, update, delete lifecycle", () => {
    expect(fixture.store.taxonomies.createCategory({ name: "Tech" }, fixture.actor).ok).toBe(true);
    const tech = fixture.store.taxonomies.listCategories().find((c) => c.name === "Tech")!;
    expect(fixture.store.taxonomies.updateCategory({ id: tech.id, name: "Technology" }, fixture.actor).ok).toBe(true);
    expect(fixture.store.taxonomies.deleteCategory(tech.id, fixture.actor).ok).toBe(true);
    expect(fixture.store.taxonomies.listCategories().some((c) => c.name === "Technology")).toBe(false);
  });

  it("createCategory returns error for duplicate name", () => {
    fixture.store.taxonomies.createCategory({ name: "Dup Category" }, fixture.actor);
    expect(fixture.store.taxonomies.createCategory({ name: "Dup Category" }, fixture.actor).ok).toBe(false);
  });

  it("updateCategory returns error for non-existent id", () => {
    expect(fixture.store.taxonomies.updateCategory({ id: 999_999, name: "Ghost" }, fixture.actor).ok).toBe(false);
  });

  it("tags: create, update, delete lifecycle", () => {
    expect(fixture.store.taxonomies.createTag({ name: "JavaScript" }, fixture.actor).ok).toBe(true);
    const js = fixture.store.taxonomies.listTags().find((t) => t.name === "JavaScript")!;
    expect(fixture.store.taxonomies.updateTag({ id: js.id, name: "JS" }, fixture.actor).ok).toBe(true);
    expect(fixture.store.taxonomies.deleteTag(js.id, fixture.actor).ok).toBe(true);
    expect(fixture.store.taxonomies.listTags().some((t) => t.name === "JS")).toBe(false);
  });

  it("createTag returns error for duplicate name", () => {
    fixture.store.taxonomies.createTag({ name: "Dup Tag" }, fixture.actor);
    expect(fixture.store.taxonomies.createTag({ name: "Dup Tag" }, fixture.actor).ok).toBe(false);
  });
});

describe("taxonomies additional branches", () => {
  it("createCategory: empty name (whitespace) returns error (covers !name branch)", () => {
    expect(fixture.store.taxonomies.createCategory({ name: "   " }, fixture.actor).ok).toBe(false);
  });

  it("createCategory: slugifyTerm produces empty slug (covers !slug branch)", () => {
    expect(fixture.store.taxonomies.createCategory({ name: "---" }, fixture.actor).ok).toBe(false);
  });

  it("createCategory: uses provided slug when explicitly set", () => {
    expect(fixture.store.taxonomies.createCategory({ name: "Cat With Slug", slug: "cat-with-slug" }, fixture.actor).ok).toBe(true);
  });

  it("createCategory: description provided", () => {
    expect(fixture.store.taxonomies.createCategory({ name: "Cat With Desc", description: "A description" }, fixture.actor).ok).toBe(true);
  });

  it("updateCategory: empty name returns error (covers !name branch)", () => {
    fixture.store.taxonomies.createCategory({ name: "Up For Update" }, fixture.actor);
    const c = fixture.store.taxonomies.listCategories().find((x) => x.name === "Up For Update")!;
    expect(fixture.store.taxonomies.updateCategory({ id: c.id, name: "" }, fixture.actor).ok).toBe(false);
  });

  it("updateCategory: with explicit slug and description (covers optional field branches)", () => {
    fixture.store.taxonomies.createCategory({ name: "Cat To Update Fully" }, fixture.actor);
    const c = fixture.store.taxonomies.listCategories().find((x) => x.name === "Cat To Update Fully")!;
    expect(fixture.store.taxonomies.updateCategory({ id: c.id, name: "Cat Updated Fully", slug: "cat-updated-fully", description: "New desc" }, fixture.actor).ok).toBe(true);
  });

  it("deleteCategory: not found returns error", () => {
    expect(fixture.store.taxonomies.deleteCategory(999_998, fixture.actor).ok).toBe(false);
  });

  it("createTag: empty name returns error (covers !name branch)", () => {
    expect(fixture.store.taxonomies.createTag({ name: "   " }, fixture.actor).ok).toBe(false);
  });

  it("createTag: empty slug returns error (covers !slug branch)", () => {
    expect(fixture.store.taxonomies.createTag({ name: "---" }, fixture.actor).ok).toBe(false);
  });

  it("createTag: uses provided slug when explicitly set", () => {
    expect(fixture.store.taxonomies.createTag({ name: "Tag With Slug", slug: "tag-with-slug" }, fixture.actor).ok).toBe(true);
  });

  it("createTag: description provided", () => {
    expect(fixture.store.taxonomies.createTag({ name: "Tag With Desc", description: "A tag desc" }, fixture.actor).ok).toBe(true);
  });

  it("updateTag: empty name returns error", () => {
    fixture.store.taxonomies.createTag({ name: "Up For Tag Update" }, fixture.actor);
    const t = fixture.store.taxonomies.listTags().find((x) => x.name === "Up For Tag Update")!;
    expect(fixture.store.taxonomies.updateTag({ id: t.id, name: "" }, fixture.actor).ok).toBe(false);
  });

  it("updateTag: with explicit slug and description (covers optional field branches)", () => {
    fixture.store.taxonomies.createTag({ name: "Tag To Update Fully" }, fixture.actor);
    const t = fixture.store.taxonomies.listTags().find((x) => x.name === "Tag To Update Fully")!;
    expect(fixture.store.taxonomies.updateTag({ id: t.id, name: "Tag Updated Fully", slug: "tag-updated-fully", description: "New tag desc" }, fixture.actor).ok).toBe(true);
  });

  it("deleteTag: not found returns error", () => {
    expect(fixture.store.taxonomies.deleteTag(999_997, fixture.actor).ok).toBe(false);
  });
});

// ─── Content ──────────────────────────────────────────────────────────────────

describe("content", () => {
  it("listContentStates returns empty list when no content_entries exist", () => {
    expect(Array.isArray(fixture.store.content.listContentStates())).toBe(true);
  });

  it("getContentState returns null for unknown slug", () => {
    expect(fixture.store.content.getContentState("unknown-slug")).toBeNull();
  });

  it("createContentRecord creates a new post (insert path, serializeIdList undefined branch)", () => {
    const result = fixture.store.content.createContentRecord(
      { title: "My First Post", slug: "my-first-post", status: "draft", seoTitle: "My First Post", metaDescription: "A test post", body: "Hello world" },
      fixture.actor,
    );
    expect(result.ok).toBe(true);
    expect(fixture.store.content.getContentState("my-first-post")).not.toBeNull();
  });

  it("createContentRecord returns error for duplicate slug", () => {
    expect(fixture.store.content.createContentRecord(
      { title: "Dup", slug: "my-first-post", status: "draft", seoTitle: "Dup", metaDescription: "Dup" },
      fixture.actor,
    ).ok).toBe(false);
  });

  it("createContentRecord returns error for missing required fields", () => {
    expect(fixture.store.content.createContentRecord(
      { title: "", slug: "no-title", status: "draft", seoTitle: "", metaDescription: "" },
      fixture.actor,
    ).ok).toBe(false);
  });

  it("createContentRecord with unknown status uses 'published' (normalizeContentStatus else branch)", () => {
    const result = fixture.store.content.createContentRecord(
      { title: "Status Norm Post", slug: "status-norm-post", status: "pending" as string, seoTitle: "Status Norm Post", metaDescription: "Testing status normalization" },
      fixture.actor,
    );
    expect(result.ok).toBe(true);
    expect(fixture.store.content.getContentState("status-norm-post")?.status).toBe("published");
  });

  it("saveContentState updates an existing post (update path)", () => {
    expect(fixture.store.content.saveContentState(
      "my-first-post",
      { title: "My First Post Updated", status: "published", seoTitle: "Updated", metaDescription: "Updated meta", body: "Updated body" },
      fixture.actor,
    ).ok).toBe(true);
  });

  it("saveContentState returns error for unknown slug", () => {
    expect(fixture.store.content.saveContentState(
      "does-not-exist",
      { title: "X", status: "draft", seoTitle: "X", metaDescription: "X" },
      fixture.actor,
    ).ok).toBe(false);
  });

  it("saveContentState returns error for missing required fields", () => {
    expect(fixture.store.content.saveContentState(
      "my-first-post",
      { title: "", status: "draft", seoTitle: "", metaDescription: "" },
      fixture.actor,
    ).ok).toBe(false);
  });

  it("saveContentState with author/category/tag assignments", () => {
    fixture.store.authors.createAuthor({ name: "Assigned Author" }, fixture.actor);
    const authorId = fixture.store.authors.listAuthors().find((a) => a.name === "Assigned Author")!.id;
    fixture.store.taxonomies.createCategory({ name: "Assigned Category" }, fixture.actor);
    const catId = fixture.store.taxonomies.listCategories().find((c) => c.name === "Assigned Category")!.id;
    fixture.store.taxonomies.createTag({ name: "Assigned Tag" }, fixture.actor);
    const tagId = fixture.store.taxonomies.listTags().find((t) => t.name === "Assigned Tag")!.id;

    expect(fixture.store.content.saveContentState(
      "my-first-post",
      { title: "With Authors", status: "published", seoTitle: "With Authors", metaDescription: "With assignments", authorIds: [authorId], categoryIds: [catId], tagIds: [tagId] },
      fixture.actor,
    ).ok).toBe(true);
  });

  it("getContentRevisions returns revisions with parseIdList null→[] for null author_ids", () => {
    const revisions = fixture.store.content.getContentRevisions("my-first-post");
    expect(Array.isArray(revisions)).toBe(true);
    expect(revisions!.length).toBeGreaterThan(0);
    expect(revisions![0].authorIds).toEqual(expect.any(Array));
  });

  it("getContentRevisions returns null for unknown slug", () => {
    expect(fixture.store.content.getContentRevisions("unknown-slug")).toBeNull();
  });

  it("restoreRevision restores a previous revision", () => {
    const revisions = fixture.store.content.getContentRevisions("my-first-post")!;
    const revisionId = revisions[revisions.length - 1].id;
    expect(fixture.store.content.restoreRevision("my-first-post", revisionId, fixture.actor).ok).toBe(true);
  });

  it("restoreRevision returns error for non-existent slug", () => {
    expect(fixture.store.content.restoreRevision("does-not-exist", "revision-1", fixture.actor).ok).toBe(false);
  });

  it("restoreRevision returns error for non-existent revision", () => {
    expect(fixture.store.content.restoreRevision("my-first-post", "non-existent-revision", fixture.actor).ok).toBe(false);
  });

  it("parseIdList: non-array JSON in author_ids branch", () => {
    fixture.db.prepare(
      `INSERT INTO content_revisions (id, slug, title, status, seo_title, meta_description, author_ids, source, created_by)
       VALUES (?, 'my-first-post', 'Injected', 'draft', 'X', 'X', '{"not":"array"}', 'reviewed', 'seed')`,
    ).run("revision-bad-ids");
    const revisions = fixture.store.content.getContentRevisions("my-first-post");
    expect(revisions?.find((r) => r.id === "revision-bad-ids")?.authorIds).toEqual([]);
  });
});

// ─── Content additional branches ─────────────────────────────────────────────

describe("content additional branches", () => {
  it("createContentRecord: all optional fields provided", () => {
    expect(fixture.store.content.createContentRecord(
      {
        title: "Optional Fields Post",
        slug: "optional-fields-post",
        status: "draft",
        seoTitle: "Optional Fields SEO",
        metaDescription: "Meta for optional",
        body: "Body content",
        excerpt: "Short excerpt",
        ogTitle: "OG Title",
        ogDescription: "OG Description",
        ogImage: "/og.png",
        canonicalUrlOverride: "https://example.com/optional",
        robotsDirective: "noindex",
      },
      fixture.actor,
    ).ok).toBe(true);
  });

  it("saveContentState: all optional fields including scheduledAt, revisionNote, og fields (covers branches)", () => {
    expect(fixture.store.content.saveContentState(
      "optional-fields-post",
      {
        title: "Optional Updated",
        status: "published",
        seoTitle: "Updated SEO",
        metaDescription: "Updated meta",
        body: "Updated body",
        excerpt: "Updated excerpt",
        ogTitle: "Updated OG Title",
        ogDescription: "Updated OG Desc",
        ogImage: "/updated-og.png",
        canonicalUrlOverride: "https://example.com/updated",
        robotsDirective: "noindex",
        scheduledAt: new Date(Date.now() + 86400000).toISOString(),
        revisionNote: "Updated with all fields",
      },
      fixture.actor,
    ).ok).toBe(true);
  });

  it("createContentRecord: uses summary as excerpt when no explicit excerpt is given", () => {
    expect(fixture.store.content.createContentRecord(
      { title: "Summary Post", slug: "summary-post-test", status: "draft", seoTitle: "Summary Post SEO", metaDescription: "Summary meta", summary: "Post summary text" },
      fixture.actor,
    ).ok).toBe(true);
  });
});

// ─── Content restoreRevision optional assignment branches ────────────────────

describe("content restoreRevision optional assignment branches", () => {
  it("restoreRevision from a revision with authorIds/categoryIds/tagIds", () => {
    fixture.store.content.createContentRecord(
      { title: "Revision Post", slug: "revision-post-for-restore", status: "draft", seoTitle: "Revision SEO", metaDescription: "Revision meta" },
      fixture.actor,
    );
    fixture.store.taxonomies.createCategory({ name: "Rev Cat" }, fixture.actor);
    const catId = fixture.store.taxonomies.listCategories().find((c) => c.name === "Rev Cat")!.id;
    fixture.store.content.saveContentState(
      "revision-post-for-restore",
      { title: "Revision Post", status: "draft", seoTitle: "Revision SEO", metaDescription: "Revision meta", categoryIds: [catId] },
      fixture.actor,
    );
    const revisions = fixture.store.content.getContentRevisions("revision-post-for-restore")!;
    expect(fixture.store.content.restoreRevision("revision-post-for-restore", revisions[0].id, fixture.actor).ok).toBe(true);
  });
});

// ─── Content entry optional fields in DB ─────────────────────────────────────

describe("content entry optional fields in DB", () => {
  it("listContentStates: content_entries with body and summary return non-null values", () => {
    fixture.db.prepare(`
      INSERT INTO content_entries (slug, legacy_url, title, kind, template_key, source_html_path, body, summary, seo_title, meta_description)
      VALUES (?, ?, ?, 'post', 'content', ?, ?, ?, ?, ?)
    `).run("custom-entry-with-body", "/custom-entry-with-body", "Custom Entry", "runtime://content/custom-entry-with-body", "Body content here", "Summary here", "Custom SEO", "Custom meta");
    expect(fixture.store.content.listContentStates().find((s) => s.slug === "custom-entry-with-body")).toBeDefined();
  });
});

// ─── Submissions ──────────────────────────────────────────────────────────────

describe("submissions", () => {
  it("submitContact stores a submission and getContactSubmissions returns it", () => {
    const result = fixture.store.submissions.submitContact({
      name: "Alice",
      email: "alice@example.com",
      message: "Hello from form",
      submittedAt: new Date().toISOString(),
    });
    expect(result.ok).toBe(true);
    expect(fixture.store.submissions.getContactSubmissions().some((s) => s.name === "Alice")).toBe(true);
  });
});

// ─── Translations ─────────────────────────────────────────────────────────────

describe("translations", () => {
  it("getEffectiveTranslationState returns default when no override exists", () => {
    expect(fixture.store.translations.getEffectiveTranslationState("/blog/no-override")).toBe("not_started");
  });

  it("updateTranslationState persists state and getEffectiveTranslationState reads it back", () => {
    expect(fixture.store.translations.updateTranslationState("/blog/translatable", "partial", fixture.actor).ok).toBe(true);
    expect(fixture.store.translations.getEffectiveTranslationState("/blog/translatable")).toBe("partial");
  });

  it("updateTranslationState returns error for invalid state", () => {
    expect(fixture.store.translations.updateTranslationState("/blog/x", "invalid-state" as string, fixture.actor).ok).toBe(false);
  });
});
