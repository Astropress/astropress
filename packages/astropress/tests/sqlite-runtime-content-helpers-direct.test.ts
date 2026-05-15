// Direct tests for src/sqlite-runtime/content-helpers.ts targeting Stryker
// survivors. Static imports + per-test DB ensure Stryker's per-test coverage
// tracker attributes the kills correctly.
import { DatabaseSync } from "node:sqlite";
import { beforeEach, describe, expect, it } from "vitest";

import { readAstropressSqliteSchemaSql } from "../src/sqlite-bootstrap.js";
import {
	type ContentEntryRow,
	mapContentEntryRow,
	pageRecordToContentRecord,
	queryContentAssignmentIds,
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
