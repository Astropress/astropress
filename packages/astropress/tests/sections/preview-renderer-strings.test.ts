/**
 * Targeted tests killing surviving StringLiteral mutations in
 * preview-renderer.ts. Each test asserts an EXACT substring or attribute
 * pair so a "" or "Stryker was here!" replacement breaks the assertion.
 */
import { describe, expect, it } from "vitest";
import { renderSectionsDocument } from "../../src/sections/preview-renderer";
import type { Section } from "../../src/sections/schema";

const ctx = { mediaUrls: {} as Record<string, string>, testimonials: [] };

describe("preview escapeHtml exact substitution targets", () => {
	it("ampersand becomes &amp;", () => {
		const html = renderSectionsDocument(
			[{ id: "h", kind: "hero", headline: "A&B", alignment: "start" }],
			ctx,
		);
		expect(html).toContain("A&amp;B");
		expect(html).not.toContain("A&B");
	});

	it("less-than becomes &lt;", () => {
		const html = renderSectionsDocument(
			[{ id: "h", kind: "hero", headline: "A<B", alignment: "start" }],
			ctx,
		);
		expect(html).toContain("A&lt;B");
	});

	it("greater-than becomes &gt;", () => {
		const html = renderSectionsDocument(
			[{ id: "h", kind: "hero", headline: "A>B", alignment: "start" }],
			ctx,
		);
		expect(html).toContain("A&gt;B");
	});

	it("double-quote in attribute becomes &quot;", () => {
		const html = renderSectionsDocument(
			[
				{
					id: "h",
					kind: "hero",
					headline: "x",
					alignment: "start",
					mediaId: "m",
				},
			],
			{ ...ctx, mediaUrls: { m: '/a"b.png' } },
		);
		expect(html).toContain("&quot;");
	});
});

describe("preview hero exact attributes", () => {
	it("img has empty alt attribute literally", () => {
		const html = renderSectionsDocument(
			[
				{
					id: "h",
					kind: "hero",
					headline: "x",
					alignment: "start",
					mediaId: "m",
				},
			],
			{ ...ctx, mediaUrls: { m: "/a.png" } },
		);
		expect(html).toContain('alt=""');
	});

	it("subhead p tag has class ap-hero__subhead", () => {
		const html = renderSectionsDocument(
			[
				{
					id: "h",
					kind: "hero",
					headline: "x",
					alignment: "start",
					subhead: "S",
				},
			],
			ctx,
		);
		expect(html).toContain('<p class="ap-hero__subhead">S</p>');
	});

	it("primary cta href appears verbatim in href attribute", () => {
		const html = renderSectionsDocument(
			[
				{
					id: "h",
					kind: "hero",
					headline: "x",
					alignment: "start",
					primaryCta: { label: "Go", href: "/path" },
				},
			],
			ctx,
		);
		expect(html).toContain('href="/path"');
		expect(html).toContain(">Go</a>");
	});

	it("secondary cta link contains both href and label", () => {
		const html = renderSectionsDocument(
			[
				{
					id: "h",
					kind: "hero",
					headline: "x",
					alignment: "start",
					secondaryCta: { label: "More", href: "/more" },
				},
			],
			ctx,
		);
		expect(html).toContain('href="/more"');
		expect(html).toContain(">More</a>");
		expect(html).toContain('class="ap-btn ap-btn--secondary"');
	});

	it("hero cta wrapper class is ap-hero__cta when CTAs present", () => {
		const html = renderSectionsDocument(
			[
				{
					id: "h",
					kind: "hero",
					headline: "x",
					alignment: "start",
					primaryCta: { label: "Go", href: "/" },
				},
			],
			ctx,
		);
		expect(html).toContain('class="ap-hero__cta"');
	});

	it("hero media wrapper has aria-hidden=true", () => {
		const html = renderSectionsDocument(
			[
				{
					id: "h",
					kind: "hero",
					headline: "x",
					alignment: "start",
					mediaId: "m",
				},
			],
			{ ...ctx, mediaUrls: { m: "/a.png" } },
		);
		expect(html).toContain('aria-hidden="true"');
	});
});

describe("preview feature-grid exact text", () => {
	it("intro paragraph has class ap-feature-grid__intro", () => {
		const html = renderSectionsDocument(
			[
				{
					id: "f",
					kind: "feature-grid",
					heading: "H",
					columns: 3,
					items: [],
					intro: "INT",
				},
			],
			ctx,
		);
		expect(html).toContain('<p class="ap-feature-grid__intro">INT</p>');
	});

	it("feature item icon span class is ap-feature-grid__icon", () => {
		const html = renderSectionsDocument(
			[
				{
					id: "f",
					kind: "feature-grid",
					heading: "H",
					columns: 3,
					items: [{ icon: "*", title: "T", body: "B" }],
				},
			],
			ctx,
		);
		expect(html).toContain('class="ap-feature-grid__icon"');
	});

	it("feature items wrapper class is ap-feature-grid__items", () => {
		const html = renderSectionsDocument(
			[
				{
					id: "f",
					kind: "feature-grid",
					heading: "H",
					columns: 3,
					items: [{ title: "T", body: "B" }],
				},
			],
			ctx,
		);
		expect(html).toContain('class="ap-feature-grid__items"');
	});
});

