/**
 * Each parse function pushes errors with specific path + message strings.
 * These tests assert the exact path and message for every error branch so
 * StringLiteral/ObjectLiteral mutations on the errors.push() calls die.
 */
import { describe, expect, it } from "vitest";
import { parseSections } from "../../src/sections/schema";

function expectErr(input: unknown, path: string, message: string) {
	const r = parseSections(input);
	expect(r.ok).toBe(false);
	if (!r.ok) {
		const found = r.errors.find((e) => e.path === path);
		if (!found) {
			throw new Error(`expected error at path '${path}' but got: ${JSON.stringify(r.errors)}`);
		}
		expect(found.message).toBe(message);
	}
}

describe("schema error paths — exact path + message coverage", () => {
	it("CTA missing label", () => {
		expectErr(
			[{ id: "h", kind: "hero", headline: "x", primaryCta: { href: "/p" } }],
			"$[0].primaryCta.label",
			"label is required",
		);
	});

	it("CTA missing href", () => {
		expectErr(
			[{ id: "h", kind: "hero", headline: "x", primaryCta: { label: "L" } }],
			"$[0].primaryCta.href",
			"href is required",
		);
	});

	it("CTA non-object", () => {
		expectErr(
			[{ id: "h", kind: "hero", headline: "x", primaryCta: 7 }],
			"$[0].primaryCta",
			"must be an object with label + href",
		);
	});

	it("hero subhead non-string", () => {
		expectErr(
			[{ id: "h", kind: "hero", headline: "x", subhead: 5 }],
			"$[0].subhead",
			"subhead must be string",
		);
	});

	it("hero mediaId non-string", () => {
		expectErr(
			[{ id: "h", kind: "hero", headline: "x", mediaId: 5 }],
			"$[0].mediaId",
			"mediaId must be string",
		);
	});

	it("hero headline missing", () => {
		expectErr(
			[{ id: "h", kind: "hero", alignment: "start" }],
			"$[0].headline",
			"headline is required",
		);
	});

	it("feature-grid heading missing", () => {
		expectErr(
			[{ id: "f", kind: "feature-grid", items: [] }],
			"$[0].heading",
			"heading is required",
		);
	});

	it("feature-grid items not array", () => {
		expectErr(
			[{ id: "f", kind: "feature-grid", heading: "X", items: "no" }],
			"$[0].items",
			"items must be an array",
		);
	});

	it("feature-grid item not object", () => {
		expectErr(
			[{ id: "f", kind: "feature-grid", heading: "X", items: ["nope"] }],
			"$[0].items[0]",
			"must be object",
		);
	});

	it("feature-grid item.title missing", () => {
		expectErr(
			[
				{
					id: "f",
					kind: "feature-grid",
					heading: "X",
					items: [{ body: "b" }],
				},
			],
			"$[0].items[0].title",
			"title required",
		);
	});

	it("feature-grid item.body missing", () => {
		expectErr(
			[
				{
					id: "f",
					kind: "feature-grid",
					heading: "X",
					items: [{ title: "t" }],
				},
			],
			"$[0].items[0].body",
			"body required",
		);
	});

	it("testimonials ids required when source=ids", () => {
		expectErr(
			[{ id: "t", kind: "testimonials", source: "ids", layout: "grid" }],
			"$[0].ids",
			"ids[] required when source=ids",
		);
	});

	it("testimonials ids empty array also rejected", () => {
		expectErr(
			[
				{
					id: "t",
					kind: "testimonials",
					source: "ids",
					layout: "grid",
					ids: [],
				},
			],
			"$[0].ids",
			"ids[] required when source=ids",
		);
	});

	it("cta-banner headline missing", () => {
		expectErr(
			[
				{
					id: "c",
					kind: "cta-banner",
					primaryCta: { label: "x", href: "/" },
				},
			],
			"$[0].headline",
			"headline required",
		);
	});

	it("cta-banner primaryCta missing → label error", () => {
		const r = parseSections([{ id: "c", kind: "cta-banner", headline: "H" }]);
		expect(r.ok).toBe(false);
		if (!r.ok) {
			expect(r.errors.some((e) => e.path === "$[0].primaryCta")).toBe(true);
		}
	});

	it("image-text heading missing", () => {
		expectErr(
			[
				{
					id: "i",
					kind: "image-text",
					body: "b",
					mediaId: "",
					imageSide: "start",
				},
			],
			"$[0].heading",
			"heading required",
		);
	});

	it("image-text body missing", () => {
		expectErr(
			[
				{
					id: "i",
					kind: "image-text",
					heading: "H",
					mediaId: "",
					imageSide: "start",
				},
			],
			"$[0].body",
			"body required",
		);
	});

	it("image-text mediaId non-string", () => {
		expectErr(
			[
				{
					id: "i",
					kind: "image-text",
					heading: "H",
					body: "B",
					mediaId: 5,
				},
			],
			"$[0].mediaId",
			"mediaId must be string",
		);
	});

	it("faq items not array", () => {
		expectErr([{ id: "f", kind: "faq", items: "no" }], "$[0].items", "items must be an array");
	});

	it("faq item not object", () => {
		expectErr([{ id: "f", kind: "faq", items: ["nope"] }], "$[0].items[0]", "must be object");
	});

	it("faq item.question missing", () => {
		expectErr(
			[{ id: "f", kind: "faq", items: [{ answer: "a" }] }],
			"$[0].items[0].question",
			"question required",
		);
	});

	it("faq item.answer missing", () => {
		expectErr(
			[{ id: "f", kind: "faq", items: [{ question: "q" }] }],
			"$[0].items[0].answer",
			"answer required",
		);
	});

	it("gallery mediaIds non-array", () => {
		expectErr(
			[{ id: "g", kind: "gallery", mediaIds: "no" }],
			"$[0].mediaIds",
			"mediaIds must be string[]",
		);
	});

	it("gallery mediaIds with non-string", () => {
		expectErr(
			[{ id: "g", kind: "gallery", mediaIds: [1] }],
			"$[0].mediaIds",
			"mediaIds must be string[]",
		);
	});

	it("rich-text html non-string", () => {
		expectErr([{ id: "r", kind: "rich-text", html: 5 }], "$[0].html", "html must be a string");
	});

	it("section id missing → exact message", () => {
		expectErr([{ kind: "hero", headline: "x", alignment: "start" }], "$[0].id", "id is required");
	});

	it("section non-object → exact message", () => {
		expectErr(["bad"], "$[0]", "section must be an object");
	});

	it("unknown kind error message includes kind value", () => {
		const r = parseSections([{ id: "x", kind: "what" }]);
		expect(r.ok).toBe(false);
		if (!r.ok) {
			const e = r.errors.find((x) => x.path === "$[0].kind");
			expect(e?.message).toBe("unknown section kind: what");
		}
	});

	it("top-level non-array message", () => {
		const r = parseSections({ random: 1 });
		expect(r.ok).toBe(false);
		if (!r.ok) expect(r.errors[0].message).toBe("sections payload must be an array");
	});

	it("intro included on success only when non-empty (string truthy guard)", () => {
		const r = parseSections([
			{
				id: "f",
				kind: "feature-grid",
				heading: "H",
				intro: "x",
				items: [],
			},
		]);
		expect(r.ok).toBe(true);
		if (r.ok && r.sections[0].kind === "feature-grid") {
			expect(r.sections[0].intro).toBe("x");
		}
	});

	it("testimonials heading included exactly when non-empty (truthy guard)", () => {
		const r1 = parseSections([
			{
				id: "t",
				kind: "testimonials",
				source: "approved",
				layout: "grid",
				heading: "X",
			},
		]);
		if (r1.ok && r1.sections[0].kind === "testimonials") {
			expect(r1.sections[0].heading).toBe("X");
		}
		const r2 = parseSections([
			{
				id: "t",
				kind: "testimonials",
				source: "approved",
				layout: "grid",
				heading: "",
			},
		]);
		if (r2.ok && r2.sections[0].kind === "testimonials") {
			expect("heading" in r2.sections[0]).toBe(false);
		}
	});

	it("cta-banner secondaryCta validated when present", () => {
		const r = parseSections([
			{
				id: "c",
				kind: "cta-banner",
				headline: "H",
				primaryCta: { label: "x", href: "/" },
				secondaryCta: { label: "S", href: "/s" },
			},
		]);
		expect(r.ok).toBe(true);
		if (r.ok && r.sections[0].kind === "cta-banner") {
			expect(r.sections[0].secondaryCta?.label).toBe("S");
		}
	});

	it("cta-banner secondaryCta with bad shape collects error", () => {
		const r = parseSections([
			{
				id: "c",
				kind: "cta-banner",
				headline: "H",
				primaryCta: { label: "x", href: "/" },
				secondaryCta: { label: "" },
			},
		]);
		expect(r.ok).toBe(false);
		if (!r.ok) expect(r.errors.some((e) => e.path.startsWith("$[0].secondaryCta"))).toBe(true);
	});

	it("hero secondaryCta with bad shape collects error", () => {
		const r = parseSections([
			{
				id: "h",
				kind: "hero",
				headline: "x",
				secondaryCta: { href: "/p" },
			},
		]);
		expect(r.ok).toBe(false);
		if (!r.ok) expect(r.errors.some((e) => e.path === "$[0].secondaryCta.label")).toBe(true);
	});

	it("rich-text returns RichTextSection with kind preserved", () => {
		const r = parseSections([{ id: "r", kind: "rich-text", html: "<p>x</p>" }]);
		expect(r.ok).toBe(true);
		if (r.ok) {
			expect(r.sections[0]).toEqual({
				id: "r",
				kind: "rich-text",
				html: "<p>x</p>",
			});
		}
	});

	it("gallery preserves mediaIds array reference contents", () => {
		const r = parseSections([
			{
				id: "g",
				kind: "gallery",
				mediaIds: ["a", "b"],
				columns: 4,
			},
		]);
		expect(r.ok).toBe(true);
		if (r.ok && r.sections[0].kind === "gallery") {
			expect(r.sections[0].mediaIds).toEqual(["a", "b"]);
		}
	});

	it("faq preserves item question + answer pairs", () => {
		const r = parseSections([
			{
				id: "f",
				kind: "faq",
				items: [
					{ question: "Q1", answer: "A1" },
					{ question: "Q2", answer: "A2" },
				],
			},
		]);
		if (r.ok && r.sections[0].kind === "faq") {
			expect(r.sections[0].items).toEqual([
				{ question: "Q1", answer: "A1" },
				{ question: "Q2", answer: "A2" },
			]);
		}
	});

	it("feature-grid preserves icon when truthy non-empty", () => {
		const r = parseSections([
			{
				id: "f",
				kind: "feature-grid",
				heading: "H",
				items: [{ icon: "*", title: "T", body: "B" }],
			},
		]);
		if (r.ok && r.sections[0].kind === "feature-grid") {
			expect(r.sections[0].items[0]).toEqual({
				icon: "*",
				title: "T",
				body: "B",
			});
		}
	});

	it("hero preserved id stays as the input string verbatim", () => {
		const r = parseSections([{ id: "abc-123", kind: "hero", headline: "x", alignment: "start" }]);
		if (r.ok) expect(r.sections[0].id).toBe("abc-123");
	});

	it("testimonials full-shape round-trip preserves source + layout + ids", () => {
		const r = parseSections([
			{
				id: "t",
				kind: "testimonials",
				source: "ids",
				ids: ["x", "y"],
				layout: "carousel",
				heading: "H",
			},
		]);
		if (r.ok && r.sections[0].kind === "testimonials") {
			expect(r.sections[0]).toEqual({
				id: "t",
				kind: "testimonials",
				source: "ids",
				layout: "carousel",
				heading: "H",
				ids: ["x", "y"],
			});
		}
	});
});
