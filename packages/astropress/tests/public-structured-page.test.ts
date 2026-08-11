import { readFileSync } from "node:fs";
import path from "node:path";
import { beforeEach, describe, expect, it, vi } from "vitest";

// Mock only the runtime store/registry seams; the real ./sections pipeline runs
// so the tests prove the body is genuinely rendered (not an empty stub — #200)
// and the on-demand dev entrypoint resolves pages exactly like production (#198).
const mocks = vi.hoisted(() => ({
	getRuntimeStructuredPageRoute: vi.fn(),
	listRuntimeStructuredPageRoutes: vi.fn(),
	getRuntimeMediaAssets: vi.fn(),
	getRuntimeTestimonials: vi.fn(),
}));

vi.mock("../src/runtime-route-registry", () => ({
	getRuntimeStructuredPageRoute: mocks.getRuntimeStructuredPageRoute,
	listRuntimeStructuredPageRoutes: mocks.listRuntimeStructuredPageRoutes,
}));
vi.mock("../src/runtime-page-store", () => ({
	getRuntimeMediaAssets: mocks.getRuntimeMediaAssets,
	getRuntimeTestimonials: mocks.getRuntimeTestimonials,
}));

import {
	buildPublicStructuredPageModel,
	listPublishedStructuredPagePaths,
} from "../src/public-structured-page";

const locals = {} as App.Locals;

const publishedRecord = {
	path: "/about",
	status: "published",
	title: "About Us",
	seoTitle: "About Us — SEO",
	summary: "A short summary.",
	metaDescription: "Meta description.",
	canonicalUrlOverride: "https://example.com/about",
	robotsDirective: "index,follow",
	ogImage: "https://example.com/og.png",
	sections: [
		{ id: "h1", kind: "hero", headline: "Welcome", mediaId: "m1" },
		{ id: "r1", kind: "rich-text", html: "<p>RICHTEXT_MARKER</p>" },
	],
};

