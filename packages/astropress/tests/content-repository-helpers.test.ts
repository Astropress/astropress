import { describe, expect, it } from "vitest";

import {
	mapContentState,
	normalizeAssignments,
} from "../src/content-repository-helpers.js";

const baseRecord = {
	id: "p1",
	kind: "post" as const,
	slug: "p1",
	status: "published" as const,
	title: "Original title",
	body: "Original body",
	seoTitle: "Original SEO",
	metaDescription: "Original meta",
	excerpt: "Original excerpt",
	authorIds: [99],
	categoryIds: [88],
	tagIds: [77],
};

const baseAssignments = {
	authorIds: [1],
	categoryIds: [2],
	tagIds: [3],
};

describe("normalizeAssignments", () => {
	it("returns [] when called with undefined", () => {
		expect(normalizeAssignments()).toEqual([]);
	});
	it("returns [] when called with empty array", () => {
		expect(normalizeAssignments([])).toEqual([]);
	});
	it("dedupes positive integer entries", () => {
		expect(normalizeAssignments([1, 2, 2, 3, 1])).toEqual([1, 2, 3]);
	});
	it("filters out non-integers (floats)", () => {
		expect(normalizeAssignments([1, 1.5, 2])).toEqual([1, 2]);
	});
	it("filters out zero and negatives (entry > 0 invariant)", () => {
		expect(normalizeAssignments([-1, 0, 1, 2])).toEqual([1, 2]);
	});
	it("preserves first-occurrence order under dedupe", () => {
		expect(normalizeAssignments([3, 1, 2, 1, 3])).toEqual([3, 1, 2]);
	});
});

describe("mapContentState", () => {
	it("uses record fields when override is null (everything from record)", () => {
		const out = mapContentState(baseRecord as never, null, baseAssignments);
		expect(out.title).toBe("Original title");
		expect(out.body).toBe("Original body");
		expect(out.seoTitle).toBe("Original SEO");
		expect(out.metaDescription).toBe("Original meta");
		expect(out.excerpt).toBe("Original excerpt");
		// Override-only fields default to undefined when no override supplied.
		expect(out.scheduledAt).toBeUndefined();
		expect(out.ogTitle).toBeUndefined();
	});

	it("uses record fields when override is undefined", () => {
		const out = mapContentState(
			baseRecord as never,
			undefined,
			baseAssignments,
		);
		expect(out.title).toBe("Original title");
	});

	it("override values take precedence over record values", () => {
		const out = mapContentState(
			baseRecord as never,
			{
				title: "New title",
				status: "draft",
				body: "New body",
				seoTitle: "New SEO",
				metaDescription: "New meta",
				excerpt: "New excerpt",
				scheduledAt: "2026-12-31T00:00:00Z",
				ogTitle: "OG-T",
				ogDescription: "OG-D",
				ogImage: "OG-I",
				canonicalUrlOverride: "/canon",
				robotsDirective: "noindex",
			} as never,
			baseAssignments,
		);
		expect(out.title).toBe("New title");
		expect(out.status).toBe("draft");
		expect(out.body).toBe("New body");
		expect(out.seoTitle).toBe("New SEO");
		expect(out.metaDescription).toBe("New meta");
		expect(out.excerpt).toBe("New excerpt");
		expect(out.scheduledAt).toBe("2026-12-31T00:00:00Z");
		expect(out.ogTitle).toBe("OG-T");
		expect(out.ogDescription).toBe("OG-D");
		expect(out.ogImage).toBe("OG-I");
		expect(out.canonicalUrlOverride).toBe("/canon");
		expect(out.robotsDirective).toBe("noindex");
	});

	it("assignments completely replace record's authorIds/categoryIds/tagIds", () => {
		const out = mapContentState(baseRecord as never, null, baseAssignments);
		expect(out.authorIds).toEqual([1]);
		expect(out.categoryIds).toEqual([2]);
		expect(out.tagIds).toEqual([3]);
	});

	it("preserves an empty-string override.body (?? semantics, not || or &&)", () => {
		// Editor explicitly cleared the body. Original `??` returns "" (use override).
		// Mutant `&&` would return record.body since "" is falsy.
		const out = mapContentState(
			baseRecord as never,
			{ body: "" } as never,
			baseAssignments,
		);
		expect(out.body).toBe("");
	});

	it("preserves an empty-string override.seoTitle (?? semantics)", () => {
		const out = mapContentState(
			baseRecord as never,
			{ seoTitle: "" } as never,
			baseAssignments,
		);
		expect(out.seoTitle).toBe("");
	});

	it("preserves an empty-string override.metaDescription (?? semantics)", () => {
		const out = mapContentState(
			baseRecord as never,
			{ metaDescription: "" } as never,
			baseAssignments,
		);
		expect(out.metaDescription).toBe("");
	});

	it("preserves an empty-string override.excerpt (?? semantics)", () => {
		const out = mapContentState(
			baseRecord as never,
			{ excerpt: "" } as never,
			baseAssignments,
		);
		expect(out.excerpt).toBe("");
	});
});
