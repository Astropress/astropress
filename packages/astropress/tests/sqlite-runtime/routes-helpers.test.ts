import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { registerCms } from "../../src/config";
import {
	mapArchiveRow,
	mapStructuredPageRow,
	SQL_FIND_ARCHIVE_FOR_UPDATE,
	SQL_FIND_STRUCTURED_FOR_UPDATE,
	SQL_FIND_SYSTEM_FOR_UPDATE,
	SQL_GET_ARCHIVE,
	SQL_INSERT_ARCHIVE_REVISION,
	SQL_INSERT_REVISION,
	SQL_INSERT_ROUTE_GROUP,
	SQL_INSERT_ROUTE_VARIANT,
	SQL_IS_PATH_TAKEN,
	SQL_LIST_ARCHIVES,
	SQL_LIST_STRUCTURED,
	SQL_LIST_SYSTEM,
	SQL_PERSIST_ARCHIVE,
	SQL_PERSIST_STRUCTURED,
	SQL_PERSIST_SYSTEM,
} from "../../src/sqlite-runtime/routes-helpers";

describe("mapArchiveRow", () => {
	it("maps a fully-populated row to a normalized record", () => {
		const row = {
			path: "/blog",
			title: "Blog",
			summary: "All posts",
			seo_title: "Posts",
			meta_description: "All blog posts",
			canonical_url_override: "https://example.org/blog",
			robots_directive: "index, follow",
			updated_at: "2026-05-03T00:00:00Z",
		} as never;
		expect(mapArchiveRow(row)).toEqual({
			path: "/blog",
			title: "Blog",
			summary: "All posts",
			seoTitle: "Posts",
			metaDescription: "All blog posts",
			canonicalUrlOverride: "https://example.org/blog",
			robotsDirective: "index, follow",
			updatedAt: "2026-05-03T00:00:00Z",
		});
	});

	it("converts every nullable column to undefined when null", () => {
		const row = {
			path: "/blog",
			title: "Blog",
			summary: null,
			seo_title: null,
			meta_description: null,
			canonical_url_override: null,
			robots_directive: null,
			updated_at: null,
		} as never;
		expect(mapArchiveRow(row)).toEqual({
			path: "/blog",
			title: "Blog",
			summary: undefined,
			seoTitle: undefined,
			metaDescription: undefined,
			canonicalUrlOverride: undefined,
			robotsDirective: undefined,
			updatedAt: undefined,
		});
	});

	it("propagates path and title verbatim (StringLiteral pin)", () => {
		const row = {
			path: "/p1",
			title: "T1",
			summary: null,
			seo_title: null,
			meta_description: null,
			canonical_url_override: null,
			robots_directive: null,
			updated_at: null,
		} as never;
		const out = mapArchiveRow(row);
		expect(out.path).toBe("/p1");
		expect(out.title).toBe("T1");
	});
});

const CMS_CONFIG_KEY = Symbol.for("astropress.cms-config");
beforeEach(() => {
	registerCms({
		siteUrl: "https://example.org",
		templateKeys: ["content"],
		seedPages: [],
		archives: [],
	} as never);
});
afterEach(() => {
	(globalThis as typeof globalThis & { [CMS_CONFIG_KEY]?: unknown })[CMS_CONFIG_KEY] = null;
});

