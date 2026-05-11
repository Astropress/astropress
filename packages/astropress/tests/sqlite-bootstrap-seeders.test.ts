import { DatabaseSync } from "node:sqlite";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { registerCms } from "../src/config";
import { readAstropressSqliteSchemaSql } from "../src/sqlite-bootstrap.js";
import type { AstropressSqliteSeedToolkitOptions } from "../src/sqlite-bootstrap-helpers";
import {
	seedArchiveRoutes,
	seedBootstrapUsers,
	seedComments,
	seedMarketingRoutes,
	seedMediaAssets,
	seedRedirects,
	seedSiteSettings,
	seedSystemRoutes,
} from "../src/sqlite-bootstrap-seeders";

function makeFreshDb() {
	const db = new DatabaseSync(":memory:");
	db.exec(readAstropressSqliteSchemaSql());
	return db;
}

function baseOptions(
	over: Partial<AstropressSqliteSeedToolkitOptions> = {},
): AstropressSqliteSeedToolkitOptions {
	return {
		readSchemaSql: () => readAstropressSqliteSchemaSql(),
		loadBootstrapUsers: () => [],
		loadMediaSeeds: () => [],
		redirectRules: [],
		comments: [],
		systemRoutes: [],
		archiveRoutes: [],
		marketingRoutes: [],
		siteSettings: {
			siteTitle: "T",
			siteTagline: "L",
			donationUrl: "https://example.com/donate",
			newsletterEnabled: false,
			commentsDefaultPolicy: "legacy-readonly",
		},
		...over,
	};
}

let db: DatabaseSync;

beforeEach(() => {
	db = makeFreshDb();
	registerCms({
		templateKeys: ["content"],
		siteUrl: "https://example.com",
		seedPages: [],
		archives: [],
		translationStatus: [],
	});
});

afterEach(() => {
	db.close();
});

describe("seedBootstrapUsers", () => {
	it("inserts admin + editor with the correct is_admin flag, lowercases email, hashes password", () => {
		const count = seedBootstrapUsers(
			baseOptions({
				loadBootstrapUsers: () => [
					{ email: "Admin@Example.com", password: "pw1", name: "A", role: "admin" },
					{ email: "edit@example.com", password: "pw2", name: "E", role: "editor" },
				],
			}),
			db,
		);
		expect(count).toBe(2);
		const rows = db
			.prepare(
				"SELECT email, is_admin, name, active, password_hash FROM admin_users ORDER BY email ASC",
			)
			.all() as Array<{
			email: string;
			is_admin: number;
			name: string;
			active: number;
			password_hash: string;
		}>;
		expect(rows).toHaveLength(2);
		expect(rows[0]).toMatchObject({
			email: "admin@example.com",
			is_admin: 1,
			name: "A",
			active: 1,
		});
		expect(rows[1]).toMatchObject({ email: "edit@example.com", is_admin: 0, name: "E", active: 1 });
		expect(rows[0].password_hash.length).toBeGreaterThan(0);
		expect(rows[0].password_hash).not.toBe("pw1");
	});

	it("upserts existing users (re-seed updates name and hash)", () => {
		const opts = baseOptions({
			loadBootstrapUsers: () => [
				{ email: "a@x.com", password: "pw", name: "First", role: "admin" },
			],
		});
		seedBootstrapUsers(opts, db);
		seedBootstrapUsers(
			baseOptions({
				loadBootstrapUsers: () => [
					{ email: "a@x.com", password: "pw2", name: "Second", role: "editor" },
				],
			}),
			db,
		);
		const row = db
			.prepare("SELECT name, is_admin FROM admin_users WHERE email = 'a@x.com'")
			.get() as { name: string; is_admin: number };
		expect(row.name).toBe("Second");
		expect(row.is_admin).toBe(0);
	});

	it("returns 0 when no bootstrap users are provided", () => {
		expect(seedBootstrapUsers(baseOptions(), db)).toBe(0);
	});
});

