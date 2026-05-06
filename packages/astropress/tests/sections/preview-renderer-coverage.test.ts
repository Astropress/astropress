/**
 * Branch / literal coverage for preview-renderer.ts.
 * Tests verify exact substrings that mutation operators would change
 * (StringLiteral, ConditionalExpression, BooleanLiteral, ComparisonOperator).
 */
import { describe, expect, it } from "vitest";
import { renderSectionsDocument } from "../../src/sections/preview-renderer";

const baseCtx = { mediaUrls: {} as Record<string, string>, testimonials: [] };

describe("preview document chrome", () => {
	it("emits doctype, html lang=en, ap-sections wrapper, viewport meta", () => {
		const html = renderSectionsDocument([], baseCtx);
		expect(html).toContain("<!doctype html>");
		expect(html).toContain('<html lang="en"');
		expect(html).toContain('class="ap-sections"');
		expect(html).toContain('<meta name="viewport" content="width=device-width, initial-scale=1"');
		expect(html).toContain("<title>Preview</title>");
	});

	it("dir defaults to ltr when ctx.dir is undefined", () => {
		const html = renderSectionsDocument([], baseCtx);
		expect(html).toContain('dir="ltr"');
	});

	it("dir = ltr when ctx.dir = 'ltr'", () => {
		const html = renderSectionsDocument([], { ...baseCtx, dir: "ltr" });
		expect(html).toContain('dir="ltr"');
	});

	it("includes inline body styles", () => {
		const html = renderSectionsDocument([], baseCtx);
		expect(html).toContain("body{margin:0;");
	});

	it("escapes stylesheet URL", () => {
		const html = renderSectionsDocument([], baseCtx, {
			stylesheetUrl: '/x"y.css',
		});
		expect(html).toContain("&quot;");
	});

	it("no stylesheet link tag when stylesheetUrl omitted", () => {
		const html = renderSectionsDocument([], baseCtx);
		expect(html).not.toContain('rel="stylesheet"');
	});
});

describe("preview hero", () => {
	it("hero with mediaId and known url renders <img>", () => {
		const html = renderSectionsDocument(
			[
				{
					id: "h",
					kind: "hero",
					headline: "H",
					alignment: "start",
					mediaId: "m",
				},
			],
			{ ...baseCtx, mediaUrls: { m: "/x.png" } },
		);
		expect(html).toContain('class="ap-hero__media"');
		expect(html).toContain("/x.png");
	});

	it("hero with mediaId but no url omits the img wrapper", () => {
		const html = renderSectionsDocument(
			[
				{
					id: "h",
					kind: "hero",
					headline: "H",
					alignment: "start",
					mediaId: "missing",
				},
			],
			baseCtx,
		);
		expect(html).not.toContain("ap-hero__media");
	});

	it("hero data-align uses 'start' value when alignment is start", () => {
		const html = renderSectionsDocument(
			[{ id: "h", kind: "hero", headline: "H", alignment: "start" }],
			baseCtx,
		);
		expect(html).toContain('data-align="start"');
	});

	it("hero data-align uses 'center' when alignment center", () => {
		const html = renderSectionsDocument(
			[{ id: "h", kind: "hero", headline: "H", alignment: "center" }],
			baseCtx,
		);
		expect(html).toContain('data-align="center"');
	});

	it("hero subhead block omitted when subhead missing", () => {
		const html = renderSectionsDocument(
			[{ id: "h", kind: "hero", headline: "H", alignment: "start" }],
			baseCtx,
		);
		expect(html).not.toContain("ap-hero__subhead");
	});

	it("hero subhead rendered when present", () => {
		const html = renderSectionsDocument(
			[
				{
					id: "h",
					kind: "hero",
					headline: "H",
					alignment: "start",
					subhead: "Sub",
				},
			],
			baseCtx,
		);
		expect(html).toContain('class="ap-hero__subhead">Sub<');
	});

	it("hero CTA block omitted when no CTAs", () => {
		const html = renderSectionsDocument(
			[{ id: "h", kind: "hero", headline: "H", alignment: "start" }],
			baseCtx,
		);
		expect(html).not.toContain("ap-hero__cta");
	});

	it("hero primary-only CTA renders one button", () => {
		const html = renderSectionsDocument(
			[
				{
					id: "h",
					kind: "hero",
					headline: "H",
					alignment: "start",
					primaryCta: { label: "Go", href: "/g" },
				},
			],
			baseCtx,
		);
		expect(html).toContain("ap-btn--primary");
		expect(html).not.toContain("ap-btn--secondary");
		expect(html).toContain(">Go<");
		expect(html).toContain('href="/g"');
	});

	it("hero secondary-only CTA renders only secondary", () => {
		const html = renderSectionsDocument(
			[
				{
					id: "h",
					kind: "hero",
					headline: "H",
					alignment: "start",
					secondaryCta: { label: "S", href: "/s" },
				},
			],
			baseCtx,
		);
		expect(html).toContain("ap-btn--secondary");
		expect(html).not.toContain("ap-btn--primary");
	});

	it("hero both CTAs renders both", () => {
		const html = renderSectionsDocument(
			[
				{
					id: "h",
					kind: "hero",
					headline: "H",
					alignment: "start",
					primaryCta: { label: "P", href: "/p" },
					secondaryCta: { label: "S", href: "/s" },
				},
			],
			baseCtx,
		);
		expect(html).toContain("ap-btn--primary");
		expect(html).toContain("ap-btn--secondary");
	});
});

