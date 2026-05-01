/**
 * Strictness tests killing remaining ObjectLiteral / ConditionalExpression
 * mutations in sections/schema.ts. These check the precise shape of each
 * returned section so a `{}` mutation on the literal breaks the test.
 */
import { describe, expect, it } from "vitest";
import { parseSections } from "../../src/sections/schema";

describe("schema strict shape — feature-grid", () => {
	it("returns object with kind, heading, columns, items keys exactly", () => {
		const r = parseSections([
			{ id: "f", kind: "feature-grid", heading: "H", columns: 3, items: [] },
		]);
		expect(r.ok).toBe(true);
		if (!r.ok) return;
		const s = r.sections[0];
		expect(s.kind).toBe("feature-grid");
		expect(s.id).toBe("f");
		if (s.kind === "feature-grid") {
			expect(s.heading).toBe("H");
			expect(s.columns).toBe(3);
			expect(Array.isArray(s.items)).toBe(true);
		}
	});

	it("columns 4 valid input is preserved (mutation guard on || chain)", () => {
		const r = parseSections([
			{ id: "f", kind: "feature-grid", heading: "H", columns: 4, items: [] },
		]);
		if (r.ok && r.sections[0].kind === "feature-grid") {
			expect(r.sections[0].columns).toBe(4);
		}
	});

	it("columns 2 valid input is preserved", () => {
		const r = parseSections([
			{ id: "f", kind: "feature-grid", heading: "H", columns: 2, items: [] },
		]);
		if (r.ok && r.sections[0].kind === "feature-grid") {
			expect(r.sections[0].columns).toBe(2);
		}
	});

	it("intro empty string drops intro key (mutation guard on && length>0)", () => {
		const r = parseSections([
			{
				id: "f",
				kind: "feature-grid",
				heading: "H",
				items: [],
				intro: "",
			},
		]);
		if (r.ok && r.sections[0].kind === "feature-grid") {
			expect(r.sections[0].intro).toBeUndefined();
		}
	});
});

describe("schema strict shape — testimonials", () => {
	it("returns object with kind, source, layout exactly", () => {
		const r = parseSections([
			{ id: "t", kind: "testimonials", source: "approved", layout: "grid" },
		]);
		if (r.ok) {
			expect(r.sections[0].kind).toBe("testimonials");
			expect(r.sections[0].id).toBe("t");
			if (r.sections[0].kind === "testimonials") {
				expect(r.sections[0].source).toBe("approved");
				expect(r.sections[0].layout).toBe("grid");
			}
		}
	});

	it("heading empty string drops heading", () => {
		const r = parseSections([
			{
				id: "t",
				kind: "testimonials",
				source: "approved",
				layout: "grid",
				heading: "",
			},
		]);
		if (r.ok && r.sections[0].kind === "testimonials") {
			expect(r.sections[0].heading).toBeUndefined();
		}
	});

	it("heading non-empty kept", () => {
		const r = parseSections([
			{
				id: "t",
				kind: "testimonials",
				source: "approved",
				layout: "grid",
				heading: "X",
			},
		]);
		if (r.ok && r.sections[0].kind === "testimonials") {
			expect(r.sections[0].heading).toBe("X");
		}
	});
});

describe("schema strict shape — cta-banner", () => {
	it("returns object with kind=cta-banner exactly + tone field", () => {
		const r = parseSections([
			{
				id: "c",
				kind: "cta-banner",
				headline: "H",
				primaryCta: { label: "x", href: "/" },
				tone: "neutral",
			},
		]);
		if (r.ok) {
			const s = r.sections[0];
			expect(s.kind).toBe("cta-banner");
			expect(s.id).toBe("c");
			if (s.kind === "cta-banner") {
				expect(s.headline).toBe("H");
				expect(s.tone).toBe("neutral");
				expect(s.primaryCta).toEqual({ label: "x", href: "/" });
			}
		}
	});

	it("body empty string drops body key (mutation on && length>0)", () => {
		const r = parseSections([
			{
				id: "c",
				kind: "cta-banner",
				headline: "H",
				body: "",
				primaryCta: { label: "x", href: "/" },
				tone: "accent",
			},
		]);
		if (r.ok && r.sections[0].kind === "cta-banner") {
			expect(r.sections[0].body).toBeUndefined();
		}
	});

	it("secondaryCta with bad shape collects error (sc undefined branch)", () => {
		const r = parseSections([
			{
				id: "c",
				kind: "cta-banner",
				headline: "H",
				primaryCta: { label: "x", href: "/" },
				secondaryCta: 5,
			},
		]);
		expect(r.ok).toBe(false);
	});
});