describe("preview testimonials branches", () => {
	const samples = [
		{ id: "a", name: "Alice", quote: "qa", featured: true, status: "approved" },
		{ id: "b", name: "Bob", quote: "qb", featured: false, status: "approved" },
	];

	it("ids source without ids field falls back to approved", () => {
		// LogicalOperator mutation: s.source === "ids" && s.ids
		// without ids array, the right side is falsy so we skip the ids branch.
		const sec: Section = {
			id: "t",
			kind: "testimonials",
			source: "ids",
			layout: "grid",
		};
		const html = renderSectionsDocument([sec], {
			...ctx,
			testimonials: samples,
		});
		// approved branch picks both Alice and Bob.
		expect(html).toContain("Alice");
		expect(html).toContain("Bob");
	});

	it("ids source with ids array selects only listed ids", () => {
		const sec: Section = {
			id: "t",
			kind: "testimonials",
			source: "ids",
			layout: "grid",
			ids: ["a"],
		};
		const html = renderSectionsDocument([sec], {
			...ctx,
			testimonials: samples,
		});
		expect(html).toContain("Alice");
		expect(html).not.toContain("Bob");
	});

	it("testimonials heading h2 has exact class ap-testimonials__heading", () => {
		const html = renderSectionsDocument(
			[
				{
					id: "t",
					kind: "testimonials",
					source: "approved",
					layout: "grid",
					heading: "What",
				},
			],
			ctx,
		);
		expect(html).toContain('<h2 class="ap-testimonials__heading">What</h2>');
	});

	it("testimonials list class ap-testimonials__list", () => {
		const html = renderSectionsDocument(
			[
				{
					id: "t",
					kind: "testimonials",
					source: "approved",
					layout: "grid",
				},
			],
			{ ...ctx, testimonials: [samples[0]] },
		);
		expect(html).toContain('class="ap-testimonials__list"');
		expect(html).toContain('role="list"');
	});

	it("testimonials role-only meta renders the role text", () => {
		const html = renderSectionsDocument(
			[
				{
					id: "t",
					kind: "testimonials",
					source: "approved",
					layout: "grid",
				},
			],
			{
				...ctx,
				testimonials: [{ id: "x", name: "X", quote: "q", role: "Eng", status: "approved" }],
			},
		);
		expect(html).toContain("Eng");
		expect(html).toContain('class="ap-testimonials__meta"');
	});

	it("testimonials company-only meta renders the company text", () => {
		const html = renderSectionsDocument(
			[
				{
					id: "t",
					kind: "testimonials",
					source: "approved",
					layout: "grid",
				},
			],
			{
				...ctx,
				testimonials: [
					{
						id: "x",
						name: "X",
						quote: "q",
						company: "Acme",
						status: "approved",
					},
				],
			},
		);
		expect(html).toContain("Acme");
	});

	it("testimonials role + company are joined exactly with ' — ' (em-dash with spaces)", () => {
		const html = renderSectionsDocument(
			[
				{
					id: "t",
					kind: "testimonials",
					source: "approved",
					layout: "grid",
				},
			],
			{
				...ctx,
				testimonials: [
					{
						id: "x",
						name: "X",
						quote: "q",
						role: "PM",
						company: "Acme",
						status: "approved",
					},
				],
			},
		);
		expect(html).toContain("PM — Acme");
	});
});

describe("preview cta-banner exact attributes", () => {
	it("cta__body p tag class", () => {
		const html = renderSectionsDocument(
			[
				{
					id: "c",
					kind: "cta-banner",
					headline: "H",
					body: "B",
					primaryCta: { label: "x", href: "/" },
					tone: "neutral",
				},
			],
			ctx,
		);
		expect(html).toContain('<p class="ap-cta__body">B</p>');
	});

	it("cta secondary cta href appears", () => {
		const html = renderSectionsDocument(
			[
				{
					id: "c",
					kind: "cta-banner",
					headline: "H",
					primaryCta: { label: "x", href: "/" },
					secondaryCta: { label: "Sec", href: "/sec" },
					tone: "neutral",
				},
			],
			ctx,
		);
		expect(html).toContain('href="/sec"');
		expect(html).toContain(">Sec</a>");
	});
});

describe("preview faq + gallery exact attributes", () => {
	it("faq heading class is ap-faq__heading", () => {
		const html = renderSectionsDocument([{ id: "f", kind: "faq", items: [], heading: "Q" }], ctx);
		expect(html).toContain('<h2 class="ap-faq__heading">Q</h2>');
	});

	it("faq list class is ap-faq__list", () => {
		const html = renderSectionsDocument(
			[{ id: "f", kind: "faq", items: [{ question: "q", answer: "a" }] }],
			ctx,
		);
		expect(html).toContain('class="ap-faq__list"');
	});

	it("gallery heading class is ap-gallery__heading", () => {
		const html = renderSectionsDocument(
			[
				{
					id: "g",
					kind: "gallery",
					mediaIds: [],
					columns: 3,
					heading: "GH",
				},
			],
			ctx,
		);
		expect(html).toContain('<h2 class="ap-gallery__heading">GH</h2>');
	});

	it("gallery items class is ap-gallery__items", () => {
		const html = renderSectionsDocument(
			[{ id: "g", kind: "gallery", mediaIds: ["a"], columns: 3 }],
			{ ...ctx, mediaUrls: { a: "/a.png" } },
		);
		expect(html).toContain('class="ap-gallery__items"');
	});
});

describe("preview document chrome exact strings", () => {
	it("stylesheet link rel attribute is exactly 'stylesheet'", () => {
		const html = renderSectionsDocument([], ctx, { stylesheetUrl: "/x.css" });
		expect(html).toContain('rel="stylesheet"');
	});

	it("ap-sections wrapper div class", () => {
		const html = renderSectionsDocument([], ctx);
		expect(html).toContain('<div class="ap-sections">');
	});
});
