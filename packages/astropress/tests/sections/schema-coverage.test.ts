/**
 * Exhaustive branch / literal coverage for sections/schema.ts.
 * Each test targets a specific mutation operator: ConditionalExpression,
 * StringLiteral, BooleanLiteral, ComparisonOperator, LogicalOperator.
 */
import { describe, expect, it } from "vitest";
import { parseSections, parseSectionsFromJson, SECTION_KINDS } from "../../src/sections/schema";

function ok<T>(r: { ok: true; sections: T } | { ok: false; errors: unknown[] }) {
	if (!r.ok) throw new Error(`expected ok, got errors: ${JSON.stringify(r.errors)}`);
	return r.sections;
}

describe("schema — input shape", () => {
	it("SECTION_KINDS contains exactly the eight kinds in declared order", () => {
		expect(SECTION_KINDS).toEqual([
			"hero",
			"feature-grid",
			"testimonials",
			"cta-banner",
			"image-text",
			"faq",
			"gallery",
			"rich-text",
		]);
	});

	it("rejects a string input as the top-level payload", () => {
		const r = parseSections("nope");
		expect(r.ok).toBe(false);
		if (!r.ok) expect(r.errors[0].path).toBe("$");
	});

	it("rejects a number input as the top-level payload", () => {
		const r = parseSections(42);
		expect(r.ok).toBe(false);
	});

	it("rejects an object missing both `sections` array and being empty", () => {
		const r = parseSections({ random: 1 });
		expect(r.ok).toBe(false);
		if (!r.ok) expect(r.errors[0].message).toContain("sections payload must be an array");
	});

	it("rejects sections envelope when sections is not an array", () => {
		const r = parseSections({ sections: "no" });
		expect(r.ok).toBe(false);
	});

	it("rejects a section that is not an object", () => {
		const r = parseSections(["nope"]);
		expect(r.ok).toBe(false);
		if (!r.ok)
			expect(r.errors[0]).toMatchObject({
				path: "$[0]",
				message: "section must be an object",
			});
	});

	it("rejects a section with an array as the value", () => {
		const r = parseSections([[1, 2]]);
		expect(r.ok).toBe(false);
	});

	it("rejects a section with empty-string id", () => {
		const r = parseSections([{ id: "", kind: "hero", headline: "x", alignment: "start" }]);
		expect(r.ok).toBe(false);
		if (!r.ok) expect(r.errors[0].path).toBe("$[0].id");
	});

	it("rejects a section with non-string id", () => {
		const r = parseSections([{ id: 5, kind: "hero", headline: "x", alignment: "start" }]);
		expect(r.ok).toBe(false);
	});
});

describe("schema — hero parsing", () => {
	it("preserves subhead, mediaId, primaryCta, secondaryCta", () => {
		const sections = ok(
			parseSections([
				{
					id: "h",
					kind: "hero",
					headline: "Hi",
					subhead: "Sub",
					mediaId: "m1",
					alignment: "start",
					primaryCta: { label: "P", href: "/p" },
					secondaryCta: { label: "S", href: "/s" },
				},
			]),
		);
		const h = sections[0];
		if (h.kind !== "hero") throw new Error("wrong kind");
		expect(h.headline).toBe("Hi");
		expect(h.subhead).toBe("Sub");
		expect(h.mediaId).toBe("m1");
		expect(h.primaryCta).toEqual({ label: "P", href: "/p" });
		expect(h.secondaryCta).toEqual({ label: "S", href: "/s" });
		expect(h.alignment).toBe("start");
	});

	it("alignment 'center' is preserved; anything else becomes 'start'", () => {
		const a = ok(parseSections([{ id: "h", kind: "hero", headline: "Hi", alignment: "center" }]));
		if (a[0].kind === "hero") expect(a[0].alignment).toBe("center");
		const b = ok(parseSections([{ id: "h", kind: "hero", headline: "Hi", alignment: "weird" }]));
		if (b[0].kind === "hero") expect(b[0].alignment).toBe("start");
		const c = ok(parseSections([{ id: "h", kind: "hero", headline: "Hi" }]));
		if (c[0].kind === "hero") expect(c[0].alignment).toBe("start");
	});

	it("rejects subhead with non-string type", () => {
		const r = parseSections([{ id: "h", kind: "hero", headline: "x", subhead: 5 }]);
		expect(r.ok).toBe(false);
	});

	it("rejects mediaId with non-string type", () => {
		const r = parseSections([{ id: "h", kind: "hero", headline: "x", mediaId: 5 }]);
		expect(r.ok).toBe(false);
	});

	it("rejects primaryCta missing label", () => {
		const r = parseSections([{ id: "h", kind: "hero", headline: "x", primaryCta: { href: "/p" } }]);
		expect(r.ok).toBe(false);
		if (!r.ok) expect(r.errors.some((e) => e.path === "$[0].primaryCta.label")).toBe(true);
	});

	it("rejects primaryCta missing href", () => {
		const r = parseSections([{ id: "h", kind: "hero", headline: "x", primaryCta: { label: "L" } }]);
		expect(r.ok).toBe(false);
		if (!r.ok) expect(r.errors.some((e) => e.path === "$[0].primaryCta.href")).toBe(true);
	});

	it("rejects primaryCta as non-object", () => {
		const r = parseSections([{ id: "h", kind: "hero", headline: "x", primaryCta: "no" }]);
		expect(r.ok).toBe(false);
	});

	it("does NOT include subhead/mediaId fields when omitted", () => {
		const sections = ok(
			parseSections([{ id: "h", kind: "hero", headline: "Hi", alignment: "start" }]),
		);
		const h = sections[0];
		if (h.kind !== "hero") throw new Error();
		expect("subhead" in h).toBe(false);
		expect("mediaId" in h).toBe(false);
		expect("primaryCta" in h).toBe(false);
		expect("secondaryCta" in h).toBe(false);
	});
});

