// Direct tests for src/sqlite-runtime/content-helpers.ts targeting Stryker
// survivors. Static imports + per-test DB ensure Stryker's per-test coverage
// tracker attributes the kills correctly.
import { DatabaseSync } from "node:sqlite";
import { beforeEach, describe, expect, it } from "vitest";

import { readAstropressSqliteSchemaSql } from "../src/sqlite-bootstrap.js";
import {
	type ContentEntryRow,
	insertRevision,
	mapContentEntryRow,
	pageRecordToContentRecord,
	queryContentAssignmentIds,
	replaceAssignments,
	tryInsertContentEntry,
} from "../src/sqlite-runtime/content-helpers.js";

function fullRow(over: Partial<ContentEntryRow> = {}): ContentEntryRow {
	return {
		slug: "post-1",
		legacy_url: "/legacy/post-1",
		title: "Title",
		kind: "post",
		template_key: "default",
		source_html_path: "src/post-1.html",
		updated_at: "2024-01-01T00:00:00Z",
		body: "BODY",
		summary: "SUMMARY",
		seo_title: "SEO",
		meta_description: "META",
		og_title: "OG",
		og_description: "OG-DESC",
		og_image: "https://img/x.png",
		...over,
	};
}

describe("mapContentEntryRow — null fallbacks and constant fields", () => {
	it("body defaults to literal empty string when row.body is null (kills 79:9 LogicalOperator ?? →&& and 79:21 StringLiteral)", () => {
		const out = mapContentEntryRow(fullRow({ body: null }));
		expect(out.body).toBe("");
		// 79:21 mutant `"Stryker was here!"` would make body that literal.
		expect(out.body).not.toContain("Stryker");
	});

	it("summary defaults to literal empty string when row.summary is null (kills 80:27 StringLiteral)", () => {
		const out = mapContentEntryRow(fullRow({ summary: null }));
		expect(out.summary).toBe("");
		expect(out.summary).not.toContain("Stryker");
	});

	it("metaDescription defaults to empty string when both meta_description and summary are null (kills 82:59 StringLiteral)", () => {
		const out = mapContentEntryRow(fullRow({ meta_description: null, summary: null }));
		expect(out.metaDescription).toBe("");
		expect(out.metaDescription).not.toContain("Stryker");
	});

	it("ogTitle is undefined (not null) when row.og_title is null (kills 83:12 LogicalOperator ?? →&&)", () => {
		const out = mapContentEntryRow(fullRow({ og_title: null }));
		expect(out.ogTitle).toBeUndefined();
		// `null ?? undefined` = undefined. Mutant `null && undefined` = null → not undefined.
		expect(out.ogTitle === undefined).toBe(true);
	});

	it("ogImage is undefined (not null) when row.og_image is null (kills 85:12 LogicalOperator ?? →&&)", () => {
		const out = mapContentEntryRow(fullRow({ og_image: null }));
		expect(out.ogImage).toBeUndefined();
		expect(out.ogImage === undefined).toBe(true);
	});

	it("seoTitle falls back to row.title when row.seo_title is null (kills 81:13 LogicalOperator ?? →&&)", () => {
		const out = mapContentEntryRow(fullRow({ seo_title: null, title: "FALLBACK-TITLE" }));
		// Mutant `row.seo_title && row.title` → null when seo_title is null.
		expect(out.seoTitle).toBe("FALLBACK-TITLE");
	});

	it("ogDescription is undefined (not null) when row.og_description is null (kills 84:18 LogicalOperator ?? →&&)", () => {
		const out = mapContentEntryRow(fullRow({ og_description: null }));
		expect(out.ogDescription).toBeUndefined();
		expect(out.ogDescription === undefined).toBe(true);
	});

	it("listingItems is an empty array (kills 75:17 ArrayDeclaration [])", () => {
		const out = mapContentEntryRow(fullRow());
		expect(Array.isArray(out.listingItems)).toBe(true);
		expect(out.listingItems).toHaveLength(0);
		// Mutant `["Stryker was here"]` → length 1.
	});

	it("paginationLinks is an empty array (kills 76:20 ArrayDeclaration [])", () => {
		const out = mapContentEntryRow(fullRow());
		expect(Array.isArray(out.paginationLinks)).toBe(true);
		expect(out.paginationLinks).toHaveLength(0);
	});

	it("preserves non-null body/summary verbatim (sanity for the original ?? branch)", () => {
		const out = mapContentEntryRow(fullRow({ body: "B", summary: "S" }));
		expect(out.body).toBe("B");
		expect(out.summary).toBe("S");
	});
});

