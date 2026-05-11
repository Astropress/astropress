import { describe, expect, it } from "vitest";
import {
	getD1ContentAssignmentIds,
	mapPersistedOverride,
	mergeContentOverride,
	type PageRecord,
} from "../src/d1-store-content-helpers";
import { makeDb } from "./helpers/make-db.js";
import { SqliteBackedD1Database } from "./helpers/provider-test-fixtures.js";

const basePage: PageRecord = {
	slug: "hello",
	legacyUrl: "/hello",
	title: "Hello",
	templateKey: "content",
	listingItems: [],
	paginationLinks: [],
	sourceHtmlPath: "runtime://content/hello",
	updatedAt: "2025-01-01T00:00:00Z",
};

describe("mapPersistedOverride", () => {
	it("returns null when the row is null", () => {
		expect(mapPersistedOverride(null)).toBeNull();
	});

	it("maps a full row into a ContentOverride and strips the metadata column from the result", () => {
		const r = mapPersistedOverride({
			title: "T",
			status: "published",
			scheduled_at: "2025-02-01T00:00:00Z",
			body: "<p>b</p>",
			seo_title: "S",
			meta_description: "M",
			excerpt: "e",
			og_title: "OT",
			og_description: "OD",
			og_image: "https://example.com/og.png",
			canonical_url_override: "https://example.com/c",
			robots_directive: "noindex",
			// The D1 schema does not include a metadata column; the helper must drop it
			// from the returned object even if the upstream mapper attached one.
			metadata: JSON.stringify({ leaked: true }),
		});
		expect(r).not.toBeNull();
		expect(r).toEqual({
			title: "T",
			status: "published",
			scheduledAt: "2025-02-01T00:00:00Z",
			body: "<p>b</p>",
			seoTitle: "S",
			metaDescription: "M",
			excerpt: "e",
			ogTitle: "OT",
			ogDescription: "OD",
			ogImage: "https://example.com/og.png",
			canonicalUrlOverride: "https://example.com/c",
			robotsDirective: "noindex",
		});
		expect(r as object).not.toHaveProperty("metadata");
	});
});

describe("getD1ContentAssignmentIds", () => {
	function seedSlug(db: ReturnType<typeof makeDb>, slug: string) {
		// content_authors/categories/tags FK back to content_overrides(slug)
		db.prepare(
			`INSERT INTO content_overrides (slug, title, status, updated_by) VALUES (?, ?, ?, ?)`,
		).run(slug, slug, "draft", "seed@test.local");
		db.prepare("INSERT OR IGNORE INTO authors (id, slug, name) VALUES (1, 'a1', 'A1')").run();
		db.prepare("INSERT OR IGNORE INTO authors (id, slug, name) VALUES (2, 'a2', 'A2')").run();
		db.prepare(
			"INSERT OR IGNORE INTO categories (id, name, slug) VALUES (10, 'Cat10', 'cat-10')",
		).run();
		db.prepare(
			"INSERT OR IGNORE INTO categories (id, name, slug) VALUES (11, 'Cat11', 'cat-11')",
		).run();
		db.prepare("INSERT OR IGNORE INTO tags (id, name, slug) VALUES (100, 'Tag', 'tag')").run();
	}

	it("returns empty arrays when no assignments exist", async () => {
		const db = makeDb();
		const d1 = new SqliteBackedD1Database(db);
		db.prepare(
			`INSERT INTO content_overrides (slug, title, status, updated_by) VALUES (?, ?, ?, ?)`,
		).run("nope", "nope", "draft", "seed@test.local");
		const ids = await getD1ContentAssignmentIds(d1, "nope");
		expect(ids).toEqual({ authorIds: [], categoryIds: [], tagIds: [] });
	});

	it("returns author/category/tag ids in ASC order (not insertion order)", async () => {
		const db = makeDb();
		const d1 = new SqliteBackedD1Database(db);
		seedSlug(db, "hello");
		// Insert author/category/tag links in *descending* order so the ORDER BY ASC is observable
		db.prepare("INSERT INTO content_authors (slug, author_id) VALUES ('hello', 2)").run();
		db.prepare("INSERT INTO content_authors (slug, author_id) VALUES ('hello', 1)").run();
		db.prepare("INSERT INTO content_categories (slug, category_id) VALUES ('hello', 11)").run();
		db.prepare("INSERT INTO content_categories (slug, category_id) VALUES ('hello', 10)").run();
		db.prepare("INSERT INTO content_tags (slug, tag_id) VALUES ('hello', 100)").run();

		const ids = await getD1ContentAssignmentIds(d1, "hello");
		expect(ids.authorIds).toEqual([1, 2]);
		expect(ids.categoryIds).toEqual([10, 11]);
		expect(ids.tagIds).toEqual([100]);
	});

	it("scopes the query to the requested slug", async () => {
		const db = makeDb();
		const d1 = new SqliteBackedD1Database(db);
		seedSlug(db, "hello");
		seedSlug(db, "other");
		db.prepare("INSERT INTO content_authors (slug, author_id) VALUES ('hello', 1)").run();
		db.prepare("INSERT INTO content_authors (slug, author_id) VALUES ('other', 2)").run();
		const ids = await getD1ContentAssignmentIds(d1, "hello");
		expect(ids.authorIds).toEqual([1]);
	});
});

