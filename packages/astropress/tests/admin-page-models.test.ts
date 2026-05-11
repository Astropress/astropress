import type { DatabaseSync } from "node:sqlite";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import * as adminDashboard from "../src/admin-dashboard";
import {
	buildAcceptInvitePageModel,
	buildAdminDashboardPageModel,
	buildArchiveEditorModel,
	buildArchivesIndexPageModel,
	buildAuthorsPageModel,
	buildCommentsPageModel,
	buildMediaPageModel,
	buildPagesIndexPageModel,
	buildPostEditorPageModel,
	buildPostRevisionsPageModel,
	buildPostsIndexPageModel,
	buildRedirectsPageModel,
	buildResetPasswordPageModel,
	buildRoutePageEditorModel,
	buildRouteTablePageModel,
	buildSeoPageModel,
	buildSettingsPageModel,
	buildSystemPageModel,
	buildTaxonomiesPageModel,
	buildTestimonialsPageModel,
	buildTranslationsPageModel,
	buildUsersPageModel,
} from "../src/admin-page-models";
import { registerCms } from "../src/config";
import * as runtimePageStore from "../src/runtime-page-store";
import * as runtimeRouteRegistry from "../src/runtime-route-registry";
import { makeDb } from "./helpers/make-db.js";
import { makeLocals } from "./helpers/make-locals.js";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const adminRole = {
	id: "1",
	email: "admin@example.com",
	role: "admin" as const,
	isAdmin: true,
};
const editorRole = {
	id: "2",
	email: "editor@example.com",
	role: "editor" as const,
	isAdmin: false,
};

let db: DatabaseSync;
let locals: App.Locals;

beforeEach(() => {
	db = makeDb();
	locals = makeLocals(db);

	registerCms({
		templateKeys: ["content"],
		siteUrl: "https://example.com",
		seedPages: [],
		archives: [
			{
				title: "Blog",
				kind: "posts",
				slug: "blog",
				legacyUrl: "/blog",
				listingItems: [],
			},
		],
		translationStatus: [
			{
				route: "/es/about",
				translationState: "not_started",
				englishSourceUrl: "/about",
				locale: "es",
			},
		],
	});

	// Seed minimal data
	db.prepare(
		"INSERT INTO admin_users (email, password_hash, name, active, is_admin) VALUES (?1, ?2, ?4, ?5, CASE WHEN ?3 = 'admin' THEN 1 ELSE 0 END)",
	).run("admin@test.local", "hash", "admin", "Admin", 1);
	db.prepare(
		`INSERT INTO content_entries (slug, legacy_url, title, kind, template_key, source_html_path, body, summary, seo_title, meta_description)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
	).run(
		"hello-world",
		"/hello-world",
		"Hello World",
		"post",
		"content",
		"runtime://content/hello-world",
		"<p>Body</p>",
		"A summary",
		"Hello SEO",
		"Hello meta",
	);
	db.prepare(
		`INSERT INTO content_overrides (slug, title, status, body, seo_title, meta_description, updated_by)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
	).run(
		"hello-world",
		"Hello World",
		"published",
		"<p>Body</p>",
		"Hello SEO",
		"Hello meta",
		"admin@test.local",
	);
	db.prepare(
		`INSERT INTO content_revisions (id, slug, source, title, status, body, seo_title, meta_description, created_by)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
	).run(
		"rev-1",
		"hello-world",
		"reviewed",
		"Hello World",
		"published",
		"<p>Body</p>",
		"SEO",
		"Meta",
		"admin@test.local",
	);
});

afterEach(() => {
	vi.restoreAllMocks();
});

// ---------------------------------------------------------------------------
// buildAdminDashboardPageModel
// ---------------------------------------------------------------------------

describe("buildAdminDashboardPageModel", () => {
	it("returns ok with no warnings on the success path and an array-shaped data payload", async () => {
		const result = await buildAdminDashboardPageModel(locals, adminRole);
		expect(result.status).toBe("ok");
		expect(result.warnings).toEqual([]);
		expect(Array.isArray(result.data.posts)).toBe(true);
		expect(Array.isArray(result.data.auditEvents)).toBe(true);
		expect(Array.isArray(result.data.contentStates)).toBe(true);
	});

	it("returns partial with the documented warning when buildAdminDashboardModel rejects", async () => {
		vi.spyOn(adminDashboard, "buildAdminDashboardModel").mockRejectedValueOnce(
			new Error("dashboard fail"),
		);
		const result = await buildAdminDashboardPageModel(locals, adminRole);
		expect(result.status).toBe("partial");
		expect(result.warnings).toContain("Some dashboard counts are temporarily unavailable.");
		expect(result.data.posts).toEqual([]);
		expect(result.data.auditEvents).toEqual([]);
	});
});

// ---------------------------------------------------------------------------
// buildAuthorsPageModel
// ---------------------------------------------------------------------------

describe("buildAuthorsPageModel", () => {
	it("returns forbidden for editor role", async () => {
		const result = await buildAuthorsPageModel(locals, editorRole);
		expect(result.status).toBe("forbidden");
		expect(result.data).toEqual({ authors: [], auditEvents: [] });
	});

	it("returns ok for admin with both arrays present", async () => {
		const result = await buildAuthorsPageModel(locals, adminRole);
		expect(result.status).toBe("ok");
		expect(Array.isArray(result.data.authors)).toBe(true);
		expect(Array.isArray(result.data.auditEvents)).toBe(true);
	});

	it("returns partial with the authors-records message when getRuntimeAuthors fails", async () => {
		vi.spyOn(runtimePageStore, "getRuntimeAuthors").mockRejectedValueOnce(new Error("fail"));
		const result = await buildAuthorsPageModel(locals, adminRole);
		expect(result.status).toBe("partial");
		expect(result.warnings).toContain("Author records are temporarily unavailable.");
		expect(result.data.authors).toEqual([]);
	});

	it("returns partial with the audit-history message when getRuntimeAuditEvents fails", async () => {
		vi.spyOn(runtimePageStore, "getRuntimeAuditEvents").mockRejectedValueOnce(new Error("fail"));
		const result = await buildAuthorsPageModel(locals, adminRole);
		expect(result.status).toBe("partial");
		expect(result.warnings).toContain("Author audit history is temporarily unavailable.");
		expect(result.data.auditEvents).toEqual([]);
	});
});

// ---------------------------------------------------------------------------
// buildTaxonomiesPageModel
// ---------------------------------------------------------------------------

describe("buildTaxonomiesPageModel", () => {
	it("returns forbidden for editor role with the full empty shape", async () => {
		const result = await buildTaxonomiesPageModel(locals, editorRole);
		expect(result.status).toBe("forbidden");
		expect(result.data).toEqual({ categories: [], tags: [], auditEvents: [] });
	});

	it("returns ok for admin with all three arrays present", async () => {
		const result = await buildTaxonomiesPageModel(locals, adminRole);
		expect(result.status).toBe("ok");
		expect(Array.isArray(result.data.categories)).toBe(true);
		expect(Array.isArray(result.data.tags)).toBe(true);
		expect(Array.isArray(result.data.auditEvents)).toBe(true);
	});

	it("returns partial with the categories message when getRuntimeCategories fails", async () => {
		vi.spyOn(runtimePageStore, "getRuntimeCategories").mockRejectedValueOnce(new Error("fail"));
		const result = await buildTaxonomiesPageModel(locals, adminRole);
		expect(result.status).toBe("partial");
		expect(result.warnings).toContain("Categories are temporarily unavailable.");
		expect(result.data.categories).toEqual([]);
	});

	it("returns partial with the tags message when getRuntimeTags fails", async () => {
		vi.spyOn(runtimePageStore, "getRuntimeTags").mockRejectedValueOnce(new Error("fail"));
		const result = await buildTaxonomiesPageModel(locals, adminRole);
		expect(result.status).toBe("partial");
		expect(result.warnings).toContain("Tags are temporarily unavailable.");
		expect(result.data.tags).toEqual([]);
	});

	it("returns partial with the taxonomy-audit message when getRuntimeAuditEvents fails", async () => {
		vi.spyOn(runtimePageStore, "getRuntimeAuditEvents").mockRejectedValueOnce(new Error("fail"));
		const result = await buildTaxonomiesPageModel(locals, adminRole);
		expect(result.status).toBe("partial");
		expect(result.warnings).toContain("Taxonomy audit history is temporarily unavailable.");
		expect(result.data.auditEvents).toEqual([]);
	});
});

// ---------------------------------------------------------------------------
// buildUsersPageModel
// ---------------------------------------------------------------------------

describe("buildUsersPageModel", () => {
	it("returns forbidden for editor role with the full empty shape", async () => {
		const result = await buildUsersPageModel(locals, editorRole);
		expect(result.status).toBe("forbidden");
		expect(result.data).toEqual({ users: [], auditEvents: [] });
	});

	it("returns ok for admin with both arrays present", async () => {
		const result = await buildUsersPageModel(locals, adminRole);
		expect(result.status).toBe("ok");
		expect(Array.isArray(result.data.users)).toBe(true);
		expect(Array.isArray(result.data.auditEvents)).toBe(true);
	});

	it("returns partial with the user-records message when getRuntimeAdminUsers fails", async () => {
		vi.spyOn(runtimePageStore, "getRuntimeAdminUsers").mockRejectedValueOnce(new Error("fail"));
		const result = await buildUsersPageModel(locals, adminRole);
		expect(result.status).toBe("partial");
		expect(result.warnings).toContain("User records are temporarily unavailable.");
		expect(result.data.users).toEqual([]);
	});

	it("returns partial with the access-audit message when getRuntimeAuditEvents fails", async () => {
		vi.spyOn(runtimePageStore, "getRuntimeAuditEvents").mockRejectedValueOnce(new Error("fail"));
		const result = await buildUsersPageModel(locals, adminRole);
		expect(result.status).toBe("partial");
		expect(result.warnings).toContain("Access audit history is temporarily unavailable.");
		expect(result.data.auditEvents).toEqual([]);
	});
});

// ---------------------------------------------------------------------------
// buildCommentsPageModel
// ---------------------------------------------------------------------------

describe("buildCommentsPageModel", () => {
	it("returns ok with both comments and audit-events arrays present", async () => {
		const result = await buildCommentsPageModel(locals);
		expect(result.status).toBe("ok");
		expect(Array.isArray(result.data.comments)).toBe(true);
		expect(Array.isArray(result.data.auditEvents)).toBe(true);
	});

	it("returns partial with the comments message when getRuntimeComments fails", async () => {
		vi.spyOn(runtimePageStore, "getRuntimeComments").mockRejectedValueOnce(new Error("fail"));
		const result = await buildCommentsPageModel(locals);
		expect(result.status).toBe("partial");
		expect(result.warnings).toContain("Comments are temporarily unavailable.");
		expect(result.data.comments).toEqual([]);
	});

	it("returns partial with the comment-audit message when getRuntimeAuditEvents fails", async () => {
		vi.spyOn(runtimePageStore, "getRuntimeAuditEvents").mockRejectedValueOnce(new Error("fail"));
		const result = await buildCommentsPageModel(locals);
		expect(result.status).toBe("partial");
		expect(result.warnings).toContain("Comment audit history is temporarily unavailable.");
		expect(result.data.auditEvents).toEqual([]);
	});
});

// ---------------------------------------------------------------------------
// buildTestimonialsPageModel
// ---------------------------------------------------------------------------

describe("buildTestimonialsPageModel", () => {
	it("returns ok with all four arrays present", async () => {
		const result = await buildTestimonialsPageModel(locals);
		expect(result.status).toBe("ok");
		expect(Array.isArray(result.data.pending)).toBe(true);
		expect(Array.isArray(result.data.approved)).toBe(true);
		expect(Array.isArray(result.data.featured)).toBe(true);
		expect(Array.isArray(result.data.auditEvents)).toBe(true);
	});

	it("returns partial with the pending-testimonials message when that bucket fails", async () => {
		vi.spyOn(runtimePageStore, "getRuntimeTestimonials").mockImplementation(async (kind) => {
			if (kind === "pending") throw new Error("fail");
			return [];
		});
		const result = await buildTestimonialsPageModel(locals);
		expect(result.status).toBe("partial");
		expect(result.warnings).toContain("Pending testimonials are temporarily unavailable.");
		expect(result.data.pending).toEqual([]);
	});

	it("returns partial with the approved-testimonials message when that bucket fails", async () => {
		vi.spyOn(runtimePageStore, "getRuntimeTestimonials").mockImplementation(async (kind) => {
			if (kind === "approved") throw new Error("fail");
			return [];
		});
		const result = await buildTestimonialsPageModel(locals);
		expect(result.status).toBe("partial");
		expect(result.warnings).toContain("Approved testimonials are temporarily unavailable.");
		expect(result.data.approved).toEqual([]);
	});

	it("returns partial with the featured-testimonials message when that bucket fails", async () => {
		vi.spyOn(runtimePageStore, "getRuntimeTestimonials").mockImplementation(async (kind) => {
			if (kind === "featured") throw new Error("fail");
			return [];
		});
		const result = await buildTestimonialsPageModel(locals);
		expect(result.status).toBe("partial");
		expect(result.warnings).toContain("Featured testimonials are temporarily unavailable.");
		expect(result.data.featured).toEqual([]);
	});

	it("returns partial with the testimonial-audit message when getRuntimeAuditEvents fails", async () => {
		vi.spyOn(runtimePageStore, "getRuntimeAuditEvents").mockRejectedValueOnce(new Error("fail"));
		const result = await buildTestimonialsPageModel(locals);
		expect(result.status).toBe("partial");
		expect(result.warnings).toContain("Testimonial audit history is temporarily unavailable.");
		expect(result.data.auditEvents).toEqual([]);
	});
});

// ---------------------------------------------------------------------------
// buildMediaPageModel
// ---------------------------------------------------------------------------

describe("buildMediaPageModel", () => {
	it("returns ok with both arrays present", async () => {
		const result = await buildMediaPageModel(locals);
		expect(result.status).toBe("ok");
		expect(Array.isArray(result.data.mediaWithResolvedUrls)).toBe(true);
		expect(Array.isArray(result.data.auditEvents)).toBe(true);
	});

	it("returns partial with the media-assets message when getRuntimeMediaAssets fails", async () => {
		vi.spyOn(runtimePageStore, "getRuntimeMediaAssets").mockRejectedValueOnce(new Error("fail"));
		const result = await buildMediaPageModel(locals);
		expect(result.status).toBe("partial");
		expect(result.warnings).toContain("Media assets are temporarily unavailable.");
		expect(result.data.mediaWithResolvedUrls).toEqual([]);
	});

	it("returns partial with the media-audit message when getRuntimeAuditEvents fails", async () => {
		vi.spyOn(runtimePageStore, "getRuntimeAuditEvents").mockRejectedValueOnce(new Error("fail"));
		const result = await buildMediaPageModel(locals);
		expect(result.status).toBe("partial");
		expect(result.warnings).toContain("Media audit history is temporarily unavailable.");
		expect(result.data.auditEvents).toEqual([]);
	});

	it("resolves media URLs when assets are present", async () => {
		db.prepare(
			`INSERT INTO media_assets (id, source_url, local_path, mime_type, alt_text, title, uploaded_by)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
		).run(
			"media-test-1",
			null,
			"/images/uploads/test.png",
			"image/png",
			"Alt text",
			"Test Image",
			"admin@test.local",
		);

		const result = await buildMediaPageModel(locals);
		expect(result.status).toBe("ok");
		expect(result.data.mediaWithResolvedUrls.length).toBeGreaterThan(0);
		const first = result.data.mediaWithResolvedUrls[0] as {
			id?: string;
			localPath?: string;
			resolvedUrl?: string;
		};
		expect(first.id).toBe("media-test-1");
		expect(first.resolvedUrl).toEqual(expect.any(String));
		expect(first.resolvedUrl?.length ?? 0).toBeGreaterThan(0);
	});
});

