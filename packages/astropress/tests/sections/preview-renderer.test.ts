import { describe, expect, it } from "vitest";
import { renderSectionsDocument, safeHref } from "../../src/sections/preview-renderer";
import type { Section } from "../../src/sections/schema";

const ctx = { mediaUrls: {}, testimonials: [] };

describe("renderSectionsDocument", () => {
	it("renders an empty document for no sections", () => {
		const html = renderSectionsDocument([], ctx);
		expect(html).toContain("<!doctype html>");
		expect(html).toContain('class="ap-sections"');
	});

	it("includes the stylesheet link when stylesheetUrl is given", () => {
		const html = renderSectionsDocument([], ctx, {
			stylesheetUrl: "/sections.css",
		});
		expect(html).toContain('rel="stylesheet"');
		expect(html).toContain("/sections.css");
	});

	it("renders dir=rtl when context dir is rtl", () => {
		const html = renderSectionsDocument([], { ...ctx, dir: "rtl" });
		expect(html).toContain('dir="rtl"');
	});

	it("escapes HTML in plain-text fields", () => {
		const sections: Section[] = [
			{
				id: "h",
				kind: "hero",
				headline: '<img src=x onerror="alert(1)">',
				alignment: "start",
			},
		];
		const html = renderSectionsDocument(sections, ctx);
		expect(html).not.toMatch(/<img\s+src=x\s+onerror/);
		expect(html).toContain("&lt;img");
	});

	it("renders hero with primary CTA href escaped", () => {
		const sections: Section[] = [
			{
				id: "h",
				kind: "hero",
				headline: "Hi",
				alignment: "center",
				primaryCta: { label: "Go", href: 'javascript"' },
			},
		];
		const html = renderSectionsDocument(sections, ctx);
		expect(html).toContain("&quot;");
	});

	it("neutralizes a javascript: CTA href to '#' in rendered output", () => {
		const sections: Section[] = [
			{
				id: "h",
				kind: "hero",
				headline: "Hi",
				alignment: "center",
				primaryCta: { label: "Go", href: "javascript:alert(1)" },
			},
		];
		const html = renderSectionsDocument(sections, ctx);
		expect(html).not.toContain("javascript:alert");
		expect(html).toContain(`href="#"`);
	});

	it("renders rich-text html as-is (sanitization runs at save time)", () => {
		const sections: Section[] = [{ id: "r", kind: "rich-text", html: "<p>preserved</p>" }];
		const html = renderSectionsDocument(sections, ctx);
		expect(html).toContain("<p>preserved</p>");
	});
});

describe("safeHref", () => {
	it("passes through safe schemes and relative URLs unchanged", () => {
		for (const href of [
			"/about",
			"#section",
			"?q=1",
			"https://example.com",
			"http://example.com",
			"mailto:a@b.com",
			"tel:+15551234",
			"contact",
		]) {
			expect(safeHref(href)).toBe(href);
		}
	});

	it("collapses script-executing and opaque schemes to '#'", () => {
		expect(safeHref("javascript:alert(1)")).toBe("#");
		expect(safeHref("JavaScript:alert(1)")).toBe("#");
		expect(safeHref("data:text/html,<script>x</script>")).toBe("#");
		expect(safeHref("vbscript:msgbox(1)")).toBe("#");
	});

	it("defeats control-character scheme obfuscation", () => {
		expect(safeHref("java\tscript:alert(1)")).toBe("#");
		expect(safeHref("java\nscript:alert(1)")).toBe("#");
		expect(safeHref(" javascript:alert(1)")).toBe("#");
	});

	it("renders gallery with valid media urls", () => {
		const sections: Section[] = [
			{
				id: "g",
				kind: "gallery",
				mediaIds: ["a", "b"],
				columns: 3,
			},
		];
		const html = renderSectionsDocument(sections, {
			...ctx,
			mediaUrls: { a: "/a.png", b: "/b.png" },
		});
		expect(html).toContain("/a.png");
		expect(html).toContain("/b.png");
	});

	it("falls back to placeholder when image-text mediaId is missing", () => {
		const sections: Section[] = [
			{
				id: "it",
				kind: "image-text",
				heading: "X",
				body: "<p>y</p>",
				mediaId: "missing",
				imageSide: "end",
			},
		];
		const html = renderSectionsDocument(sections, ctx);
		expect(html).toContain("ap-image-text__placeholder");
	});

	it("renders all eight section kinds without throwing", () => {
		const all: Section[] = [
			{ id: "1", kind: "hero", headline: "H", alignment: "start" },
			{
				id: "2",
				kind: "feature-grid",
				heading: "F",
				columns: 3,
				items: [{ title: "t", body: "b" }],
			},
			{ id: "3", kind: "testimonials", source: "approved", layout: "grid" },
			{
				id: "4",
				kind: "cta-banner",
				headline: "Now",
				primaryCta: { label: "X", href: "/" },
				tone: "neutral",
			},
			{
				id: "5",
				kind: "image-text",
				heading: "I",
				body: "<p>b</p>",
				mediaId: "",
				imageSide: "start",
			},
			{ id: "6", kind: "faq", items: [{ question: "q?", answer: "a" }] },
			{ id: "7", kind: "gallery", mediaIds: [], columns: 2 },
			{ id: "8", kind: "rich-text", html: "<p>x</p>" },
		];
		const html = renderSectionsDocument(all, ctx);
		expect(html).toContain("ap-hero");
		expect(html).toContain("ap-feature-grid");
		expect(html).toContain("ap-testimonials");
		expect(html).toContain("ap-cta");
		expect(html).toContain("ap-image-text");
		expect(html).toContain("ap-faq");
		expect(html).toContain("ap-gallery");
		expect(html).toContain("ap-rich-text");
	});
});
