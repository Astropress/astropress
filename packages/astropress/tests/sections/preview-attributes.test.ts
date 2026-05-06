/**
 * Targets escapeHtml (used in attributes only) — distinct from escText
 * (used in plain-text). Each test forces an attribute through escapeHtml
 * so its three replace() calls' literals are independently mutation-tested.
 */
import { describe, expect, it } from "vitest";
import { renderSectionsDocument } from "../../src/sections/preview-renderer";
import type { Section } from "../../src/sections/schema";

const ctx = { mediaUrls: {} as Record<string, string>, testimonials: [] };

describe("escapeHtml — attribute-only escapes", () => {
	it("ampersand in href attribute becomes &amp;", () => {
		const html = renderSectionsDocument(
			[
				{
					id: "h",
					kind: "hero",
					headline: "x",
					alignment: "start",
					primaryCta: { label: "Go", href: "/a&b" },
				},
			],
			ctx,
		);
		expect(html).toContain('href="/a&amp;b"');
	});

	it("less-than in href attribute becomes &lt;", () => {
		const html = renderSectionsDocument(
			[
				{
					id: "h",
					kind: "hero",
					headline: "x",
					alignment: "start",
					primaryCta: { label: "Go", href: "/a<b" },
				},
			],
			ctx,
		);
		expect(html).toContain('href="/a&lt;b"');
	});

	it("greater-than in href attribute becomes &gt;", () => {
		const html = renderSectionsDocument(
			[
				{
					id: "h",
					kind: "hero",
					headline: "x",
					alignment: "start",
					primaryCta: { label: "Go", href: "/a>b" },
				},
			],
			ctx,
		);
		expect(html).toContain('href="/a&gt;b"');
	});

	it("double-quote in href attribute becomes &quot;", () => {
		const html = renderSectionsDocument(
			[
				{
					id: "h",
					kind: "hero",
					headline: "x",
					alignment: "start",
					primaryCta: { label: "Go", href: '/a"b' },
				},
			],
			ctx,
		);
		expect(html).toContain('href="/a&quot;b"');
	});

	it("ampersand in stylesheetUrl becomes &amp;", () => {
		const html = renderSectionsDocument([], ctx, { stylesheetUrl: "/a&b.css" });
		expect(html).toContain("/a&amp;b.css");
	});

	it("ampersand in mediaUrl src becomes &amp;", () => {
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
			{ ...ctx, mediaUrls: { m: "/a&b.png" } },
		);
		expect(html).toContain("/a&amp;b.png");
	});
});