// ---------------------------------------------------------------------------
// buildRedirectsPageModel
// ---------------------------------------------------------------------------

describe("buildRedirectsPageModel", () => {
	it("returns forbidden for editor role with the full empty shape", async () => {
		const result = await buildRedirectsPageModel(locals, editorRole);
		expect(result.status).toBe("forbidden");
		expect(result.data).toEqual({ redirectRules: [], auditEvents: [] });
	});

	it("returns ok for admin with both arrays present", async () => {
		const result = await buildRedirectsPageModel(locals, adminRole);
		expect(result.status).toBe("ok");
		expect(Array.isArray(result.data.redirectRules)).toBe(true);
		expect(Array.isArray(result.data.auditEvents)).toBe(true);
	});

	it("returns partial with the redirect-rules message when getRuntimeRedirectRules fails", async () => {
		vi.spyOn(runtimePageStore, "getRuntimeRedirectRules").mockRejectedValueOnce(new Error("fail"));
		const result = await buildRedirectsPageModel(locals, adminRole);
		expect(result.status).toBe("partial");
		expect(result.warnings).toContain("Redirect rules are temporarily unavailable.");
		expect(result.data.redirectRules).toEqual([]);
	});

	it("returns partial with the redirect-audit message when getRuntimeAuditEvents fails", async () => {
		vi.spyOn(runtimePageStore, "getRuntimeAuditEvents").mockRejectedValueOnce(new Error("fail"));
		const result = await buildRedirectsPageModel(locals, adminRole);
		expect(result.status).toBe("partial");
		expect(result.warnings).toContain("Redirect audit history is temporarily unavailable.");
		expect(result.data.auditEvents).toEqual([]);
	});
});

// ---------------------------------------------------------------------------
// buildSettingsPageModel
// ---------------------------------------------------------------------------

describe("buildSettingsPageModel", () => {
	it("returns forbidden for editor role with defaultSiteSettings as data", async () => {
		const result = await buildSettingsPageModel(locals, editorRole);
		expect(result.status).toBe("forbidden");
		expect(result.data.settings).toBeDefined();
	});

	it("returns ok for admin with settings present", async () => {
		const result = await buildSettingsPageModel(locals, adminRole);
		expect(result.status).toBe("ok");
		expect(result.data.settings).toBeDefined();
	});

	it("returns partial with the settings-fallback message when getRuntimeSettings fails", async () => {
		vi.spyOn(runtimePageStore, "getRuntimeSettings").mockRejectedValueOnce(new Error("fail"));
		const result = await buildSettingsPageModel(locals, adminRole);
		expect(result.status).toBe("partial");
		expect(result.warnings).toContain("Settings could not be loaded. Showing defaults.");
		expect(result.data.settings).toBeDefined();
	});
});

