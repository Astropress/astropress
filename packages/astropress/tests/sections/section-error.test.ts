import { describe, expect, it } from "vitest";
import {
	humanizeSectionError,
	SECTION_KIND_LABELS,
	sectionErrorIndex,
} from "../../src/sections/section-error";

describe("humanizeSectionError", () => {
	const sections = [{ kind: "hero" }, { kind: "image-text" }, { kind: "cta-banner" }];

	it("names the section by position + kind label and the field", () => {
		expect(humanizeSectionError(sections, { path: "$[1].heading", message: "heading required" })).toBe(
			"Section 2 (Image + text): heading — heading required",
		);
	});

	it("handles nested field paths", () => {
		expect(
			humanizeSectionError(sections, { path: "$[2].primaryCta.href", message: "href is required" }),
		).toBe("Section 3 (Call-to-action): primaryCta.href — href is required");
	});

	it("falls back to a positional label when the kind is unknown", () => {
		expect(humanizeSectionError([{}], { path: "$[0].headline", message: "headline is required" })).toBe(
			"Section 1 (section 1): headline — headline is required",
		);
	});

	it("uses a generic message for a top-level (non-indexed) error", () => {
		expect(humanizeSectionError(sections, { path: "$", message: "must be an array" })).toBe(
			"Please fix the page sections: must be an array",
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
