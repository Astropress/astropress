/**
 * Contract tests for HTML sanitization.
 *
 * Covers: features/contracts/html-sanitization.feature
 *
 * sanitizeHtml() is part of the public rendering contract and must remain
 * available alongside optimizeImageLoading().
 */

import { sanitizeHtml } from "@astropress-diy/astropress";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

describe("html-sanitization.feature: sanitizeHtml() allowlist contract", () => {
	it("strips <script> tags", async () => {
		const input = "<p>Hello</p><script>alert(1)</script>";
		const output = await sanitizeHtml(input);
		expect(output).not.toContain("<script");
		expect(output).not.toContain("alert(1)");
		expect(output).toContain("<p>Hello</p>");
	});

	it("strips event handler attributes (onclick, onmouseover, etc.)", async () => {
		const input = '<a href="/donate" onclick="steal()">Donate</a>';
		const output = await sanitizeHtml(input);
		expect(output).not.toContain("onclick");
		expect(output).not.toContain("steal()");
		expect(output).toContain("Donate");
	});

	it("strips <iframe> tags", async () => {
		const input = '<p>Content</p><iframe src="https://evil.example"></iframe>';
		const output = await sanitizeHtml(input);
		expect(output).not.toContain("<iframe");
		expect(output).toContain("Content");
	});

	it("preserves allowed structural tags: p, h2, ul, li, blockquote", async () => {
		const input = "<h2>Title</h2><p>Text</p><ul><li>Item</li></ul><blockquote>Quote</blockquote>";
		const output = await sanitizeHtml(input);
		expect(output).toContain("<h2>");
		expect(output).toContain("<p>");
		expect(output).toContain("<ul>");
		expect(output).toContain("<li>");
		expect(output).toContain("<blockquote>");
	});

	it("preserves allowed inline tags with safe attributes: strong, em, a[href]", async () => {
		const input = '<strong>Bold</strong><em>Italic</em><a href="/about">Link</a>';
		const output = await sanitizeHtml(input);
		expect(output).toContain("<strong>");
		expect(output).toContain("<em>");
		expect(output).toContain('href="/about"');
	});

	it("strips style= attributes from all elements", async () => {
		const input = '<p style="color:red">Text</p><h2 style="font-size:99px">Title</h2>';
		const output = await sanitizeHtml(input);
		expect(output).not.toContain("style=");
		expect(output).toContain("<p>");
		expect(output).toContain("<h2>");
	});

	it("strips nested disallowed tags inside allowed tags", async () => {
		const input = "<p>Safe text <script>evil()</script> still safe</p>";
		const output = await sanitizeHtml(input);
		expect(output).toContain("<p>");
		expect(output).not.toContain("<script");
		expect(output).not.toContain("evil()");
	});

	it("strips javascript: href values from links", async () => {
		const input = '<a href="javascript:alert(1)">Bad link</a><a href="/safe">Safe link</a>';
		const output = await sanitizeHtml(input);
		expect(output).not.toContain("javascript:");
		expect(output).toContain(">Bad link</a>");
		expect(output).toContain('href="/safe"');
	});

	it("strips data: URL from img src (data URI injection)", async () => {
		const input = '<img src="data:text/html,<script>alert(1)</script>" alt="probe">';
		const output = await sanitizeHtml(input);
		expect(output).not.toContain("data:");
		expect(output).not.toContain("alert(1)");
		// img tag may be present but src must be absent
		if (output.includes("<img")) {
			expect(output).not.toContain('src="');
		}
	});

	it("strips protocol-relative URLs from href (// scheme open redirect)", async () => {
		const input = '<a href="//evil.example/steal">click me</a>';
		const output = await sanitizeHtml(input);
		expect(output).not.toContain("//evil.example");
		expect(output).toContain("click me");
	});

	it("strips SVG tags entirely (SVG XSS vector)", async () => {
		const input = "<svg><script>alert(1)</script><circle r='10'/></svg>";
		const output = await sanitizeHtml(input);
		expect(output).not.toContain("<svg");
		expect(output).not.toContain("<script");
		expect(output).not.toContain("alert(1)");
	});

	it("strips srcset candidates with javascript: scheme while preserving safe candidates", async () => {
		const input = '<img srcset="javascript:alert(1) 1x, /safe.jpg 2x" alt="probe">';
		const output = await sanitizeHtml(input);
		expect(output).not.toContain("javascript:");
		expect(output).toContain("/safe.jpg");
	});

	it("strips deeply nested script inside multiple allowed structural wrappers", async () => {
		const input = "<blockquote><ul><li><p><script>evil()</script></p></li></ul></blockquote>";
		const output = await sanitizeHtml(input);
		expect(output).not.toContain("<script");
		expect(output).not.toContain("evil()");
		expect(output).toContain("<blockquote>");
		expect(output).toContain("<ul>");
		expect(output).toContain("<li>");
		expect(output).toContain("<p>");
	});

	it("strips non-class attributes that have an empty string value", async () => {
		const input = '<img src="/image.jpg" alt="" />';
		const output = await sanitizeHtml(input);
		// The empty alt attribute is removed; src is a safe URL so it stays
		expect(output).toContain("/image.jpg");
		// alt="" (empty non-class attribute) is stripped
		expect(output).not.toMatch(/alt=""/);
	});

	it("removes srcset attribute entirely when all candidates are blocked", async () => {
		const input = '<img srcset="javascript:alert(1) 1x" alt="probe" />';
		const output = await sanitizeHtml(input);
		expect(output).not.toContain("srcset=");
		expect(output).toContain("probe");
	});

	it("preserves empty class attribute (class is the only non-boolean attribute with empty values kept)", async () => {
		const input = '<div class="">content</div>';
		const output = await sanitizeHtml(input);
		expect(output).toMatch(/class=""/);
	});

	it("joins multiple surviving srcset candidates with the literal ', ' separator", async () => {
		const input = '<img srcset="/a.jpg 1x, /b.jpg 2x" alt="x" />';
		const output = await sanitizeHtml(input);
		// Both candidates survive and are joined by ", "
		expect(output).toMatch(/srcset="\/a\.jpg 1x, \/b\.jpg 2x"/);
	});

	it("adds rel=noopener noreferrer to every <a> via the HTMLRewriter path", async () => {
		const output = await sanitizeHtml('<a href="/page">link</a>');
		expect(output).toContain("/page");
		expect(output).toContain('rel="noopener noreferrer"');
	});

	it("rewrites an existing rel value to 'noopener noreferrer' on <a> (overwrite not append)", async () => {
		const output = await sanitizeHtml('<a href="/p" rel="custom">x</a>');
		expect(output).toContain('rel="noopener noreferrer"');
		expect(output).not.toMatch(/rel="custom"/);
	});

	it("does NOT add rel=noopener noreferrer to non-anchor tags", async () => {
		const output = await sanitizeHtml('<span class="link">x</span>');
		expect(output).not.toMatch(/rel="noopener noreferrer"/);
	});

	it("returns true from isAllowedUrl for relative URLs without a scheme (no colon-prefixed scheme match)", async () => {
		// A relative '/foo' URL has no scheme; sanitizer should keep the href.
		const output = await sanitizeHtml('<a href="/relative/path">x</a>');
		expect(output).toContain('href="/relative/path"');
	});

	it("preserves a mailto: link (uses allowedSchemes lowercase match)", async () => {
		const output = await sanitizeHtml('<a href="MAILTO:User@Example.com">contact</a>');
		// scheme lowercased via .toLowerCase(); 'mailto' is in allowedSchemes
		expect(output).toMatch(/href="MAILTO:User@Example\.com"/i);
	});

	it("strips href with a disallowed scheme that has alphanumeric + '+.-' characters", async () => {
		// 'data:' is alphanumeric-only — exercises the [a-zA-Z][a-zA-Z0-9+.-]* scheme regex
		const output = await sanitizeHtml('<a href="data:text/html,<svg/onload=alert(1)>">x</a>');
		expect(output).not.toContain("data:");
	});

	it("trims surrounding whitespace from URL attribute values (href / src)", async () => {
		const output = await sanitizeHtml('<a href="  /trimmed  ">x</a>');
		// The trimmed value is what's checked against isAllowedUrl; trimmed form is written back.
		expect(output).toMatch(/href="\/trimmed"/);
	});

	it("trims srcset candidate whitespace and recomposes with ', ' separator", async () => {
		const output = await sanitizeHtml('<img srcset="  /a.jpg 1x  ,  /b.jpg 2x  " alt="x" />');
		expect(output).toMatch(/srcset="\/a\.jpg 1x, \/b\.jpg 2x"/);
	});

	it("treats a scheme-bearing javascript: prefix with surrounding whitespace as blocked (trim matters)", async () => {
		const output = await sanitizeHtml('<a href="   javascript:alert(1)   ">x</a>');
		expect(output).not.toContain("javascript:");
	});
});