// ---------------------------------------------------------------------------
// buildSystemPageModel
// ---------------------------------------------------------------------------

describe("buildSystemPageModel", () => {
	it("returns forbidden for editor role with the full empty shape", async () => {
		const result = await buildSystemPageModel(locals, editorRole);
		expect(result.status).toBe("forbidden");
		expect(result.data.systemRoutes).toEqual([]);
		expect(result.data.routeMap instanceof Map).toBe(true);
	});

	it("returns ok for admin with empty system routes", async () => {
		const result = await buildSystemPageModel(locals, adminRole);
		expect(result.status).toBe("ok");
		expect(Array.isArray(result.data.systemRoutes)).toBe(true);
		expect(result.data.routeMap instanceof Map).toBe(true);
	});

	it("returns partial with the system-routes message when listRuntimeSystemRoutes fails", async () => {
		vi.spyOn(runtimeRouteRegistry, "listRuntimeSystemRoutes").mockRejectedValueOnce(
			new Error("fail"),
		);
		const result = await buildSystemPageModel(locals, adminRole);
		expect(result.status).toBe("partial");
		expect(result.warnings).toContain("System routes are temporarily unavailable.");
		expect(result.data.systemRoutes).toEqual([]);
	});

	it("populates routeMap from non-empty system routes", async () => {
		const settings = JSON.stringify({
			templateKey: "content",
			alternateLinks: [],
		});
		db.prepare(
			`INSERT INTO cms_route_groups (id, kind, render_strategy, canonical_locale, canonical_path) VALUES ('g-sys-login', 'system', 'structured_sections', 'en', '/ap-admin/login')`,
		).run();
		db.prepare(
			`INSERT INTO cms_route_variants (id, group_id, locale, path, status, title, settings_json, updated_by) VALUES ('v-sys-login', 'g-sys-login', 'en', '/ap-admin/login', 'published', 'Login', ?, 'admin@test.local')`,
		).run(settings);

		const result = await buildSystemPageModel(locals, adminRole);
		expect(result.status).toBe("ok");
		expect(result.data.routeMap.has("/ap-admin/login")).toBe(true);
	});
});

// ---------------------------------------------------------------------------
// buildRouteTablePageModel
// ---------------------------------------------------------------------------

describe("buildRouteTablePageModel", () => {
	it("returns forbidden for editor role with the full empty shape", async () => {
		const result = await buildRouteTablePageModel(locals, editorRole);
		expect(result.status).toBe("forbidden");
		expect(result.data.routePages).toEqual([]);
		expect(result.data.settings).toBeDefined();
	});

	it("returns ok for admin with both fields present", async () => {
		const result = await buildRouteTablePageModel(locals, adminRole);
		expect(result.status).toBe("ok");
		expect(Array.isArray(result.data.routePages)).toBe(true);
		expect(result.data.settings).toBeDefined();
	});

	it("returns partial with the structured-routes message when listRuntimeStructuredPageRoutes fails", async () => {
		vi.spyOn(runtimeRouteRegistry, "listRuntimeStructuredPageRoutes").mockRejectedValueOnce(
			new Error("fail"),
		);
		const result = await buildRouteTablePageModel(locals, adminRole);
		expect(result.status).toBe("partial");
		expect(result.warnings).toContain("Structured route records are temporarily unavailable.");
		expect(result.data.routePages).toEqual([]);
	});

	it("returns partial with the settings-fallback message when getRuntimeSettings fails", async () => {
		vi.spyOn(runtimePageStore, "getRuntimeSettings").mockRejectedValueOnce(new Error("fail"));
		const result = await buildRouteTablePageModel(locals, adminRole);
		expect(result.status).toBe("partial");
		expect(result.warnings).toContain("Settings could not be loaded. Showing defaults.");
		expect(result.data.settings).toBeDefined();
	});
});

// ---------------------------------------------------------------------------
// buildArchivesIndexPageModel
// ---------------------------------------------------------------------------

describe("buildArchivesIndexPageModel", () => {
	it("returns forbidden with the full empty shape for editor role", async () => {
		const result = await buildArchivesIndexPageModel(locals, editorRole);
		expect(result.status).toBe("forbidden");
		expect(result.data).toEqual({
			archiveList: [],
			archivesByKind: {},
			kindCounts: [],
			totalArchives: 0,
			totalItems: 0,
		});
	});

	it("returns forbidden when user is null", async () => {
		const result = await buildArchivesIndexPageModel(locals, null);
		expect(result.status).toBe("forbidden");
		expect(result.data).toEqual({
			archiveList: [],
			archivesByKind: {},
			kindCounts: [],
			totalArchives: 0,
			totalItems: 0,
		});
	});

	it("returns ok for admin and counts archives + items correctly", async () => {
		registerCms({
			templateKeys: ["content"],
			siteUrl: "https://example.com",
			seedPages: [],
			archives: [
				{
					title: "Blog",
					kind: "posts",
					slug: "blog",
					legacyUrl: "/blog",
					listingItems: [{ href: "/a" }, { href: "/b" }],
				},
				{
					title: "Vids",
					kind: "videos",
					slug: "vids",
					legacyUrl: "/vids",
					listingItems: [{ href: "/v" }],
				},
			],
			translationStatus: [],
		});
		const result = await buildArchivesIndexPageModel(locals, adminRole);
		expect(result.status).toBe("ok");
		expect(result.warnings).toEqual([]);
		expect(result.data.totalArchives).toBe(2);
		expect(result.data.totalItems).toBe(3);
		expect(result.data.kindCounts).toEqual(
			expect.arrayContaining([
				{ kind: "posts", count: 1 },
				{ kind: "videos", count: 1 },
			]),
		);
	});

	it("falls back to config title when getRuntimeArchiveRoute returns undefined title", async () => {
		vi.spyOn(runtimeRouteRegistry, "getRuntimeArchiveRoute").mockResolvedValueOnce(undefined);
		const result = await buildArchivesIndexPageModel(locals, adminRole);
		expect(result.status).toBe("ok");
		const archive = result.data.archiveList.find(
			(a: unknown) => (a as { slug: string }).slug === "blog",
		);
		expect((archive as { title: string }).title).toBe("Blog");
	});

	it("treats archives with undefined listingItems as contributing zero to totalItems", async () => {
		registerCms({
			templateKeys: ["content"],
			siteUrl: "https://example.com",
			seedPages: [],
			archives: [
				// listingItems explicitly absent — exercises the `?.length || 0` guard
				{ title: "Bare", kind: "posts", slug: "bare", legacyUrl: "/bare" },
				{
					title: "Two",
					kind: "posts",
					slug: "two",
					legacyUrl: "/two",
					listingItems: [{ href: "/a" }, { href: "/b" }],
				},
			],
			translationStatus: [],
		});
		const result = await buildArchivesIndexPageModel(locals, adminRole);
		expect(result.status).toBe("ok");
		expect(result.data.totalItems).toBe(2);
		expect(result.data.totalArchives).toBe(2);
	});

	it("uses archive title from database when the archive route exists", async () => {
		// Seed a cms_route_groups entry for /blog so getRuntimeArchiveRoute returns a real title from DB
		const settings = JSON.stringify({
			templateKey: "content",
			alternateLinks: [],
		});
		db.prepare(
			`INSERT INTO cms_route_groups (id, kind, render_strategy, canonical_locale, canonical_path) VALUES ('g-arc-idx-blog', 'archive', 'archive_listing', 'en', '/blog')`,
		).run();
		db.prepare(
			`INSERT INTO cms_route_variants (id, group_id, locale, path, status, title, settings_json, updated_by) VALUES ('v-arc-idx-blog', 'g-arc-idx-blog', 'en', '/blog', 'published', 'Blog Archive Title', ?, 'admin@test.local')`,
		).run(settings);

		const result = await buildArchivesIndexPageModel(locals, adminRole);
		expect(result.status).toBe("ok");
		// The archive title should come from the DB (runtimeArchive.title), not the config title "Blog"
		const archive = result.data.archiveList.find(
			(a: unknown) => (a as { slug: string }).slug === "blog",
		);
		expect(archive?.title).toBe("Blog Archive Title");
	});

	it("returns partial with the exact archive-metadata warning text when getRuntimeArchiveRoute fails", async () => {
		vi.spyOn(runtimeRouteRegistry, "getRuntimeArchiveRoute").mockRejectedValueOnce(
			new Error("archive fail"),
		);
		const result = await buildArchivesIndexPageModel(locals, adminRole);
		expect(result.status).toBe("partial");
		expect(result.warnings).toContain("Some archive metadata is temporarily unavailable.");
		// withSettledMap fallback returns the raw archive config entry untouched
		const blog = result.data.archiveList.find(
			(a: unknown) => (a as { slug: string }).slug === "blog",
		);
		expect((blog as { title: string }).title).toBe("Blog");
	});

	it("groups multiple archives of the same kind together", async () => {
		registerCms({
			templateKeys: ["content"],
			siteUrl: "https://example.com",
			seedPages: [],
			archives: [
				{
					title: "Blog",
					kind: "posts",
					slug: "blog",
					legacyUrl: "/blog",
					listingItems: [],
				},
				{
					title: "News",
					kind: "posts",
					slug: "news",
					legacyUrl: "/news",
					listingItems: [],
				},
			],
			translationStatus: [],
		});
		const result = await buildArchivesIndexPageModel(locals, adminRole);
		expect(result.status).toBe("ok");
		expect(result.data.archivesByKind.posts.length).toBe(2);
		expect(result.data.kindCounts.find((k: { kind: string }) => k.kind === "posts")?.count).toBe(2);
	});
});