describe("seedMediaAssets", () => {
	it("inserts assets with derived mime type and defaults the local_path when missing", () => {
		const count = seedMediaAssets(
			baseOptions({
				loadMediaSeeds: () => [
					{ id: "img-1.png", sourceUrl: "https://example.com/img-1.png" },
					{ id: "img-2", localPath: "/custom/img-2.jpg", r2Key: "media/img-2.jpg" },
				],
			}),
			db,
			"/workspace",
		);
		expect(count).toBe(2);
		const rows = db
			.prepare("SELECT id, local_path, mime_type, r2_key FROM media_assets ORDER BY id ASC")
			.all() as Array<{ id: string; local_path: string; mime_type: string; r2_key: string }>;
		expect(rows[0].id).toBe("img-1.png");
		expect(rows[0].local_path).toBe("/images/legacy/img-1.png");
		expect(rows[0].mime_type).toMatch(/png/);
		expect(rows[1].local_path).toBe("/custom/img-2.jpg");
		expect(rows[1].r2_key).toBe("media/img-2.jpg");
		expect(rows[1].mime_type).toMatch(/jpe?g/);
	});

	it("returns 0 when no media seeds are provided", () => {
		expect(seedMediaAssets(baseOptions(), db, "/workspace")).toBe(0);
	});
});

describe("seedRedirects", () => {
	it("inserts redirect rules and upserts on conflict", () => {
		const count = seedRedirects(
			baseOptions({
				redirectRules: [
					{ sourcePath: "/old", targetPath: "/new", statusCode: 301 },
					{ sourcePath: "/x", targetPath: "/y", statusCode: 302 },
				],
			}),
			db,
		);
		expect(count).toBe(2);
		const rows = db
			.prepare(
				"SELECT source_path, target_path, status_code FROM redirect_rules ORDER BY source_path ASC",
			)
			.all() as Array<{ source_path: string; target_path: string; status_code: number }>;
		expect(rows).toEqual([
			{ source_path: "/old", target_path: "/new", status_code: 301 },
			{ source_path: "/x", target_path: "/y", status_code: 302 },
		]);
	});

	it("upserts existing redirects (re-seed updates the target_path)", () => {
		seedRedirects(
			baseOptions({
				redirectRules: [{ sourcePath: "/old", targetPath: "/v1", statusCode: 301 }],
			}),
			db,
		);
		seedRedirects(
			baseOptions({
				redirectRules: [{ sourcePath: "/old", targetPath: "/v2", statusCode: 302 }],
			}),
			db,
		);
		const row = db
			.prepare("SELECT target_path, status_code FROM redirect_rules WHERE source_path = '/old'")
			.get() as { target_path: string; status_code: number };
		expect(row.target_path).toBe("/v2");
		expect(row.status_code).toBe(302);
	});
});

describe("seedComments", () => {
	it("inserts comments and skips duplicates (ON CONFLICT DO NOTHING)", () => {
		const count = seedComments(
			baseOptions({
				comments: [
					{
						id: "c1",
						author: "A",
						email: "a@x.com",
						body: "hi",
						route: "/r",
						status: "approved",
						policy: "open-moderated",
						submittedAt: "2025-01-01T00:00:00Z",
					},
				],
			}),
			db,
		);
		expect(count).toBe(1);
		// Re-insert: skipped, count returns 0
		const second = seedComments(
			baseOptions({
				comments: [
					{
						id: "c1",
						author: "A",
						email: null as unknown as string,
						body: null as unknown as string,
						route: "/r",
						status: "approved",
						policy: "open-moderated",
					},
				],
			}),
			db,
		);
		expect(second).toBe(0);
	});

	it("defaults missing submittedAt to a SQL CURRENT_TIMESTAMP value", () => {
		seedComments(
			baseOptions({
				comments: [
					{
						id: "c2",
						author: "B",
						route: "/r",
						status: "pending",
						policy: "legacy-readonly",
					},
				],
			}),
			db,
		);
		const row = db.prepare("SELECT submitted_at FROM comments WHERE id = 'c2'").get() as {
			submitted_at: string;
		};
		expect(typeof row.submitted_at).toBe("string");
		expect(row.submitted_at.length).toBeGreaterThan(0);
	});
});

