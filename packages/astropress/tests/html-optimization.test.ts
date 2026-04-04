import { describe, expect, it } from "vitest";
import { optimizeImageLoading } from "astropress";

describe("optimizeImageLoading()", () => {
  it("adds loading='lazy' to images without a loading attribute", () => {
    const result = optimizeImageLoading(
      '<img src="/first.jpg" alt="First"><img src="/second.jpg" alt="Second">'
    );
    expect(result).toContain('loading="lazy"');
  });

  it("does not modify images that already have a loading attribute", () => {
    const html = '<img src="/photo.jpg" alt="Photo" loading="eager">';
    const result = optimizeImageLoading(html);
    expect(result).not.toContain('loading="lazy"');
    expect(result).toContain('loading="eager"');
  });

  it("skips the first image (likely hero/LCP) to avoid performance regression", () => {
    const html = '<img src="/hero.jpg" alt="Hero">';
    const result = optimizeImageLoading(html);
    expect(result).not.toContain('loading="lazy"');
  });

  it("adds loading='lazy' to second and subsequent images", () => {
    const html = [
      '<img src="/hero.jpg" alt="Hero">',
      '<img src="/second.jpg" alt="Second">',
      '<img src="/third.jpg" alt="Third">',
    ].join("");
    const result = optimizeImageLoading(html);
    const lazyCount = (result.match(/loading="lazy"/g) ?? []).length;
    expect(lazyCount).toBe(2);
  });

  it("skips first image if it has fetchpriority attribute", () => {
    const html = '<img src="/hero.jpg" alt="Hero" fetchpriority="high"><img src="/next.jpg" alt="Next">';
    const result = optimizeImageLoading(html);
    expect(result).not.toMatch(/<img[^>]*fetchpriority="high"[^>]*loading="lazy"[^>]*>/);
  });

  it("returns HTML unchanged if there are no img tags", () => {
    const html = "<p>No images here.</p>";
    expect(optimizeImageLoading(html)).toBe(html);
  });
});