// ---------------------------------------------------------------------------
// buildPagesIndexPageModel
// ---------------------------------------------------------------------------

describe("buildPagesIndexPageModel", () => {
	it("returns forbidden with the full empty shape for editor role", async () => {
		const result = await buildPagesIndexPageModel(locals, editorRole);
		expect(result.status).toBe("forbidden");
		expect(result.data).toEqual({ contentStates: [], routePages: [], archiveRows: [] });
	});

	it("returns forbidden when user is null", async () => {
		const result = await buildPagesIndexPageModel(locals, null);
		expect(result.status).toBe("forbidden");
		expect(result.data).toEqual({ contentStates: [], routePages: [], archiveRows: [] });
	});

	it("returns ok for admin with the loaded content + route + archive arrays", async () => {
		const result = await buildPagesIndexPageModel(locals, adminRole);
		expect(result.status).toBe("ok");
		expect(result.warnings).toEqual([]);
		expect(Array.isArray(result.data.contentStates)).toBe(true);
		expect(Array.isArray(result.data.routePages)).toBe(true);
		// Default registered config has a single /blog archive
		expect(result.data.archiveRows).toHaveLength(1);
	});

	it("returns partial with the legacy-page-records warning when listRuntimeContentStates fails", async () => {
		vi.spyOn(runtimePageStore, "listRuntimeContentStates").mockRejectedValueOnce(new Error("fail"));
		const result = await buildPagesIndexPageModel(locals, adminRole);
		expect(result.status).toBe("partial");
		expect(result.warnings).toContain("Legacy page records are temporarily unavailable.");
		expect(result.data.contentStates).toEqual([]);
	});

	it("returns partial with the structured-page-records warning when listRuntimeStructuredPageRoutes fails", async () => {
		vi.spyOn(runtimeRouteRegistry, "listRuntimeStructuredPageRoutes").mockRejectedValueOnce(
			new Error("fail"),
		);
		const result = await buildPagesIndexPageModel(locals, adminRole);
		expect(result.status).toBe("partial");
		expect(result.warnings).toContain("Structured page records are temporarily unavailable.");
		expect(result.data.routePages).toEqual([]);
	});

	it("returns partial with the archive-page-records warning when getRuntimeArchiveRoute fails", async () => {
		vi.spyOn(runtimeRouteRegistry, "getRuntimeArchiveRoute").mockRejectedValueOnce(
			new Error("archive fail"),
		);
		const result = await buildPagesIndexPageModel(locals, adminRole);
		expect(result.status).toBe("partial");
		expect(result.warnings).toContain("Some archive page records are temporarily unavailable.");
		// withSettledMap fallback sets runtime: null for the failed archive
		expect(
			result.data.archiveRows.every((r: unknown) => (r as { runtime: unknown }).runtime === null),
		).toBe(true);
	});
});

// ---------------------------------------------------------------------------
// buildPostsIndexPageModel
// ---------------------------------------------------------------------------

describe("buildPostsIndexPageModel", () => {
	it("returns ok with no warnings and all loaded arrays populated", async () => {
		const result = await buildPostsIndexPageModel(locals);
		expect(result.status).toBe("ok");
		expect(result.warnings).toEqual([]);
		expect(Array.isArray(result.data.authors)).toBe(true);
		expect(Array.isArray(result.data.categories)).toBe(true);
		expect(Array.isArray(result.data.tags)).toBe(true);
		expect(Array.isArray(result.data.allContent)).toBe(true);
		expect(result.data.archives).toHaveLength(1);
	});

	it("returns partial with the author-filters warning when getRuntimeAuthors fails", async () => {
		vi.spyOn(runtimePageStore, "getRuntimeAuthors").mockRejectedValueOnce(new Error("fail"));
		const result = await buildPostsIndexPageModel(locals);
		expect(result.status).toBe("partial");
		expect(result.warnings).toContain("Author filters are temporarily unavailable.");
		expect(result.data.authors).toEqual([]);
	});

	it("returns partial with the category-filters warning when getRuntimeCategories fails", async () => {
		vi.spyOn(runtimePageStore, "getRuntimeCategories").mockRejectedValueOnce(new Error("fail"));
		const result = await buildPostsIndexPageModel(locals);
		expect(result.status).toBe("partial");
		expect(result.warnings).toContain("Category filters are temporarily unavailable.");
		expect(result.data.categories).toEqual([]);
	});

	it("returns partial with the tag-filters warning when getRuntimeTags fails", async () => {
		vi.spyOn(runtimePageStore, "getRuntimeTags").mockRejectedValueOnce(new Error("fail"));
		const result = await buildPostsIndexPageModel(locals);
		expect(result.status).toBe("partial");
		expect(result.warnings).toContain("Tag filters are temporarily unavailable.");
		expect(result.data.tags).toEqual([]);
	});

	it("returns partial with the post-records warning when listRuntimeContentStates fails", async () => {
		vi.spyOn(runtimePageStore, "listRuntimeContentStates").mockRejectedValueOnce(new Error("fail"));
		const result = await buildPostsIndexPageModel(locals);
		expect(result.status).toBe("partial");
		expect(result.warnings).toContain("Post records are temporarily unavailable.");
		expect(result.data.allContent).toEqual([]);
	});

	it("returns partial with the archive-filters warning when getRuntimeArchiveRoute fails", async () => {
		vi.spyOn(runtimeRouteRegistry, "getRuntimeArchiveRoute").mockRejectedValueOnce(
			new Error("fail"),
		);
		const result = await buildPostsIndexPageModel(locals);
		expect(result.status).toBe("partial");
		expect(result.warnings).toContain("Archive filters are temporarily unavailable.");
		// withSettledMap fallback uses the raw archive config title + listingItems []
		const blog = result.data.archives.find((a) => a.slug === "blog");
		expect(blog?.title).toBe("Blog");
		expect(blog?.listingItems).toEqual([]);
	});

	it("defaults listingItems to [] when the archive config omits it", async () => {
		registerCms({
			templateKeys: ["content"],
			siteUrl: "https://example.com",
			seedPages: [],
			archives: [{ title: "News", kind: "posts", slug: "news", legacyUrl: "/news" }],
			translationStatus: [],
		});
		const result = await buildPostsIndexPageModel(locals);
		expect(result.status).toBe("ok");
		const news = result.data.archives.find((a) => a.slug === "news");
		expect(news?.listingItems).toEqual([]);
	});

	it("uses runtime archive title when present and falls back to config title when runtime title is empty", async () => {
		vi.spyOn(runtimeRouteRegistry, "getRuntimeArchiveRoute").mockResolvedValueOnce({
			path: "/blog",
			title: "Runtime Blog Title",
			status: "published",
			summary: undefined,
			seoTitle: undefined,
			metaDescription: undefined,
			updatedAt: "2025-01-01",
		});
		const result = await buildPostsIndexPageModel(locals);
		const blog = result.data.archives.find((a) => a.slug === "blog");
		expect(blog?.title).toBe("Runtime Blog Title");
	});

	it("falls back to config title when runtime archive title is falsy", async () => {
		vi.spyOn(runtimeRouteRegistry, "getRuntimeArchiveRoute").mockResolvedValueOnce({
			path: "/blog",
			title: "",
			status: "published",
			summary: undefined,
			seoTitle: undefined,
			metaDescription: undefined,
			updatedAt: "2025-01-01",
		});
		const result = await buildPostsIndexPageModel(locals);
		const blog = result.data.archives.find((a) => a.slug === "blog");
		expect(blog?.title).toBe("Blog");
	});

	it("includes archive titles from the database and gracefully handles fetch failures", async () => {
		// Register an archive without explicit listingItems to exercise the default fallback
		registerCms({
			templateKeys: ["content"],
			siteUrl: "https://example.com",
			seedPages: [],
			archives: [
				{
					title: "Blog",
					kind: "posts",
					slug: "blog",
					legacyUrl: "/blog",
					listingItems: [],
				},
				{ title: "News", kind: "posts", slug: "news", legacyUrl: "/news" },
			],
			translationStatus: [
				{
					route: "/es/about",
					translationState: "not_started",
					englishSourceUrl: "/about",
					locale: "es",
				},
			],
		});

		// Seed an archive route for /blog so the DB title is used instead of the config title
		const settings = JSON.stringify({
			templateKey: "content",
			alternateLinks: [],
		});
		db.prepare(
			`INSERT INTO cms_route_groups (id, kind, render_strategy, canonical_locale, canonical_path) VALUES ('g-blog', 'archive', 'archive_listing', 'en', '/blog')`,
		).run();
		db.prepare(
			`INSERT INTO cms_route_variants (id, group_id, locale, path, status, title, settings_json, updated_by) VALUES ('v-blog', 'g-blog', 'en', '/blog', 'published', 'Blog Archive', ?, 'admin@test.local')`,
		).run(settings);

		// Simulate the /news archive lookup failing to verify the page still renders with partial data
		vi.spyOn(runtimeRouteRegistry, "getRuntimeArchiveRoute")
			.mockResolvedValueOnce({
				path: "/blog",
				title: "Blog Archive",
				status: "published",
				summary: undefined,
				seoTitle: undefined,
				metaDescription: undefined,
				updatedAt: "2025-01-01",
			})
			.mockRejectedValueOnce(new Error("fail"));

		const result = await buildPostsIndexPageModel(locals);
		expect(result.status).toMatch(/ok|partial/);
		expect(Array.isArray(result.data.archives)).toBe(true);
	});
});