describe("seedSiteSettings", () => {
	it("returns 1 (changes count) when inserting a fresh row", () => {
		expect(seedSiteSettings(baseOptions(), db)).toBe(1);
	});

	it("writes a row at id=1 with newsletterEnabled mapped to 1 or 0", () => {
		seedSiteSettings(
			baseOptions({
				siteSettings: {
					siteTitle: "Hello",
					siteTagline: "Tag",
					donationUrl: "https://example.com/d",
					newsletterEnabled: true,
					commentsDefaultPolicy: "open-moderated",
				},
			}),
			db,
		);
		const row = db
			.prepare(
				"SELECT site_title, site_tagline, newsletter_enabled, comments_default_policy FROM site_settings WHERE id = 1",
			)
			.get() as {
			site_title: string;
			site_tagline: string;
			newsletter_enabled: number;
			comments_default_policy: string;
		};
		expect(row.site_title).toBe("Hello");
		expect(row.newsletter_enabled).toBe(1);
		expect(row.comments_default_policy).toBe("open-moderated");
	});

	it("maps newsletterEnabled=false to 0", () => {
		seedSiteSettings(
			baseOptions({
				siteSettings: {
					siteTitle: "Hello",
					siteTagline: "Tag",
					donationUrl: "https://example.com/d",
					newsletterEnabled: false,
					commentsDefaultPolicy: "legacy-readonly",
				},
			}),
			db,
		);
		const row = db.prepare("SELECT newsletter_enabled FROM site_settings WHERE id = 1").get() as {
			newsletter_enabled: number;
		};
		expect(row.newsletter_enabled).toBe(0);
	});
});

describe("seedSystemRoutes", () => {
	it("returns the inserted count (1 per route)", () => {
		expect(
			seedSystemRoutes(
				baseOptions({
					systemRoutes: [
						{
							groupId: "g1",
							variantId: "v1",
							path: "/p1",
							title: "T",
							renderStrategy: "structured_sections",
						},
						{
							groupId: "g2",
							variantId: "v2",
							path: "/p2",
							title: "T",
							renderStrategy: "structured_sections",
						},
					],
				}),
				db,
			),
		).toBe(2);
	});

	it("inserts a group + variant + revision per system route, with metaDescription falling back through summary then title", () => {
		const n = seedSystemRoutes(
			baseOptions({
				systemRoutes: [
					{
						groupId: "g-sys",
						variantId: "v-sys",
						path: "/sys",
						title: "Sys",
						summary: "Sys summary",
						bodyHtml: "<p>body</p>",
						renderStrategy: "structured_sections",
						settingsJson: JSON.stringify({ key: "value" }),
					},
				],
			}),
			db,
		);
		expect(n).toBe(1);
		const variant = db
			.prepare(
				"SELECT title, summary, body_html, meta_description, settings_json, updated_by FROM cms_route_variants WHERE id = 'v-sys'",
			)
			.get() as {
			title: string;
			summary: string;
			body_html: string;
			meta_description: string;
			settings_json: string;
			updated_by: string;
		};
		expect(variant.title).toBe("Sys");
		expect(variant.summary).toBe("Sys summary");
		expect(variant.body_html).toBe("<p>body</p>");
		// metaDescription absent → falls back to summary
		expect(variant.meta_description).toBe("Sys summary");
		expect(variant.updated_by).toBe("seed-import");
		const rev = db
			.prepare(
				"SELECT snapshot_json, revision_note, created_by FROM cms_route_revisions WHERE id = 'revision:v-sys:seed'",
			)
			.get() as { snapshot_json: string; revision_note: string; created_by: string };
		expect(rev.revision_note).toBe("Imported baseline");
		expect(rev.created_by).toBe("seed-import");
		const snap = JSON.parse(rev.snapshot_json);
		expect(snap).toEqual({
			path: "/sys",
			title: "Sys",
			summary: "Sys summary",
			bodyHtml: "<p>body</p>",
			settings: { key: "value" },
			renderStrategy: "structured_sections",
		});
	});

	it("falls back metaDescription to title when both metaDescription and summary are absent; settings null when no JSON", () => {
		seedSystemRoutes(
			baseOptions({
				systemRoutes: [
					{
						groupId: "g-min",
						variantId: "v-min",
						path: "/min",
						title: "Min",
						renderStrategy: "generated_text",
					},
				],
			}),
			db,
		);
		const v = db
			.prepare(
				"SELECT meta_description, summary, body_html FROM cms_route_variants WHERE id = 'v-min'",
			)
			.get() as { meta_description: string; summary: string | null; body_html: string | null };
		expect(v.meta_description).toBe("Min");
		expect(v.summary).toBeNull();
		expect(v.body_html).toBeNull();
		// systemRouteSnapshot fills summary="" and bodyHtml="" when absent (not "Stryker was here")
		const rev = db
			.prepare("SELECT snapshot_json FROM cms_route_revisions WHERE id = 'revision:v-min:seed'")
			.get() as { snapshot_json: string };
		const snap = JSON.parse(rev.snapshot_json);
		expect(snap.summary).toBe("");
		expect(snap.bodyHtml).toBe("");
		expect(snap.settings).toBeNull();
	});
});

