import type { DatabaseSync } from "node:sqlite";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { registerCms } from "../src/config";
import type { ContentOverride } from "../src/persistence-types";
import {
	ensureD1BaselineRevision,
	findPageRecord,
	getCustomContentEntries,
	getPageRecords,
	mapContentState,
	normalizeContentStatus,
	type PageRecord,
	replaceD1ContentAssignments,
	validateContentTypeFields,
} from "../src/runtime-actions-content-shared";
import { makeDb, STANDARD_CMS_CONFIG } from "./helpers/make-db.js";
import { makeLocals } from "./helpers/make-locals.js";
import { SqliteBackedD1Database } from "./helpers/provider-test-fixtures.js";

const CMS_CONFIG_KEY = Symbol.for("astropress.cms-config");

function resetConfigStoreForTest(): void {
	delete (globalThis as Record<symbol, unknown>)[CMS_CONFIG_KEY];
}

let db: DatabaseSync;
let locals: App.Locals;

beforeEach(() => {
	db = makeDb();
	locals = makeLocals(db);
	registerCms(STANDARD_CMS_CONFIG);
});

afterEach(() => {
	resetConfigStoreForTest();
});

// ---------------------------------------------------------------------------
// normalizeContentStatus
// ---------------------------------------------------------------------------

describe("normalizeContentStatus", () => {
	it("returns 'draft' unchanged", () => {
		expect(normalizeContentStatus("draft")).toBe("draft");
	});
	it("returns 'review' unchanged", () => {
		expect(normalizeContentStatus("review")).toBe("review");
	});
	it("returns 'archived' unchanged", () => {
		expect(normalizeContentStatus("archived")).toBe("archived");
	});
	it("returns 'published' unchanged", () => {
		expect(normalizeContentStatus("published")).toBe("published");
	});
	it("falls back to 'published' for undefined", () => {
		expect(normalizeContentStatus(undefined)).toBe("published");
	});
	it("falls back to 'published' for null", () => {
		expect(normalizeContentStatus(null)).toBe("published");
	});
	it("falls back to 'published' for arbitrary unknown strings", () => {
		expect(normalizeContentStatus("garbage")).toBe("published");
	});
	it("falls back to 'published' for the empty string", () => {
		expect(normalizeContentStatus("")).toBe("published");
	});
});

// ---------------------------------------------------------------------------
// getCustomContentEntries — fallback semantics on null DB columns
// ---------------------------------------------------------------------------

describe("getCustomContentEntries", () => {
	it("applies '' fallback for null body and null summary, derives metaDescription from title when both are null", async () => {
		db.prepare(
			`INSERT INTO content_entries (slug, legacy_url, title, kind, template_key, source_html_path, body, summary, seo_title, meta_description)
       VALUES ('a', '/a', 'Title A', 'post', 'content', 'runtime://content/a', NULL, NULL, NULL, NULL)`,
		).run();
		const adminDb = new SqliteBackedD1Database(db);
		const entries = await getCustomContentEntries(adminDb);
		expect(entries).toHaveLength(1);
		const e = entries[0];
		expect(e.body).toBe("");
		expect(e.summary).toBe("");
		expect(e.seoTitle).toBe("Title A");
		expect(e.metaDescription).toBe("");
	});

	it("uses summary as metaDescription fallback when meta_description is null but summary is present", async () => {
		db.prepare(
			`INSERT INTO content_entries (slug, legacy_url, title, kind, template_key, source_html_path, body, summary, seo_title, meta_description)
       VALUES ('b', '/b', 'Title B', 'post', 'content', 'runtime://content/b', '<p/>', 'A summary', 'SEO B', NULL)`,
		).run();
		const adminDb = new SqliteBackedD1Database(db);
		const [e] = await getCustomContentEntries(adminDb);
		expect(e.body).toBe("<p/>");
		expect(e.summary).toBe("A summary");
		expect(e.seoTitle).toBe("SEO B");
		expect(e.metaDescription).toBe("A summary");
	});

	it("preserves explicit non-null fields when present", async () => {
		db.prepare(
			`INSERT INTO content_entries (slug, legacy_url, title, kind, template_key, source_html_path, body, summary, seo_title, meta_description)
       VALUES ('c', '/c', 'Title C', 'post', 'content', 'runtime://content/c', 'BODY', 'SUM', 'SEO', 'META')`,
		).run();
		const adminDb = new SqliteBackedD1Database(db);
		const [e] = await getCustomContentEntries(adminDb);
		expect(e.body).toBe("BODY");
		expect(e.summary).toBe("SUM");
		expect(e.seoTitle).toBe("SEO");
		expect(e.metaDescription).toBe("META");
		expect(e.status).toBe("draft");
	});
});