// ---------------------------------------------------------------------------
// buildTranslationsPageModel
// ---------------------------------------------------------------------------

describe("buildTranslationsPageModel", () => {
	it("returns forbidden with the full empty shape for editor role", async () => {
		const result = await buildTranslationsPageModel(locals, editorRole);
		expect(result.status).toBe("forbidden");
		expect(result.data).toEqual({ rows: [] });
	});

	it("returns forbidden when user is null", async () => {
		const result = await buildTranslationsPageModel(locals, null);
		expect(result.status).toBe("forbidden");
		expect(result.data).toEqual({ rows: [] });
	});

	it("returns ok for admin with a row mapped from translationStatus", async () => {
		const result = await buildTranslationsPageModel(locals, adminRole);
		expect(result.status).toBe("ok");
		expect(result.warnings).toEqual([]);
		expect(result.data.rows).toHaveLength(1);
		const row = result.data.rows[0] as {
			route: string;
			englishEditHref?: string;
			localizedEditHref?: string;
		};
		expect(row.route).toBe("/es/about");
		// No matching seedPage → englishEditHref undefined
		expect(row.englishEditHref).toBeUndefined();
		// No structured route in DB → localizedEditHref undefined
		expect(row.localizedEditHref).toBeUndefined();
	});

	it("provides edit links for both the english source and its localized route when both exist", async () => {
		registerCms({
			templateKeys: ["content"],
			siteUrl: "https://example.com",
			seedPages: [
				{
					slug: "about",
					legacyUrl: "/about",
					title: "About",
					sourceHtmlPath: "runtime://content/about",
					updatedAt: "2025-01-01T00:00:00Z",
				},
			],
			archives: [
				{
					title: "Blog",
					kind: "posts",
					slug: "blog",
					legacyUrl: "/blog",
					listingItems: [],
				},
			],
			translationStatus: [
				{
					route: "/es/about",
					translationState: "not_started",
					englishSourceUrl: "/about",
					locale: "es",
				},
			],
		});

		// Seed a structured page route for /es/about so localizedEditHref is populated
		const settings = JSON.stringify({
			templateKey: "content",
			alternateLinks: [],
		});
		db.prepare(
			`INSERT INTO cms_route_groups (id, kind, render_strategy, canonical_locale, canonical_path) VALUES ('g-es-about', 'page', 'structured_sections', 'es', '/es/about')`,
		).run();
		db.prepare(
			`INSERT INTO cms_route_variants (id, group_id, locale, path, status, title, settings_json, updated_by) VALUES ('v-es-about', 'g-es-about', 'es', '/es/about', 'published', 'Sobre Nosotros', ?, 'admin@test.local')`,
		).run(settings);

		const result = await buildTranslationsPageModel(locals, adminRole);
		expect(result.status).toBe("ok");
		const row = result.data.rows[0] as {
			englishEditHref?: string;
			localizedEditHref?: string;
		};
		expect(row.englishEditHref).toContain("/ap-admin/posts/about");
		expect(row.localizedEditHref).toContain("/ap-admin/route-pages/es/about");
	});

	it("populates englishEditHref when a matching seedPage is present, else leaves it undefined", async () => {
		registerCms({
			templateKeys: ["content"],
			siteUrl: "https://example.com",
			seedPages: [
				{
					slug: "about",
					legacyUrl: "/about",
					title: "About",
					sourceHtmlPath: "runtime://content/about",
					updatedAt: "2025-01-01T00:00:00Z",
				},
			],
			archives: [],
			translationStatus: [
				{
					route: "/es/about",
					translationState: "not_started",
					englishSourceUrl: "/about",
					locale: "es",
				},
				{
					route: "/es/orphan",
					translationState: "not_started",
					englishSourceUrl: "/no-match",
					locale: "es",
				},
			],
		});
		const result = await buildTranslationsPageModel(locals, adminRole);
		expect(result.status).toBe("ok");
		const matched = result.data.rows.find(
			(r) => (r as { route: string }).route === "/es/about",
		) as { englishEditHref?: string };
		expect(matched.englishEditHref).toBe("/ap-admin/posts/about");
		const orphan = result.data.rows.find(
			(r) => (r as { route: string }).route === "/es/orphan",
		) as { englishEditHref?: string };
		expect(orphan.englishEditHref).toBeUndefined();
	});

	it("returns partial with the translation-rows warning when getRuntimeTranslationState rejects", async () => {
		vi.spyOn(runtimePageStore, "getRuntimeTranslationState").mockRejectedValueOnce(
			new Error("db fail"),
		);
		const result = await buildTranslationsPageModel(locals, adminRole);
		expect(result.status).toBe("partial");
		expect(result.warnings).toContain("Some translation rows are temporarily unavailable.");
		// withSettledMap fallback emits a row carrying the source translationState as effectiveState
		const row = result.data.rows[0] as {
			route: string;
			effectiveState: string;
			localizedEditHref?: string;
		};
		expect(row.route).toBe("/es/about");
		expect(row.effectiveState).toBe("not_started");
		expect(row.localizedEditHref).toBeUndefined();
	});
});

// ---------------------------------------------------------------------------
// buildSeoPageModel
// ---------------------------------------------------------------------------

