import { createAstropressCloudflareAdapter, registerCms } from "@astropress-diy/astropress";
import { beforeEach, describe, expect, it } from "vitest";
import { makeDb, STANDARD_CMS_CONFIG } from "./helpers/make-db.js";
import { SqliteBackedD1Database } from "./helpers/provider-test-fixtures.js";

let db: ReturnType<typeof makeDb>;
let d1: SqliteBackedD1Database;
let adapter: ReturnType<typeof createAstropressCloudflareAdapter>;

beforeEach(() => {
	registerCms(STANDARD_CMS_CONFIG);
	db = makeDb();
	d1 = new SqliteBackedD1Database(db);
	adapter = createAstropressCloudflareAdapter({ db: d1 });
});

function getOverride(slug: string) {
	return db
		.prepare(
			"SELECT title, status, body, seo_title, meta_description, excerpt, og_title, og_description, og_image, canonical_url_override, robots_directive FROM content_overrides WHERE slug = ?",
		)
		.get(slug) as Record<string, unknown> | undefined;
}

function getEntry(slug: string) {
	return db
		.prepare(
			"SELECT slug, legacy_url, title, kind, template_key, source_html_path, body, summary, seo_title, meta_description, og_title, og_description, og_image FROM content_entries WHERE slug = ?",
		)
		.get(slug) as Record<string, unknown> | undefined;
}

describe("cloudflare savePageOrPost — new record (no existing entry)", () => {
	it("uses metadata.legacyUrl when provided, else falls back to '/<slug>'", async () => {
		await adapter.content.save({
			id: "with-legacy",
			kind: "post",
			slug: "with-legacy",
			title: "T",
			metadata: { legacyUrl: "/custom/legacy/path" },
		});
		expect(getEntry("with-legacy")?.legacy_url).toBe("/custom/legacy/path");

		await adapter.content.save({
			id: "default-legacy",
			kind: "post",
			slug: "default-legacy",
			title: "T",
		});
		expect(getEntry("default-legacy")?.legacy_url).toBe("/default-legacy");
	});

	it("uses metadata.templateKey when provided, else falls back to 'content'", async () => {
		await adapter.content.save({
			id: "with-template",
			kind: "post",
			slug: "with-template",
			title: "T",
			metadata: { templateKey: "custom-template" },
		});
		expect(getEntry("with-template")?.template_key).toBe("custom-template");

		await adapter.content.save({
			id: "default-template",
			kind: "post",
			slug: "default-template",
			title: "T",
		});
		expect(getEntry("default-template")?.template_key).toBe("content");
	});

	it("uses 'runtime://content/<slug>' as the source_html_path for new entries", async () => {
		await adapter.content.save({
			id: "src-path",
			kind: "post",
			slug: "src-path",
			title: "T",
		});
		expect(getEntry("src-path")?.source_html_path).toBe("runtime://content/src-path");
	});

	it("falls back to slug when title is omitted and there is no existing record", async () => {
		await adapter.content.save({
			id: "no-title-slug",
			kind: "post",
			slug: "no-title-slug",
		});
		const override = getOverride("no-title-slug");
		expect(override?.title).toBe("no-title-slug");
	});

	it("uses record.id as the slug when slug is omitted", async () => {
		await adapter.content.save({
			id: "id-as-slug",
			kind: "post",
			title: "T",
		});
		expect(getEntry("id-as-slug")?.slug).toBe("id-as-slug");
	});
});

