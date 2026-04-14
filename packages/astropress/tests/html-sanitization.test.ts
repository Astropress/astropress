/**
 * Contract tests for HTML sanitization.
 *
 * Covers: features/contracts/html-sanitization.feature
 *
 * sanitizeHtml() is part of the public rendering contract and must remain
 * available alongside optimizeImageLoading().
 */
import { describe, expect, it } from "vitest";

import { sanitizeHtml } from "@astropress-diy/astropress";

describe("html-sanitization.feature: sanitizeHtml() allowlist contract", () => {
  it("strips <script> tags", async () => {
    const input = '<p>Hello</p><script>alert(1)</script>';
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
    const input = '<p>Safe text <script>evil()</script> still safe</p>';
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
});