describe("schema — feature-grid", () => {
	it("requires items to be an array", () => {
		const r = parseSections([{ id: "fg", kind: "feature-grid", heading: "X", items: "not-array" }]);
		expect(r.ok).toBe(false);
		if (!r.ok) expect(r.errors[0].path).toBe("$[0].items");
	});

	it("rejects non-object item", () => {
		const r = parseSections([{ id: "fg", kind: "feature-grid", heading: "X", items: ["x"] }]);
		expect(r.ok).toBe(false);
	});

	it("rejects missing item title", () => {
		const r = parseSections([
			{ id: "fg", kind: "feature-grid", heading: "X", items: [{ body: "b" }] },
		]);
		expect(r.ok).toBe(false);
	});

	it("preserves item.icon when string and non-empty", () => {
		const sections = ok(
			parseSections([
				{
					id: "fg",
					kind: "feature-grid",
					heading: "X",
					columns: 2,
					items: [{ icon: "*", title: "t", body: "b" }],
				},
			]),
		);
		if (sections[0].kind === "feature-grid") {
			expect(sections[0].items[0].icon).toBe("*");
			expect(sections[0].columns).toBe(2);
		}
	});

	it("does not include icon field when icon is empty string", () => {
		const sections = ok(
			parseSections([
				{
					id: "fg",
					kind: "feature-grid",
					heading: "X",
					items: [{ icon: "", title: "t", body: "b" }],
				},
			]),
		);
		if (sections[0].kind === "feature-grid") {
			expect("icon" in sections[0].items[0]).toBe(false);
		}
	});

	it("preserves intro when non-empty; drops when empty", () => {
		const a = ok(
			parseSections([
				{
					id: "fg",
					kind: "feature-grid",
					heading: "X",
					intro: "yo",
					items: [],
				},
			]),
		);
		if (a[0].kind === "feature-grid") expect(a[0].intro).toBe("yo");
		const b = ok(
			parseSections([{ id: "fg", kind: "feature-grid", heading: "X", intro: "", items: [] }]),
		);
		if (b[0].kind === "feature-grid") expect("intro" in b[0]).toBe(false);
	});

	it("columns 2/3/4 are preserved exactly", () => {
		for (const c of [2, 3, 4] as const) {
			const sections = ok(
				parseSections([
					{
						id: "fg",
						kind: "feature-grid",
						heading: "X",
						columns: c,
						items: [],
					},
				]),
			);
			if (sections[0].kind === "feature-grid") expect(sections[0].columns).toBe(c);
		}
	});
});

