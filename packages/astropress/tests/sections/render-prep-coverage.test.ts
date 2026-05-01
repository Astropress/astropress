import { describe, expect, it } from "vitest";
import {
	collectMediaIds,
	selectTestimonialsForSection,
} from "../../src/sections/render-prep";
import type { Section, TestimonialsSection } from "../../src/sections/schema";

describe("collectMediaIds — coverage", () => {
	it("returns empty array for empty input", () => {
		expect(collectMediaIds([])).toEqual([]);
	});

	it("hero without mediaId yields no id", () => {
		const r = collectMediaIds([
			{ id: "h", kind: "hero", headline: "h", alignment: "start" },
		]);
		expect(r).toEqual([]);
	});

	it("image-text empty mediaId yields no id", () => {
		const r = collectMediaIds([
			{
				id: "i",
				kind: "image-text",
				heading: "H",
				body: "<p>b</p>",
				mediaId: "",
				imageSide: "start",
			},
		]);
		expect(r).toEqual([]);
	});

	it("preserves first-seen ordering across kinds", () => {
		const sections: Section[] = [
			{
				id: "1",
				kind: "hero",
				headline: "h",
				alignment: "start",
				mediaId: "m1",
			},
			{ id: "2", kind: "gallery", mediaIds: ["m2", "m1"], columns: 3 },
			{
				id: "3",
				kind: "image-text",
				heading: "x",
				body: "<p>x</p>",
				mediaId: "m3",
				imageSide: "start",
			},
		];
		expect(collectMediaIds(sections)).toEqual(["m1", "m2", "m3"]);
	});

	it("ignores other kinds (testimonials, faq, cta-banner, rich-text, feature-grid)", () => {
		const sections: Section[] = [
			{ id: "t", kind: "testimonials", source: "approved", layout: "grid" },
			{ id: "f", kind: "faq", items: [] },
			{
				id: "c",
				kind: "cta-banner",
				headline: "x",
				primaryCta: { label: "x", href: "/" },
				tone: "neutral",
			},
			{ id: "r", kind: "rich-text", html: "<p>x</p>" },
			{ id: "fg", kind: "feature-grid", heading: "h", columns: 3, items: [] },
		];
		expect(collectMediaIds(sections)).toEqual([]);
	});
});

describe("selectTestimonialsForSection — coverage", () => {
	const all = [
		{ id: "a", name: "A", quote: "q", featured: true, status: "approved" },
		{ id: "b", name: "B", quote: "q", featured: false, status: "approved" },
		{ id: "c", name: "C", quote: "q", featured: true, status: "pending" },
		{ id: "d", name: "D", quote: "q", featured: true }, // status undefined
	];

	it("featured: missing status defaults to 'approved' and is included", () => {
		const sec: TestimonialsSection = {
			id: "t",
			kind: "testimonials",
			source: "featured",
			layout: "grid",
		};
		const picked = selectTestimonialsForSection(sec, all);
		expect(picked.map((p) => p.id).sort()).toEqual(["a", "d"]);
	});

	it("featured: featured=false excluded even when approved", () => {
		const sec: TestimonialsSection = {
			id: "t",
			kind: "testimonials",
			source: "featured",
			layout: "grid",
		};
		const picked = selectTestimonialsForSection(sec, all);
		expect(picked.find((p) => p.id === "b")).toBeUndefined();
	});

	it("approved: includes 'd' (undefined status defaults to approved)", () => {
		const sec: TestimonialsSection = {
			id: "t",
			kind: "testimonials",
			source: "approved",
			layout: "grid",
		};
		const picked = selectTestimonialsForSection(sec, all);
		expect(picked.find((p) => p.id === "d")).toBeDefined();
	});

	it("approved: pending status excluded", () => {
		const sec: TestimonialsSection = {
			id: "t",
			kind: "testimonials",
			source: "approved",
			layout: "grid",
		};
		const picked = selectTestimonialsForSection(sec, all);
		expect(picked.find((p) => p.id === "c")).toBeUndefined();
	});

	it("ids without ids array falls through to approved-filter branch", () => {
		// The runtime logic checks `section.source === "ids" && section.ids`
		// so when ids array is missing it falls into the else (approved branch).
		const sec = {
			id: "t",
			kind: "testimonials",
			source: "ids",
			layout: "grid",
		} as TestimonialsSection;
		const picked = selectTestimonialsForSection(sec, all);
		// Falls through to the second `if (source === featured)` test (false),
		// then the final approved branch — so we get all approved ones.
		expect(picked.map((p) => p.id).sort()).toEqual(["a", "b", "d"]);
	});

	it("ids with empty list selects nothing", () => {
		const sec: TestimonialsSection = {
			id: "t",
			kind: "testimonials",
			source: "ids",
			layout: "grid",
			ids: [],
		};
		// Empty Set means filter excludes all — returns [].
		// But the runtime check `section.ids` is truthy for empty array,
		// so the ids branch IS taken.
		const picked = selectTestimonialsForSection(sec, all);
		expect(picked).toEqual([]);
	});

	it("ids does not match unknown id", () => {
		const sec: TestimonialsSection = {
			id: "t",
			kind: "testimonials",
			source: "ids",
			layout: "grid",
			ids: ["zzz"],
		};
		expect(selectTestimonialsForSection(sec, all)).toEqual([]);
	});
});
