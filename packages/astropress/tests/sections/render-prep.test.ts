import { describe, expect, it } from "vitest";
import {
	collectMediaIds,
	selectTestimonialsForSection,
} from "../../src/sections/render-prep";
import type { Section, TestimonialsSection } from "../../src/sections/schema";

describe("collectMediaIds", () => {
	it("returns ids from hero, image-text, gallery", () => {
		const sections: Section[] = [
			{
				id: "1",
				kind: "hero",
				headline: "h",
				alignment: "start",
				mediaId: "a",
			},
			{
				id: "2",
				kind: "image-text",
				heading: "x",
				body: "<p>x</p>",
				mediaId: "b",
				imageSide: "start",
			},
			{ id: "3", kind: "gallery", mediaIds: ["c", "d"], columns: 3 },
		];
		expect(collectMediaIds(sections).sort()).toEqual(["a", "b", "c", "d"]);
	});

	it("deduplicates repeated ids", () => {
		const sections: Section[] = [
			{
				id: "1",
				kind: "hero",
				headline: "h",
				alignment: "start",
				mediaId: "a",
			},
			{ id: "2", kind: "gallery", mediaIds: ["a", "a"], columns: 2 },
		];
		expect(collectMediaIds(sections)).toEqual(["a"]);
	});

	it("ignores empty / falsy ids", () => {
		const sections: Section[] = [
			{ id: "1", kind: "hero", headline: "h", alignment: "start" },
			{ id: "2", kind: "gallery", mediaIds: [""], columns: 2 },
		];
		expect(collectMediaIds(sections)).toEqual([]);
	});
});

describe("selectTestimonialsForSection", () => {
	const all = [
		{ id: "a", name: "A", quote: "q", featured: true, status: "approved" },
		{ id: "b", name: "B", quote: "q", featured: false, status: "approved" },
		{ id: "c", name: "C", quote: "q", featured: true, status: "pending" },
	];

	it("source=featured selects featured AND approved", () => {
		const sec: TestimonialsSection = {
			id: "t",
			kind: "testimonials",
			source: "featured",
			layout: "grid",
		};
		const picked = selectTestimonialsForSection(sec, all);
		expect(picked.map((p) => p.id)).toEqual(["a"]);
	});

	it("source=approved selects all approved", () => {
		const sec: TestimonialsSection = {
			id: "t",
			kind: "testimonials",
			source: "approved",
			layout: "grid",
		};
		const picked = selectTestimonialsForSection(sec, all);
		expect(picked.map((p) => p.id).sort()).toEqual(["a", "b"]);
	});

	it("source=ids selects exactly the requested ids", () => {
		const sec: TestimonialsSection = {
			id: "t",
			kind: "testimonials",
			source: "ids",
			layout: "grid",
			ids: ["b", "c"],
		};
		const picked = selectTestimonialsForSection(sec, all);
		expect(picked.map((p) => p.id).sort()).toEqual(["b", "c"]);
	});
});