describe("pageRecordToContentRecord — seoTitle fallback", () => {
	it("seoTitle falls back to title when undefined on the input (kills 95:13 LogicalOperator ?? →&&)", () => {
		const out = pageRecordToContentRecord({
			slug: "s",
			legacyUrl: "/s",
			title: "TITLE",
			templateKey: "default",
			listingItems: [],
			paginationLinks: [],
			sourceHtmlPath: "",
			updatedAt: "",
			body: "",
			summary: "",
			seoTitle: undefined as unknown as string,
			metaDescription: "",
			kind: "post",
			status: "published",
		});
		expect(out.seoTitle).toBe("TITLE");
	});

	it("status falls back to 'published' when undefined (kills 94:11 ?? →&& and 94:32 StringLiteral '')", () => {
		const out = pageRecordToContentRecord({
			slug: "s",
			legacyUrl: "/s",
			title: "T",
			templateKey: "default",
			listingItems: [],
			paginationLinks: [],
			sourceHtmlPath: "",
			updatedAt: "",
			body: "",
			summary: "",
			seoTitle: "S",
			metaDescription: "",
			kind: "post",
			// status omitted → undefined → fallback to "published"
		} as unknown as Parameters<typeof pageRecordToContentRecord>[0]);
		// Mutant `&&` → undefined; mutant `""` → "".
		expect(out.status).toBe("published");
	});

	it("metaDescription empty-string fallback is literal '' (kills 96:72 StringLiteral 'Stryker was here!')", () => {
		const out = pageRecordToContentRecord({
			slug: "s",
			legacyUrl: "/s",
			title: "T",
			templateKey: "default",
			listingItems: [],
			paginationLinks: [],
			sourceHtmlPath: "",
			updatedAt: "",
			body: "",
			summary: undefined as unknown as string,
			seoTitle: "S",
			metaDescription: undefined as unknown as string,
			kind: "post",
			status: "published",
		});
		// Mutant replaces "" with "Stryker was here!".
		expect(out.metaDescription).toBe("");
		expect(out.metaDescription).not.toContain("Stryker");
	});
});

describe("replaceAssignments — empty-input array fallbacks", () => {
	let db: DatabaseSync;
	beforeEach(() => {
		db = new DatabaseSync(":memory:");
		db.exec(readAstropressSqliteSchemaSql());
		db.prepare("INSERT INTO authors (id, slug, name) VALUES (1, 'a1', 'A1')").run();
		db.prepare("INSERT INTO categories (id, slug, name) VALUES (10, 'c1', 'C1')").run();
		db.prepare("INSERT INTO tags (id, slug, name) VALUES (100, 't1', 'T1')").run();
		// Pre-seed assignments so we can prove the DELETEs ran but no fallback "Stryker was here" inserts followed.
		db.prepare("INSERT INTO content_authors (slug, author_id) VALUES ('s', 1)").run();
		db.prepare("INSERT INTO content_categories (slug, category_id) VALUES ('s', 10)").run();
		db.prepare("INSERT INTO content_tags (slug, tag_id) VALUES ('s', 100)").run();
	});

	it("with empty input clears all three assignment tables and inserts nothing (kills 193/199/205 ArrayDeclaration [] → ['Stryker was here'])", () => {
		// Mutant replaces `?? []` with `?? ["Stryker was here"]` — a non-empty fallback that would try
		// INSERT OR IGNORE with author_id="Stryker was here". Since the FK column is INTEGER and authors.id=1,
		// the inserted string would either coerce to 0 or be IGNORED (no matching FK target). Either way the
		// result table content diverges from the original (still empty after DELETE).
		replaceAssignments(() => db, "s", {});
		expect(db.prepare("SELECT COUNT(*) AS n FROM content_authors WHERE slug = 's'").get()).toEqual({
			n: 0,
		});
		expect(
			db.prepare("SELECT COUNT(*) AS n FROM content_categories WHERE slug = 's'").get(),
		).toEqual({ n: 0 });
		expect(db.prepare("SELECT COUNT(*) AS n FROM content_tags WHERE slug = 's'").get()).toEqual({
			n: 0,
		});
	});
});

describe("insertRevision — body undefined nullification", () => {
	let db: DatabaseSync;
	beforeEach(() => {
		db = new DatabaseSync(":memory:");
		db.exec(readAstropressSqliteSchemaSql());
		// content_revisions.slug FK → content_overrides(slug); seed parent row first.
		db.prepare(
			"INSERT INTO content_overrides (slug, title, status, updated_by) VALUES ('slug-A', 'T', 'published', 'seed')",
		).run();
	});

	it("body undefined becomes literal SQL NULL, not undefined (kills 267:4 LogicalOperator ?? →&&)", () => {
		// Original: undefined ?? null → null → SQLite NULL.
		// Mutant: undefined && null → undefined → node:sqlite throws TypeError.
		expect(() =>
			insertRevision(
				() => db,
				() => "abc",
				"slug-A",
				{
					title: "T",
					status: "published",
					body: undefined,
					seoTitle: "S",
					metaDescription: "M",
				},
				{ email: "u@e" },
			),
		).not.toThrow();
		const row = db
			.prepare("SELECT body FROM content_revisions WHERE slug = 'slug-A' LIMIT 1")
			.get() as { body: string | null };
		expect(row.body).toBeNull();
	});
});