describe("seedArchiveRoutes", () => {
	it("returns the inserted count (1 per archive)", () => {
		expect(
			seedArchiveRoutes(
				baseOptions({
					archiveRoutes: [
						{ legacyUrl: "/a", title: "A" },
						{ legacyUrl: "/b", title: "B" },
					],
				}),
				db,
			),
		).toBe(2);
	});

	it("derives group/variant ids from legacyUrl and falls back seoTitle/metaDescription chain", () => {
		seedArchiveRoutes(
			baseOptions({
				archiveRoutes: [
					{ legacyUrl: "/blog", title: "Blog", summary: "Blog summary" },
					{
						legacyUrl: "/news/world",
						title: "World News",
						seoTitle: "World SEO",
						metaDescription: "World meta",
					},
				],
			}),
			db,
		);
		const blog = db
			.prepare(
				"SELECT id, group_id, title, seo_title, meta_description, updated_by FROM cms_route_variants WHERE id = 'variant:archive:blog:en'",
			)
			.get() as {
			group_id: string;
			title: string;
			seo_title: string;
			meta_description: string;
			updated_by: string;
		};
		expect(blog.group_id).toBe("archive:blog");
		expect(blog.title).toBe("Blog");
		// seoTitle absent → falls back to title
		expect(blog.seo_title).toBe("Blog");
		// metaDescription absent → falls back to summary
		expect(blog.meta_description).toBe("Blog summary");
		expect(blog.updated_by).toBe("seed-import");

		const news = db
			.prepare(
				"SELECT seo_title, meta_description FROM cms_route_variants WHERE id = 'variant:archive:news:world:en'",
			)
			.get() as { seo_title: string; meta_description: string };
		expect(news.seo_title).toBe("World SEO");
		expect(news.meta_description).toBe("World meta");
	});

	it("uses 'root' as the base id when legacyUrl is '/'", () => {
		seedArchiveRoutes(
			baseOptions({
				archiveRoutes: [{ legacyUrl: "/", title: "Root" }],
			}),
			db,
		);
		const row = db
			.prepare("SELECT title FROM cms_route_variants WHERE id = 'variant:archive:root:en'")
			.get() as { title: string };
		expect(row.title).toBe("Root");
	});

	it("falls back metaDescription to '' when both metaDescription and summary are absent", () => {
		seedArchiveRoutes(
			baseOptions({
				archiveRoutes: [{ legacyUrl: "/bare", title: "Bare" }],
			}),
			db,
		);
		const row = db
			.prepare(
				"SELECT meta_description FROM cms_route_variants WHERE id = 'variant:archive:bare:en'",
			)
			.get() as { meta_description: string };
		expect(row.meta_description).toBe("");
	});
});