describe("buildPublicStructuredPageModel", () => {
	beforeEach(() => {
		vi.clearAllMocks();
		mocks.getRuntimeMediaAssets.mockResolvedValue([
			{ id: "m1", sourceUrl: null, localPath: "/media/hero.webp", r2Key: null },
		]);
		mocks.getRuntimeTestimonials.mockResolvedValue([]);
	});

	it("returns null for a page that is not published", async () => {
		mocks.getRuntimeStructuredPageRoute.mockResolvedValue({ ...publishedRecord, status: "draft" });
		expect(await buildPublicStructuredPageModel("/about", locals)).toBeNull();
	});

	it("returns null when no route record exists", async () => {
		mocks.getRuntimeStructuredPageRoute.mockResolvedValue(null);
		expect(await buildPublicStructuredPageModel("/missing", locals)).toBeNull();
	});

	it("resolves a published page into a render-ready model, querying by path", async () => {
		mocks.getRuntimeStructuredPageRoute.mockResolvedValue(publishedRecord);
		const model = await buildPublicStructuredPageModel("/about", locals);

		expect(mocks.getRuntimeStructuredPageRoute).toHaveBeenCalledWith("/about", locals);
		expect(model).not.toBeNull();
		expect(model?.title).toBe("About Us — SEO");
		expect(model?.description).toBe("Meta description.");
		expect(model?.canonical).toBe("https://example.com/about");
		expect(model?.robots).toBe("index,follow");
		expect(model?.ogImage).toBe("https://example.com/og.png");
	});

	it("actually renders the sections into the body, resolving referenced media (#200)", async () => {
		mocks.getRuntimeStructuredPageRoute.mockResolvedValue(publishedRecord);
		const model = await buildPublicStructuredPageModel("/about", locals);
		// Body is genuinely rendered from the sections, not an empty stub…
		expect(model?.body).toContain("RICHTEXT_MARKER");
		// …and a referenced media asset lands in the HTML rather than being dropped.
		expect(model?.body).toContain('src="/media/hero.webp"');
	});

	it("falls back seoTitle → title → slug for the page title", async () => {
		mocks.getRuntimeStructuredPageRoute.mockResolvedValue({ ...publishedRecord, seoTitle: "" });
		expect((await buildPublicStructuredPageModel("/about", locals))?.title).toBe("About Us");

		mocks.getRuntimeStructuredPageRoute.mockResolvedValue({
			...publishedRecord,
			seoTitle: "",
			title: "",
		});
		// Slug is derived from the requested path, sans leading slash.
		expect((await buildPublicStructuredPageModel("/about", locals))?.title).toBe("about");
	});

	it("falls back metaDescription → summary → empty string", async () => {
		mocks.getRuntimeStructuredPageRoute.mockResolvedValue({
			...publishedRecord,
			metaDescription: undefined,
		});
		expect((await buildPublicStructuredPageModel("/about", locals))?.description).toBe(
			"A short summary.",
		);

		mocks.getRuntimeStructuredPageRoute.mockResolvedValue({
			...publishedRecord,
			metaDescription: undefined,
			summary: undefined,
		});
		expect((await buildPublicStructuredPageModel("/about", locals))?.description).toBe("");
	});

	it("defaults canonical/robots/ogImage to empty strings when the record omits them", async () => {
		mocks.getRuntimeStructuredPageRoute.mockResolvedValue({
			...publishedRecord,
			canonicalUrlOverride: undefined,
			robotsDirective: undefined,
			ogImage: undefined,
		});
		const model = await buildPublicStructuredPageModel("/about", locals);
		expect(model?.canonical).toBe("");
		expect(model?.robots).toBe("");
		expect(model?.ogImage).toBe("");
	});

	it("fetches only approved+featured testimonials and renders their quotes", async () => {
		mocks.getRuntimeStructuredPageRoute.mockResolvedValue({
			...publishedRecord,
			sections: [{ id: "t1", kind: "testimonials", source: "approved", layout: "grid" }],
		});
		mocks.getRuntimeTestimonials.mockImplementation(async (status: string) =>
			status === "approved"
				? [
						{
							id: "q1",
							name: "Ada",
							specificResult: "TESTIMONIAL_QUOTE",
							consentToPublish: true,
							status: "approved",
						},
					]
				: [],
		);
		const model = await buildPublicStructuredPageModel("/about", locals);
		// The testimonials reader must actually run and its quote must land in the body.
		expect(model?.body).toContain("TESTIMONIAL_QUOTE");
		// Only the approved + featured statuses are ever queried for the public surface.
		expect(mocks.getRuntimeTestimonials).toHaveBeenCalledWith("approved", locals);
		expect(mocks.getRuntimeTestimonials).toHaveBeenCalledWith("featured", locals);
	});

	it("renders no section content when the sections payload fails to parse", async () => {
		mocks.getRuntimeStructuredPageRoute.mockResolvedValue({
			...publishedRecord,
			sections: "not-a-valid-sections-payload",
		});
		const model = await buildPublicStructuredPageModel("/about", locals);
		expect(model).not.toBeNull();
		// Parse failure → sections = [] → none of the record's authored content renders.
		expect(model?.body).not.toContain("RICHTEXT_MARKER");
		expect(model?.body).not.toContain('src="/media/hero.webp"');
	});
});

describe("listPublishedStructuredPagePaths", () => {
	it("returns only published paths, excluding empty and the host-owned root", async () => {
		mocks.listRuntimeStructuredPageRoutes.mockResolvedValue([
			{ path: "/about", status: "published" },
			{ path: "/draft", status: "draft" },
			{ path: "/", status: "published" },
			{ path: "", status: "published" },
			{ path: "/contact", status: "published" },
		]);
		expect(await listPublishedStructuredPagePaths()).toEqual(["/about", "/contact"]);
	});
});

// #198 / #200 wiring guards: the .astro entrypoints' frontmatter can't run under
// vitest, so assert their source delegates to the shared resolver and can't
// regress to inlined logic or the wrong prerender strategy.
describe("public-renderer entrypoint wiring", () => {
	const read = (rel: string) => readFileSync(path.resolve(import.meta.dirname, "..", rel), "utf8");

	it("both entrypoints resolve pages through buildPublicStructuredPageModel", () => {
		expect(read("pages/astropress-public-page.astro")).toContain("buildPublicStructuredPageModel(");
		expect(read("pages/astropress-public-page-dev.astro")).toContain(
			"buildPublicStructuredPageModel(",
		);
	});

	it("the production entrypoint prerenders via getStaticPaths", () => {
		const src = read("pages/astropress-public-page.astro");
		expect(src).toMatch(/export const prerender = true/);
		// The call/definition, not the word — the dev page mentions it in prose.
		expect(src).toMatch(/getStaticPaths\s*\(/);
	});

	it("the dev entrypoint is on-demand: prerender=false and no getStaticPaths (#198)", () => {
		const src = read("pages/astropress-public-page-dev.astro");
		expect(src).toMatch(/export const prerender = false/);
		// No getStaticPaths definition/call (a passing mention in the comment is fine).
		expect(src).not.toMatch(/getStaticPaths\s*\(/);
	});
});
