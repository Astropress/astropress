import { describe, expect, it } from "vitest";
import {
	cleanIdList,
	detectConflict,
	insertContentRevision,
	normalizeLegacyUrl,
	normalizeScheduledAt,
	normalizeSeoFields,
	nullsToUndefined,
	serializeMetadata,
	trimOrNull,
} from "../src/runtime-actions-content-helpers";
import { makeDb, STANDARD_ACTOR } from "./helpers/make-db.js";
import { SqliteBackedD1Database } from "./helpers/provider-test-fixtures.js";

describe("trimOrNull", () => {
	it("returns null for undefined / null / empty / whitespace-only inputs", () => {
		expect(trimOrNull(undefined)).toBeNull();
		expect(trimOrNull(null)).toBeNull();
		expect(trimOrNull("")).toBeNull();
		expect(trimOrNull("   ")).toBeNull();
	});

	it("returns the trimmed string for non-empty input", () => {
		expect(trimOrNull("  hello  ")).toBe("hello");
		expect(trimOrNull("hello")).toBe("hello");
	});
});

describe("cleanIdList", () => {
	it("returns [] when input is undefined or empty", () => {
		expect(cleanIdList(undefined)).toEqual([]);
		expect(cleanIdList([])).toEqual([]);
	});

	it("filters non-positive integers and de-dupes while preserving first-seen order", () => {
		expect(cleanIdList([1, 2, 2, 3, 1, 4])).toEqual([1, 2, 3, 4]);
		expect(cleanIdList([0, -1, 1.5, Number.NaN, 5])).toEqual([5]);
	});

	it("treats Infinity and non-integers as invalid", () => {
		expect(cleanIdList([Number.POSITIVE_INFINITY, 1.1, 0, 7])).toEqual([7]);
	});
});

describe("normalizeSeoFields", () => {
	it("trims each field and converts blank/missing to null", () => {
		expect(
			normalizeSeoFields({
				excerpt: "  ex  ",
				ogTitle: "",
				ogDescription: "   ",
				ogImage: undefined,
				canonicalUrlOverride: "https://example.com/c",
				robotsDirective: "noindex",
			}),
		).toEqual({
			excerpt: "ex",
			ogTitle: null,
			ogDescription: null,
			ogImage: null,
			canonicalUrlOverride: "https://example.com/c",
			robotsDirective: "noindex",
		});
	});

	it("returns null for every field when input is fully empty", () => {
		expect(normalizeSeoFields({})).toEqual({
			excerpt: null,
			ogTitle: null,
			ogDescription: null,
			ogImage: null,
			canonicalUrlOverride: null,
			robotsDirective: null,
		});
	});
});

describe("normalizeScheduledAt", () => {
	it("returns null for undefined / empty / whitespace-only inputs", () => {
		expect(normalizeScheduledAt(undefined)).toBeNull();
		expect(normalizeScheduledAt("")).toBeNull();
		expect(normalizeScheduledAt("   ")).toBeNull();
	});

	it("returns an ISO-8601 UTC string for a parseable timestamp", () => {
		expect(normalizeScheduledAt("2026-02-01T00:00:00Z")).toBe("2026-02-01T00:00:00.000Z");
		expect(normalizeScheduledAt("2026-02-01T00:00:00+00:00")).toBe("2026-02-01T00:00:00.000Z");
	});
});

describe("normalizeLegacyUrl", () => {
	it("returns the trimmed legacyUrl when present, prefixed with '/' if missing", () => {
		expect(normalizeLegacyUrl("/already-prefixed", "slug")).toBe("/already-prefixed");
		expect(normalizeLegacyUrl("missing-prefix", "slug")).toBe("/missing-prefix");
		expect(normalizeLegacyUrl("  /trimmed  ", "slug")).toBe("/trimmed");
	});

	it("falls back to '/<slug>' when legacyUrl is undefined / empty / whitespace-only", () => {
		expect(normalizeLegacyUrl(undefined, "hello")).toBe("/hello");
		expect(normalizeLegacyUrl("", "hello")).toBe("/hello");
		expect(normalizeLegacyUrl("   ", "hello")).toBe("/hello");
	});
});

describe("serializeMetadata", () => {
	it("returns null when metadata is empty", () => {
		expect(serializeMetadata({})).toBeNull();
	});

	it("returns a JSON-stringified copy when metadata has at least one key", () => {
		expect(serializeMetadata({ a: 1, b: "x" })).toBe(JSON.stringify({ a: 1, b: "x" }));
	});
});

describe("nullsToUndefined", () => {
	it("replaces null values with undefined while preserving the original key set", () => {
		const result = nullsToUndefined({ a: 1, b: null, c: "x", d: null });
		expect(result).toEqual({ a: 1, b: undefined, c: "x", d: undefined });
		expect(Object.keys(result).sort()).toEqual(["a", "b", "c", "d"]);
	});

	it("leaves undefined values as undefined and non-null primitives unchanged", () => {
		const result = nullsToUndefined({ a: undefined, b: 0, c: false });
		expect(result).toEqual({ a: undefined, b: 0, c: false });
	});
});