describe("preview-renderer — exact substring guards", () => {
	it("hero img tag is closed with /> and contains alt=''", () => {
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
			{ ...ctx, mediaUrls: { m: "/x.png" } },
		);
		expect(html).toMatch(/<img\s+src="\/x\.png"\s+alt=""\s*\/>/);
	});

	it("hero inner wrapper class is exactly ap-hero__inner", () => {
		const html = renderSectionsDocument(
			[{ id: "h", kind: "hero", headline: "x", alignment: "start" }],
			ctx,
		);
		expect(html).toContain('<div class="ap-hero__inner">');
	});

	it("hero headline tag is h1.ap-hero__headline", () => {
		const html = renderSectionsDocument(
			[{ id: "h", kind: "hero", headline: "Hi", alignment: "start" }],
			ctx,
		);
		expect(html).toContain('<h1 class="ap-hero__headline">Hi</h1>');
	});

	it("feature-grid head wrapper class is ap-feature-grid__head", () => {
		const html = renderSectionsDocument(
			[{ id: "f", kind: "feature-grid", heading: "H", columns: 3, items: [] }],
			ctx,
		);
		expect(html).toContain('class="ap-feature-grid__head"');
	});

	it("feature-grid heading tag is h2.ap-feature-grid__heading", () => {
		const html = renderSectionsDocument(
			[{ id: "f", kind: "feature-grid", heading: "FX", columns: 3, items: [] }],
			ctx,
		);
		expect(html).toContain('<h2 class="ap-feature-grid__heading">FX</h2>');
	});

	it("feature-grid item tag is li.ap-feature-grid__item", () => {
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
		expect(html).toContain('<li class="ap-feature-grid__item">');
		expect(html).toContain('class="ap-feature-grid__title"');
		expect(html).toContain('class="ap-feature-grid__body"');
	});

	it("testimonials __empty empty-state has exact text", () => {
		const html = renderSectionsDocument(
			[{ id: "t", kind: "testimonials", source: "approved", layout: "grid" }],
			ctx,
		);
		expect(html).toContain('<p class="ap-testimonials__empty">No testimonials yet.</p>');
	});

	it("testimonials item li class", () => {
		const html = renderSectionsDocument(
			[{ id: "t", kind: "testimonials", source: "approved", layout: "grid" }],
			{
				...ctx,
				testimonials: [{ id: "x", name: "X", quote: "Q", status: "approved" }],
			},
		);
		expect(html).toContain('<li class="ap-testimonials__item">');
		expect(html).toContain('class="ap-testimonials__quote"');
		expect(html).toContain('class="ap-testimonials__name"');
		expect(html).toContain('class="ap-testimonials__cite"');
	});

	it("cta inner wrapper class is ap-cta__inner", () => {
		const html = renderSectionsDocument(
			[
				{
					id: "c",
					kind: "cta-banner",
					headline: "H",
					primaryCta: { label: "x", href: "/" },
					tone: "neutral",
				},
			],
			ctx,
		);
		expect(html).toContain('<div class="ap-cta__inner">');
	});

	it("cta headline tag is h2.ap-cta__headline", () => {
		const html = renderSectionsDocument(
			[
				{
					id: "c",
					kind: "cta-banner",
					headline: "Hi",
					primaryCta: { label: "x", href: "/" },
					tone: "neutral",
				},
			],
			ctx,
		);
		expect(html).toContain('<h2 class="ap-cta__headline">Hi</h2>');
	});

	it("cta actions wrapper class", () => {
		const html = renderSectionsDocument(
			[
				{
					id: "c",
					kind: "cta-banner",
					headline: "H",
					primaryCta: { label: "x", href: "/" },
					tone: "neutral",
				},
			],
			ctx,
		);
		expect(html).toContain('<div class="ap-cta__actions">');
	});

	it("image-text media wrapper class is ap-image-text__media", () => {
		const html = renderSectionsDocument(
			[
				{
					id: "i",
					kind: "image-text",
					heading: "H",
					body: "<p>b</p>",
					mediaId: "",
					imageSide: "start",
				},
			],
			ctx,
		);
		expect(html).toContain('<div class="ap-image-text__media">');
		expect(html).toContain('class="ap-image-text__copy"');
		expect(html).toContain('class="ap-image-text__heading"');
		expect(html).toContain('class="ap-image-text__body"');
	});

	it("image-text placeholder div class", () => {
		const html = renderSectionsDocument(
			[
				{
					id: "i",
					kind: "image-text",
					heading: "H",
					body: "<p>b</p>",
					mediaId: "missing",
					imageSide: "start",
				},
			],
			ctx,
		);
		expect(html).toContain('<div class="ap-image-text__placeholder"');
	});

	it("faq item li class is ap-faq__item with details/summary", () => {
		const html = renderSectionsDocument(
			[{ id: "f", kind: "faq", items: [{ question: "q", answer: "a" }] }],
			ctx,
		);
		expect(html).toContain('<li class="ap-faq__item">');
		expect(html).toContain('class="ap-faq__details"');
		expect(html).toContain('class="ap-faq__question"');
		expect(html).toContain('class="ap-faq__answer"');
	});

	it("gallery li/img class and empty state", () => {
		const html1 = renderSectionsDocument(
			[{ id: "g", kind: "gallery", mediaIds: ["a"], columns: 3 }],
			{ ...ctx, mediaUrls: { a: "/a.png" } },
		);
		expect(html1).toContain('<li class="ap-gallery__item">');
		const html2 = renderSectionsDocument(
			[{ id: "g", kind: "gallery", mediaIds: [], columns: 3 }],
			ctx,
		);
		expect(html2).toContain('<p class="ap-gallery__empty">No images yet.</p>');
	});

	it("rich-text inner wrapper class is ap-rich-text__inner", () => {
		const html = renderSectionsDocument([{ id: "r", kind: "rich-text", html: "<p>x</p>" }], ctx);
		expect(html).toContain('<div class="ap-rich-text__inner">');
	});

	it("section data-align attribute uses literal 'start' / 'center'", () => {
		const a = renderSectionsDocument(
			[{ id: "h", kind: "hero", headline: "x", alignment: "start" }],
			ctx,
		);
		expect(a).toContain('data-align="start"');
		const b = renderSectionsDocument(
			[{ id: "h", kind: "hero", headline: "x", alignment: "center" }],
			ctx,
		);
		expect(b).toContain('data-align="center"');
	});

	it("testimonials role+company joined with ' — ' (em-dash with spaces, exact)", () => {
		const html = renderSectionsDocument(
			[{ id: "t", kind: "testimonials", source: "approved", layout: "grid" }],
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
		// The exact join string is " — " (space, em-dash U+2014, space).
		expect(html).toContain(">PM — Acme<");
	});

	it("testimonials with role only (no company) does NOT include em-dash separator", () => {
		const html = renderSectionsDocument(
			[{ id: "t", kind: "testimonials", source: "approved", layout: "grid" }],
			{
				...ctx,
				testimonials: [{ id: "x", name: "X", quote: "q", role: "PM", status: "approved" }],
			},
		);
		expect(html).toContain(">PM<");
		expect(html).not.toContain("—");
	});
});