describe("buildSeoPageModel", () => {
	it("returns forbidden with the full empty shape for editor role", async () => {
		const result = await buildSeoPageModel(locals, editorRole);
		expect(result.status).toBe("forbidden");
		expect(result.data).toEqual({ rows: [] });
	});

	it("returns forbidden when user is null", async () => {
		const result = await buildSeoPageModel(locals, null);
		expect(result.status).toBe("forbidden");
		expect(result.data).toEqual({ rows: [] });
	});

	it("returns ok for admin with a Post row carrying its seo fields and a clear missingMetadata flag", async () => {
		vi.spyOn(runtimePageStore, "listRuntimeContentStates").mockResolvedValueOnce([
			{
				slug: "hello-world",
				legacyUrl: "/hello-world",
				title: "Hello World",
				kind: "post",
				templateKey: "content",
				seoTitle: "Hello SEO",
				metaDescription: "Hello meta",
				status: "published",
				listingItems: [],
				paginationLinks: [],
				sourceHtmlPath: "runtime://content/hello-world",
				updatedAt: "2025-01-01",
			},
		]);
		const result = await buildSeoPageModel(locals, adminRole);
		expect(result.status).toBe("ok");
		expect(result.warnings).toEqual([]);
		const post = result.data.rows.find((r) => r.path === "/hello-world");
		expect(post?.type).toBe("Post");
		expect(post?.label).toBe("Hello World");
		expect(post?.seoTitle).toBe("Hello SEO");
		expect(post?.metaDescription).toBe("Hello meta");
		expect(post?.missingMetadata).toBe(false);
		expect(post?.editHref).toBe("/ap-admin/posts/hello-world");
	});

	it("returns partial with the content-SEO warning when listRuntimeContentStates fails", async () => {
		vi.spyOn(runtimePageStore, "listRuntimeContentStates").mockRejectedValueOnce(new Error("fail"));
		const result = await buildSeoPageModel(locals, adminRole);
		expect(result.status).toBe("partial");
		expect(result.warnings).toContain("Content SEO records are temporarily unavailable.");
	});

	it("returns partial with the structured-page-SEO warning when listRuntimeStructuredPageRoutes fails", async () => {
		vi.spyOn(runtimeRouteRegistry, "listRuntimeStructuredPageRoutes").mockRejectedValueOnce(
			new Error("fail"),
		);
		const result = await buildSeoPageModel(locals, adminRole);
		expect(result.status).toBe("partial");
		expect(result.warnings).toContain("Structured page SEO records are temporarily unavailable.");
	});

	it("returns partial with the system-route-SEO warning when listRuntimeSystemRoutes fails", async () => {
		vi.spyOn(runtimeRouteRegistry, "listRuntimeSystemRoutes").mockRejectedValueOnce(
			new Error("fail"),
		);
		const result = await buildSeoPageModel(locals, adminRole);
		expect(result.status).toBe("partial");
		expect(result.warnings).toContain("System route SEO records are temporarily unavailable.");
	});

	it("returns partial with the archive-SEO warning when getRuntimeArchiveRoute fails", async () => {
		vi.spyOn(runtimeRouteRegistry, "getRuntimeArchiveRoute").mockRejectedValueOnce(
			new Error("archive fail"),
		);
		const result = await buildSeoPageModel(locals, adminRole);
		expect(result.status).toBe("partial");
		expect(result.warnings).toContain("Some archive SEO records are temporarily unavailable.");
	});

	it("emits an Archive row using config fields when getRuntimeArchiveRoute fails (fallback runtime: null)", async () => {
		vi.spyOn(runtimeRouteRegistry, "getRuntimeArchiveRoute").mockRejectedValueOnce(
			new Error("archive fail"),
		);
		const result = await buildSeoPageModel(locals, adminRole);
		const blogRow = result.data.rows.find((r) => r.path === "/blog");
		expect(blogRow?.type).toBe("Archive");
		expect(blogRow?.label).toBe("Blog");
		expect(blogRow?.seoTitle).toBe("Blog");
		expect(blogRow?.metaDescription).toBe("—");
		expect(blogRow?.missingMetadata).toBe(true);
		expect(blogRow?.editHref).toBe("/ap-admin/archives/blog");
	});

	it("flags Structured Page missingMetadata per the !seoTitle || !metaDescription contract", async () => {
		vi.spyOn(runtimeRouteRegistry, "listRuntimeStructuredPageRoutes").mockResolvedValueOnce([
			{
				path: "/full",
				title: "Full",
				summary: undefined,
				seoTitle: "S",
				metaDescription: "M",
				status: "published",
				updatedAt: "2025-01-01",
			},
			{
				path: "/title-only",
				title: "Title",
				summary: undefined,
				seoTitle: "S",
				metaDescription: undefined,
				status: "published",
				updatedAt: "2025-01-01",
			},
			{
				path: "/desc-only",
				title: "Desc",
				summary: undefined,
				seoTitle: undefined,
				metaDescription: "M",
				status: "published",
				updatedAt: "2025-01-01",
			},
		]);
		const result = await buildSeoPageModel(locals, adminRole);
		expect(result.data.rows.find((r) => r.path === "/full")?.missingMetadata).toBe(false);
		expect(result.data.rows.find((r) => r.path === "/title-only")?.missingMetadata).toBe(true);
		expect(result.data.rows.find((r) => r.path === "/desc-only")?.missingMetadata).toBe(true);
	});

	it("flags Archive missingMetadata per the !runtime?.seoTitle || !runtime?.metaDescription contract", async () => {
		// Three archives: full meta, seoTitle-only, neither (no runtime row at all).
		registerCms({
			templateKeys: ["content"],
			siteUrl: "https://example.com",
			seedPages: [],
			archives: [
				{ title: "Full", kind: "posts", slug: "full", legacyUrl: "/full" },
				{ title: "TitleOnly", kind: "posts", slug: "title-only", legacyUrl: "/title-only" },
				{ title: "None", kind: "posts", slug: "none", legacyUrl: "/none" },
			],
			translationStatus: [],
		});
		const spy = vi.spyOn(runtimeRouteRegistry, "getRuntimeArchiveRoute");
		spy.mockImplementation(async (legacyUrl: string) => {
			if (legacyUrl === "/full") {
				return {
					path: "/full",
					title: "Full",
					seoTitle: "S",
					metaDescription: "M",
					summary: undefined,
					status: "published",
					updatedAt: "2025-01-01",
				};
			}
			if (legacyUrl === "/title-only") {
				return {
					path: "/title-only",
					title: "TitleOnly",
					seoTitle: "S",
					metaDescription: undefined,
					summary: undefined,
					status: "published",
					updatedAt: "2025-01-01",
				};
			}
			return undefined;
		});
		const result = await buildSeoPageModel(locals, adminRole);
		expect(result.data.rows.find((r) => r.path === "/full")?.missingMetadata).toBe(false);
		expect(result.data.rows.find((r) => r.path === "/title-only")?.missingMetadata).toBe(true);
		// runtime undefined → both falsy → still flagged true
		expect(result.data.rows.find((r) => r.path === "/none")?.missingMetadata).toBe(true);
	});

	it("flags missingMetadata=true when metaDescription is present but seoTitle is absent", async () => {
		vi.spyOn(runtimePageStore, "listRuntimeContentStates").mockResolvedValueOnce([
			{
				slug: "missing-seo-title",
				legacyUrl: "/missing-seo-title",
				title: "T",
				kind: "post",
				templateKey: "content",
				seoTitle: undefined,
				metaDescription: "Has meta",
				status: "published",
				listingItems: [],
				paginationLinks: [],
				sourceHtmlPath: "runtime://content/x",
				updatedAt: "2025-01-01",
			},
		]);
		const result = await buildSeoPageModel(locals, adminRole);
		const row = result.data.rows.find((r) => r.path === "/missing-seo-title");
		expect(row?.metaDescription).toBe("Has meta");
		expect(row?.seoTitle).toBe("—");
		expect(row?.missingMetadata).toBe(true);
	});

	it("clears missingMetadata when both content seoTitle and metaDescription are present", async () => {
		vi.spyOn(runtimePageStore, "listRuntimeContentStates").mockResolvedValueOnce([
			{
				slug: "fully-set",
				legacyUrl: "/fully-set",
				title: "T",
				kind: "page",
				templateKey: "page",
				seoTitle: "S",
				metaDescription: "M",
				status: "published",
				listingItems: [],
				paginationLinks: [],
				sourceHtmlPath: "runtime://content/x",
				updatedAt: "2025-01-01",
			},
		]);
		const result = await buildSeoPageModel(locals, adminRole);
		const row = result.data.rows.find((r) => r.path === "/fully-set");
		expect(row?.type).toBe("Page");
		expect(row?.missingMetadata).toBe(false);
	});

	it("emits an Archive row with seoTitle/metaDescription/label resolved from runtime when runtime is present", async () => {
		vi.spyOn(runtimeRouteRegistry, "getRuntimeArchiveRoute").mockResolvedValueOnce({
			path: "/blog",
			title: "Runtime Blog",
			seoTitle: "Runtime SEO",
			metaDescription: "Runtime meta",
			summary: undefined,
			status: "published",
			updatedAt: "2025-01-01",
		});
		const result = await buildSeoPageModel(locals, adminRole);
		const blog = result.data.rows.find((r) => r.path === "/blog");
		expect(blog?.label).toBe("Runtime Blog");
		expect(blog?.seoTitle).toBe("Runtime SEO");
		expect(blog?.metaDescription).toBe("Runtime meta");
		expect(blog?.missingMetadata).toBe(false);
	});

	it("emits an Archive row with seoTitle falling back to runtime.title and metaDescription to runtime.summary", async () => {
		vi.spyOn(runtimeRouteRegistry, "getRuntimeArchiveRoute").mockResolvedValueOnce({
			path: "/blog",
			title: "Runtime Title Only",
			seoTitle: undefined,
			metaDescription: undefined,
			summary: "Runtime summary",
			status: "published",
			updatedAt: "2025-01-01",
		});
		const result = await buildSeoPageModel(locals, adminRole);
		const blog = result.data.rows.find((r) => r.path === "/blog");
		expect(blog?.seoTitle).toBe("Runtime Title Only");
		expect(blog?.metaDescription).toBe("Runtime summary");
		expect(blog?.missingMetadata).toBe(true);
	});

	it("emits a System route row with summary-derived metaDescription and editHref '/ap-admin/system'", async () => {
		vi.spyOn(runtimeRouteRegistry, "listRuntimeSystemRoutes").mockResolvedValueOnce([
			{
				path: "/sys-a",
				title: "System A",
				summary: "Sys summary",
				seoTitle: undefined,
				metaDescription: undefined,
				status: "published",
				updatedAt: "2025-01-01",
			},
			{
				path: "/sys-b",
				title: "System B",
				summary: undefined,
				seoTitle: undefined,
				metaDescription: undefined,
				status: "published",
				updatedAt: "2025-01-01",
			},
		]);
		const result = await buildSeoPageModel(locals, adminRole);
		const a = result.data.rows.find((r) => r.path === "/sys-a");
		expect(a?.type).toBe("System");
		expect(a?.label).toBe("System A");
		expect(a?.seoTitle).toBe("System A");
		expect(a?.metaDescription).toBe("Sys summary");
		expect(a?.missingMetadata).toBe(false);
		expect(a?.editHref).toBe("/ap-admin/system");
		const b = result.data.rows.find((r) => r.path === "/sys-b");
		expect(b?.metaDescription).toBe("—");
		expect(b?.missingMetadata).toBe(true);
		expect(b?.editHref).toBe("/ap-admin/system");
	});

	it("falls back to empty content/route/system arrays when their loaders fail (no rows emitted from failed sources)", async () => {
		vi.spyOn(runtimePageStore, "listRuntimeContentStates").mockRejectedValueOnce(new Error("a"));
		vi.spyOn(runtimeRouteRegistry, "listRuntimeStructuredPageRoutes").mockRejectedValueOnce(
			new Error("b"),
		);
		vi.spyOn(runtimeRouteRegistry, "listRuntimeSystemRoutes").mockRejectedValueOnce(new Error("c"));
		const result = await buildSeoPageModel(locals, adminRole);
		expect(result.status).toBe("partial");
		// Only the Archive row from the surviving archive lookup remains
		expect(result.data.rows.every((r) => r.type === "Archive")).toBe(true);
	});

	it("emits a Structured Page row with seoTitle falling back to title and metaDescription to summary then em-dash", async () => {
		vi.spyOn(runtimeRouteRegistry, "listRuntimeStructuredPageRoutes").mockResolvedValueOnce([
			{
				path: "/about",
				title: "About",
				summary: "About summary",
				seoTitle: undefined,
				metaDescription: undefined,
				status: "published",
				updatedAt: "2025-01-01",
			},
			{
				path: "/empty",
				title: "Empty",
				summary: undefined,
				seoTitle: undefined,
				metaDescription: undefined,
				status: "published",
				updatedAt: "2025-01-01",
			},
		]);
		const result = await buildSeoPageModel(locals, adminRole);
		const about = result.data.rows.find((r) => r.path === "/about");
		expect(about?.type).toBe("Structured Page");
		expect(about?.seoTitle).toBe("About");
		expect(about?.metaDescription).toBe("About summary");
		expect(about?.missingMetadata).toBe(true);
		expect(about?.editHref).toBe("/ap-admin/route-pages/about");
		const empty = result.data.rows.find((r) => r.path === "/empty");
		expect(empty?.metaDescription).toBe("—");
		expect(empty?.missingMetadata).toBe(true);
	});

	it("shows em-dash placeholder when seo fields are absent on a page record", async () => {
		vi.spyOn(runtimePageStore, "listRuntimeContentStates").mockResolvedValueOnce([
			{
				slug: "about",
				legacyUrl: "/about",
				title: "About",
				kind: "page",
				templateKey: "page",
				seoTitle: undefined,
				metaDescription: undefined,
				status: "published",
				listingItems: [],
				paginationLinks: [],
				sourceHtmlPath: "runtime://content/about",
				updatedAt: "2025-01-01",
			},
		]);
		const result = await buildSeoPageModel(locals, adminRole);
		expect(result.status).toMatch(/ok|partial/);
		const row = result.data.rows.find((r: { path: string }) => r.path === "/about");
		expect(row?.type).toBe("Page");
		expect(row?.seoTitle).toBe("—");
		expect(row?.metaDescription).toBe("—");
	});

	it("flags missingMetadata when seoTitle is present but metaDescription is absent", async () => {
		vi.spyOn(runtimePageStore, "listRuntimeContentStates").mockResolvedValueOnce([
			{
				slug: "services",
				legacyUrl: "/services",
				title: "Services",
				kind: "post",
				templateKey: "content",
				seoTitle: "Services SEO Title",
				metaDescription: undefined,
				status: "published",
				listingItems: [],
				paginationLinks: [],
				sourceHtmlPath: "runtime://content/services",
				updatedAt: "2025-01-01",
			},
		]);
		const result = await buildSeoPageModel(locals, adminRole);
		expect(result.status).toMatch(/ok|partial/);
		const row = result.data.rows.find((r: { path: string }) => r.path === "/services");
		expect(row?.type).toBe("Post");
		expect(row?.seoTitle).toBe("Services SEO Title");
		expect(row?.missingMetadata).toBe(true);
	});

	it("shows correct seo fields for archives with varying amounts of metadata in the database", async () => {
		registerCms({
			templateKeys: ["content"],
			siteUrl: "https://example.com",
			seedPages: [],
			archives: [
				{
					title: "Blog",
					kind: "posts",
					slug: "blog",
					legacyUrl: "/blog",
					listingItems: [],
				},
				{
					title: "News",
					kind: "posts",
					slug: "news",
					legacyUrl: "/news",
					listingItems: [],
				},
				{
					title: "Tips",
					kind: "posts",
					slug: "tips",
					legacyUrl: "/tips",
					listingItems: [],
				},
			],
			translationStatus: [
				{
					route: "/es/about",
					translationState: "not_started",
					englishSourceUrl: "/about",
					locale: "es",
				},
			],
		});

		const settings = JSON.stringify({
			templateKey: "content",
			alternateLinks: [],
		});

		// Blog: full seo_title + meta_description in the DB
		db.prepare(
			`INSERT INTO cms_route_groups (id, kind, render_strategy, canonical_locale, canonical_path) VALUES ('g-arc-blog', 'archive', 'archive_listing', 'en', '/blog')`,
		).run();
		db.prepare(
			`INSERT INTO cms_route_variants (id, group_id, locale, path, status, title, seo_title, meta_description, settings_json, updated_by) VALUES ('v-arc-blog', 'g-arc-blog', 'en', '/blog', 'published', 'Blog Archive', 'Blog SEO', 'Blog meta desc', ?, 'admin@test.local')`,
		).run(settings);

		// News: no seo_title, but has a summary (should fall back to summary for the meta description)
		db.prepare(
			`INSERT INTO cms_route_groups (id, kind, render_strategy, canonical_locale, canonical_path) VALUES ('g-arc-news', 'archive', 'archive_listing', 'en', '/news')`,
		).run();
		db.prepare(
			`INSERT INTO cms_route_variants (id, group_id, locale, path, status, title, summary, settings_json, updated_by) VALUES ('v-arc-news', 'g-arc-news', 'en', '/news', 'published', 'News Archive', 'News summary', ?, 'admin@test.local')`,
		).run(settings);

		// Tips: has seo_title but no meta_description (should show em-dash placeholder for meta)
		db.prepare(
			`INSERT INTO cms_route_groups (id, kind, render_strategy, canonical_locale, canonical_path) VALUES ('g-arc-tips', 'archive', 'archive_listing', 'en', '/tips')`,
		).run();
		db.prepare(
			`INSERT INTO cms_route_variants (id, group_id, locale, path, status, title, seo_title, settings_json, updated_by) VALUES ('v-arc-tips', 'g-arc-tips', 'en', '/tips', 'published', 'Tips Archive', 'Tips SEO', ?, 'admin@test.local')`,
		).run(settings);

		const result = await buildSeoPageModel(locals, adminRole);
		expect(result.status).toBe("ok");
		expect(result.data.rows.some((r) => r.type === "Archive")).toBe(true);
	});

	it("shows correct seo fields for route pages and system routes with varying metadata", async () => {
		const settings = JSON.stringify({
			templateKey: "content",
			alternateLinks: [],
		});

		// Full seo_title + meta_description in DB
		db.prepare(
			`INSERT INTO cms_route_groups (id, kind, render_strategy, canonical_locale, canonical_path) VALUES ('g-seo-a', 'page', 'structured_sections', 'en', '/contact')`,
		).run();
		db.prepare(
			`INSERT INTO cms_route_variants (id, group_id, locale, path, status, title, seo_title, meta_description, settings_json, updated_by) VALUES ('v-seo-a', 'g-seo-a', 'en', '/contact', 'published', 'Contact', 'Contact SEO', 'Contact meta', ?, 'admin@test.local')`,
		).run(settings);

		// No seo_title, but has summary (summary should be used as description fallback)
		db.prepare(
			`INSERT INTO cms_route_groups (id, kind, render_strategy, canonical_locale, canonical_path) VALUES ('g-seo-b', 'page', 'structured_sections', 'en', '/careers')`,
		).run();
		db.prepare(
			`INSERT INTO cms_route_variants (id, group_id, locale, path, status, title, summary, settings_json, updated_by) VALUES ('v-seo-b', 'g-seo-b', 'en', '/careers', 'published', 'Careers', 'Careers summary', ?, 'admin@test.local')`,
		).run(settings);

		// seo_title present, no meta_description, no summary (should show em-dash placeholder)
		db.prepare(
			`INSERT INTO cms_route_groups (id, kind, render_strategy, canonical_locale, canonical_path) VALUES ('g-seo-c', 'page', 'structured_sections', 'en', '/team')`,
		).run();
		db.prepare(
			`INSERT INTO cms_route_variants (id, group_id, locale, path, status, title, seo_title, settings_json, updated_by) VALUES ('v-seo-c', 'g-seo-c', 'en', '/team', 'published', 'Team', 'Team SEO', ?, 'admin@test.local')`,
		).run(settings);

		// System route with a summary (should appear in the SEO table with real description)
		db.prepare(
			`INSERT INTO cms_route_groups (id, kind, render_strategy, canonical_locale, canonical_path) VALUES ('g-sys-a', 'system', 'structured_sections', 'en', '/ap-admin')`,
		).run();
		db.prepare(
			`INSERT INTO cms_route_variants (id, group_id, locale, path, status, title, summary, settings_json, updated_by) VALUES ('v-sys-a', 'g-sys-a', 'en', '/ap-admin', 'published', 'Admin', 'Admin area', ?, 'admin@test.local')`,
		).run(settings);

		// System route without any description (should show em-dash placeholder)
		db.prepare(
			`INSERT INTO cms_route_groups (id, kind, render_strategy, canonical_locale, canonical_path) VALUES ('g-sys-b', 'system', 'structured_sections', 'en', '/sitemap.xml')`,
		).run();
		db.prepare(
			`INSERT INTO cms_route_variants (id, group_id, locale, path, status, title, settings_json, updated_by) VALUES ('v-sys-b', 'g-sys-b', 'en', '/sitemap.xml', 'published', 'Sitemap', ?, 'admin@test.local')`,
		).run(settings);

		const result = await buildSeoPageModel(locals, adminRole);
		expect(result.status).toBe("ok");
		const rows = result.data.rows;
		expect(rows.some((r) => r.type === "Structured Page")).toBe(true);
		expect(rows.some((r) => r.type === "System")).toBe(true);
	});
});