describe("preview feature-grid", () => {
	it("data-columns matches input columns", () => {
		const html = renderSectionsDocument(
			[
				{
					id: "f",
					kind: "feature-grid",
					heading: "H",
					columns: 4,
					items: [],
				},
			],
			baseCtx,
		);
		expect(html).toContain('data-columns="4"');
	});

	it("renders heading text", () => {
		const html = renderSectionsDocument(
			[{ id: "f", kind: "feature-grid", heading: "FX", columns: 3, items: [] }],
			baseCtx,
		);
		expect(html).toContain(">FX<");
	});

	it("intro paragraph omitted without intro", () => {
		const html = renderSectionsDocument(
			[{ id: "f", kind: "feature-grid", heading: "H", columns: 3, items: [] }],
			baseCtx,
		);
		expect(html).not.toContain("ap-feature-grid__intro");
	});

	it("intro rendered when present", () => {
		const html = renderSectionsDocument(
			[
				{
					id: "f",
					kind: "feature-grid",
					heading: "H",
					columns: 3,
					items: [],
					intro: "INTRO",
				},
			],
			baseCtx,
		);
		expect(html).toContain(">INTRO<");
		expect(html).toContain("ap-feature-grid__intro");
	});

	it("item icon span omitted when no icon", () => {
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
			baseCtx,
		);
		expect(html).not.toContain("ap-feature-grid__icon");
	});

	it("item icon rendered when present", () => {
		const html = renderSectionsDocument(
			[
				{
					id: "f",
					kind: "feature-grid",
					heading: "H",
					columns: 3,
					items: [{ icon: "★", title: "T", body: "B" }],
				},
			],
			baseCtx,
		);
		expect(html).toContain('class="ap-feature-grid__icon"');
		expect(html).toContain("★");
	});
});