// ---------------------------------------------------------------------------
// findPageRecord — branches: no-db, slug match, legacyUrl match, no match
// ---------------------------------------------------------------------------

describe("findPageRecord", () => {
	it("falls back to seedPages and matches a seed by slug when its legacyUrl is unrelated to the lookup string", async () => {
		registerCms({
			...STANDARD_CMS_CONFIG,
			seedPages: [
				{
					slug: "wrong-one",
					legacyUrl: "/wrong-one",
					title: "Wrong",
					sourceHtmlPath: "runtime://content/wrong",
					updatedAt: "2025-01-01",
				},
				{
					// slug matches the lookup, but legacyUrl is intentionally NOT '/seeded'
					// so an `||`→`&&` mutant on the find predicate would miss it.
					slug: "seeded",
					legacyUrl: "/different-path",
					title: "Seeded",
					sourceHtmlPath: "runtime://content/seeded",
					updatedAt: "2025-01-01",
				},
			],
		});
		const result = await findPageRecord("seeded", null);
		expect(result?.slug).toBe("seeded");
		expect(result?.legacyUrl).toBe("/different-path");
	});

	it("falls back to seedPages and matches a seed by legacyUrl '/${slug}' when the seed's own slug differs", async () => {
		registerCms({
			...STANDARD_CMS_CONFIG,
			seedPages: [
				{
					slug: "canonical",
					legacyUrl: "/lookup-via-legacy",
					title: "Canonical",
					sourceHtmlPath: "runtime://content/canon",
					updatedAt: "2025-01-01",
				},
			],
		});
		const result = await findPageRecord("lookup-via-legacy", null);
		expect(result?.slug).toBe("canonical");
	});

	it("returns null when admin db is absent and seedPages contains entries that do not match", async () => {
		registerCms({
			...STANDARD_CMS_CONFIG,
			seedPages: [
				{
					slug: "alpha",
					legacyUrl: "/alpha",
					title: "A",
					sourceHtmlPath: "runtime://content/a",
					updatedAt: "2025-01-01",
				},
				{
					slug: "beta",
					legacyUrl: "/beta",
					title: "B",
					sourceHtmlPath: "runtime://content/b",
					updatedAt: "2025-01-01",
				},
			],
		});
		const result = await findPageRecord("no-such-slug", null);
		expect(result).toBeNull();
	});

	it("matches by legacyUrl when slug differs", async () => {
		db.prepare(
			`INSERT INTO content_entries (slug, legacy_url, title, kind, template_key, source_html_path, body, summary, seo_title, meta_description)
       VALUES ('canonical-slug', '/legacy-path', 'L', 'post', 'content', 'runtime://content/legacy', NULL, NULL, NULL, NULL)`,
		).run();
		const result = await findPageRecord("legacy-path", locals);
		expect(result?.slug).toBe("canonical-slug");
		expect(result?.legacyUrl).toBe("/legacy-path");
	});

	it("matches by slug when legacyUrl differs", async () => {
		db.prepare(
			`INSERT INTO content_entries (slug, legacy_url, title, kind, template_key, source_html_path, body, summary, seo_title, meta_description)
       VALUES ('hello', '/some/other/path', 'Hello', 'post', 'content', 'runtime://content/hello', NULL, NULL, NULL, NULL)`,
		).run();
		const result = await findPageRecord("hello", locals);
		expect(result?.slug).toBe("hello");
	});

	it("returns null when neither slug nor legacyUrl matches anything", async () => {
		db.prepare(
			`INSERT INTO content_entries (slug, legacy_url, title, kind, template_key, source_html_path, body, summary, seo_title, meta_description)
       VALUES ('present', '/present', 'P', 'post', 'content', 'runtime://content/p', NULL, NULL, NULL, NULL)`,
		).run();
		const result = await findPageRecord("absent", locals);
		expect(result).toBeNull();
	});
});

// ---------------------------------------------------------------------------
// replaceD1ContentAssignments
// ---------------------------------------------------------------------------

