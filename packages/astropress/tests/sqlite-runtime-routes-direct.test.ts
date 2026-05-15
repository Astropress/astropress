// Direct tests for src/sqlite-runtime/routes.ts targeting Stryker survivors.
// Static imports + fresh per-test DB; drives helpers through the public
// cmsRouteRegistry / cmsRegistryModule surfaces and asserts DB state.
import { DatabaseSync } from "node:sqlite";
import { beforeAll, beforeEach, describe, expect, it } from "vitest";

import { registerCms } from "../src/config.js";
import { readAstropressSqliteSchemaSql } from "../src/sqlite-bootstrap.js";
import { createSqliteRoutesStore } from "../src/sqlite-runtime/routes.js";

beforeAll(() => {
	registerCms({
		templateKeys: ["default", "about", "home"],
		siteUrl: "https://example.com",
		seedPages: [],
		archives: [],
		translationStatus: [],
	});
});

const ACTOR = { email: "admin@test.local", role: "admin" as const, name: "Admin" };

function seedSystemRoute(
	db: DatabaseSync,
	opts: {
		path?: string;
		title?: string;
		summary?: string | null;
		bodyHtml?: string | null;
		updatedAt?: string | null;
	} = {},
) {
	const path = opts.path ?? "/sitemap.xml";
	const groupId = `group-${path}`;
	const variantId = `variant-${path}`;
	db.prepare(
		"INSERT INTO cms_route_groups (id, kind, render_strategy, canonical_locale, canonical_path) VALUES (?, 'system', 'generated_xml', 'en', ?)",
	).run(groupId, path);
	if (opts.updatedAt === null || opts.updatedAt === undefined) {
		db.prepare(
			"INSERT INTO cms_route_variants (id, group_id, locale, path, status, title, summary, body_html, settings_json, updated_by) VALUES (?, ?, 'en', ?, 'published', ?, ?, ?, NULL, 'seed')",
		).run(
			variantId,
			groupId,
			path,
			opts.title ?? "Sitemap",
			opts.summary ?? null,
			opts.bodyHtml ?? null,
		);
	} else {
		db.prepare(
			"INSERT INTO cms_route_variants (id, group_id, locale, path, status, title, summary, body_html, settings_json, updated_at, updated_by) VALUES (?, ?, 'en', ?, 'published', ?, ?, ?, NULL, ?, 'seed')",
		).run(
			variantId,
			groupId,
			path,
			opts.title ?? "Sitemap",
			opts.summary ?? null,
			opts.bodyHtml ?? null,
			opts.updatedAt,
		);
	}
	return { groupId, variantId };
}

function seedStructuredRoute(db: DatabaseSync, path: string) {
	const groupId = `group-${path}`;
	const variantId = `variant-${path}`;
	db.prepare(
		"INSERT INTO cms_route_groups (id, kind, render_strategy, canonical_locale, canonical_path) VALUES (?, 'page', 'structured_sections', 'en', ?)",
	).run(groupId, path);
	db.prepare(
		"INSERT INTO cms_route_variants (id, group_id, locale, path, status, title, summary, sections_json, settings_json, seo_title, meta_description, updated_by) VALUES (?, ?, 'en', ?, 'published', 'Old Title', 'Old summary', NULL, ?, NULL, NULL, 'seed')",
	).run(variantId, groupId, path, JSON.stringify({ templateKey: "default", alternateLinks: [] }));
	return { groupId, variantId };
}

function seedArchiveRoute(db: DatabaseSync, path: string) {
	const groupId = `group-${path}`;
	const variantId = `variant-${path}`;
	db.prepare(
		"INSERT INTO cms_route_groups (id, kind, render_strategy, canonical_locale, canonical_path) VALUES (?, 'archive', 'archive_listing', 'en', ?)",
	).run(groupId, path);
	db.prepare(
		"INSERT INTO cms_route_variants (id, group_id, locale, path, status, title, summary, updated_by) VALUES (?, ?, 'en', ?, 'published', 'Archive', 'Old summary', 'seed')",
	).run(variantId, groupId, path);
	return { groupId, variantId };
}

let db: DatabaseSync;
let counter: number;
function freshStore() {
	db = new DatabaseSync(":memory:");
	db.exec(readAstropressSqliteSchemaSql());
	counter = 0;
	return createSqliteRoutesStore(
		() => db,
		() => `id-${++counter}`,
	);
}

beforeEach(() => {});

describe("querySystemRoutes — null fallbacks", () => {
	it("bodyHtml is undefined when row.body_html is NULL (kills 46:13 LogicalOperator ?? →&&)", () => {
		const { sqliteCmsRouteRegistry } = freshStore();
		seedSystemRoute(db, { path: "/p", bodyHtml: null });
		const list = sqliteCmsRouteRegistry.listSystemRoutes();
		const route = list.find((r) => r.path === "/p");
		expect(route).toBeDefined();
		expect(route?.bodyHtml).toBeUndefined();
	});

	// NOTE: row.updated_at ?? undefined (48:14) is cataloged equivalent — the column has a NOT NULL
	// constraint with CURRENT_TIMESTAMP default, so the ?? branch is observationally unreachable.
});

