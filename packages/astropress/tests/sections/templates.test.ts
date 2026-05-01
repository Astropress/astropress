import { describe, expect, it } from "vitest";
import { parseSections } from "../../src/sections/schema";
import {
	TEMPLATE_CATALOG,
	TEMPLATE_KEYS,
	buildTemplate,
	isTemplateKey,
} from "../../src/sections/templates";

describe("page templates", () => {
	it("blank produces no sections", () => {
		expect(buildTemplate("blank")).toEqual([]);
	});

	it("landing produces hero, feature-grid, testimonials, cta-banner", () => {
		const sections = buildTemplate("landing");
		expect(sections.map((s) => s.kind)).toEqual([
			"hero",
			"feature-grid",
			"testimonials",
			"cta-banner",
		]);
	});

	it("about includes hero, image-text, feature-grid, cta-banner", () => {
		expect(buildTemplate("about").map((s) => s.kind)).toEqual([
			"hero",
			"image-text",
			"feature-grid",
			"cta-banner",
		]);
	});

	it("contact includes hero, image-text, faq, cta-banner", () => {
		expect(buildTemplate("contact").map((s) => s.kind)).toEqual([
			"hero",
			"image-text",
			"faq",
			"cta-banner",
		]);
	});

	it("each template's output round-trips through parseSections", () => {
		for (const key of TEMPLATE_KEYS) {
			const sections = buildTemplate(key);
			const parsed = parseSections(sections);
			expect(parsed.ok, `${key} must validate`).toBe(true);
		}
	});

	it("uses unique ids within a single template invocation", () => {
		const sections = buildTemplate("landing");
		const ids = sections.map((s) => s.id);
		expect(new Set(ids).size).toBe(ids.length);
	});

	it("isTemplateKey rejects unknown keys", () => {
		expect(isTemplateKey("landing")).toBe(true);
		expect(isTemplateKey("nope")).toBe(false);
	});

	it("TEMPLATE_CATALOG covers all template keys", () => {
		const catalogKeys = TEMPLATE_CATALOG.map((e) => e.key).sort();
		expect(catalogKeys).toEqual([...TEMPLATE_KEYS].sort());
	});

	it("each catalog entry's sectionKinds matches the built sections", () => {
		for (const entry of TEMPLATE_CATALOG) {
			const built = buildTemplate(entry.key).map((s) => s.kind);
			expect(built).toEqual(entry.sectionKinds);
		}
	});
});