describe("mergeContentOverride", () => {
	const assignments = { authorIds: [1], categoryIds: [2], tagIds: [3] };

	it("preserves page record fields when override is null and supplies the default status 'published'", () => {
		const r = mergeContentOverride(basePage, null, assignments);
		expect(r.title).toBe("Hello");
		expect(r.status).toBe("published");
		expect(r.body).toBeUndefined();
		expect(r.authorIds).toEqual([1]);
		expect(r.categoryIds).toEqual([2]);
		expect(r.tagIds).toEqual([3]);
		expect(r.seoTitle).toBe("Hello");
		expect(r.metaDescription).toBe("");
		expect(r.excerpt).toBeUndefined();
		expect(r.ogTitle).toBeUndefined();
		expect(r.ogDescription).toBeUndefined();
		expect(r.ogImage).toBeUndefined();
		expect(r.canonicalUrlOverride).toBeUndefined();
		expect(r.robotsDirective).toBeUndefined();
	});

	it("uses the page record status when override.status is absent and the page record carries one", () => {
		const r = mergeContentOverride({ ...basePage, status: "draft" }, null, assignments);
		expect(r.status).toBe("draft");
	});

	it("overrides every field when override is fully populated", () => {
		const r = mergeContentOverride(
			basePage,
			{
				title: "Override T",
				status: "draft",
				scheduledAt: "2025-02-01",
				body: "<p>override</p>",
				seoTitle: "Override SEO",
				metaDescription: "Override Meta",
				excerpt: "Override excerpt",
				ogTitle: "OG-T",
				ogDescription: "OG-D",
				ogImage: "https://example.com/og.png",
				canonicalUrlOverride: "https://example.com/c",
				robotsDirective: "noindex",
			},
			assignments,
		);
		expect(r.title).toBe("Override T");
		expect(r.status).toBe("draft");
		expect(r.scheduledAt).toBe("2025-02-01");
		expect(r.body).toBe("<p>override</p>");
		expect(r.seoTitle).toBe("Override SEO");
		expect(r.metaDescription).toBe("Override Meta");
		expect(r.excerpt).toBe("Override excerpt");
		expect(r.ogTitle).toBe("OG-T");
		expect(r.ogDescription).toBe("OG-D");
		expect(r.ogImage).toBe("https://example.com/og.png");
		expect(r.canonicalUrlOverride).toBe("https://example.com/c");
		expect(r.robotsDirective).toBe("noindex");
	});

	it("falls back metaDescription through pageRecord.metaDescription, then pageRecord.summary, then ''", () => {
		expect(
			mergeContentOverride(
				{ ...basePage, metaDescription: "PR Meta", summary: "PR Summary" },
				null,
				assignments,
			).metaDescription,
		).toBe("PR Meta");
		expect(
			mergeContentOverride({ ...basePage, summary: "PR Summary" }, null, assignments)
				.metaDescription,
		).toBe("PR Summary");
		expect(mergeContentOverride(basePage, null, assignments).metaDescription).toBe("");
	});

	it("falls back seoTitle through pageRecord.seoTitle, then pageRecord.title", () => {
		expect(
			mergeContentOverride({ ...basePage, seoTitle: "PR SEO" }, null, assignments).seoTitle,
		).toBe("PR SEO");
		expect(mergeContentOverride({ ...basePage, title: "Page T" }, null, assignments).seoTitle).toBe(
			"Page T",
		);
	});

	it("uses pageRecord.summary as excerpt when override.excerpt is absent", () => {
		expect(
			mergeContentOverride({ ...basePage, summary: "PR Summary" }, null, assignments).excerpt,
		).toBe("PR Summary");
	});

	it("uses pageRecord.body when override.body is absent", () => {
		expect(mergeContentOverride({ ...basePage, body: "PR body" }, null, assignments).body).toBe(
			"PR body",
		);
	});

	it("passes assignments through verbatim", () => {
		const r = mergeContentOverride(basePage, null, {
			authorIds: [7, 8],
			categoryIds: [9],
			tagIds: [],
		});
		expect(r.authorIds).toEqual([7, 8]);
		expect(r.categoryIds).toEqual([9]);
		expect(r.tagIds).toEqual([]);
	});
});