describe("listStructuredPageRoutes — null-row filter", () => {
	it("filters out rows that mapStructuredPageRow returns null for (kills 74:10 MethodExpression .filter(Boolean) removed and 74:85 ConditionalExpression)", () => {
		const { sqliteCmsRouteRegistry } = freshStore();
		seedStructuredRoute(db, "/valid");
		// Seed a malformed structured row whose settings_json triggers mapStructuredPageRow → null.
		// Inspect routes-helpers for what makes it null — typically missing templateKey or invalid
		// settings_json. We force settings_json to a non-JSON string so JSON.parse throws inside the
		// mapper, which returns null.
		const badGroup = "group-bad";
		const badVariant = "variant-bad";
		db.prepare(
			"INSERT INTO cms_route_groups (id, kind, render_strategy, canonical_locale, canonical_path) VALUES (?, 'page', 'structured_sections', 'en', '/bad')",
		).run(badGroup);
		db.prepare(
			"INSERT INTO cms_route_variants (id, group_id, locale, path, status, title, summary, sections_json, settings_json, updated_by) VALUES (?, ?, 'en', '/bad', 'published', 'Bad', NULL, NULL, 'not-json-{{{', 'seed')",
		).run(badVariant, badGroup);

		const list = sqliteCmsRouteRegistry.listStructuredPageRoutes();
		// The malformed row must be filtered out; the well-formed row remains.
		expect(list.some((r) => r.path === "/valid")).toBe(true);
		expect(list.every((r) => r !== null)).toBe(true);
		// Without .filter(Boolean) the bad row would appear as null in the array.
	});
});

describe("saveSystemRoute drives persistSystemRoute, appendSystemRouteRevision, recordRouteAudit", () => {
	it("persists title/summary/bodyHtml/settings and inserts a revision row + audit row (kills 123:6 and 151:6 BlockStatement {}, 126:57 LogicalOperator summary ?? title →&&, 159:21 ObjectLiteral, 164:17 LogicalOperator settings ?? null →&&, 360:6 BlockStatement {}, 361:49 StringLiteral 'content'→'')", () => {
		const { sqliteCmsRouteRegistry } = freshStore();
		const { variantId } = seedSystemRoute(db, { path: "/sitemap.xml" });
		const result = sqliteCmsRouteRegistry.saveSystemRoute(
			"/sitemap.xml",
			{
				title: "New Title",
				summary: "New Summary",
				bodyHtml: "<xml/>",
				settings: { foo: "bar" },
				revisionNote: "note",
			},
			ACTOR,
		);
		expect(result.ok).toBe(true);
		const row = db
			.prepare(
				"SELECT title, summary, body_html, settings_json, seo_title, meta_description FROM cms_route_variants WHERE id = ?",
			)
			.get(variantId) as {
			title: string;
			summary: string;
			body_html: string;
			settings_json: string;
			seo_title: string;
			meta_description: string;
		};
		expect(row.title).toBe("New Title");
		expect(row.summary).toBe("New Summary");
		expect(row.body_html).toBe("<xml/>");
		expect(JSON.parse(row.settings_json)).toEqual({ foo: "bar" });
		// 126:57 mutant: summary ?? title → && — when summary is non-null, the original is `summary`
		// so seo_title = "New Title", meta_description = "New Summary". Mutant: summary && title = title
		// → meta_description would be "New Title" not "New Summary".
		expect(row.meta_description).toBe("New Summary");

		// Revision row was inserted by appendSystemRouteRevision.
		const rev = db
			.prepare(
				"SELECT route_path, locale, snapshot_json, revision_note FROM cms_route_revisions WHERE variant_id = ? ORDER BY created_at DESC LIMIT 1",
			)
			.get(variantId) as {
			route_path: string;
			locale: string;
			snapshot_json: string;
			revision_note: string;
		};
		expect(rev.route_path).toBe("/sitemap.xml");
		expect(rev.locale).toBe("en");
		expect(rev.revision_note).toBe("note");
		const snapshot = JSON.parse(rev.snapshot_json);
		expect(snapshot.title).toBe("New Title");
		expect(snapshot.summary).toBe("New Summary");
		expect(snapshot.bodyHtml).toBe("<xml/>");
		// 159:21 ObjectLiteral {} would strip every snapshot field — assertions above would fail.
		expect(snapshot.settings).toEqual({ foo: "bar" });
		// 164:17 LogicalOperator settings ?? null →&&: when settings is truthy, original=settings → fields present;
		// mutant: settings && null → null → snapshot.settings = null.
		expect(snapshot.settings).not.toBeNull();
		expect(snapshot.renderStrategy).toBe("generated_xml");

		// Audit row inserted with resource_type='content'.
		const audit = db
			.prepare(
				"SELECT resource_type, action FROM audit_events WHERE action = 'system.update' ORDER BY id DESC LIMIT 1",
			)
			.get() as { resource_type: string; action: string };
		expect(audit.resource_type).toBe("content");
	});
});