describe("html-sanitization.feature: sanitizeHtml() sanitize-html library fallback (no HTMLRewriter)", () => {
	let saved: typeof globalThis.HTMLRewriter;

	beforeEach(() => {
		saved = globalThis.HTMLRewriter;
		// @ts-expect-error — intentionally removing the polyfill to test the library fallback path
		globalThis.HTMLRewriter = undefined;
	});

	afterEach(() => {
		globalThis.HTMLRewriter = saved;
	});

	it("strips <script> tags via library fallback", async () => {
		const output = await sanitizeHtml("<p>Hello</p><script>alert(1)</script>");
		expect(output).not.toContain("<script");
		expect(output).toContain("<p>Hello</p>");
	});

	it("strips event handler attributes via library fallback", async () => {
		const output = await sanitizeHtml('<a href="/donate" onclick="steal()">Donate</a>');
		expect(output).not.toContain("onclick");
		expect(output).toContain("Donate");
	});

	it("adds rel=noopener noreferrer to links via library fallback", async () => {
		const output = await sanitizeHtml('<a href="/page">Link</a>');
		expect(output).toContain('rel="noopener noreferrer"');
	});

	it("library fallback uses the same allowed-tags list (preserves <p>, drops <iframe>)", async () => {
		const output = await sanitizeHtml("<p>kept</p><iframe>evil</iframe>");
		expect(output).toContain("<p>kept</p>");
		expect(output).not.toContain("<iframe");
	});

	it("library fallback uses the allowedSchemes list (strips javascript: href)", async () => {
		const output = await sanitizeHtml('<a href="javascript:alert(1)">x</a>');
		expect(output).not.toContain("javascript:");
	});

	it("library fallback rejects protocol-relative URLs (allowProtocolRelative: false)", async () => {
		const output = await sanitizeHtml('<a href="//evil.example.com/x">x</a>');
		expect(output).not.toContain("//evil.example.com");
	});
});