describe("replaceD1ContentAssignments", () => {
	it("replaces all three pivot tables with the provided id sets", async () => {
		const adminDb = new SqliteBackedD1Database(db);
		// FK targets: a parent content_entries row plus admin_users / categories / tags entries.
		db.prepare(
			`INSERT INTO content_entries (slug, legacy_url, title, kind, template_key, source_html_path)
       VALUES ('s', '/s', 'S', 'post', 'content', 'runtime://content/s')`,
		).run();
		for (const id of [1, 2]) {
			db.prepare("INSERT INTO authors (id, slug, name) VALUES (?, ?, ?)").run(
				id,
				`a${id}`,
				`Author ${id}`,
			);
		}
		for (const id of [10, 20]) {
			db.prepare("INSERT INTO categories (id, slug, name) VALUES (?, ?, ?)").run(
				id,
				`c${id}`,
				`Cat ${id}`,
			);
		}
		for (const id of [100, 200]) {
			db.prepare("INSERT INTO tags (id, slug, name) VALUES (?, ?, ?)").run(
				id,
				`t${id}`,
				`Tag ${id}`,
			);
		}

		await replaceD1ContentAssignments(adminDb, "s", {
			authorIds: [1, 2],
			categoryIds: [10, 20],
			tagIds: [100, 200],
		});

		const authors = db
			.prepare("SELECT author_id FROM content_authors WHERE slug = 's' ORDER BY author_id")
			.all() as Array<{ author_id: number }>;
		const cats = db
			.prepare("SELECT category_id FROM content_categories WHERE slug = 's' ORDER BY category_id")
			.all() as Array<{ category_id: number }>;
		const tags = db
			.prepare("SELECT tag_id FROM content_tags WHERE slug = 's' ORDER BY tag_id")
			.all() as Array<{ tag_id: number }>;

		expect(authors.map((r) => r.author_id)).toEqual([1, 2]);
		expect(cats.map((r) => r.category_id)).toEqual([10, 20]);
		expect(tags.map((r) => r.tag_id)).toEqual([100, 200]);
	});
});

// ---------------------------------------------------------------------------
// mapContentState
// ---------------------------------------------------------------------------

describe("mapContentState", () => {
	it("merges override fields over the page record while preserving non-overridden ones", () => {
		const page: PageRecord = {
			slug: "p",
			legacyUrl: "/p",
			title: "Original",
			sourceHtmlPath: "runtime://content/p",
			updatedAt: "2025-01-01",
			body: "ORIG-BODY",
			seoTitle: "ORIG-SEO",
		};
		const override: ContentOverride = {
			title: "Overridden",
			status: "review",
			seoTitle: "NEW-SEO",
			metaDescription: "NEW-META",
		};
		const merged = mapContentState(page, override);
		expect(merged.slug).toBe("p");
		expect(merged.legacyUrl).toBe("/p");
		expect(merged.title).toBe("Overridden");
		expect(merged.status).toBe("review");
		expect(merged.seoTitle).toBe("NEW-SEO");
		expect(merged.metaDescription).toBe("NEW-META");
		expect(merged.body).toBe("ORIG-BODY");
		expect(merged.sourceHtmlPath).toBe("runtime://content/p");
	});
});

// ---------------------------------------------------------------------------
// validateContentTypeFields
// ---------------------------------------------------------------------------

describe("validateContentTypeFields", () => {
	it("returns null when no contentTypes are configured at all", () => {
		expect(validateContentTypeFields("content", {})).toBeNull();
	});

	it("returns null when peekCmsConfig itself is unset", () => {
		resetConfigStoreForTest();
		expect(validateContentTypeFields("anything", {})).toBeNull();
		registerCms(STANDARD_CMS_CONFIG);
	});

	it("returns null when templateKey does not match any registered contentType", () => {
		registerCms({
			...STANDARD_CMS_CONFIG,
			contentTypes: [
				{
					key: "recipe",
					label: "Recipe",
					fields: [{ name: "servings", label: "Servings", type: "number", required: true }],
				},
			],
		});
		expect(validateContentTypeFields("not-a-recipe", {})).toBeNull();
	});

	it("returns null when contentType is matched and validation passes", () => {
		registerCms({
			...STANDARD_CMS_CONFIG,
			contentTypes: [
				{
					key: "recipe",
					label: "Recipe",
					fields: [{ name: "servings", label: "Servings", type: "number", required: true }],
				},
			],
		});
		expect(validateContentTypeFields("recipe", { servings: 4 })).toBeNull();
	});

	it("returns the validation error string when a required field is missing", () => {
		registerCms({
			...STANDARD_CMS_CONFIG,
			contentTypes: [
				{
					key: "recipe",
					label: "Recipe",
					fields: [{ name: "servings", label: "Servings", type: "number", required: true }],
				},
			],
		});
		const result = validateContentTypeFields("recipe", {});
		expect(result).toBe('"Servings" is required.');
	});
});

// ---------------------------------------------------------------------------
// ensureD1BaselineRevision (covers baselineFields fallbacks via SQL bindings)
// ---------------------------------------------------------------------------

