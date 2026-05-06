/**
 * Edge mutation killers for templates, render-prep, and admin-locale.
 */
import { describe, expect, it } from "vitest";
import { selectTestimonialsForSection } from "../../src/sections/render-prep";
import type { TestimonialsSection } from "../../src/sections/schema";
import { buildTemplate } from "../../src/sections/templates";

describe("templates exact field strings", () => {
	it("about hero subhead exact text", () => {
		const sections = buildTemplate("about");
		if (sections[0].kind === "hero") {
			expect(sections[0].subhead).toBe("A short, honest description of who we are.");
		}
	});

	it("contact hero exact headline + subhead", () => {
		const sections = buildTemplate("contact");
		if (sections[0].kind === "hero") {
			expect(sections[0].headline).toBe("Contact");
			expect(sections[0].subhead).toBe("Reach us through any of these channels.");
		}
	});

	it("contact image-text mediaId is empty string literal", () => {
		const sections = buildTemplate("contact");
		const it = sections[1];
		if (it.kind === "image-text") {
			expect(it.mediaId).toBe("");
		}
	});

	it("contact cta primaryCta href is the exact mailto string", () => {
		const sections = buildTemplate("contact");
		const c = sections[3];
		if (c.kind === "cta-banner") {
			expect(c.primaryCta.href).toBe("mailto:hello@example.com");
		}
	});

	it("default id generator increments by 1 (assignment operator guard)", () => {
		// If `n += 1` were mutated to `n -= 1`, the suffixes would no longer be
		// monotonically increasing positive integers; we guard via uniqueness.
		const sections = buildTemplate("landing");
		const suffixes = sections.map((s) => {
			const m = s.id.match(/-(\d+)$/);
			return m ? Number(m[1]) : -1;
		});
		expect(suffixes).toEqual([1, 2, 3, 4]);
	});
});

describe("selectTestimonialsForSection — ids logical-operator guard", () => {
	const all = [
		{ id: "a", name: "A", quote: "q", featured: true, status: "approved" },
		{ id: "b", name: "B", quote: "q", featured: false, status: "approved" },
	];

	it("source=ids without ids array uses approved branch (not ids branch)", () => {
		const sec = {
			id: "t",
			kind: "testimonials",
			source: "ids",
			layout: "grid",
		} as TestimonialsSection;
		const picked = selectTestimonialsForSection(sec, all);
		// approved branch yields both a and b.
		expect(picked.map((p) => p.id).sort()).toEqual(["a", "b"]);
	});

	it("source=ids with ids:[] is truthy → ids branch returns []", () => {
		const sec: TestimonialsSection = {
			id: "t",
			kind: "testimonials",
			source: "ids",
			layout: "grid",
			ids: [],
		};
		const picked = selectTestimonialsForSection(sec, all);
		expect(picked).toEqual([]);
	});
});