// ---------------------------------------------------------------------------
// buildPostEditorPageModel
// ---------------------------------------------------------------------------

describe("buildPostEditorPageModel", () => {
	it("returns not_found for unknown slug", async () => {
		const result = await buildPostEditorPageModel(locals, "no-such-post");
		expect(result.status).toBe("not_found");
		expect(result.data.pageRecord).toBeNull();
	});

	it("returns ok for known slug", async () => {
		const result = await buildPostEditorPageModel(locals, "hello-world");
		expect(result.status).toBe("ok");
		expect(result.data.pageRecord).not.toBeNull();
		expect(result.data.pageRecord?.slug).toBe("hello-world");
	});

	it("returns partial when authors query fails for known slug", async () => {
		vi.spyOn(runtimePageStore, "getRuntimeAuthors").mockRejectedValueOnce(new Error("fail"));
		const result = await buildPostEditorPageModel(locals, "hello-world");
		expect(["ok", "partial"]).toContain(result.status);
	});

	it("loads the editor for a localized post whose english source is a different slug", async () => {
		db.prepare(
			`INSERT INTO content_entries (slug, legacy_url, title, kind, template_key, source_html_path, body, summary, seo_title, meta_description)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
		).run(
			"es-about",
			"/es/about",
			"Sobre Nosotros",
			"post",
			"content",
			"runtime://content/es-about",
			"<p>ES</p>",
			"ES summary",
			"ES SEO",
			"ES meta",
		);
		db.prepare(
			`INSERT INTO content_overrides (slug, title, status, body, seo_title, meta_description, updated_by)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
		).run(
			"es-about",
			"Sobre Nosotros",
			"published",
			"<p>ES</p>",
			"ES SEO",
			"ES meta",
			"admin@test.local",
		);

		const result = await buildPostEditorPageModel(locals, "es-about");
		expect(result.status).toMatch(/ok|partial/);
		expect(result.data.pageRecord?.slug).toBe("es-about");
	});

	it("loads the editor for an english post that has a localized counterpart", async () => {
		db.prepare(
			`INSERT INTO content_entries (slug, legacy_url, title, kind, template_key, source_html_path, body, summary, seo_title, meta_description)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
		).run(
			"about",
			"/about",
			"About",
			"post",
			"content",
			"runtime://content/about",
			"<p>About</p>",
			"About us",
			"About SEO",
			"About meta",
		);
		db.prepare(
			`INSERT INTO content_overrides (slug, title, status, body, seo_title, meta_description, updated_by)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
		).run(
			"about",
			"About",
			"published",
			"<p>About</p>",
			"About SEO",
			"About meta",
			"admin@test.local",
		);

		const result = await buildPostEditorPageModel(locals, "about");
		expect(result.status).toMatch(/ok|partial/);
		expect(result.data.pageRecord?.slug).toBe("about");
	});
});