describe("seedMarketingRoutes", () => {
	it("returns the inserted count (1 per page)", () => {
		expect(
			seedMarketingRoutes(
				baseOptions({
					marketingRoutes: [
						{
							path: "/a",
							title: "A",
							summary: "s",
							seoTitle: "s",
							metaDescription: "m",
							templateKey: "content",
							sections: null,
						},
						{
							path: "/b",
							title: "B",
							summary: "s",
							seoTitle: "s",
							metaDescription: "m",
							templateKey: "content",
							sections: null,
						},
					],
				}),
				db,
			),
		).toBe(2);
	});

	it("derives locale from CMS config locale prefix and otherwise falls back to first locale", () => {
		registerCms({
			templateKeys: ["content"],
			siteUrl: "https://example.com",
			seedPages: [],
			archives: [],
			translationStatus: [],
			locales: ["en", "es", "fr"],
		} as unknown as Parameters<typeof registerCms>[0]);

		seedMarketingRoutes(
			baseOptions({
				marketingRoutes: [
					{
						path: "/es/contacto",
						title: "Contacto",
						summary: "es summary",
						seoTitle: "Contacto",
						metaDescription: "Contacto meta",
						templateKey: "content",
						sections: { hero: { title: "h" } },
						alternateLinks: [{ hreflang: "en", href: "/contact" }],
					},
					{
						path: "/about",
						title: "About",
						summary: "About summary",
						seoTitle: "About SEO",
						metaDescription: "About meta",
						templateKey: "content",
						sections: null,
					},
				],
			}),
			db,
		);
		const es = db
			.prepare(
				"SELECT locale, path, title, seo_title, settings_json, group_id, updated_by FROM cms_route_variants WHERE id = 'variant:page:es:contacto:es'",
			)
			.get() as {
			locale: string;
			path: string;
			title: string;
			seo_title: string;
			settings_json: string;
			group_id: string;
			updated_by: string;
		};
		expect(es.locale).toBe("es");
		expect(es.path).toBe("/es/contacto");
		expect(es.group_id).toBe("page:es:contacto");
		expect(es.updated_by).toBe("seed-import");
		expect(JSON.parse(es.settings_json)).toEqual({
			templateKey: "content",
			alternateLinks: [{ hreflang: "en", href: "/contact" }],
		});

		const about = db
			.prepare(
				"SELECT locale, settings_json FROM cms_route_variants WHERE id = 'variant:page:about:en'",
			)
			.get() as { locale: string; settings_json: string };
		expect(about.locale).toBe("en");
		// alternateLinks absent on the page → defaults to []
		expect(JSON.parse(about.settings_json).alternateLinks).toEqual([]);
	});

	it("falls back to ['en','es'] when getCmsConfig throws", async () => {
		// Re-importing to force getCmsConfig to throw is tricky; instead exercise the
		// 'no config-locales match' path which uses configLocales[0] ?? 'en'.
		seedMarketingRoutes(
			baseOptions({
				marketingRoutes: [
					{
						path: "/orphan",
						title: "Orphan",
						summary: "s",
						seoTitle: "s",
						metaDescription: "m",
						templateKey: "content",
						sections: null,
					},
				],
			}),
			db,
		);
		const row = db
			.prepare("SELECT locale FROM cms_route_variants WHERE id = 'variant:page:orphan:en'")
			.get() as { locale: string };
		expect(row.locale).toBe("en");
	});

	it("falls back to ['en','es'] when getCmsConfig throws (no CMS registered)", () => {
		const CMS_CONFIG_KEY = Symbol.for("astropress.cms-config");
		const g = globalThis as unknown as Record<symbol, unknown>;
		const saved = g[CMS_CONFIG_KEY];
		// Unset the registered config so getCmsConfig() throws inside resolveMarketingLocale
		g[CMS_CONFIG_KEY] = undefined;
		try {
			seedMarketingRoutes(
				baseOptions({
					marketingRoutes: [
						{
							path: "/es/sin-config",
							title: "Sin",
							summary: "s",
							seoTitle: "s",
							metaDescription: "m",
							templateKey: "content",
							sections: null,
						},
					],
				}),
				db,
			);
			const row = db
				.prepare("SELECT locale FROM cms_route_variants WHERE id = 'variant:page:es:sin-config:es'")
				.get() as { locale: string };
			expect(row.locale).toBe("es");
		} finally {
			g[CMS_CONFIG_KEY] = saved;
		}
	});

	it("defaults to ['en','es'] when the config has no locales defined", () => {
		// Default registerCms in beforeEach didn't set locales — exercises the `?? ['en','es']` arm.
		seedMarketingRoutes(
			baseOptions({
				marketingRoutes: [
					{
						path: "/es/welcome",
						title: "Welcome",
						summary: "s",
						seoTitle: "s",
						metaDescription: "m",
						templateKey: "content",
						sections: null,
					},
				],
			}),
			db,
		);
		const row = db
			.prepare("SELECT locale FROM cms_route_variants WHERE id = 'variant:page:es:welcome:es'")
			.get() as { locale: string };
		expect(row.locale).toBe("es");
	});
});