describe("preview testimonials", () => {
	const samples = [
		{ id: "a", name: "Alice", quote: "qa", featured: true, status: "approved" },
		{ id: "b", name: "Bob", quote: "qb", featured: false, status: "approved" },
		{ id: "c", name: "Cy", quote: "qc", featured: true, status: "pending" },
		{
			id: "d",
			name: "Dee",
			quote: "qd",
			role: "PM",
			company: "Acme",
			featured: true,
			status: "approved",
		},
	];

	it("source=featured filters featured AND approved", () => {
		const html = renderSectionsDocument(
			[{ id: "t", kind: "testimonials", source: "featured", layout: "grid" }],
			{ ...baseCtx, testimonials: samples },
		);
		expect(html).toContain("Alice");
		expect(html).toContain("Dee");
		expect(html).not.toContain("Bob");
		expect(html).not.toContain("Cy");
	});

	it("source=approved includes Bob (not featured) and excludes pending", () => {
		const html = renderSectionsDocument(
			[{ id: "t", kind: "testimonials", source: "approved", layout: "grid" }],
			{ ...baseCtx, testimonials: samples },
		);
		expect(html).toContain("Alice");
		expect(html).toContain("Bob");
		expect(html).toContain("Dee");
		expect(html).not.toContain(">Cy<");
	});

	it("source=ids picks exactly listed ids", () => {
		const html = renderSectionsDocument(
			[
				{
					id: "t",
					kind: "testimonials",
					source: "ids",
					layout: "grid",
					ids: ["b", "c"],
				},
			],
			{ ...baseCtx, testimonials: samples },
		);
		expect(html).toContain("Bob");
		expect(html).toContain("Cy");
		expect(html).not.toContain(">Alice<");
	});

	it("data-layout reflects 'carousel'", () => {
		const html = renderSectionsDocument(
			[
				{
					id: "t",
					kind: "testimonials",
					source: "approved",
					layout: "carousel",
				},
			],
			baseCtx,
		);
		expect(html).toContain('data-layout="carousel"');
	});

	it("data-layout = 'grid' default", () => {
		const html = renderSectionsDocument(
			[{ id: "t", kind: "testimonials", source: "approved", layout: "grid" }],
			baseCtx,
		);
		expect(html).toContain('data-layout="grid"');
	});

	it("empty state when nothing matches", () => {
		const html = renderSectionsDocument(
			[{ id: "t", kind: "testimonials", source: "approved", layout: "grid" }],
			baseCtx,
		);
		expect(html).toContain("No testimonials yet.");
		expect(html).toContain("ap-testimonials__empty");
	});

	it("renders heading when present", () => {
		const html = renderSectionsDocument(
			[
				{
					id: "t",
					kind: "testimonials",
					source: "approved",
					layout: "grid",
					heading: "What people say",
				},
			],
			baseCtx,
		);
		expect(html).toContain("What people say");
		expect(html).toContain("ap-testimonials__heading");
	});

	it("renders meta with role + company joined by em-dash", () => {
		const html = renderSectionsDocument(
			[{ id: "t", kind: "testimonials", source: "approved", layout: "grid" }],
			{ ...baseCtx, testimonials: [samples[3]] },
		);
		expect(html).toContain("PM — Acme");
	});

	it("omits meta block when role and company both missing", () => {
		const html = renderSectionsDocument(
			[{ id: "t", kind: "testimonials", source: "approved", layout: "grid" }],
			{ ...baseCtx, testimonials: [samples[0]] },
		);
		expect(html).not.toContain("ap-testimonials__meta");
	});

	it("treats missing status as 'approved' default", () => {
		const html = renderSectionsDocument(
			[{ id: "t", kind: "testimonials", source: "approved", layout: "grid" }],
			{
				...baseCtx,
				testimonials: [{ id: "x", name: "Nostatus", quote: "q" }],
			},
		);
		expect(html).toContain("Nostatus");
	});
});

describe("preview cta-banner", () => {
	it("data-tone reflects 'accent'", () => {
		const html = renderSectionsDocument(
			[
				{
					id: "c",
					kind: "cta-banner",
					headline: "H",
					primaryCta: { label: "x", href: "/" },
					tone: "accent",
				},
			],
			baseCtx,
		);
		expect(html).toContain('data-tone="accent"');
	});

	it("body block omitted without body", () => {
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
			baseCtx,
		);
		expect(html).not.toContain("ap-cta__body");
	});

	it("body rendered when present", () => {
		const html = renderSectionsDocument(
			[
				{
					id: "c",
					kind: "cta-banner",
					headline: "H",
					body: "BODY!",
					primaryCta: { label: "x", href: "/" },
					tone: "neutral",
				},
			],
			baseCtx,
		);
		expect(html).toContain(">BODY!<");
	});

	it("secondaryCta only renders when present", () => {
		const html = renderSectionsDocument(
			[
				{
					id: "c",
					kind: "cta-banner",
					headline: "H",
					primaryCta: { label: "P", href: "/p" },
					secondaryCta: { label: "S", href: "/s" },
					tone: "neutral",
				},
			],
			baseCtx,
		);
		expect(html).toContain("ap-btn--secondary");
		expect(html).toContain(">S<");
	});
});