describe("tryInsertContentEntry — sourceHtmlPath template and catch branch", () => {
	let db: DatabaseSync;
	beforeEach(() => {
		db = new DatabaseSync(":memory:");
		db.exec(readAstropressSqliteSchemaSql());
	});

	it("inserts source_html_path = 'runtime://content/<slug>' (kills 306:5 StringLiteral '')", () => {
		const ok = tryInsertContentEntry(() => db, {
			slug: "post-x",
			legacyUrl: "/legacy/post-x",
			title: "T",
			body: "B",
			summary: "S",
			seoTitle: "ST",
			metaDescription: "M",
		});
		expect(ok).toBe(true);
		const row = db
			.prepare("SELECT source_html_path FROM content_entries WHERE slug = 'post-x'")
			.get() as { source_html_path: string };
		expect(row.source_html_path).toBe("runtime://content/post-x");
	});

	it("returns false (not undefined, not true) on duplicate slug (kills 316:10 BlockStatement {} and 317:10 BooleanLiteral false→true)", () => {
		const first = tryInsertContentEntry(() => db, {
			slug: "dup",
			legacyUrl: "/legacy/dup",
			title: "T",
			body: "B",
			summary: "S",
			seoTitle: "ST",
			metaDescription: "M",
		});
		expect(first).toBe(true);
		// Second insert with same slug → primary-key violation → caught → returns false.
		const second = tryInsertContentEntry(() => db, {
			slug: "dup",
			legacyUrl: "/legacy/dup-2",
			title: "T2",
			body: "B2",
			summary: "S2",
			seoTitle: "ST2",
			metaDescription: "M2",
		});
		// Mutant catch{}: function falls through → returns undefined; strict false check kills it.
		// Mutant return true: catch returns true; strict false check kills it.
		expect(second).toBe(false);
		expect(second).not.toBe(true);
		expect(second).not.toBeUndefined();
	});
});

// ── queryContentAssignmentIds: kills ArrowFunction `() => undefined` on category/tag mappers ──

describe("queryContentAssignmentIds — category and tag id projections", () => {
	let db: DatabaseSync;
	beforeEach(() => {
		db = new DatabaseSync(":memory:");
		db.exec(readAstropressSqliteSchemaSql());
		// Seed authors / categories / tags rows + assignment rows so the SELECTs return data.
		db.prepare("INSERT INTO authors (id, slug, name) VALUES (1, 'a1', 'A1')").run();
		db.prepare("INSERT INTO authors (id, slug, name) VALUES (2, 'a2', 'A2')").run();
		db.prepare("INSERT INTO categories (id, slug, name) VALUES (10, 'c1', 'C1')").run();
		db.prepare("INSERT INTO categories (id, slug, name) VALUES (20, 'c2', 'C2')").run();
		db.prepare("INSERT INTO tags (id, slug, name) VALUES (100, 't1', 'T1')").run();
		db.prepare("INSERT INTO tags (id, slug, name) VALUES (200, 't2', 'T2')").run();
		db.prepare(
			"INSERT INTO content_authors (slug, author_id) VALUES ('post-x', 1), ('post-x', 2)",
		).run();
		db.prepare(
			"INSERT INTO content_categories (slug, category_id) VALUES ('post-x', 10), ('post-x', 20)",
		).run();
		db.prepare(
			"INSERT INTO content_tags (slug, tag_id) VALUES ('post-x', 100), ('post-x', 200)",
		).run();
	});

	it("returns the full {authorIds, categoryIds, tagIds} triple with non-undefined ids (kills 174:8 and 179:8 ArrowFunction () => undefined)", () => {
		const result = queryContentAssignmentIds(() => db, "post-x");
		expect(result.authorIds).toEqual([1, 2]);
		expect(result.categoryIds).toEqual([10, 20]);
		expect(result.tagIds).toEqual([100, 200]);
		// Mutant `() => undefined` on the category mapper produces [undefined, undefined] for
		// categoryIds; on the tag mapper produces [undefined, undefined] for tagIds. Either kills
		// against an .toEqual() with concrete numbers.
		expect(result.categoryIds.every((id) => typeof id === "number")).toBe(true);
		expect(result.tagIds.every((id) => typeof id === "number")).toBe(true);
	});
});
