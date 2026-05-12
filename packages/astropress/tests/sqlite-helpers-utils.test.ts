import { describe, expect, it } from "vitest";
import {
	buildRevisionParams,
	resolveMetaString,
	resolveSqliteStatus,
	SQL_INSERT_REVISION,
	SQL_LIST_TRANSLATIONS,
	SQL_UPSERT_MEDIA,
	snapshotField,
} from "../src/adapters/sqlite-helpers";

describe("resolveMetaString", () => {
	it("returns the string value when meta[key] is a string", () => {
		expect(resolveMetaString({ a: "hello" }, "a")).toBe("hello");
	});
	it("returns undefined when meta[key] is not a string", () => {
		expect(resolveMetaString({ a: 42 }, "a")).toBeUndefined();
		expect(resolveMetaString({ a: null }, "a")).toBeUndefined();
		expect(resolveMetaString({ a: true }, "a")).toBeUndefined();
		expect(resolveMetaString({}, "missing")).toBeUndefined();
	});
	it("returns undefined when meta is null or undefined (optional-chain pin)", () => {
		expect(resolveMetaString(null, "x")).toBeUndefined();
		expect(resolveMetaString(undefined, "x")).toBeUndefined();
	});
});

describe("resolveSqliteStatus", () => {
	it("returns 'archived' only for the literal 'archived'", () => {
		expect(resolveSqliteStatus("archived")).toBe("archived");
	});
	it("returns 'draft' only for the literal 'draft'", () => {
		expect(resolveSqliteStatus("draft")).toBe("draft");
	});
	it("returns 'published' for anything else including undefined and unrecognized strings", () => {
		expect(resolveSqliteStatus(undefined)).toBe("published");
		expect(resolveSqliteStatus("published")).toBe("published");
		expect(resolveSqliteStatus("scheduled")).toBe("published");
		expect(resolveSqliteStatus("")).toBe("published");
	});
});

describe("snapshotField", () => {
	it("returns snapshot[key] when present and non-null", () => {
		expect(snapshotField({ a: "x" }, "a")).toBe("x");
		expect(snapshotField({ a: 0 }, "a")).toBe(0);
		expect(snapshotField({ a: false }, "a")).toBe(false);
	});
	it("returns the fallback when snapshot[key] is null or undefined", () => {
		expect(snapshotField({ a: null }, "a", "FB")).toBe("FB");
		expect(snapshotField({}, "missing", "FB")).toBe("FB");
	});
	it("defaults the fallback to null", () => {
		expect(snapshotField({}, "missing")).toBeNull();
	});
});

describe("buildRevisionParams", () => {
	it("produces a 21-element array matching the SQL_INSERT_REVISION column order", () => {
		const params = buildRevisionParams(
			{
				title: "T",
				status: "draft",
				scheduledAt: "2026-01-01",
				body: "B",
				seoTitle: "ST",
				metaDescription: "MD",
				excerpt: "E",
				ogTitle: "OG",
				ogDescription: "OGD",
				ogImage: "OGI",
				authorIds: ["a1"],
				categoryIds: ["c1"],
				tagIds: ["t1"],
				canonicalUrlOverride: "/canon",
				robotsDirective: "noindex",
			},
			{ id: "rev-1", recordId: "rec-1", summary: "S", createdAt: "2026-01-02", actorId: "u1" },
			"actor@example.com",
		);
		expect(params).toEqual([
			"rev-1",
			"rec-1",
			"T",
			"draft",
			"2026-01-01",
			"B",
			"ST",
			"MD",
			"E",
			"OG",
			"OGD",
			"OGI",
			'["a1"]',
			'["c1"]',
			'["t1"]',
			"/canon",
			"noindex",
			"S",
			"2026-01-02",
			"u1",
		]);
	});

	it("falls back to recordId / actorEmail when title/actorId are missing", () => {
		const params = buildRevisionParams(
			{},
			{ id: "rev-2", recordId: "rec-2", createdAt: "2026-01-03" },
			"actor@example.com",
		);
		expect(params[2]).toBe("rec-2"); // title fallback
		expect(params[6]).toBe("rec-2"); // seoTitle fallback
		expect(params[7]).toBe("rec-2"); // metaDescription fallback
		expect(params[12]).toBe("[]"); // empty authorIds JSON
		expect(params[13]).toBe("[]");
		expect(params[14]).toBe("[]");
		expect(params[17]).toBeNull(); // revision.summary ?? null
		expect(params[19]).toBe("actor@example.com"); // actorId fallback
	});

	it("uses snapshot.title for seoTitle/metaDescription when explicit fields are absent", () => {
		const params = buildRevisionParams(
			{ title: "FromSnapshot" },
			{ id: "r", recordId: "rec", createdAt: "now" },
			"e@example.com",
		);
		expect(params[6]).toBe("FromSnapshot");
		expect(params[7]).toBe("FromSnapshot");
	});
});

describe("SQL constants are literal strings (kill StringLiteral mutants)", () => {
	it("SQL_UPSERT_MEDIA inserts into media_assets and ON CONFLICT updates", () => {
		expect(SQL_UPSERT_MEDIA).toContain("INSERT INTO media_assets");
		expect(SQL_UPSERT_MEDIA).toContain("ON CONFLICT(id) DO UPDATE SET");
		expect(SQL_UPSERT_MEDIA).toContain("deleted_at = NULL");
	});
	it("SQL_INSERT_REVISION targets content_revisions with the source='reviewed' literal", () => {
		expect(SQL_INSERT_REVISION).toContain("INSERT INTO content_revisions");
		expect(SQL_INSERT_REVISION).toContain("'reviewed'");
	});
	it("SQL_LIST_TRANSLATIONS reads translation_overrides ordered by route ASC", () => {
		expect(SQL_LIST_TRANSLATIONS).toContain("FROM translation_overrides");
		expect(SQL_LIST_TRANSLATIONS).toContain("ORDER BY route ASC");
	});
});