describe("schema — testimonials", () => {
	it("source defaults to 'featured' for unknown values", () => {
		const sections = ok(
			parseSections([{ id: "t", kind: "testimonials", source: "weird", layout: "grid" }]),
		);
		if (sections[0].kind === "testimonials") expect(sections[0].source).toBe("featured");
	});

	it("source 'approved' is preserved", () => {
		const sections = ok(
			parseSections([{ id: "t", kind: "testimonials", source: "approved", layout: "grid" }]),
		);
		if (sections[0].kind === "testimonials") expect(sections[0].source).toBe("approved");
	});

	it("layout 'carousel' preserved; otherwise 'grid'", () => {
		const a = ok(
			parseSections([
				{
					id: "t",
					kind: "testimonials",
					source: "approved",
					layout: "carousel",
				},
			]),
		);
		if (a[0].kind === "testimonials") expect(a[0].layout).toBe("carousel");
		const b = ok(
			parseSections([{ id: "t", kind: "testimonials", source: "approved", layout: "weird" }]),
		);
		if (b[0].kind === "testimonials") expect(b[0].layout).toBe("grid");
	});

	it("ids source rejects empty array", () => {
		const r = parseSections([
			{ id: "t", kind: "testimonials", source: "ids", ids: [], layout: "grid" },
		]);
		expect(r.ok).toBe(false);
	});

	it("ids source rejects non-string-array", () => {
		const r = parseSections([
			{
				id: "t",
				kind: "testimonials",
				source: "ids",
				ids: [1, 2],
				layout: "grid",
			},
		]);
		expect(r.ok).toBe(false);
	});

	it("ids source preserves ids when valid", () => {
		const sections = ok(
			parseSections([
				{
					id: "t",
					kind: "testimonials",
					source: "ids",
					ids: ["x", "y"],
					layout: "grid",
				},
			]),
		);
		if (sections[0].kind === "testimonials") expect(sections[0].ids).toEqual(["x", "y"]);
	});

	it("preserves heading when non-empty", () => {
		const sections = ok(
			parseSections([
				{
					id: "t",
					kind: "testimonials",
					source: "approved",
					layout: "grid",
					heading: "H",
				},
			]),
		);
		if (sections[0].kind === "testimonials") expect(sections[0].heading).toBe("H");
	});
});

describe("schema — cta-banner", () => {
	it("requires headline", () => {
		const r = parseSections([
			{ id: "c", kind: "cta-banner", primaryCta: { label: "x", href: "/" } },
		]);
		expect(r.ok).toBe(false);
	});

	it("requires primaryCta", () => {
		const r = parseSections([{ id: "c", kind: "cta-banner", headline: "H" }]);
		expect(r.ok).toBe(false);
	});

	it("tone 'accent' preserved; default 'neutral'", () => {
		const a = ok(
			parseSections([
				{
					id: "c",
					kind: "cta-banner",
					headline: "H",
					primaryCta: { label: "x", href: "/" },
					tone: "accent",
				},
			]),
		);
		if (a[0].kind === "cta-banner") expect(a[0].tone).toBe("accent");
		const b = ok(
			parseSections([
				{
					id: "c",
					kind: "cta-banner",
					headline: "H",
					primaryCta: { label: "x", href: "/" },
				},
			]),
		);
		if (b[0].kind === "cta-banner") expect(b[0].tone).toBe("neutral");
	});

	it("body included only when non-empty", () => {
		const a = ok(
			parseSections([
				{
					id: "c",
					kind: "cta-banner",
					headline: "H",
					body: "b",
					primaryCta: { label: "x", href: "/" },
				},
			]),
		);
		if (a[0].kind === "cta-banner") expect(a[0].body).toBe("b");
		const b = ok(
			parseSections([
				{
					id: "c",
					kind: "cta-banner",
					headline: "H",
					body: "",
					primaryCta: { label: "x", href: "/" },
				},
			]),
		);
		if (b[0].kind === "cta-banner") expect("body" in b[0]).toBe(false);
	});

	it("secondaryCta validated when present", () => {
		const sections = ok(
			parseSections([
				{
					id: "c",
					kind: "cta-banner",
					headline: "H",
					primaryCta: { label: "x", href: "/" },
					secondaryCta: { label: "Y", href: "/y" },
				},
			]),
		);
		if (sections[0].kind === "cta-banner") expect(sections[0].secondaryCta?.label).toBe("Y");
	});
});

describe("schema — image-text", () => {
	it("requires heading and body", () => {
		const r1 = parseSections([
			{
				id: "i",
				kind: "image-text",
				body: "b",
				mediaId: "m",
				imageSide: "start",
			},
		]);
		expect(r1.ok).toBe(false);
		const r2 = parseSections([
			{
				id: "i",
				kind: "image-text",
				heading: "H",
				mediaId: "m",
				imageSide: "start",
			},
		]);
		expect(r2.ok).toBe(false);
	});

	it("rejects non-string mediaId", () => {
		const r = parseSections([{ id: "i", kind: "image-text", heading: "H", body: "B", mediaId: 5 }]);
		expect(r.ok).toBe(false);
	});

	it("accepts empty-string mediaId (template default)", () => {
		const sections = ok(
			parseSections([
				{
					id: "i",
					kind: "image-text",
					heading: "H",
					body: "B",
					mediaId: "",
					imageSide: "end",
				},
			]),
		);
		if (sections[0].kind === "image-text") {
			expect(sections[0].mediaId).toBe("");
			expect(sections[0].imageSide).toBe("end");
		}
	});

	it("imageSide defaults to 'start' for unknown values", () => {
		const sections = ok(
			parseSections([
				{
					id: "i",
					kind: "image-text",
					heading: "H",
					body: "B",
					mediaId: "m",
					imageSide: "weird",
				},
			]),
		);
		if (sections[0].kind === "image-text") expect(sections[0].imageSide).toBe("start");
	});
});