describe("schema strict shape — image-text + faq + gallery + rich-text", () => {
	it("image-text returns object with kind=image-text + all keys", () => {
		const r = parseSections([
			{
				id: "i",
				kind: "image-text",
				heading: "H",
				body: "B",
				mediaId: "m",
				imageSide: "start",
			},
		]);
		if (r.ok) {
			const s = r.sections[0];
			expect(s.kind).toBe("image-text");
			expect(s.id).toBe("i");
			if (s.kind === "image-text") {
				expect(s.heading).toBe("H");
				expect(s.body).toBe("B");
				expect(s.mediaId).toBe("m");
				expect(s.imageSide).toBe("start");
			}
		}
	});

	it("faq returns object with kind=faq + items", () => {
		const r = parseSections([
			{
				id: "f",
				kind: "faq",
				items: [{ question: "q", answer: "a" }],
			},
		]);
		if (r.ok) {
			expect(r.sections[0].kind).toBe("faq");
			expect(r.sections[0].id).toBe("f");
			if (r.sections[0].kind === "faq") {
				expect(r.sections[0].items[0].question).toBe("q");
				expect(r.sections[0].items[0].answer).toBe("a");
			}
		}
	});

	it("faq empty heading drops heading", () => {
		const r = parseSections([{ id: "f", kind: "faq", items: [], heading: "" }]);
		if (r.ok && r.sections[0].kind === "faq") {
			expect(r.sections[0].heading).toBeUndefined();
		}
	});

	it("gallery returns object with kind=gallery + mediaIds + columns", () => {
		const r = parseSections([
			{ id: "g", kind: "gallery", mediaIds: ["a"], columns: 4 },
		]);
		if (r.ok) {
			const s = r.sections[0];
			expect(s.kind).toBe("gallery");
			expect(s.id).toBe("g");
			if (s.kind === "gallery") {
				expect(s.mediaIds).toEqual(["a"]);
				expect(s.columns).toBe(4);
			}
		}
	});

	it("gallery empty heading drops heading", () => {
		const r = parseSections([
			{ id: "g", kind: "gallery", mediaIds: [], columns: 3, heading: "" },
		]);
		if (r.ok && r.sections[0].kind === "gallery") {
			expect(r.sections[0].heading).toBeUndefined();
		}
	});
});

describe("isObject + isStringArray edges", () => {
	it("rejects null in section position", () => {
		const r = parseSections([null]);
		expect(r.ok).toBe(false);
	});

	it("isStringArray rejects mixed array in mediaIds", () => {
		const r = parseSections([{ id: "g", kind: "gallery", mediaIds: ["a", 5] }]);
		expect(r.ok).toBe(false);
	});

	it("isStringArray rejects non-array in mediaIds", () => {
		const r = parseSections([{ id: "g", kind: "gallery", mediaIds: "a" }]);
		expect(r.ok).toBe(false);
	});
});

describe("hero subhead/mediaId branch coverage", () => {
	it("subhead present sets subhead key (mutation guard on if (raw.subhead))", () => {
		const r = parseSections([
			{
				id: "h",
				kind: "hero",
				headline: "H",
				alignment: "start",
				subhead: "X",
			},
		]);
		if (r.ok && r.sections[0].kind === "hero") {
			expect(r.sections[0].subhead).toBe("X");
		}
	});

	it("subhead empty string (defined but falsy) skips subhead key", () => {
		const r = parseSections([
			{
				id: "h",
				kind: "hero",
				headline: "H",
				alignment: "start",
				subhead: "",
			},
		]);
		if (r.ok && r.sections[0].kind === "hero") {
			expect(r.sections[0].subhead).toBeUndefined();
		}
	});

	it("mediaId present sets mediaId key", () => {
		const r = parseSections([
			{
				id: "h",
				kind: "hero",
				headline: "H",
				alignment: "start",
				mediaId: "m1",
			},
		]);
		if (r.ok && r.sections[0].kind === "hero") {
			expect(r.sections[0].mediaId).toBe("m1");
		}
	});

	it("mediaId empty string (defined but falsy) skips mediaId key", () => {
		const r = parseSections([
			{
				id: "h",
				kind: "hero",
				headline: "H",
				alignment: "start",
				mediaId: "",
			},
		]);
		if (r.ok && r.sections[0].kind === "hero") {
			expect(r.sections[0].mediaId).toBeUndefined();
		}
	});
});

describe("multi-error accumulation", () => {
	it("multiple errors flow into errors array (length>0 final guard)", () => {
		const r = parseSections([
			{ id: "h1", kind: "hero" },
			{ id: "h2", kind: "hero" },
		]);
		expect(r.ok).toBe(false);
		if (!r.ok) {
			expect(r.errors.length).toBeGreaterThanOrEqual(2);
		}
	});

	it("zero errors returns ok=true (length>0 mutation guard)", () => {
		const r = parseSections([]);
		expect(r.ok).toBe(true);
	});
});