describe("saveStructuredPageRoute drives persistStructuredRoute, appendStructuredRouteRevision", () => {
	it("persists the variant and inserts a revision snapshot with all structured fields (kills 264:37 BlockStatement {} and 272:21 ObjectLiteral {})", () => {
		const { sqliteCmsRouteRegistry } = freshStore();
		const { variantId } = seedStructuredRoute(db, "/about");
		const result = sqliteCmsRouteRegistry.saveStructuredPageRoute(
			"/about",
			{
				title: "About Us",
				summary: "Our team",
				seoTitle: "About — SEO",
				metaDescription: "META",
				canonicalUrlOverride: null,
				robotsDirective: null,
				ogImage: null,
				templateKey: "about",
				alternateLinks: [{ locale: "es", path: "/es/sobre" }],
				sections: [{ kind: "hero", body: "h" }],
				revisionNote: "structured-note",
			},
			ACTOR,
		);
		expect(result.ok).toBe(true);
		const row = db
			.prepare("SELECT title, summary, seo_title FROM cms_route_variants WHERE id = ?")
			.get(variantId) as { title: string; summary: string; seo_title: string };
		expect(row.title).toBe("About Us");
		expect(row.seo_title).toBe("About — SEO");

		const rev = db
			.prepare(
				"SELECT snapshot_json, revision_note FROM cms_route_revisions WHERE variant_id = ? ORDER BY created_at DESC LIMIT 1",
			)
			.get(variantId) as { snapshot_json: string; revision_note: string };
		expect(rev.revision_note).toBe("structured-note");
		const snapshot = JSON.parse(rev.snapshot_json);
		// 272:21 ObjectLiteral {} would strip every field from the snapshot.
		expect(snapshot.title).toBe("About Us");
		expect(snapshot.summary).toBe("Our team");
		expect(snapshot.seoTitle).toBe("About — SEO");
		expect(snapshot.metaDescription).toBe("META");
		expect(snapshot.templateKey).toBe("about");
		expect(snapshot.alternateLinks).toEqual([{ locale: "es", path: "/es/sobre" }]);
		expect(snapshot.sections).toEqual([{ kind: "hero", body: "h" }]);
	});
});

describe("saveArchiveRoute drives persistArchiveRoute, appendArchiveRouteRevision", () => {
	it("persists archive variant and inserts revision snapshot with all archive fields (kills 305:27 BlockStatement {}, 330:34 BlockStatement {}, 337:21 ObjectLiteral {})", () => {
		const { sqliteCmsRouteRegistry } = freshStore();
		const { variantId } = seedArchiveRoute(db, "/blog");
		const result = sqliteCmsRouteRegistry.saveArchiveRoute(
			"/blog",
			{
				title: "Blog Archive",
				summary: "All posts",
				seoTitle: "Blog — SEO",
				metaDescription: "Blog meta",
				canonicalUrlOverride: null,
				robotsDirective: null,
				revisionNote: "archive-note",
			},
			ACTOR,
		);
		expect(result.ok).toBe(true);
		const row = db
			.prepare("SELECT title, summary, seo_title FROM cms_route_variants WHERE id = ?")
			.get(variantId) as { title: string; summary: string; seo_title: string };
		expect(row.title).toBe("Blog Archive");
		expect(row.seo_title).toBe("Blog — SEO");

		const rev = db
			.prepare(
				"SELECT snapshot_json, revision_note FROM cms_route_revisions WHERE variant_id = ? ORDER BY created_at DESC LIMIT 1",
			)
			.get(variantId) as { snapshot_json: string; revision_note: string };
		expect(rev.revision_note).toBe("archive-note");
		const snapshot = JSON.parse(rev.snapshot_json);
		expect(snapshot.title).toBe("Blog Archive");
		expect(snapshot.summary).toBe("All posts");
		expect(snapshot.seoTitle).toBe("Blog — SEO");
		expect(snapshot.metaDescription).toBe("Blog meta");
	});
});

describe("cmsRegistryModule wires through to the registry (kills 94:66 and 365:68 ObjectLiteral factory configs)", () => {
	it("getSystemRoute on the registry module returns the seeded route via normalizePath", () => {
		const { sqliteCmsRegistryModule } = freshStore();
		seedSystemRoute(db, { path: "/sitemap.xml", title: "S" });
		const route = sqliteCmsRegistryModule.getSystemRoute("/sitemap.xml");
		expect(route).not.toBeNull();
		expect(route?.title).toBe("S");
		// If the factory config 365:68 ObjectLiteral mutated to {}, getSystemRoute would be missing
		// and the call would throw a TypeError. If 94:66 mutated to {}, normalizePath / listSystemRoutes
		// would be undefined inside the registry and the call would throw before reaching the DB.
	});

	it("listArchiveRoutes returns seeded archive routes through the module", () => {
		const { sqliteCmsRegistryModule } = freshStore();
		seedArchiveRoute(db, "/news");
		const list = sqliteCmsRegistryModule.listArchiveRoutes();
		expect(list.length).toBe(1);
		expect(list[0].path).toBe("/news");
	});
});