describe("preview-renderer no mutation-marker leakage", () => {
	// Stryker uses the literal "Stryker was here!" as its standard
	// StringLiteral mutation replacement on template-string fragments. If
	// any conditional-fallback (`? ... : ""`) or `.join("")` separator gets
	// mutated, that marker leaks into the rendered HTML. Each test here
	// exercises a distinct false-branch / empty-join site so the mutation
	// dies on detection of the marker in the output.

	function expectClean(html: string) {
		expect(html).not.toContain("Stryker was here!");
	}

	it("hero with no media + no subhead + no CTAs has no marker", () => {
		expectClean(
			renderSectionsDocument([{ id: "h", kind: "hero", headline: "x", alignment: "start" }], ctx),
		);
	});

	it("hero with media but no subhead/CTAs has no marker", () => {
		expectClean(
			renderSectionsDocument(
				[
					{
						id: "h",
						kind: "hero",
						headline: "x",
						alignment: "start",
						mediaId: "m",
					},
				],
				{ ...ctx, mediaUrls: { m: "/x.png" } },
			),
		);
	});

	it("hero with subhead but no CTAs has no marker", () => {
		expectClean(
			renderSectionsDocument(
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
			),
		);
	});

	it("hero with primary CTA only has no marker", () => {
		expectClean(
			renderSectionsDocument(
				[
					{
						id: "h",
						kind: "hero",
						headline: "x",
						alignment: "start",
						primaryCta: { label: "P", href: "/" },
					},
				],
				ctx,
			),
		);
	});

	it("hero with both CTAs has no marker", () => {
		expectClean(
			renderSectionsDocument(
				[
					{
						id: "h",
						kind: "hero",
						headline: "x",
						alignment: "start",
						primaryCta: { label: "P", href: "/" },
						secondaryCta: { label: "S", href: "/" },
					},
				],
				ctx,
			),
		);
	});

	it("feature-grid with no intro + items has no marker (item join + intro fallback)", () => {
		expectClean(
			renderSectionsDocument(
				[
					{
						id: "f",
						kind: "feature-grid",
						heading: "H",
						columns: 3,
						items: [
							{ title: "T1", body: "B1" },
							{ title: "T2", body: "B2" },
						],
					},
				],
				ctx,
			),
		);
	});

	it("feature-grid with intro but no item icons has no marker", () => {
		expectClean(
			renderSectionsDocument(
				[
					{
						id: "f",
						kind: "feature-grid",
						heading: "H",
						columns: 3,
						intro: "I",
						items: [{ title: "T", body: "B" }],
					},
				],
				ctx,
			),
		);
	});

	it("testimonials with empty heading + meta-less items has no marker", () => {
		expectClean(
			renderSectionsDocument(
				[{ id: "t", kind: "testimonials", source: "approved", layout: "grid" }],
				{
					...ctx,
					testimonials: [
						{ id: "x", name: "X", quote: "q", status: "approved" },
						{ id: "y", name: "Y", quote: "q", status: "approved" },
					],
				},
			),
		);
	});

	it("testimonials with heading + meta-bearing items has no marker", () => {
		expectClean(
			renderSectionsDocument(
				[
					{
						id: "t",
						kind: "testimonials",
						source: "approved",
						layout: "grid",
						heading: "H",
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
			),
		);
	});

	it("cta-banner with no body + no secondaryCta has no marker", () => {
		expectClean(
			renderSectionsDocument(
				[
					{
						id: "c",
						kind: "cta-banner",
						headline: "H",
						primaryCta: { label: "x", href: "/" },
						tone: "neutral",
					},
				],
				ctx,
			),
		);
	});

	it("cta-banner with body + secondaryCta has no marker", () => {
		expectClean(
			renderSectionsDocument(
				[
					{
						id: "c",
						kind: "cta-banner",
						headline: "H",
						body: "B",
						primaryCta: { label: "x", href: "/" },
						secondaryCta: { label: "Y", href: "/" },
						tone: "accent",
					},
				],
				ctx,
			),
		);
	});

	it("faq with no heading + items has no marker", () => {
		expectClean(
			renderSectionsDocument(
				[
					{
						id: "f",
						kind: "faq",
						items: [
							{ question: "q1", answer: "a1" },
							{ question: "q2", answer: "a2" },
						],
					},
				],
				ctx,
			),
		);
	});

	it("gallery with no heading + items has no marker", () => {
		expectClean(
			renderSectionsDocument([{ id: "g", kind: "gallery", mediaIds: ["a", "b"], columns: 3 }], {
				...ctx,
				mediaUrls: { a: "/a.png", b: "/b.png" },
			}),
		);
	});

	it("multi-section render has no marker (join('') guard)", () => {
		const sections: Section[] = [
			{ id: "1", kind: "hero", headline: "H", alignment: "start" },
			{ id: "2", kind: "rich-text", html: "<p>x</p>" },
		];
		expectClean(renderSectionsDocument(sections, ctx));
	});

	it("document with no stylesheetUrl has no marker", () => {
		expectClean(renderSectionsDocument([], ctx));
	});

	it("document with stylesheetUrl has no marker", () => {
		expectClean(renderSectionsDocument([], ctx, { stylesheetUrl: "/x.css" }));
	});
});

describe("preview-renderer testimonials ConditionalExpression L98", () => {
	it("source=ids with ids array short-circuits to ids branch (not approved)", () => {
		// If L98's `s.source === "ids" && s.ids` mutated to `true`, the ids
		// branch would be taken even for source=featured/approved, leaking
		// the wrong selection.
		const sec: Section = {
			id: "t",
			kind: "testimonials",
			source: "featured",
			layout: "grid",
		};
		const html = renderSectionsDocument([sec], {
			...ctx,
			testimonials: [
				{
					id: "a",
					name: "Alice",
					quote: "q",
					featured: true,
					status: "approved",
				},
				{
					id: "b",
					name: "Bob",
					quote: "q",
					featured: false,
					status: "approved",
				},
			],
		});
		// featured branch keeps Alice, drops Bob. If mutation forced ids branch
		// with no ids array, Set(undefined) would throw or pick nothing — either
		// way the output would lose Alice.
		expect(html).toContain("Alice");
	});
});