describe("detectConflict", () => {
	function setup() {
		const db = makeDb();
		const d1 = new SqliteBackedD1Database(db);
		db.prepare(
			"INSERT INTO content_overrides (slug, title, status, updated_at, updated_by) VALUES (?, ?, ?, ?, ?)",
		).run("hello", "Hello", "draft", "2026-01-01T00:00:00Z", "seed@test.local");
		return d1;
	}

	it("returns null when no row exists for the slug", async () => {
		const d1 = new SqliteBackedD1Database(makeDb());
		expect(await detectConflict(d1, "nope", "2026-01-01T00:00:00Z")).toBeNull();
	});

	it("returns null when the persisted updated_at matches the lastKnownUpdatedAt", async () => {
		const d1 = setup();
		expect(await detectConflict(d1, "hello", "2026-01-01T00:00:00Z")).toBeNull();
	});

	it("returns the conflict envelope when updated_at differs from lastKnownUpdatedAt", async () => {
		const d1 = setup();
		const result = await detectConflict(d1, "hello", "1999-01-01T00:00:00Z");
		expect(result).toEqual({
			ok: false,
			error:
				"This record was modified by another editor after you opened it. Reload to see the latest version.",
			conflict: true,
		});
	});
});

describe("insertContentRevision", () => {
	it("writes a content_revisions row with source='reviewed', a 'revision-<uuid>' id, and persisted SEO fields", async () => {
		const db = makeDb();
		const d1 = new SqliteBackedD1Database(db);
		db.prepare(
			"INSERT INTO content_overrides (slug, title, status, updated_by) VALUES (?, ?, ?, ?)",
		).run("hello", "Hello", "draft", "seed@test.local");
		await insertContentRevision(d1, "hello", {
			title: "T",
			status: "draft",
			scheduledAt: "2026-02-01T00:00:00Z",
			body: "body",
			seoTitle: "S",
			metaDescription: "M",
			seo: normalizeSeoFields({
				excerpt: "ex",
				ogTitle: "ot",
				ogDescription: "od",
				ogImage: "https://example.com/og.png",
				canonicalUrlOverride: "https://example.com/c",
				robotsDirective: "noindex",
			}),
			authorIds: "[1]",
			categoryIds: "[2]",
			tagIds: "[3]",
			revisionNote: "first",
			actor: STANDARD_ACTOR,
		});
		const row = db
			.prepare(
				"SELECT id, slug, source, title, status, scheduled_at, body, seo_title, meta_description, excerpt, og_title, og_description, og_image, author_ids, category_ids, tag_ids, canonical_url_override, robots_directive, revision_note, created_by FROM content_revisions WHERE slug = 'hello'",
			)
			.get() as Record<string, unknown>;
		expect((row.id as string).startsWith("revision-")).toBe(true);
		expect(row.source).toBe("reviewed");
		expect(row.title).toBe("T");
		expect(row.status).toBe("draft");
		expect(row.scheduled_at).toBe("2026-02-01T00:00:00Z");
		expect(row.body).toBe("body");
		expect(row.seo_title).toBe("S");
		expect(row.meta_description).toBe("M");
		expect(row.excerpt).toBe("ex");
		expect(row.og_title).toBe("ot");
		expect(row.og_description).toBe("od");
		expect(row.og_image).toBe("https://example.com/og.png");
		expect(row.author_ids).toBe("[1]");
		expect(row.category_ids).toBe("[2]");
		expect(row.tag_ids).toBe("[3]");
		expect(row.canonical_url_override).toBe("https://example.com/c");
		expect(row.robots_directive).toBe("noindex");
		expect(row.revision_note).toBe("first");
		expect(row.created_by).toBe(STANDARD_ACTOR.email);
	});

	it("binds null for scheduledAt when scheduledAt is undefined", async () => {
		const db = makeDb();
		const d1 = new SqliteBackedD1Database(db);
		db.prepare(
			"INSERT INTO content_overrides (slug, title, status, updated_by) VALUES (?, ?, ?, ?)",
		).run("hello", "Hello", "draft", "seed@test.local");
		await insertContentRevision(d1, "hello", {
			title: "T",
			status: "draft",
			body: "b",
			seoTitle: "S",
			metaDescription: "M",
			seo: normalizeSeoFields({}),
			authorIds: "[]",
			categoryIds: "[]",
			tagIds: "[]",
			revisionNote: null,
			actor: STANDARD_ACTOR,
		});
		const row = db
			.prepare("SELECT scheduled_at, revision_note FROM content_revisions WHERE slug = 'hello'")
			.get() as { scheduled_at: string | null; revision_note: string | null };
		expect(row.scheduled_at).toBeNull();
		expect(row.revision_note).toBeNull();
	});
});
