import { optimizeImageLoading } from "@astropress-diy/astropress";
import { describe, expect, it } from "vitest";

describe("optimizeImageLoading()", () => {
	it("adds loading='lazy' to images without a loading attribute", () => {
		const result = optimizeImageLoading(
			'<img src="/first.jpg" alt="First"><img src="/second.jpg" alt="Second">',
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
		const html =
			'<img src="/hero.jpg" alt="Hero" fetchpriority="high"><img src="/next.jpg" alt="Next">';
		const result = optimizeImageLoading(html);
		expect(result).not.toMatch(/<img[^>]*fetchpriority="high"[^>]*loading="lazy"[^>]*>/);
	});

	it("returns HTML unchanged if there are no img tags", () => {
		const html = "<p>No images here.</p>";
		expect(optimizeImageLoading(html)).toBe(html);
	});

	it("never appends a second loading attr to an image that already has one (non-first position)", () => {
		// First img is the LCP candidate; second already has loading=eager.
		// The loading-check branch must short-circuit so the explicit
		// loading=eager image never gets a duplicate loading="lazy" appended.
		const html = '<img src="/hero.jpg"><img src="/explicit.jpg" loading="eager">';
		const result = optimizeImageLoading(html);
		// Exactly one `loading=` attribute on the second img, and it's "eager".
		const matches = result.match(/loading="[^"]*"/g) ?? [];
		expect(matches).toEqual(['loading="eager"']);
	});

	it("a leading explicit-loading image still consumes the firstImage slot (kills BooleanLiteral mutant in the loading branch)", () => {
		// If the loading branch did NOT set firstImage=false, the second img
		// would be treated as the LCP and skip lazy.
		const html = '<img src="/hero.jpg" loading="eager"><img src="/next.jpg">';
		const result = optimizeImageLoading(html);
		expect(result).toContain('<img src="/next.jpg" loading="lazy">');
	});

	it("never appends loading='lazy' to a non-first image that has fetchpriority", () => {
		// fetchpriority=high signals a non-LCP image we explicitly want to
		// keep eager (e.g. above-the-fold non-hero). Must short-circuit even
		// when not in the firstImage slot.
		const html = '<img src="/hero.jpg"><img src="/banner.jpg" fetchpriority="high">';
		const result = optimizeImageLoading(html);
		// The fetchpriority image must NOT have loading attribute appended.
		expect(result).not.toMatch(/fetchpriority="high"\s+loading=/);
	});

	it("a leading fetchpriority image still consumes the firstImage slot (kills BooleanLiteral mutant in the fetchpriority branch)", () => {
		// If the fetchpriority branch did NOT set firstImage=false, the
		// second img would be treated as the LCP and skip lazy.
		const html = '<img src="/banner.jpg" fetchpriority="high"><img src="/next.jpg">';
		const result = optimizeImageLoading(html);
		expect(result).toContain('<img src="/next.jpg" loading="lazy">');
	});
});