describe("mapStructuredPageRow", () => {
	const baseSettingsJson = JSON.stringify({
		templateKey: "content",
		alternateLinks: [{ hreflang: "es", href: "/es/x" }],
	});

	it("maps a structured row using settings JSON for templateKey + alternates", () => {
		const row = {
			path: "/x",
			title: "X",
			summary: "Sum",
			seo_title: "SEO",
			meta_description: "Desc",
			canonical_url_override: "https://example.org/x",
			robots_directive: "index, follow",
			og_image: "https://example.org/x.png",
			sections_json: JSON.stringify({ hero: { title: "H" } }),
			settings_json: baseSettingsJson,
			updated_at: "2026-05-03T00:00:00Z",
		} as never;
		const result = mapStructuredPageRow(row);
		expect(result).toEqual({
			path: "/x",
			title: "X",
			summary: "Sum",
			seoTitle: "SEO",
			metaDescription: "Desc",
			canonicalUrlOverride: "https://example.org/x",
			robotsDirective: "index, follow",
			ogImage: "https://example.org/x.png",
			templateKey: "content",
			alternateLinks: [{ hreflang: "es", href: "/es/x" }],
			sections: { hero: { title: "H" } },
			updatedAt: "2026-05-03T00:00:00Z",
		});
	});

	it("returns null when settings.templateKey is missing or invalid", () => {
		const row = {
			path: "/x",
			title: "X",
			summary: null,
			seo_title: null,
			meta_description: null,
			canonical_url_override: null,
			robots_directive: null,
			og_image: null,
			sections_json: null,
			settings_json: JSON.stringify({}),
			updated_at: null,
		} as never;
		expect(mapStructuredPageRow(row)).toBeNull();
	});

	it("defaults alternateLinks to [] when settings has no alternateLinks array", () => {
		const row = {
			path: "/x",
			title: "X",
			summary: null,
			seo_title: null,
			meta_description: null,
			canonical_url_override: null,
			robots_directive: null,
			og_image: null,
			sections_json: null,
			settings_json: JSON.stringify({ templateKey: "content" }),
			updated_at: null,
		} as never;
		expect(mapStructuredPageRow(row)?.alternateLinks).toEqual([]);
	});

	it("defaults alternateLinks to [] when settings.alternateLinks is not an array", () => {
		const row = {
			path: "/x",
			title: "X",
			summary: null,
			seo_title: null,
			meta_description: null,
			canonical_url_override: null,
			robots_directive: null,
			og_image: null,
			sections_json: null,
			settings_json: JSON.stringify({
				templateKey: "content",
				alternateLinks: "not-an-array",
			}),
			updated_at: null,
		} as never;
		expect(mapStructuredPageRow(row)?.alternateLinks).toEqual([]);
	});

	it("returns sections as null when sections_json is null", () => {
		const row = {
			path: "/x",
			title: "X",
			summary: null,
			seo_title: null,
			meta_description: null,
			canonical_url_override: null,
			robots_directive: null,
			og_image: null,
			sections_json: null,
			settings_json: baseSettingsJson,
			updated_at: null,
		} as never;
		expect(mapStructuredPageRow(row)?.sections).toBeNull();
	});

	it("converts every nullable column to undefined when null", () => {
		const row = {
			path: "/x",
			title: "X",
			summary: null,
			seo_title: null,
			meta_description: null,
			canonical_url_override: null,
			robots_directive: null,
			og_image: null,
			sections_json: null,
			settings_json: baseSettingsJson,
			updated_at: null,
		} as never;
		const out = mapStructuredPageRow(row);
		if (!out) throw new Error("expected row to map (templateKey is valid)");
		expect(out.summary).toBeUndefined();
		expect(out.seoTitle).toBeUndefined();
		expect(out.metaDescription).toBeUndefined();
		expect(out.canonicalUrlOverride).toBeUndefined();
		expect(out.robotsDirective).toBeUndefined();
		expect(out.ogImage).toBeUndefined();
		expect(out.updatedAt).toBeUndefined();
	});
});

describe("SQL constants", () => {
	// These string literals are sent verbatim to D1/SQLite — pin every one to
	// make StringLiteral mutations to "" or arbitrary text observable.
	const cases: [string, string, string[]][] = [
		[
			"SQL_LIST_SYSTEM",
			SQL_LIST_SYSTEM,
			["SELECT", "cms_route_variants", "kind = 'system'", "ORDER BY"],
		],
		[
			"SQL_LIST_STRUCTURED",
			SQL_LIST_STRUCTURED,
			["SELECT", "cms_route_variants", "render_strategy = 'structured_sections'", "ORDER BY"],
		],
		["SQL_GET_ARCHIVE", SQL_GET_ARCHIVE, ["SELECT", "kind = 'archive'", "v.path = ?", "LIMIT 1"]],
		["SQL_LIST_ARCHIVES", SQL_LIST_ARCHIVES, ["SELECT", "kind = 'archive'", "ORDER BY"]],
		[
			"SQL_FIND_SYSTEM_FOR_UPDATE",
			SQL_FIND_SYSTEM_FOR_UPDATE,
			["SELECT", "render_strategy", "kind = 'system'", "v.path = ?"],
		],
		["SQL_PERSIST_SYSTEM", SQL_PERSIST_SYSTEM, ["UPDATE", "WHERE id = ?"]],
		["SQL_INSERT_REVISION", SQL_INSERT_REVISION, ["INSERT INTO cms_route_revisions", "VALUES"]],
		["SQL_IS_PATH_TAKEN", SQL_IS_PATH_TAKEN, ["SELECT", "v.path = ?", "LIMIT 1"]],
		[
			"SQL_FIND_STRUCTURED_FOR_UPDATE",
			SQL_FIND_STRUCTURED_FOR_UPDATE,
			["SELECT", "render_strategy = 'structured_sections'", "v.path = ?"],
		],
		["SQL_INSERT_ROUTE_GROUP", SQL_INSERT_ROUTE_GROUP, ["INSERT INTO cms_route_groups", "VALUES"]],
		[
			"SQL_INSERT_ROUTE_VARIANT",
			SQL_INSERT_ROUTE_VARIANT,
			["INSERT INTO cms_route_variants", "VALUES"],
		],
		["SQL_PERSIST_STRUCTURED", SQL_PERSIST_STRUCTURED, ["UPDATE", "WHERE id = ?"]],
		[
			"SQL_FIND_ARCHIVE_FOR_UPDATE",
			SQL_FIND_ARCHIVE_FOR_UPDATE,
			["SELECT", "kind = 'archive'", "v.path = ?"],
		],
		["SQL_PERSIST_ARCHIVE", SQL_PERSIST_ARCHIVE, ["UPDATE", "WHERE id = ?"]],
		[
			"SQL_INSERT_ARCHIVE_REVISION",
			SQL_INSERT_ARCHIVE_REVISION,
			["INSERT INTO cms_route_revisions", "VALUES", "'en'"],
		],
	];
	it.each(cases)("%s contains expected keywords", (_name, sql, parts) => {
		for (const part of parts) {
			expect(sql).toContain(part);
		}
		expect(sql.length).toBeGreaterThan(20);
	});
});