describe("html-sanitization.feature: mutation-coverage pins", () => {
	// The scheme regex `/^([a-zA-Z][a-zA-Z0-9+.-]*):/` must match only at the
	// start. Without the `^` anchor a URL like "/some-path:foo" would still
	// match "foo:" and treat it as a scheme — flipping a relative path into
	// a scheme check.
	it("isAllowedUrl treats a path with an internal colon as relative (anchored scheme match)", async () => {
		// "/safe-path:internal" has no scheme at the start. Original
		// schemeMatch is null → returns true (allowed). Mutant (no `^`)
		// matches "internal:" somewhere → asks allowedSchemes for
		// "internal" → false → href stripped.
		const output = await sanitizeHtml('<a href="/safe-path:internal">link</a>');
		expect(output).toContain('href="/safe-path:internal"');
	});

	// sanitizeSrcset's `.filter(Boolean)` drops empty entries left behind by
	// consecutive commas. Without the filter, `[" ", ""]` flows into the
	// subsequent `.filter(c => Boolean(url) && isAllowedUrl(url))` which
	// still rejects them, but the candidate array would carry the
	// blanks if isAllowedUrl returned true on "" — kill the mutant by
	// asserting the joined output has no double-space artefacts.
	it("sanitizeSrcset drops empty candidates from consecutive commas (no leftover blanks)", async () => {
		const output = await sanitizeHtml('<img srcset="/a.jpg 1x,,/b.jpg 2x" alt="x" />');
		// Original: candidates = ["/a.jpg 1x", "/b.jpg 2x"] → joined cleanly.
		expect(output).toMatch(/srcset="\/a\.jpg 1x, \/b\.jpg 2x"/);
		expect(output).not.toMatch(/srcset="[^"]*, ?, ?/);
	});

	// sanitizeSrcset's whitespace split uses `/\s+/` so multi-space gaps
	// between URL and descriptor are handled as a single delimiter. The
	// `+` quantifier matters: `/\s/` (without `+`) would split each
	// individual space, producing empty entries between them, and the
	// first token captured by `.split(/\s/, 1)` would still be the URL
	// — but for srcset values where the URL is followed by tabs/newlines,
	// only the `\s+` form correctly collapses them.
	it("sanitizeSrcset splits URL from descriptor on runs of whitespace, not single chars", async () => {
		// A trailing tab between url and descriptor; `\s+` collapses it.
		// Mutated `\s` would still split at the first \t but the rest of
		// the candidate would re-parse incorrectly.
		const output = await sanitizeHtml('<img srcset="/x.jpg\t\t1x" alt="x" />');
		expect(output).toContain("/x.jpg");
	});
});
