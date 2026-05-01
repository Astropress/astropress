import { describe, expect, it } from "vitest";
import {
	SECTION_KINDS,
	parseSections,
	parseSectionsFromJson,
} from "../../src/sections/schema";

describe("parseSections", () => {
	it("returns empty array for null/undefined input", () => {
		expect(parseSections(null)).toEqual({ ok: true, sections: [] });
		expect(parseSections(undefined)).toEqual({ ok: true, sections: [] });
	});

	it("returns empty array for an empty object", () => {
		expect(parseSections({})).toEqual({ ok: true, sections: [] });
	});

	it("accepts a top-level array", () => {
		const r = parseSections([
			{ id: "h", kind: "hero", headline: "Hello", alignment: "center" },
		]);
		expect(r.ok).toBe(true);
		if (r.ok) expect(r.sections).toHaveLength(1);
	});

	it("accepts the {sections: [...]} envelope shape", () => {
		const r = parseSections({
			sections: [
				{ id: "h", kind: "hero", headline: "Hello", alignment: "center" },
			],
		});
		expect(r.ok).toBe(true);
		if (r.ok) expect(r.sections).toHaveLength(1);
	});

	it("rejects an unknown kind with a path-keyed error", () => {
		const r = parseSections([{ id: "x", kind: "weird-kind" }]);
		expect(r.ok).toBe(false);
		if (!r.ok)
			expect(r.errors[0]).toMatchObject({
				path: "$[0].kind",
				message: expect.stringContaining("unknown section kind"),
			});
	});

	it("requires hero.headline", () => {
		const r = parseSections([{ id: "h", kind: "hero", alignment: "start" }]);
		expect(r.ok).toBe(false);
		if (!r.ok)
			expect(r.errors).toContainEqual({
				path: "$[0].headline",
				message: "headline is required",
			});
	});

	it("validates feature-grid item shape", () => {
		const r = parseSections([
			{
				id: "fg",
				kind: "feature-grid",
				heading: "X",
				columns: 3,
				items: [{ title: "ok", body: "" }],
			},
		]);
		expect(r.ok).toBe(false);
		if (!r.ok) expect(r.errors[0].path).toBe("$[0].items[0].body");
	});

	it("normalises invalid columns to 3", () => {
		const r = parseSections([
			{
				id: "fg",
				kind: "feature-grid",
				heading: "X",
				columns: 99,
				items: [],
			},
		]);
		expect(r.ok).toBe(true);
		if (r.ok) {
			const fg = r.sections[0];
			if (fg.kind === "feature-grid") expect(fg.columns).toBe(3);
		}
	});

	it("requires testimonials.ids when source=ids", () => {
		const r = parseSections([
			{ id: "t", kind: "testimonials", source: "ids", layout: "grid" },
		]);
		expect(r.ok).toBe(false);
	});

	it("accepts a fully populated landing-page payload", () => {
		const r = parseSections([
			{
				id: "1",
				kind: "hero",
				headline: "H",
				alignment: "center",
				primaryCta: { label: "Go", href: "#" },
			},
			{
				id: "2",
				kind: "feature-grid",
				heading: "Why",
				columns: 3,
				items: [{ title: "T", body: "B" }],
			},
			{
				id: "3",
				kind: "cta-banner",
				headline: "Now",
				primaryCta: { label: "Yes", href: "#" },
				tone: "accent",
			},
			{ id: "4", kind: "rich-text", html: "<p>x</p>" },
		]);
		expect(r.ok).toBe(true);
		if (r.ok) expect(r.sections).toHaveLength(4);
	});

	it("covers all eight section kinds in the catalog", () => {
		expect(SECTION_KINDS).toHaveLength(8);
	});

	it("parseSectionsFromJson handles invalid JSON", () => {
		const r = parseSectionsFromJson("{not json");
		expect(r.ok).toBe(false);
		if (!r.ok) expect(r.errors[0].message).toContain("invalid JSON");
	});

	it("parseSectionsFromJson treats empty string as no sections", () => {
		const r = parseSectionsFromJson("");
		expect(r.ok).toBe(true);
		if (r.ok) expect(r.sections).toEqual([]);
	});
});
