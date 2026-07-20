import { describe, expect, it } from "vitest";
import {
	humanizeSectionError,
	SECTION_KIND_LABELS,
	sectionErrorIndex,
} from "../../src/sections/section-error";

describe("humanizeSectionError", () => {
	const sections = [{ kind: "hero" }, { kind: "image-text" }, { kind: "cta-banner" }];

	it("names the section by position + kind label and the field", () => {
		expect(
			humanizeSectionError(sections, { path: "$[1].heading", message: "heading required" }),
		).toBe("Section 2 (Image + text): heading — heading required");
	});

	it("handles nested field paths", () => {
		expect(
			humanizeSectionError(sections, { path: "$[2].primaryCta.href", message: "href is required" }),
		).toBe("Section 3 (Call-to-action): primaryCta.href — href is required");
	});

	it("falls back to a positional label when the kind is unknown", () => {
		expect(
			humanizeSectionError([{}], { path: "$[0].headline", message: "headline is required" }),
		).toBe("Section 1 (section 1): headline — headline is required");
	});

	it("uses a generic message for a top-level (non-indexed) error", () => {
		expect(humanizeSectionError(sections, { path: "$", message: "must be an array" })).toBe(
			"Please fix the page sections: must be an array",
		);
	});

	it("omits the field clause for an index-only error path", () => {
		// Kills the `where` empty-string branch and the `\.?` → `\.` regex mutant:
		// "$[0]" has no field, so the message must end right after the label.
		expect(humanizeSectionError(sections, { path: "$[0]", message: "is invalid" })).toBe(
			"Section 1 (Hero): is invalid",
		);
	});

	it("reads a multi-digit section index", () => {
		// Kills `\d+` → `\d`: a two-digit index must resolve to section 11, not 2.
		const many = Array.from({ length: 11 }, (_, i) => ({ kind: i === 10 ? "faq" : "hero" }));
		expect(humanizeSectionError(many, { path: "$[10].question", message: "required" })).toBe(
			"Section 11 (FAQ): question — required",
		);
	});

	it("treats a path where the index is not at the start as top-level", () => {
		// Kills the `^` anchor removal: the index must anchor to the path start.
		expect(humanizeSectionError(sections, { path: "x$[0].heading", message: "bad" })).toBe(
			"Please fix the page sections: bad",
		);
	});

	it("uses a positional label without throwing when the index is out of range", () => {
		// Kills `sections[index]?.kind` → `sections[index].kind`: an index past the
		// array must fall back to a positional label, not throw on undefined.kind.
		expect(humanizeSectionError([{ kind: "hero" }], { path: "$[9]", message: "missing" })).toBe(
			"Section 10 (section 10): missing",
		);
	});

	it("trims surrounding whitespace out of the field name", () => {
		// Kills the `.trim()` removal: a stray space after the index dot must not
		// leak into the field clause.
		expect(humanizeSectionError(sections, { path: "$[0]. headline", message: "required" })).toBe(
			"Section 1 (Hero): headline — required",
		);
	});
});

describe("sectionErrorIndex", () => {
	it("extracts the 0-based index", () => {
		expect(sectionErrorIndex({ path: "$[3].items[0].title", message: "x" })).toBe(3);
	});
	it("returns -1 for a top-level error", () => {
		expect(sectionErrorIndex({ path: "$", message: "x" })).toBe(-1);
	});
	it("reads a multi-digit index (kills `\\d+` → `\\d`)", () => {
		expect(sectionErrorIndex({ path: "$[12].title", message: "x" })).toBe(12);
	});
	it("returns -1 when the index is not at the path start (kills `^` removal)", () => {
		expect(sectionErrorIndex({ path: "x$[3]", message: "x" })).toBe(-1);
	});
});

describe("SECTION_KIND_LABELS", () => {
	it("covers every editor section kind", () => {
		for (const kind of [
			"hero",
			"feature-grid",
			"testimonials",
			"cta-banner",
			"image-text",
			"faq",
			"gallery",
			"rich-text",
		]) {
			expect(SECTION_KIND_LABELS[kind]).toBeTruthy();
		}
	});
});