describe("ensureD1BaselineRevision", () => {
	it("upserts override + revision using all PageRecord fields when present", async () => {
		const adminDb = new SqliteBackedD1Database(db);
		const page: PageRecord = {
			slug: "full",
			legacyUrl: "/full",
			title: "Full Title",
			sourceHtmlPath: "runtime://content/full",
			updatedAt: "2025-01-01",
			body: "BODY-TEXT",
			summary: "SUM-TEXT",
			seoTitle: "SEO-TEXT",
			metaDescription: "META-TEXT",
			status: "draft",
		};
		await ensureD1BaselineRevision(adminDb, page);

		const override = db
			.prepare(
				"SELECT title, status, body, seo_title, meta_description, excerpt, updated_by FROM content_overrides WHERE slug = 'full'",
			)
			.get() as Record<string, unknown>;
		expect(override).toMatchObject({
			title: "Full Title",
			status: "draft",
			body: "BODY-TEXT",
			seo_title: "SEO-TEXT",
			meta_description: "META-TEXT",
			excerpt: "SUM-TEXT",
			updated_by: "seed-import",
		});

		const revision = db
			.prepare(
				"SELECT id, slug, title, status, body, seo_title, meta_description, excerpt, author_ids, category_ids, tag_ids, source, created_at, created_by FROM content_revisions WHERE slug = 'full'",
			)
			.get() as Record<string, unknown>;
		expect(revision).toMatchObject({
			slug: "full",
			title: "Full Title",
			status: "draft",
			body: "BODY-TEXT",
			seo_title: "SEO-TEXT",
			meta_description: "META-TEXT",
			excerpt: "SUM-TEXT",
			author_ids: "[]",
			category_ids: "[]",
			tag_ids: "[]",
			source: "imported",
			created_at: "imported-baseline",
			created_by: "seed-import",
		});
		expect(typeof revision.id).toBe("string");
		expect((revision.id as string).startsWith("revision-")).toBe(true);
	});

	it("applies fallbacks for missing optional fields (status→published, seoTitle→title, metaDesc→'', body→null, excerpt→null)", async () => {
		const adminDb = new SqliteBackedD1Database(db);
		const page: PageRecord = {
			slug: "spare",
			legacyUrl: "/spare",
			title: "Spare Title",
			sourceHtmlPath: "runtime://content/spare",
			updatedAt: "2025-01-01",
		};
		await ensureD1BaselineRevision(adminDb, page);

		const override = db
			.prepare(
				"SELECT title, status, body, seo_title, meta_description, excerpt FROM content_overrides WHERE slug = 'spare'",
			)
			.get() as Record<string, unknown>;
		expect(override.status).toBe("published");
		expect(override.body).toBeNull();
		expect(override.seo_title).toBe("Spare Title");
		expect(override.meta_description).toBe("");
		expect(override.excerpt).toBeNull();
	});

	it("uses summary as metaDescription fallback when metaDescription is absent but summary is set", async () => {
		const adminDb = new SqliteBackedD1Database(db);
		const page: PageRecord = {
			slug: "with-summary",
			legacyUrl: "/with-summary",
			title: "T",
			sourceHtmlPath: "runtime://content/ws",
			updatedAt: "2025-01-01",
			summary: "A SUMMARY",
		};
		await ensureD1BaselineRevision(adminDb, page);
		const override = db
			.prepare(
				"SELECT meta_description, excerpt FROM content_overrides WHERE slug = 'with-summary'",
			)
			.get() as Record<string, unknown>;
		expect(override.meta_description).toBe("A SUMMARY");
		expect(override.excerpt).toBe("A SUMMARY");
	});

	it("does not insert a second revision when an imported one already exists for the slug", async () => {
		const adminDb = new SqliteBackedD1Database(db);
		const page: PageRecord = {
			slug: "dup",
			legacyUrl: "/dup",
			title: "Dup",
			sourceHtmlPath: "runtime://content/dup",
			updatedAt: "2025-01-01",
		};
		await ensureD1BaselineRevision(adminDb, page);
		await ensureD1BaselineRevision(adminDb, page);
		const count = db
			.prepare(
				"SELECT COUNT(*) AS n FROM content_revisions WHERE slug = 'dup' AND source = 'imported'",
			)
			.get() as { n: number };
		expect(count.n).toBe(1);
	});
});

// ---------------------------------------------------------------------------
// getPageRecords — sanity passthrough
// ---------------------------------------------------------------------------

describe("getPageRecords", () => {
	it("reflects the seedPages registered on the active CMS config", () => {
		registerCms({
			...STANDARD_CMS_CONFIG,
			seedPages: [
				{
					slug: "x",
					legacyUrl: "/x",
					title: "X",
					sourceHtmlPath: "runtime://content/x",
					updatedAt: "2025-01-01",
				},
			],
		});
		const records = getPageRecords();
		expect(records.map((r) => r.slug)).toEqual(["x"]);
	});
});