describe("preview image-text", () => {
	it("imageSide 'end' is reflected in data attr", () => {
		const html = renderSectionsDocument(
			[
				{
					id: "i",
					kind: "image-text",
					heading: "H",
					body: "<p>b</p>",
					mediaId: "",
					imageSide: "end",
				},
			],
			baseCtx,
		);
		expect(html).toContain('data-image-side="end"');
	});

	it("imageSide 'start' default", () => {
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
			baseCtx,
		);
		expect(html).toContain('data-image-side="start"');
	});

	it("renders <img> when mediaUrl resolved", () => {
		const html = renderSectionsDocument(
			[
				{
					id: "i",
					kind: "image-text",
					heading: "H",
					body: "<p>b</p>",
					mediaId: "m",
					imageSide: "start",
				},
			],
			{ ...baseCtx, mediaUrls: { m: "/m.png" } },
		);
		expect(html).toContain("/m.png");
		expect(html).not.toContain("ap-image-text__placeholder");
	});

	it("body emitted as raw HTML (not escaped)", () => {
		const html = renderSectionsDocument(
			[
				{
					id: "i",
					kind: "image-text",
					heading: "H",
					body: "<strong>X</strong>",
					mediaId: "",
					imageSide: "start",
				},
			],
			baseCtx,
		);
		expect(html).toContain("<strong>X</strong>");
	});
});

describe("preview faq", () => {
	it("renders details/summary for each item", () => {
		const html = renderSectionsDocument(
			[
				{
					id: "f",
					kind: "faq",
					items: [
						{ question: "Q1", answer: "A1" },
						{ question: "Q2", answer: "A2" },
					],
				},
			],
			baseCtx,
		);
		expect(html).toContain("<details");
		expect(html).toContain("<summary");
		expect(html).toContain("Q1");
		expect(html).toContain("A1");
		expect(html).toContain("Q2");
	});

	it("heading rendered when present", () => {
		const html = renderSectionsDocument(
			[{ id: "f", kind: "faq", items: [], heading: "Faqq" }],
			baseCtx,
		);
		expect(html).toContain("Faqq");
		expect(html).toContain("ap-faq__heading");
	});

	it("heading block absent when not provided", () => {
		const html = renderSectionsDocument([{ id: "f", kind: "faq", items: [] }], baseCtx);
		expect(html).not.toContain("ap-faq__heading");
	});
});

describe("preview gallery", () => {
	it("empty state when no media resolved", () => {
		const html = renderSectionsDocument(
			[{ id: "g", kind: "gallery", mediaIds: ["x"], columns: 3 }],
			baseCtx,
		);
		expect(html).toContain("No images yet.");
		expect(html).toContain("ap-gallery__empty");
	});

	it("renders <img> tags when media resolved", () => {
		const html = renderSectionsDocument(
			[{ id: "g", kind: "gallery", mediaIds: ["a", "b"], columns: 2 }],
			{ ...baseCtx, mediaUrls: { a: "/a.png", b: "/b.png" } },
		);
		expect(html).toContain("/a.png");
		expect(html).toContain("/b.png");
		expect(html).toContain('data-columns="2"');
		expect(html).not.toContain("No images yet.");
	});

	it("filters out unresolved media ids", () => {
		const html = renderSectionsDocument(
			[{ id: "g", kind: "gallery", mediaIds: ["a", "missing"], columns: 3 }],
			{ ...baseCtx, mediaUrls: { a: "/a.png" } },
		);
		expect(html).toContain("/a.png");
		expect(html).not.toContain("missing");
	});

	it("renders heading when present", () => {
		const html = renderSectionsDocument(
			[{ id: "g", kind: "gallery", mediaIds: [], columns: 3, heading: "GH" }],
			baseCtx,
		);
		expect(html).toContain("GH");
	});
});

describe("preview rich-text", () => {
	it("emits html unsanitized (sanitize at save time)", () => {
		const html = renderSectionsDocument(
			[{ id: "r", kind: "rich-text", html: "<em>raw</em>" }],
			baseCtx,
		);
		expect(html).toContain("<em>raw</em>");
		expect(html).toContain("ap-rich-text");
	});
});

describe("preview escapeHtml/escText behaviour", () => {
	it("replaces & < > correctly in plain text", () => {
		const html = renderSectionsDocument(
			[
				{
					id: "h",
					kind: "hero",
					headline: "Tom & Jerry < > end",
					alignment: "start",
				},
			],
			baseCtx,
		);
		expect(html).toContain("Tom &amp; Jerry &lt; &gt; end");
	});

	it("attribute values get double-quote escaped", () => {
		const html = renderSectionsDocument(
			[
				{
					id: "h",
					kind: "hero",
					headline: "Hi",
					alignment: "start",
					primaryCta: { label: "Go", href: 'a"b' },
				},
			],
			baseCtx,
		);
		expect(html).toContain("a&quot;b");
	});
});
