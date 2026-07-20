import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it, vi } from "vitest";
import { renderSectionsBody } from "../../src/sections/preview-renderer";
import {
	buildMediaUrlMap,
	buildSectionRenderContext,
	collectMediaIds,
	selectTestimonialsForSection,
	type TestimonialSubmissionLike,
	toPublicTestimonial,
} from "../../src/sections/render-prep";
import type { Section, TestimonialsSection } from "../../src/sections/schema";

describe("collectMediaIds", () => {
	it("returns ids from hero, image-text, gallery", () => {
		const sections: Section[] = [
			{
				id: "1",
				kind: "hero",
				headline: "h",
				alignment: "start",
				mediaId: "a",
			},
			{
				id: "2",
				kind: "image-text",
				heading: "x",
				body: "<p>x</p>",
				mediaId: "b",
				imageSide: "start",
			},
			{ id: "3", kind: "gallery", mediaIds: ["c", "d"], columns: 3 },
		];
		expect(collectMediaIds(sections).sort()).toEqual(["a", "b", "c", "d"]);
	});

	it("deduplicates repeated ids", () => {
		const sections: Section[] = [
			{
				id: "1",
				kind: "hero",
				headline: "h",
				alignment: "start",
				mediaId: "a",
			},
			{ id: "2", kind: "gallery", mediaIds: ["a", "a"], columns: 2 },
		];
		expect(collectMediaIds(sections)).toEqual(["a"]);
	});

	it("ignores empty / falsy ids", () => {
		const sections: Section[] = [
			{ id: "1", kind: "hero", headline: "h", alignment: "start" },
			{ id: "2", kind: "gallery", mediaIds: [""], columns: 2 },
		];
		expect(collectMediaIds(sections)).toEqual([]);
	});
});

describe("selectTestimonialsForSection", () => {
	const all = [
		{ id: "a", name: "A", quote: "q", featured: true, status: "approved" },
		{ id: "b", name: "B", quote: "q", featured: false, status: "approved" },
		{ id: "c", name: "C", quote: "q", featured: true, status: "pending" },
	];

	it("source=featured selects featured AND approved", () => {
		const sec: TestimonialsSection = {
			id: "t",
			kind: "testimonials",
			source: "featured",
			layout: "grid",
		};
		const picked = selectTestimonialsForSection(sec, all);
		expect(picked.map((p) => p.id)).toEqual(["a"]);
	});

	it("source=approved selects all approved", () => {
		const sec: TestimonialsSection = {
			id: "t",
			kind: "testimonials",
			source: "approved",
			layout: "grid",
		};
		const picked = selectTestimonialsForSection(sec, all);
		expect(picked.map((p) => p.id).sort()).toEqual(["a", "b"]);
	});

	it("source=ids selects exactly the requested ids", () => {
		const sec: TestimonialsSection = {
			id: "t",
			kind: "testimonials",
			source: "ids",
			layout: "grid",
			ids: ["b", "c"],
		};
		const picked = selectTestimonialsForSection(sec, all);
		expect(picked.map((p) => p.id).sort()).toEqual(["b", "c"]);
	});
});

describe("toPublicTestimonial", () => {
	const base: TestimonialSubmissionLike = {
		id: "t1",
		name: "Ada",
		role: "Founder",
		company: "Acme",
		specificResult: "Doubled signups in a month",
		transformation: "Went from zero web presence to a full site",
		consentToPublish: true,
		status: "approved",
	};

	it("maps a consented approved submission, preferring specificResult as the quote", () => {
		expect(toPublicTestimonial(base)).toEqual({
			id: "t1",
			name: "Ada",
			role: "Founder",
			company: "Acme",
			quote: "Doubled signups in a month",
			featured: false,
			status: "approved",
		});
	});

	it("falls back to transformation when specificResult is absent", () => {
		const t = toPublicTestimonial({ ...base, specificResult: undefined });
		expect(t?.quote).toBe("Went from zero web presence to a full site");
	});

	it("returns null without consent, regardless of status", () => {
		expect(toPublicTestimonial({ ...base, consentToPublish: false })).toBeNull();
	});

	it("returns null when there is no quotable text", () => {
		expect(
			toPublicTestimonial({ ...base, specificResult: undefined, transformation: undefined }),
		).toBeNull();
	});

	it("maps featured status to the featured flag and normalizes status to approved", () => {
		const t = toPublicTestimonial({ ...base, status: "featured" });
		expect(t?.featured).toBe(true);
		expect(t?.status).toBe("approved");
	});

	it("preserves a non-featured status verbatim (not coerced to approved)", () => {
		// Kills `s.status && "approved"`: a truthy, non-"featured" status must pass
		// through unchanged, not be rewritten to "approved".
		const t = toPublicTestimonial({ ...base, status: "pending" });
		expect(t?.featured).toBe(false);
		expect(t?.status).toBe("pending");
	});

	it("defaults a missing status to approved", () => {
		// Kills `s.status ?? ""`: a nullish status must fall back to "approved".
		const t = toPublicTestimonial({ ...base, status: undefined });
		expect(t?.status).toBe("approved");
	});
});

