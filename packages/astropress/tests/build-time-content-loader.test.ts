import { describe, expect, it } from "vitest";
import {
  normalizeProviderCapabilities,
  assertProviderContract,
  type AstropressPlatformAdapter,
  type ContentStoreRecord,
  type ContentListOptions,
} from "@astropress-diy/astropress";
import { createAstropressBuildTimeLoader } from "../src/build-time-content-loader";

function makeTestRecord(
  overrides: Partial<ContentStoreRecord> & Pick<ContentStoreRecord, "id" | "kind" | "slug" | "status">,
): ContentStoreRecord {
  return {
    title: overrides.title ?? `Title for ${overrides.slug}`,
    body: null,
    locale: null,
    metadata: {},
    ...overrides,
  };
}

function createFilteringAdapter(records: ContentStoreRecord[]): AstropressPlatformAdapter {
  return assertProviderContract({
    capabilities: normalizeProviderCapabilities({ name: "test-filtering" }),
    content: {
      async list(kind, options?: ContentListOptions) {
        let results = [...records];

        if (kind) {
          results = results.filter((r) => r.kind === kind);
        }

        if (options?.status && options.status !== "all") {
          results = results.filter((r) => r.status === options.status);
        }

        if (options?.locale) {
          results = results.filter((r) => !r.locale || r.locale === options.locale);
        }

        if (options?.offset) {
          results = results.slice(options.offset);
        }

        if (options?.limit !== undefined) {
          results = results.slice(0, options.limit);
        }

        return results;
      },
      async get(id) {
        return records.find((r) => r.id === id) ?? null;
      },
      async save(record) {
        return record;
      },
      async delete() {},
    },
    media: {
      async put(a) {
        return a;
      },
      async get() {
        return null;
      },
      async delete() {},
    },
    revisions: {
      async list() {
        return [];
      },
      async append(r) {
        return r;
      },
    },
    auth: {
      async signIn() {
        return null;
      },
      async signOut() {},
      async getSession() {
        return null;
      },
    },
  });
}

describe("ContentListOptions", () => {
  it("list accepts status filter and returns only published records", async () => {
    const records: ContentStoreRecord[] = [
      makeTestRecord({ id: "a", kind: "post", slug: "hello-world", status: "published" }),
      makeTestRecord({ id: "b", kind: "post", slug: "unpublished", status: "draft" }),
    ];
    const adapter = createFilteringAdapter(records);

    const published = await adapter.content.list("post", { status: "published" });
    expect(published.map((r) => r.slug)).toEqual(["hello-world"]);
  });

  it("list with no status filter returns all records", async () => {
    const records: ContentStoreRecord[] = [
      makeTestRecord({ id: "a", kind: "post", slug: "hello-world", status: "published" }),
      makeTestRecord({ id: "b", kind: "post", slug: "draft-post", status: "draft" }),
    ];
    const adapter = createFilteringAdapter(records);

    const all = await adapter.content.list("post");
    expect(all).toHaveLength(2);
  });

  it("list with kind and status filter returns only matching records", async () => {
    const records: ContentStoreRecord[] = [
      makeTestRecord({ id: "a", kind: "post", slug: "post-1", status: "published" }),
      makeTestRecord({ id: "b", kind: "page", slug: "page-1", status: "published" }),
      makeTestRecord({ id: "c", kind: "post", slug: "post-draft", status: "draft" }),
    ];
    const adapter = createFilteringAdapter(records);

    const posts = await adapter.content.list("post", { status: "published" });
    expect(posts.map((r) => r.kind)).toEqual(["post"]);
    expect(posts.map((r) => r.slug)).toEqual(["post-1"]);
  });

  it("list respects limit and offset", async () => {
    const records: ContentStoreRecord[] = Array.from({ length: 10 }, (_, i) =>
      makeTestRecord({ id: `post-${i}`, kind: "post", slug: `post-${i}`, status: "published" }),
    );
    const adapter = createFilteringAdapter(records);

    const page1 = await adapter.content.list("post", { status: "published", limit: 3, offset: 0 });
    expect(page1).toHaveLength(3);

    const page2 = await adapter.content.list("post", { status: "published", limit: 3, offset: 3 });
    expect(page2).toHaveLength(3);
    expect(page2[0].slug).toBe("post-3");
  });
});

describe("createAstropressBuildTimeLoader", () => {
  it("returns a loader with posts() and pages() factories", () => {
    const adapter = createFilteringAdapter([]);
    const loader = createAstropressBuildTimeLoader(adapter);

    expect(typeof loader.posts).toBe("function");
    expect(typeof loader.pages).toBe("function");
  });

  it("posts loader fetches only published posts", async () => {
    const records: ContentStoreRecord[] = [
      makeTestRecord({ id: "a", kind: "post", slug: "live-post", status: "published" }),
      makeTestRecord({ id: "b", kind: "post", slug: "draft-post", status: "draft" }),
      makeTestRecord({ id: "c", kind: "page", slug: "a-page", status: "published" }),
    ];
    const adapter = createFilteringAdapter(records);
    const loader = createAstropressBuildTimeLoader(adapter);

    const posts = await loader.posts().load();
    expect(posts).toHaveLength(1);
    expect(posts[0].slug).toBe("live-post");
    expect(posts[0].kind).toBe("post");
  });

  it("pages loader fetches only published pages", async () => {
    const records: ContentStoreRecord[] = [
      makeTestRecord({ id: "a", kind: "page", slug: "about", status: "published" }),
      makeTestRecord({ id: "b", kind: "page", slug: "draft-page", status: "draft" }),
      makeTestRecord({ id: "c", kind: "post", slug: "a-post", status: "published" }),
    ];
    const adapter = createFilteringAdapter(records);
    const loader = createAstropressBuildTimeLoader(adapter);

    const pages = await loader.pages().load();
    expect(pages).toHaveLength(1);
    expect(pages[0].slug).toBe("about");
    expect(pages[0].kind).toBe("page");
  });

  it("each returned record has the required ContentStoreRecord shape", async () => {
    const records: ContentStoreRecord[] = [
      makeTestRecord({ id: "post-1", kind: "post", slug: "post-1", status: "published", title: "Hello World" }),
    ];
    const adapter = createFilteringAdapter(records);
    const loader = createAstropressBuildTimeLoader(adapter);

    const posts = await loader.posts().load();
    const record = posts[0];

    expect(record).toHaveProperty("id");
    expect(record).toHaveProperty("kind");
    expect(record).toHaveProperty("slug");
    expect(record).toHaveProperty("status");
    expect(record).toHaveProperty("title");
  });

  it("loader kind property matches the content kind", () => {
    const adapter = createFilteringAdapter([]);
    const loader = createAstropressBuildTimeLoader(adapter);

    expect(loader.posts().kind).toBe("post");
    expect(loader.pages().kind).toBe("page");
  });

  it("respects locale option when provided", async () => {
    const records: ContentStoreRecord[] = [
      makeTestRecord({ id: "a", kind: "post", slug: "en-post", status: "published", locale: "en" }),
      makeTestRecord({ id: "b", kind: "post", slug: "fr-post", status: "published", locale: "fr" }),
    ];
    const adapter = createFilteringAdapter(records);
    const loader = createAstropressBuildTimeLoader(adapter, { locale: "en" });

    const posts = await loader.posts().load();
    expect(posts).toHaveLength(1);
    expect(posts[0].slug).toBe("en-post");
  });
});