describe("cloudflare savePageOrPost — metadata → override fields", () => {
	it("maps metadata.summary, seoTitle, metaDescription, ogTitle/Description/Image, canonicalUrlOverride, robotsDirective to the override row", async () => {
		await adapter.content.save({
			id: "rich-meta",
			kind: "post",
			slug: "rich-meta",
			title: "Rich Title",
			body: "<p>body</p>",
			metadata: {
				summary: "rich summary",
				seoTitle: "rich seo title",
				metaDescription: "rich meta description",
				ogTitle: "rich og title",
				ogDescription: "rich og description",
				ogImage: "https://example.com/og.png",
				canonicalUrlOverride: "https://example.com/canonical",
				robotsDirective: "noindex",
			},
		});

		const override = getOverride("rich-meta");
		expect(override).toMatchObject({
			title: "Rich Title",
			body: "<p>body</p>",
			seo_title: "rich seo title",
			meta_description: "rich meta description",
			excerpt: "rich summary",
			og_title: "rich og title",
			og_description: "rich og description",
			og_image: "https://example.com/og.png",
			canonical_url_override: "https://example.com/canonical",
			robots_directive: "noindex",
		});
	});

	it("falls back to title when metadata.seoTitle / metaDescription are absent", async () => {
		await adapter.content.save({
			id: "no-seo",
			kind: "post",
			slug: "no-seo",
			title: "Fallback Title",
		});
		const override = getOverride("no-seo");
		expect(override?.seo_title).toBe("Fallback Title");
		expect(override?.meta_description).toBe("Fallback Title");
	});

	it("ignores non-string metadata values for ogTitle/Description/Image/canonical/robots and falls back to null", async () => {
		await adapter.content.save({
			id: "bad-meta",
			kind: "post",
			slug: "bad-meta",
			title: "T",
			metadata: {
				ogTitle: 123,
				ogDescription: { not: "a string" },
				ogImage: null,
				canonicalUrlOverride: false,
				robotsDirective: undefined,
			},
		});
		const override = getOverride("bad-meta");
		expect(override).toMatchObject({
			og_title: null,
			og_description: null,
			og_image: null,
			canonical_url_override: null,
			robots_directive: null,
		});
	});

	it("persists '' (not the metadata key string) for body/summary when neither record nor metadata supplies them", async () => {
		await adapter.content.save({
			id: "empty-fields",
			kind: "post",
			slug: "empty-fields",
			title: "T",
		});
		const override = getOverride("empty-fields");
		expect(override?.body).toBe("");
		expect(override?.excerpt).toBe("");
	});
});

describe("cloudflare savePageOrPost — revision snapshot is persisted with the saved fields", () => {
	it("writes a content_revisions row whose snapshot/body/title columns match the saved values (snapshot object is NOT empty)", async () => {
		await adapter.content.save({
			id: "rev-snap",
			kind: "post",
			slug: "rev-snap",
			title: "Snap Title",
			body: "<p>Snap body</p>",
			metadata: {
				seoTitle: "Snap SEO",
				metaDescription: "Snap Meta",
			},
		});

		const rev = db
			.prepare(
				"SELECT title, status, body, seo_title, meta_description FROM content_revisions WHERE slug = 'rev-snap' ORDER BY id DESC LIMIT 1",
			)
			.get() as Record<string, unknown> | undefined;
		expect(rev).toMatchObject({
			title: "Snap Title",
			body: "<p>Snap body</p>",
			seo_title: "Snap SEO",
			meta_description: "Snap Meta",
		});
	});
});

describe("cloudflare savePageOrPost — existing record preserves prior fields", () => {
	it("preserves the existing override's ogTitle/Description/Image/canonical/robots when the record's metadata omits them", async () => {
		// First save with full metadata to populate existing override fields.
		await adapter.content.save({
			id: "preserve",
			kind: "post",
			slug: "preserve",
			title: "T1",
			metadata: {
				ogTitle: "OG One",
				ogDescription: "OG Desc One",
				ogImage: "https://example.com/og1.png",
				canonicalUrlOverride: "https://example.com/canon1",
				robotsDirective: "index",
			},
		});

		// Second save WITHOUT those metadata fields. resolveContentFields should fall back
		// to the existing override row (NOT to null) for the og/canonical/robots fields.
		await adapter.content.save({
			id: "preserve",
			kind: "post",
			slug: "preserve",
			title: "T2",
			metadata: {},
		});

		const override = getOverride("preserve");
		expect(override).toMatchObject({
			title: "T2",
			og_title: "OG One",
			og_description: "OG Desc One",
			og_image: "https://example.com/og1.png",
			canonical_url_override: "https://example.com/canon1",
			robots_directive: "index",
		});
	});
});
