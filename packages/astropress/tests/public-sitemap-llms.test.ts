import { describe, expect, it, vi } from "vitest";

// Partial-mock the barrel: stub the content source and pin a deterministic
// origin; keep everything else real. (Same idiom as api-endpoints.test.ts.)
const mocks = vi.hoisted(() => ({
	listRuntimeContentStates: vi.fn(),
}));

vi.mock("@astropress-diy/astropress", async (importOriginal) => {
	const actual = await importOriginal<typeof import("../index.js")>();
	return {
		...actual,
		listRuntimeContentStates: mocks.listRuntimeContentStates,
		resolveCanonicalOrigin: () => "https://example.com",
	};
});

import { GET as llmsGET } from "../pages/llms.txt.js";
import { GET as sitemapGET } from "../pages/sitemap.xml.js";

const records = [
	{
		status: "published",
		kind: "page",
		slug: "about",
		title: "About",
		updatedAt: "2026-01-03T10:00:00Z",
		metaDescription: "About us",
	},
	{
		status: "published",
		kind: "post",
		slug: "my-post",
		title: "My Post",
		updatedAt: "2026-01-02T10:00:00Z",
		metaDescription: "A post",
	},
	// Untyped record: previously bucketed with posts and emitted at /blog/.
	{ status: "published", kind: null, slug: "untyped", title: "Untyped" },
	{ status: "draft", kind: "page", slug: "secret-draft", title: "Draft" },
];

const ctx = () => ({ request: new Request("https://example.com/x"), locals: {} }) as never;

describe("sitemap.xml only advertises URLs that resolve (#201)", () => {
	it("lists the homepage and published pages, but never /blog/ post URLs", async () => {
		mocks.listRuntimeContentStates.mockResolvedValue(records);
		const xml = await (await sitemapGET(ctx())).text();

		expect(xml).toContain("<loc>https://example.com/</loc>");
		expect(xml).toContain("<loc>https://example.com/about/</loc>");
		// Posts have no public route in the framework → never advertised.
		expect(xml).not.toContain("/blog/");
		expect(xml).not.toContain("my-post");
		// Untyped records are omitted too (unknown rendering).
		expect(xml).not.toContain("untyped");
		// Drafts never appear.
		expect(xml).not.toContain("secret-draft");
	});

	it("serves application/xml", async () => {
		mocks.listRuntimeContentStates.mockResolvedValue([]);
		const res = await sitemapGET(ctx());
		expect(res.headers.get("content-type")).toContain("xml");
	});
});

describe("llms.txt only advertises URLs that resolve (#201)", () => {
	it("emits a Pages section but no Posts section or /blog/ URLs", async () => {
		mocks.listRuntimeContentStates.mockResolvedValue(records);
		const txt = await (await llmsGET(ctx())).text();

		expect(txt).toContain("## Pages");
		expect(txt).toContain("https://example.com/about/");
		expect(txt).not.toContain("## Posts");
		expect(txt).not.toContain("/blog/");
		expect(txt).not.toContain("my-post");
	});
});
