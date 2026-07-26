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

	it("strips every ignorable control-char class before reading the scheme", () => {
		// Each of these code points is one a browser drops when parsing a scheme,
		// so each must be removed before the allowlist check — pinning the exact
		// boundaries of the cleaning loop (C0, space, DEL, and the C1 range).
		for (const ctrl of ["\x01", "\x1f", "\x7f", "\x80", "\x85", "\x9f"]) {
			expect(safeHref(`java${ctrl}script:alert(1)`), `code point ${ctrl.codePointAt(0)}`).toBe("#");
		}
	});

	it("keeps code points just outside the ignorable range (U+00A0) intact", () => {
		// U+00A0 is above the C1 range, so it is NOT stripped: the value keeps its
		// literal non-breaking space and never reads as a `javascript:` scheme.
		expect(safeHref("java\u00a0script:alert(1)")).toBe("java\u00a0script:alert(1)");
	});

	it("only treats a scheme at the very start of the value as a scheme", () => {
		// The scheme regex is anchored, so a colon inside a relative path is not a
		// scheme and the value passes through unchanged.
		expect(safeHref("/foo:bar")).toBe("/foo:bar");
		expect(safeHref("path/to:file")).toBe("path/to:file");
	});

	it("trims surrounding whitespace from the returned value", () => {
		expect(safeHref("  https://example.com/x  ")).toBe("https://example.com/x");
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

describe("render branch guards", () => {
	it("renders an empty primary-cta slot when only a secondary CTA is set", () => {
		const sections: Section[] = [
			{
				id: "h",
				kind: "hero",
				headline: "Hi",
				alignment: "start",
				secondaryCta: { label: "More", href: "/more" },
			},
		];
		const html = renderSectionsDocument(sections, ctx);
		// The primary-cta ternary's empty branch must render nothing between the
		// cta wrapper and the secondary link (kills the `: ""` StringLiteral).
		expect(html).toMatch(/<div class="ap-hero__cta">\s*<a class="ap-btn ap-btn--secondary"/);
	});

	it("uses the featured branch when a non-ids testimonials section carries an ids array", () => {
		const testimonials = [
			{ id: "feat", name: "F", quote: "FEATURED-QUOTE", featured: true, status: "approved" },
			{ id: "plain", name: "P", quote: "PLAIN-QUOTE", featured: false, status: "approved" },
		];
		const sections: Section[] = [
			{
				id: "t",
				kind: "testimonials",
				source: "featured",
				layout: "grid",
				ids: ["plain"],
			} as Section,
		];
		const html = renderSectionsDocument(sections, { ...ctx, testimonials });
		// source=featured must select the featured testimonial, not the ids-listed
		// one (kills `s.source === "ids"` → `true`).
		expect(html).toContain("FEATURED-QUOTE");
		expect(html).not.toContain("PLAIN-QUOTE");
	});
});