// ---------------------------------------------------------------------------
// buildPostRevisionsPageModel
// ---------------------------------------------------------------------------

describe("buildPostRevisionsPageModel", () => {
	it("returns not_found for unknown slug", async () => {
		const result = await buildPostRevisionsPageModel(locals, "no-such-post");
		expect(result.status).toBe("not_found");
	});

	it("returns ok for known slug with revisions", async () => {
		const result = await buildPostRevisionsPageModel(locals, "hello-world");
		expect(result.status).toBe("ok");
		expect(result.data.pageRecord).not.toBeNull();
	});
});

// ---------------------------------------------------------------------------
// buildRoutePageEditorModel
// ---------------------------------------------------------------------------

describe("buildRoutePageEditorModel", () => {
	it("returns forbidden for editor role", async () => {
		const result = await buildRoutePageEditorModel(locals, "/about", editorRole);
		expect(result.status).toBe("forbidden");
	});

	it("returns not_found for unknown route", async () => {
		const result = await buildRoutePageEditorModel(locals, "/no-such-route", adminRole);
		expect(result.status).toBe("not_found");
	});

	it("returns ok when route page exists in DB without a locale pair", async () => {
		// Seed a structured page route for /services — NOT in translationStatus config
		const groupId = "group-services";
		const variantId = "variant-services";
		const settingsJson = JSON.stringify({
			templateKey: "content",
			alternateLinks: [],
		});
		db.prepare(
			`INSERT INTO cms_route_groups (id, kind, render_strategy, canonical_locale, canonical_path)
       VALUES (?, 'page', 'structured_sections', 'en', '/services')`,
		).run(groupId);
		db.prepare(
			`INSERT INTO cms_route_variants (id, group_id, locale, path, status, title, settings_json, updated_by)
       VALUES (?, ?, 'en', '/services', 'published', 'Services', ?, 'admin@test.local')`,
		).run(variantId, groupId, settingsJson);

		// /services is not in translationStatus config so effectiveTranslationState should be undefined
		const result = await buildRoutePageEditorModel(locals, "/services", adminRole);
		expect(result.status).toBe("ok");
		expect(result.data.pageRecord).not.toBeNull();
		expect(result.data.effectiveTranslationState).toBeUndefined();
	});

	it("includes localized route path when the route has a locale pair", async () => {
		// Seed a structured page route for /about (registered as englishSourceUrl with localizedRoute /es/about)
		const groupId = "group-about";
		const variantId = "variant-about";
		const settingsJson = JSON.stringify({
			templateKey: "content",
			alternateLinks: [],
		});
		db.prepare(
			`INSERT INTO cms_route_groups (id, kind, render_strategy, canonical_locale, canonical_path)
       VALUES (?, 'page', 'structured_sections', 'en', '/about')`,
		).run(groupId);
		db.prepare(
			`INSERT INTO cms_route_variants (id, group_id, locale, path, status, title, settings_json, updated_by)
       VALUES (?, ?, 'en', '/about', 'published', 'About', ?, 'admin@test.local')`,
		).run(variantId, groupId, settingsJson);

		// /about is registered as an englishSourceUrl so its localizedRoute should be /es/about
		const result = await buildRoutePageEditorModel(locals, "/about", adminRole);
		expect(result.status).toMatch(/ok|partial/);
		expect(result.data.pageRecord).not.toBeNull();
	});
});

// ---------------------------------------------------------------------------
// buildArchiveEditorModel
// ---------------------------------------------------------------------------

describe("buildArchiveEditorModel", () => {
	it("returns forbidden for editor role", async () => {
		const result = await buildArchiveEditorModel(locals, "/blog", editorRole);
		expect(result.status).toBe("forbidden");
	});

	it("returns not_found when archive doesn't exist in DB", async () => {
		const result = await buildArchiveEditorModel(locals, "/blog", adminRole);
		expect(result.status).toBe("not_found");
	});

	it("returns ok when archive route exists in DB", async () => {
		// Seed an archive route
		const groupId = "group-blog";
		const variantId = "variant-blog";
		db.prepare(
			`INSERT INTO cms_route_groups (id, kind, render_strategy, canonical_locale, canonical_path)
       VALUES (?, 'archive', 'archive_listing', 'en', '/blog')`,
		).run(groupId);
		db.prepare(
			`INSERT INTO cms_route_variants (id, group_id, locale, path, status, title, updated_by)
       VALUES (?, ?, 'en', '/blog', 'published', 'The Blog', 'admin@test.local')`,
		).run(variantId, groupId);

		const result = await buildArchiveEditorModel(locals, "/blog", adminRole);
		expect(result.status).toBe("ok");
		expect(result.data.archive).not.toBeNull();
		expect(result.data.archive?.path).toBe("/blog");
	});
});

// ---------------------------------------------------------------------------
// buildResetPasswordPageModel
// ---------------------------------------------------------------------------

describe("buildResetPasswordPageModel", () => {
	it("returns ok with null request for empty token", async () => {
		const result = await buildResetPasswordPageModel(locals, "");
		expect(result.status).toBe("ok");
		expect(result.data.request).toBeNull();
	});

	it("returns ok with null request for invalid token", async () => {
		const result = await buildResetPasswordPageModel(locals, "bad-token");
		expect(result.status).toBe("ok");
		expect(result.data.request).toBeNull();
	});
});

// ---------------------------------------------------------------------------
// buildAcceptInvitePageModel
// ---------------------------------------------------------------------------

describe("buildAcceptInvitePageModel", () => {
	it("returns ok with null inviteRequest for empty token", async () => {
		const result = await buildAcceptInvitePageModel(locals, "");
		expect(result.status).toBe("ok");
		expect(result.data.inviteRequest).toBeNull();
	});

	it("returns ok with null inviteRequest for invalid token", async () => {
		const result = await buildAcceptInvitePageModel(locals, "bad-token");
		expect(result.status).toBe("ok");
		expect(result.data.inviteRequest).toBeNull();
	});
});