describe("buildMediaUrlMap", () => {
	it("omits records that resolve to an empty URL", () => {
		// Kills `if (url)` → `if (true)`: a record whose localPath is "" resolves to
		// a falsy URL and must not be added to the map.
		const out = buildMediaUrlMap([
			{ id: "m1", sourceUrl: null, localPath: "/media/a.webp", r2Key: null },
			{ id: "empty", sourceUrl: null, localPath: "", r2Key: null },
		]);
		expect(out).toEqual({ m1: "/media/a.webp" });
	});
});

describe("buildSectionRenderContext", () => {
	const hero: Section = {
		id: "1",
		kind: "hero",
		headline: "Welcome",
		alignment: "start",
		mediaId: "m1",
	};
	const testimonialsSection: Section = {
		id: "2",
		kind: "testimonials",
		source: "approved",
		layout: "grid",
	};
	const mediaRecords = [
		{ id: "m1", sourceUrl: null, localPath: "/media/hero.webp", r2Key: null },
		{ id: "m2", sourceUrl: null, localPath: "/media/other.webp", r2Key: null },
	];
	const submissions: TestimonialSubmissionLike[] = [
		{
			id: "t1",
			name: "Ada",
			specificResult: "Doubled signups",
			consentToPublish: true,
			status: "approved",
		},
		{
			id: "t2",
			name: "Grace",
			specificResult: "Private remark",
			consentToPublish: false,
			status: "approved",
		},
	];

	it("resolves only the media the sections reference", async () => {
		const ctx = await buildSectionRenderContext([hero], {
			listMediaAssets: async () => mediaRecords,
			listPublicTestimonials: async () => submissions,
		});
		expect(ctx.mediaUrls).toEqual({ m1: "/media/hero.webp" });
	});

	it("skips store reads entirely for sections that need neither media nor testimonials", async () => {
		const listMediaAssets = vi.fn(async () => mediaRecords);
		const listPublicTestimonials = vi.fn(async () => submissions);
		const plain: Section = { id: "3", kind: "rich-text", html: "<p>hi</p>" };
		const ctx = await buildSectionRenderContext([plain], {
			listMediaAssets,
			listPublicTestimonials,
		});
		expect(ctx).toEqual({ mediaUrls: {}, testimonials: [] });
		expect(listMediaAssets).not.toHaveBeenCalled();
		expect(listPublicTestimonials).not.toHaveBeenCalled();
	});

	it("passes only consented testimonials through", async () => {
		const ctx = await buildSectionRenderContext([testimonialsSection], {
			listMediaAssets: async () => [],
			listPublicTestimonials: async () => submissions,
		});
		expect(ctx.testimonials.map((t) => t.id)).toEqual(["t1"]);
	});

	// Regression for #200 at the page level: the public renderer's frontmatter
	// can't be executed under vitest, so guard its wiring at the source level
	// (same idiom as admin-safety.test.ts) — it must build a real context and
	// must never regress to the hard-coded empty one.
	it("astropress-public-page.astro builds its render context from the runtime", () => {
		const source = readFileSync(
			path.resolve(import.meta.dirname, "../../pages/astropress-public-page.astro"),
			"utf8",
		);
		expect(source).toContain("buildSectionRenderContext(");
		expect(source).toContain("getRuntimeMediaAssets");
		expect(source).toContain("getRuntimeTestimonials");
		expect(source).not.toMatch(/mediaUrls:\s*\{\}/);
		expect(source).not.toMatch(/testimonials:\s*\[\]/);
	});

	// Regression for #200: the public renderer used to pass an empty context,
	// so a published hero silently lost its image and testimonials rendered
	// empty. Assert the built context actually lands in the rendered HTML.
	it("renders the hero image and testimonial quote through renderSectionsBody", async () => {
		const ctx = await buildSectionRenderContext([hero, testimonialsSection], {
			listMediaAssets: async () => mediaRecords,
			listPublicTestimonials: async () => submissions,
		});
		const html = renderSectionsBody([hero, testimonialsSection], { ...ctx, dir: "ltr" });
		expect(html).toContain('src="/media/hero.webp"');
		expect(html).toContain("Doubled signups");
		expect(html).not.toContain("Private remark");
	});
});