describe("schema — faq", () => {
	it("rejects items not an array", () => {
		const r = parseSections([{ id: "f", kind: "faq", items: "no" }]);
		expect(r.ok).toBe(false);
	});

	it("rejects non-object item", () => {
		const r = parseSections([{ id: "f", kind: "faq", items: ["x"] }]);
		expect(r.ok).toBe(false);
	});

	it("rejects missing question / answer", () => {
		const r1 = parseSections([{ id: "f", kind: "faq", items: [{ answer: "a" }] }]);
		expect(r1.ok).toBe(false);
		const r2 = parseSections([{ id: "f", kind: "faq", items: [{ question: "q" }] }]);
		expect(r2.ok).toBe(false);
	});

	it("preserves heading when non-empty", () => {
		const sections = ok(parseSections([{ id: "f", kind: "faq", items: [], heading: "Hello" }]));
		if (sections[0].kind === "faq") expect(sections[0].heading).toBe("Hello");
	});
});

describe("schema — gallery", () => {
	it("rejects mediaIds not a string array", () => {
		const r = parseSections([{ id: "g", kind: "gallery", mediaIds: [1] }]);
		expect(r.ok).toBe(false);
	});

	it("preserves heading when non-empty", () => {
		const sections = ok(
			parseSections([{ id: "g", kind: "gallery", mediaIds: [], columns: 4, heading: "H" }]),
		);
		if (sections[0].kind === "gallery") {
			expect(sections[0].heading).toBe("H");
			expect(sections[0].columns).toBe(4);
		}
	});

	it("columns invalid normalises to 3", () => {
		const sections = ok(parseSections([{ id: "g", kind: "gallery", mediaIds: [], columns: 99 }]));
		if (sections[0].kind === "gallery") expect(sections[0].columns).toBe(3);
	});
});

describe("schema — rich-text", () => {
	it("rejects non-string html", () => {
		const r = parseSections([{ id: "r", kind: "rich-text", html: 5 }]);
		expect(r.ok).toBe(false);
	});

	it("preserves html exactly", () => {
		const sections = ok(parseSections([{ id: "r", kind: "rich-text", html: "<p>hi</p>" }]));
		if (sections[0].kind === "rich-text") expect(sections[0].html).toBe("<p>hi</p>");
	});
});

describe("schema — JSON wrapper", () => {
	it("parses a valid JSON array", () => {
		const r = parseSectionsFromJson(
			JSON.stringify([{ id: "h", kind: "hero", headline: "H", alignment: "start" }]),
		);
		expect(r.ok).toBe(true);
	});

	it("treats whitespace-only JSON as empty", () => {
		const r = parseSectionsFromJson("   ");
		expect(r.ok).toBe(true);
		if (r.ok) expect(r.sections).toEqual([]);
	});

	it("invalid JSON has path '$' and 'invalid JSON' message", () => {
		const r = parseSectionsFromJson("{");
		expect(r.ok).toBe(false);
		if (!r.ok) {
			expect(r.errors[0].path).toBe("$");
			expect(r.errors[0].message).toContain("invalid JSON");
		}
	});
});

describe("schema — accumulated errors", () => {
	it("collects errors from multiple bad sections", () => {
		const r = parseSections([
			{ id: "a", kind: "hero", alignment: "start" },
			{ id: "b", kind: "feature-grid", heading: "x", items: "no" },
		]);
		expect(r.ok).toBe(false);
		if (!r.ok) expect(r.errors.length).toBeGreaterThanOrEqual(2);
	});

	it("good and bad sections in same payload — fails overall but ok ones don't appear", () => {
		const r = parseSections([
			{ id: "a", kind: "hero", headline: "H", alignment: "center" },
			{ id: "b", kind: "hero", alignment: "start" },
		]);
		expect(r.ok).toBe(false);
	});
});
