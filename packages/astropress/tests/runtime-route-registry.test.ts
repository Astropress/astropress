import type { DatabaseSync } from "node:sqlite";
import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";

import { registerCms } from "../src/config";
import { makeDb, STANDARD_ACTOR } from "./helpers/make-db.js";
import { makeLocals } from "./helpers/make-locals.js";

// biome-ignore format: single-line typeof import required for esbuild/oxc compatibility
let createRuntimeStructuredPageRoute: typeof import("../src/runtime-route-registry.js").createRuntimeStructuredPageRoute;
// biome-ignore format: single-line typeof import required for esbuild/oxc compatibility
let getRuntimeArchiveRoute: typeof import("../src/runtime-route-registry.js").getRuntimeArchiveRoute;
// biome-ignore format: single-line typeof import required for esbuild/oxc compatibility
let getRuntimeStructuredPageRoute: typeof import("../src/runtime-route-registry.js").getRuntimeStructuredPageRoute;
// biome-ignore format: single-line typeof import required for esbuild/oxc compatibility
let getRuntimeSystemRoute: typeof import("../src/runtime-route-registry.js").getRuntimeSystemRoute;
// biome-ignore format: single-line typeof import required for esbuild/oxc compatibility
let listRuntimeStructuredPageRoutes: typeof import("../src/runtime-route-registry.js").listRuntimeStructuredPageRoutes;
// biome-ignore format: single-line typeof import required for esbuild/oxc compatibility
let listRuntimeSystemRoutes: typeof import("../src/runtime-route-registry.js").listRuntimeSystemRoutes;
// biome-ignore format: single-line typeof import required for esbuild/oxc compatibility
let saveRuntimeArchiveRoute: typeof import("../src/runtime-route-registry.js").saveRuntimeArchiveRoute;
// biome-ignore format: single-line typeof import required for esbuild/oxc compatibility
let saveRuntimeStructuredPageRoute: typeof import("../src/runtime-route-registry.js").saveRuntimeStructuredPageRoute;
// biome-ignore format: single-line typeof import required for esbuild/oxc compatibility
let saveRuntimeSystemRoute: typeof import("../src/runtime-route-registry.js").saveRuntimeSystemRoute;

// ---------------------------------------------------------------------------
// Mock local CMS registry — by default throws (mimicking real test env where
// the local runtime alias is unavailable). Individual tests use mockResolvedValueOnce
// to simulate the registry being available, covering the if(!local) false branch.
// ---------------------------------------------------------------------------

const { mockLoadLocalCmsRegistry, mockLocalRegistry } = vi.hoisted(() => {
	const registry = {
		listSystemRoutes: vi.fn().mockResolvedValue([]),
		getSystemRoute: vi.fn().mockResolvedValue(null),
		saveSystemRoute: vi.fn().mockResolvedValue({ ok: true }),
		listStructuredPageRoutes: vi.fn().mockResolvedValue([]),
		getStructuredPageRoute: vi.fn().mockResolvedValue(null),
		saveStructuredPageRoute: vi.fn().mockResolvedValue({ ok: true }),
		createStructuredPageRoute: vi.fn().mockResolvedValue({ ok: true }),
		getArchiveRoute: vi.fn().mockResolvedValue(null),
		saveArchiveRoute: vi.fn().mockResolvedValue({ ok: true }),
	};
	return {
		mockLoadLocalCmsRegistry: vi
			.fn()
			.mockRejectedValue(
				new Error("Local runtime modules are only available inside an Astro host"),
			),
		mockLocalRegistry: registry,
	};
});

vi.mock("../src/local-runtime-modules", () => ({
	loadLocalCmsRegistry: mockLoadLocalCmsRegistry,
}));

vi.mock("../src/local-runtime-modules.js", () => ({
	loadLocalCmsRegistry: mockLoadLocalCmsRegistry,
}));

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const actor = STANDARD_ACTOR;

let db: DatabaseSync;
let locals: App.Locals;

beforeEach(async () => {
	vi.resetModules();
	({
		createRuntimeStructuredPageRoute,
		getRuntimeArchiveRoute,
		getRuntimeStructuredPageRoute,
		getRuntimeSystemRoute,
		listRuntimeStructuredPageRoutes,
		listRuntimeSystemRoutes,
		saveRuntimeArchiveRoute,
		saveRuntimeStructuredPageRoute,
		saveRuntimeSystemRoute,
	} = await import("../src/runtime-route-registry.js"));
	db = makeDb();
	locals = makeLocals(db);

	registerCms({
		templateKeys: ["content"],
		siteUrl: "https://example.com",
		seedPages: [],
		archives: [],
		translationStatus: [],
	});
});

afterAll(() => {
	vi.resetModules();
});

// ---------------------------------------------------------------------------
// Helper: locals whose D1 DB always throws — forces withSafeRouteRegistryFallback
// to catch the error and invoke the local-registry fallback arrow.
// ---------------------------------------------------------------------------

function makeFailingLocals(): App.Locals {
	const throwingStmt = {
		bind: () => throwingStmt,
		first: async (): Promise<never> => {
			throw new Error("Simulated D1 failure");
		},
		all: async (): Promise<never> => {
			throw new Error("Simulated D1 failure");
		},
		run: async (): Promise<never> => {
			throw new Error("Simulated D1 failure");
		},
	};
	return {
		runtime: { env: { DB: { prepare: () => throwingStmt } } },
	} as unknown as App.Locals;
}

// ---------------------------------------------------------------------------
// Helpers for seeding routes
// ---------------------------------------------------------------------------

function seedSystemRoute(db: DatabaseSync, path: string, renderStrategy = "structured_sections") {
	const groupId = `group:${path}`;
	const variantId = `variant:${path}`;
	db.prepare(
		`INSERT INTO cms_route_groups (id, kind, render_strategy, canonical_locale, canonical_path)
     VALUES (?, 'system', ?, 'en', ?)`,
	).run(groupId, renderStrategy, path);
	db.prepare(
		`INSERT INTO cms_route_variants (id, group_id, locale, path, status, title, updated_by)
     VALUES (?, ?, 'en', ?, 'published', ?, ?)`,
	).run(variantId, groupId, path, `Title for ${path}`, "admin@test.local");
	return variantId;
}

function seedArchiveRoute(db: DatabaseSync, path: string) {
	const groupId = `group:${path}`;
	const variantId = `variant:${path}`;
	db.prepare(
		`INSERT INTO cms_route_groups (id, kind, render_strategy, canonical_locale, canonical_path)
     VALUES (?, 'archive', 'archive_listing', 'en', ?)`,
	).run(groupId, path);
	db.prepare(
		`INSERT INTO cms_route_variants (id, group_id, locale, path, status, title, updated_by)
     VALUES (?, ?, 'en', ?, 'published', ?, ?)`,
	).run(variantId, groupId, path, `Archive for ${path}`, "admin@test.local");
	return variantId;
}

function seedStructuredPageRoute(db: DatabaseSync, path: string, templateKey = "content") {
	const groupId = `group:${path}`;
	const variantId = `variant:${path}`;
	const settingsJson = JSON.stringify({ templateKey, alternateLinks: [] });
	db.prepare(
		`INSERT INTO cms_route_groups (id, kind, render_strategy, canonical_locale, canonical_path)
     VALUES (?, 'page', 'structured_sections', 'en', ?)`,
	).run(groupId, path);
	db.prepare(
		`INSERT INTO cms_route_variants (id, group_id, locale, path, status, title, settings_json, updated_by)
     VALUES (?, ?, 'en', ?, 'published', ?, ?, ?)`,
	).run(variantId, groupId, path, `Page at ${path}`, settingsJson, "admin@test.local");
	return variantId;
}

// ---------------------------------------------------------------------------
// listRuntimeSystemRoutes
// ---------------------------------------------------------------------------

describe("listRuntimeSystemRoutes", () => {
	it("returns empty array for empty DB", async () => {
		const routes = await listRuntimeSystemRoutes(locals);
		expect(routes).toEqual([]);
	});

	it("returns seeded system routes", async () => {
		seedSystemRoute(db, "/contact", "structured_sections");
		const routes = await listRuntimeSystemRoutes(locals);
		expect(routes).toHaveLength(1);
		expect(routes[0].path).toBe("/contact");
		expect(routes[0].renderStrategy).toBe("structured_sections");
	});

	it("returns empty array when locals are null (no registry)", async () => {
		const routes = await listRuntimeSystemRoutes(null);
		expect(routes).toEqual([]);
	});
});

// ---------------------------------------------------------------------------
// getRuntimeSystemRoute
// ---------------------------------------------------------------------------

describe("getRuntimeSystemRoute", () => {
	it("returns null for non-existent path", async () => {
		const route = await getRuntimeSystemRoute("/no-such-route", locals);
		expect(route).toBeNull();
	});

	it("returns route for existing system path", async () => {
		seedSystemRoute(db, "/sitemap.xml", "generated_xml");
		const route = await getRuntimeSystemRoute("/sitemap.xml", locals);
		expect(route).not.toBeNull();
		expect(route?.path).toBe("/sitemap.xml");
		expect(route?.renderStrategy).toBe("generated_xml");
	});

	it("normalises path without leading slash", async () => {
		seedSystemRoute(db, "/contact");
		const route = await getRuntimeSystemRoute("contact", locals);
		expect(route).not.toBeNull();
		expect(route?.path).toBe("/contact");
	});

	it("returns null when locals are null (no registry)", async () => {
		const route = await getRuntimeSystemRoute("/anything", null);
		expect(route).toBeNull();
	});

	it("falls back to local registry when D1 query throws", async () => {
		mockLoadLocalCmsRegistry.mockResolvedValueOnce(mockLocalRegistry);
		mockLocalRegistry.getSystemRoute.mockResolvedValueOnce({
			path: "/contact",
			title: "Local Contact",
			renderStrategy: "structured_sections" as const,
		});
		const route = await getRuntimeSystemRoute("/contact", makeFailingLocals());
		expect(route).toMatchObject({ title: "Local Contact" });
	});
});

// ---------------------------------------------------------------------------
// saveRuntimeSystemRoute
// ---------------------------------------------------------------------------

describe("saveRuntimeSystemRoute", () => {
	it("returns not-ok for non-existent path", async () => {
		const result = await saveRuntimeSystemRoute("/no-such-path", { title: "X" }, actor, locals);
		expect(result).toMatchObject({ ok: false });
		expect((result as { error: string }).error).toContain("could not be found");
	});

	it("returns not-ok for empty title", async () => {
		seedSystemRoute(db, "/contact");
		const result = await saveRuntimeSystemRoute("/contact", { title: "   " }, actor, locals);
		expect(result).toMatchObject({ ok: false });
		expect((result as { error: string }).error).toContain("title is required");
	});

	it("updates an existing system route", async () => {
		seedSystemRoute(db, "/contact", "structured_sections");
		const result = await saveRuntimeSystemRoute(
			"/contact",
			{ title: "Get in Touch", summary: "Contact us" },
			actor,
			locals,
		);
		expect(result).toMatchObject({ ok: true });
		const row = db
			.prepare("SELECT title FROM cms_route_variants WHERE path = '/contact'")
			.get() as { title: string };
		expect(row.title).toBe("Get in Touch");
	});

	it("stores settings JSON when settings provided", async () => {
		seedSystemRoute(db, "/feed.xml", "generated_xml");
		const result = await saveRuntimeSystemRoute(
			"/feed.xml",
			{ title: "RSS Feed", settings: { limit: 20 } },
			actor,
			locals,
		);
		expect(result).toMatchObject({ ok: true });
		const row = db
			.prepare("SELECT settings_json FROM cms_route_variants WHERE path = '/feed.xml'")
			.get() as { settings_json: string };
		expect(JSON.parse(row.settings_json)).toMatchObject({ limit: 20 });
	});

	it("updates with all optional fields and reads back non-null summary/bodyHtml", async () => {
		seedSystemRoute(db, "/about-all", "structured_sections");
		await saveRuntimeSystemRoute(
			"/about-all",
			{
				title: "About All",
				summary: "A summary",
				bodyHtml: "<p>Content</p>",
				settings: { key: "value" },
				revisionNote: "Full update",
			},
			actor,
			locals,
		);
		const route = await getRuntimeSystemRoute("/about-all", locals);
		expect(route?.summary).toBe("A summary");
		expect(route?.bodyHtml).toBe("<p>Content</p>");
	});

	it("returns not-ok when locals are null and no local registry is available", async () => {
		const result = await saveRuntimeSystemRoute("/contact", { title: "T" }, actor, null);
		expect(result).toMatchObject({ ok: false });
	});

	it("delegates to local registry when locals=null and local registry is available", async () => {
		mockLoadLocalCmsRegistry.mockResolvedValueOnce(mockLocalRegistry);
		const result = await saveRuntimeSystemRoute("/contact", { title: "T" }, actor, null);
		expect(result).toMatchObject({ ok: true });
	});

	it("returns exact 'title is required' error verbatim", async () => {
		seedSystemRoute(db, "/exact-err");
		const result = await saveRuntimeSystemRoute("/exact-err", { title: "  " }, actor, locals);
		expect(result).toEqual({ ok: false, error: "A title is required." });
	});

	it("returns exact 'could not be found' error verbatim", async () => {
		const result = await saveRuntimeSystemRoute("/ghost", { title: "T" }, actor, locals);
		expect(result).toEqual({ ok: false, error: "The selected system route could not be found." });
	});

	it("locals=null without local registry returns exact unavailable error", async () => {
		const result = await saveRuntimeSystemRoute("/blog", { title: "T" }, actor, null);
		expect(result).toEqual({ ok: false, error: "The runtime content registry is unavailable." });
	});

	it("summary omitted → stored NULL (not empty string)", async () => {
		seedSystemRoute(db, "/sys-null-summary");
		await saveRuntimeSystemRoute("/sys-null-summary", { title: "T" }, actor, locals);
		const row = db
			.prepare("SELECT summary, body_html FROM cms_route_variants WHERE path = ?")
			.get("/sys-null-summary") as { summary: string | null; body_html: string | null };
		expect(row.summary).toBeNull();
		expect(row.body_html).toBeNull();
	});

	it("summary/bodyHtml whitespace-only → stored NULL after trim", async () => {
		seedSystemRoute(db, "/sys-ws");
		await saveRuntimeSystemRoute(
			"/sys-ws",
			{ title: "T", summary: "   ", bodyHtml: "  " },
			actor,
			locals,
		);
		const row = db
			.prepare("SELECT summary, body_html FROM cms_route_variants WHERE path = ?")
			.get("/sys-ws") as { summary: string | null; body_html: string | null };
		expect(row.summary).toBeNull();
		expect(row.body_html).toBeNull();
	});

	it("metaDescription column gets summary when present, title when summary is null", async () => {
		seedSystemRoute(db, "/meta-with-summary");
		await saveRuntimeSystemRoute(
			"/meta-with-summary",
			{ title: "T1", summary: "S1" },
			actor,
			locals,
		);
		const withSum = db
			.prepare("SELECT meta_description, seo_title FROM cms_route_variants WHERE path = ?")
			.get("/meta-with-summary") as { meta_description: string; seo_title: string };
		expect(withSum.meta_description).toBe("S1");
		expect(withSum.seo_title).toBe("T1");

		seedSystemRoute(db, "/meta-no-summary");
		await saveRuntimeSystemRoute("/meta-no-summary", { title: "T2" }, actor, locals);
		const noSum = db
			.prepare("SELECT meta_description, seo_title FROM cms_route_variants WHERE path = ?")
			.get("/meta-no-summary") as { meta_description: string; seo_title: string };
		expect(noSum.meta_description).toBe("T2");
		expect(noSum.seo_title).toBe("T2");
	});

	it("revisionNote present → trimmed value persisted", async () => {
		seedSystemRoute(db, "/sys-rev");
		await saveRuntimeSystemRoute(
			"/sys-rev",
			{ title: "T", revisionNote: "  note  " },
			actor,
			locals,
		);
		const row = db
			.prepare(
				"SELECT revision_note FROM cms_route_revisions WHERE route_path = ? ORDER BY created_at DESC LIMIT 1",
			)
			.get("/sys-rev") as { revision_note: string | null };
		expect(row.revision_note).toBe("note");
	});

	it("revisionNote omitted/whitespace → stored NULL", async () => {
		seedSystemRoute(db, "/sys-no-rev");
		await saveRuntimeSystemRoute("/sys-no-rev", { title: "T" }, actor, locals);
		const r1 = db
			.prepare(
				"SELECT revision_note FROM cms_route_revisions WHERE route_path = ? ORDER BY created_at DESC LIMIT 1",
			)
			.get("/sys-no-rev") as { revision_note: string | null };
		expect(r1.revision_note).toBeNull();

		seedSystemRoute(db, "/sys-ws-rev");
		await saveRuntimeSystemRoute("/sys-ws-rev", { title: "T", revisionNote: "   " }, actor, locals);
		const r2 = db
			.prepare(
				"SELECT revision_note FROM cms_route_revisions WHERE route_path = ? ORDER BY created_at DESC LIMIT 1",
			)
			.get("/sys-ws-rev") as { revision_note: string | null };
		expect(r2.revision_note).toBeNull();
	});

	it("audit row pins action/resource_type/resource_id/summary verbatim", async () => {
		seedSystemRoute(db, "/sys-audit");
		await saveRuntimeSystemRoute("/sys-audit", { title: "T" }, actor, locals);
		const row = db
			.prepare(
				"SELECT action, resource_type, resource_id, summary FROM audit_events WHERE resource_id = ? ORDER BY created_at DESC LIMIT 1",
			)
			.get("/sys-audit") as {
			action: string;
			resource_type: string;
			resource_id: string;
			summary: string;
		};
		expect(row.action).toBe("system.update");
		expect(row.resource_type).toBe("content");
		expect(row.resource_id).toBe("/sys-audit");
		expect(row.summary).toBe("Updated system route /sys-audit.");
	});

	it("revision row id is prefixed with 'revision:<variantId>:' (non-empty UUID suffix)", async () => {
		const variantId = seedSystemRoute(db, "/sys-rev-id");
		await saveRuntimeSystemRoute("/sys-rev-id", { title: "T" }, actor, locals);
		const row = db
			.prepare(
				"SELECT id FROM cms_route_revisions WHERE route_path = ? ORDER BY created_at DESC LIMIT 1",
			)
			.get("/sys-rev-id") as { id: string };
		expect(row.id.startsWith(`revision:${variantId}:`)).toBe(true);
		expect(row.id.length).toBeGreaterThan(`revision:${variantId}:`.length);
	});

	it("snapshot_json pins all validated fields including settings null when omitted", async () => {
		seedSystemRoute(db, "/snap-null");
		await saveRuntimeSystemRoute("/snap-null", { title: "Snap" }, actor, locals);
		const row = db
			.prepare(
				"SELECT snapshot_json FROM cms_route_revisions WHERE route_path = ? ORDER BY created_at DESC LIMIT 1",
			)
			.get("/snap-null") as { snapshot_json: string };
		const snap = JSON.parse(row.snapshot_json) as Record<string, unknown>;
		expect(snap).toEqual({
			path: "/snap-null",
			title: "Snap",
			summary: null,
			bodyHtml: null,
			settings: null,
			renderStrategy: "structured_sections",
		});
	});

	it("snapshot_json threads settings object when provided", async () => {
		seedSystemRoute(db, "/snap-settings", "generated_xml");
		await saveRuntimeSystemRoute(
			"/snap-settings",
			{ title: "T", settings: { limit: 5 } },
			actor,
			locals,
		);
		const row = db
			.prepare(
				"SELECT snapshot_json FROM cms_route_revisions WHERE route_path = ? ORDER BY created_at DESC LIMIT 1",
			)
			.get("/snap-settings") as { snapshot_json: string };
		const snap = JSON.parse(row.snapshot_json) as Record<string, unknown>;
		expect(snap.settings).toEqual({ limit: 5 });
		expect(snap.renderStrategy).toBe("generated_xml");
	});

	it("returned route shape: settings undefined input becomes null in result", async () => {
		seedSystemRoute(db, "/return-shape-sys");
		const r = await saveRuntimeSystemRoute("/return-shape-sys", { title: "T" }, actor, locals);
		expect(r.ok).toBe(true);
		if (!r.ok) return;
		expect(r.route).toEqual({
			path: "/return-shape-sys",
			title: "T",
			summary: undefined,
			bodyHtml: undefined,
			settings: null,
			renderStrategy: "structured_sections",
		});
	});

	it("returned route shape: explicit settings is echoed back", async () => {
		seedSystemRoute(db, "/return-with-settings", "generated_xml");
		const r = await saveRuntimeSystemRoute(
			"/return-with-settings",
			{ title: "T", summary: "S", settings: { x: 1 } },
			actor,
			locals,
		);
		expect(r.ok).toBe(true);
		if (!r.ok) return;
		expect(r.route.settings).toEqual({ x: 1 });
		expect(r.route.summary).toBe("S");
		expect(r.route.renderStrategy).toBe("generated_xml");
	});
});

describe("getRuntimeSystemRoute — D1 row mapping & no-fallback-leak", () => {
	it("D1 row missing → returns null without consulting local registry", async () => {
		mockLoadLocalCmsRegistry.mockResolvedValueOnce(mockLocalRegistry);
		mockLocalRegistry.getSystemRoute.mockResolvedValueOnce({
			path: "/leak",
			title: "from local",
		} as unknown);
		const route = await getRuntimeSystemRoute("/no-such-system", locals);
		expect(route).toBeNull();
	});

	it("NULL row fields map to undefined in returned record (not null)", async () => {
		seedSystemRoute(db, "/sys-nulls");
		const route = await getRuntimeSystemRoute("/sys-nulls", locals);
		expect(route?.summary).toBeUndefined();
		expect(route?.bodyHtml).toBeUndefined();
	});

	it("populated summary/body_html are returned as strings", async () => {
		seedSystemRoute(db, "/sys-populated");
		db.prepare("UPDATE cms_route_variants SET summary = ?, body_html = ? WHERE path = ?").run(
			"populated summary",
			"<p>html</p>",
			"/sys-populated",
		);
		const route = await getRuntimeSystemRoute("/sys-populated", locals);
		expect(route?.summary).toBe("populated summary");
		expect(route?.bodyHtml).toBe("<p>html</p>");
	});
});

describe("listRuntimeSystemRoutes — list mapping", () => {
	it("maps each row through mapSystemRow and excludes nulls (mapSystemRow returns null only on null input — defensive .filter(Boolean))", async () => {
		seedSystemRoute(db, "/sys-a");
		seedSystemRoute(db, "/sys-b");
		const routes = await listRuntimeSystemRoutes(locals);
		const paths = routes.map((r) => r?.path).sort();
		expect(paths).toEqual(["/sys-a", "/sys-b"]);
	});
});

// ---------------------------------------------------------------------------
// listRuntimeStructuredPageRoutes
// ---------------------------------------------------------------------------

describe("listRuntimeStructuredPageRoutes", () => {
	it("returns empty array when locals are null (no registry)", async () => {
		const routes = await listRuntimeStructuredPageRoutes(null);
		expect(routes).toEqual([]);
	});

	it("returns empty array for empty DB", async () => {
		const routes = await listRuntimeStructuredPageRoutes(locals);
		expect(routes).toEqual([]);
	});

	it("returns seeded structured page routes", async () => {
		seedStructuredPageRoute(db, "/about");
		const routes = await listRuntimeStructuredPageRoutes(locals);
		expect(routes).toHaveLength(1);
		expect(routes[0].path).toBe("/about");
		expect(routes[0].templateKey).toBe("content");
	});

	it("excludes routes with invalid/missing templateKey", async () => {
		// Seed a route with no settings_json — mapStructuredPageRow returns null
		const groupId = "group-no-key";
		db.prepare(
			`INSERT INTO cms_route_groups (id, kind, render_strategy, canonical_locale, canonical_path)
       VALUES (?, 'page', 'structured_sections', 'en', '/no-key')`,
		).run(groupId);
		db.prepare(
			`INSERT INTO cms_route_variants (id, group_id, locale, path, status, title, updated_by)
       VALUES (?, ?, 'en', '/no-key', 'published', 'No Key', 'admin@test.local')`,
		).run("variant-no-key", groupId);
		const routes = await listRuntimeStructuredPageRoutes(locals);
		expect(routes.find((r) => r.path === "/no-key")).toBeUndefined();
	});

	it("falls back to local registry when D1 query throws", async () => {
		mockLoadLocalCmsRegistry.mockResolvedValueOnce(mockLocalRegistry);
		mockLocalRegistry.listStructuredPageRoutes.mockResolvedValueOnce([
			{ path: "/local-page" },
		] as unknown[]);
		const routes = await listRuntimeStructuredPageRoutes(makeFailingLocals());
		expect(routes).toEqual([{ path: "/local-page" }]);
	});
});

// ---------------------------------------------------------------------------
// getRuntimeStructuredPageRoute
// ---------------------------------------------------------------------------

describe("getRuntimeStructuredPageRoute", () => {
	it("returns null when locals are null (no registry)", async () => {
		const route = await getRuntimeStructuredPageRoute("/ghost", null);
		expect(route).toBeNull();
	});

	it("returns null for non-existent path", async () => {
		const route = await getRuntimeStructuredPageRoute("/ghost", locals);
		expect(route).toBeNull();
	});

	it("returns route for seeded structured page", async () => {
		seedStructuredPageRoute(db, "/about");
		const route = await getRuntimeStructuredPageRoute("/about", locals);
		expect(route).not.toBeNull();
		expect(route?.path).toBe("/about");
		expect(route?.templateKey).toBe("content");
	});

	it("falls back to local registry when D1 query throws", async () => {
		mockLoadLocalCmsRegistry.mockResolvedValueOnce(mockLocalRegistry);
		mockLocalRegistry.getStructuredPageRoute.mockResolvedValueOnce({
			path: "/about",
			title: "Local About",
		} as unknown);
		const route = await getRuntimeStructuredPageRoute("/about", makeFailingLocals());
		expect(route).toMatchObject({ title: "Local About" });
	});
});

// ---------------------------------------------------------------------------
// saveRuntimeStructuredPageRoute
// ---------------------------------------------------------------------------

describe("saveRuntimeStructuredPageRoute", () => {
	it("returns not-ok for non-existent path", async () => {
		const result = await saveRuntimeStructuredPageRoute(
			"/no-page",
			{ title: "T", templateKey: "content" },
			actor,
			locals,
		);
		expect(result).toMatchObject({ ok: false });
	});

	it("returns not-ok for empty title", async () => {
		seedStructuredPageRoute(db, "/about");
		const result = await saveRuntimeStructuredPageRoute(
			"/about",
			{ title: "   ", templateKey: "content" },
			actor,
			locals,
		);
		expect(result).toMatchObject({ ok: false });
	});

	it("updates a structured page route", async () => {
		seedStructuredPageRoute(db, "/about");
		const result = await saveRuntimeStructuredPageRoute(
			"/about",
			{
				title: "About Us",
				summary: "Our story",
				templateKey: "content",
				sections: { hero: { text: "Welcome" } },
				alternateLinks: [{ hreflang: "es", href: "/es/about" }],
			},
			actor,
			locals,
		);
		expect(result).toMatchObject({ ok: true });
		const row = db.prepare("SELECT title FROM cms_route_variants WHERE path = '/about'").get() as {
			title: string;
		};
		expect(row.title).toBe("About Us");
	});

	it("updates with all optional fields and reads back non-null values", async () => {
		seedStructuredPageRoute(db, "/full-opts");
		const result = await saveRuntimeStructuredPageRoute(
			"/full-opts",
			{
				title: "Full Options",
				summary: "A rich page",
				seoTitle: "Custom SEO",
				metaDescription: "Custom meta",
				canonicalUrlOverride: "https://example.com/full-opts",
				robotsDirective: "noindex",
				ogImage: "/img/og.jpg",
				templateKey: "content",
				alternateLinks: [{ hreflang: "es", href: "/es/full-opts" }],
				sections: { hero: { text: "Hello" } },
				revisionNote: "All fields updated",
			},
			actor,
			locals,
		);
		expect(result).toMatchObject({ ok: true });
		const route = await getRuntimeStructuredPageRoute("/full-opts", locals);
		expect(route?.summary).toBe("A rich page");
		expect(route?.seoTitle).toBe("Custom SEO");
		expect(route?.canonicalUrlOverride).toBe("https://example.com/full-opts");
	});

	it("returns not-ok when locals are null and no local registry is available", async () => {
		const result = await saveRuntimeStructuredPageRoute(
			"/about",
			{ title: "T", templateKey: "content" },
			actor,
			null,
		);
		expect(result).toMatchObject({ ok: false });
	});

	it("saves without optional fields and reads back with undefined for omitted values", async () => {
		seedStructuredPageRoute(db, "/minimal-page");
		const result = await saveRuntimeStructuredPageRoute(
			"/minimal-page",
			{ title: "Minimal", templateKey: "content" },
			actor,
			locals,
		);
		expect(result).toMatchObject({ ok: true });
		const route = await getRuntimeStructuredPageRoute("/minimal-page", locals);
		expect(route?.summary).toBeUndefined();
		expect(route?.seoTitle).toBe("Minimal");
	});

	it("delegates to local registry when locals=null and local registry is available", async () => {
		mockLoadLocalCmsRegistry.mockResolvedValueOnce(mockLocalRegistry);
		const result = await saveRuntimeStructuredPageRoute(
			"/about",
			{ title: "T", templateKey: "content" },
			actor,
			null,
		);
		expect(result).toMatchObject({ ok: true });
	});
});

// ---------------------------------------------------------------------------
// createRuntimeStructuredPageRoute
// ---------------------------------------------------------------------------

describe("createRuntimeStructuredPageRoute", () => {
	it("creates a new structured page route", async () => {
		const result = await createRuntimeStructuredPageRoute(
			"/new-page",
			{ title: "New Page", templateKey: "content" },
			actor,
			locals,
		);
		expect(result).toMatchObject({ ok: true });
		const row = db.prepare("SELECT path FROM cms_route_variants WHERE path = '/new-page'").get() as
			| { path: string }
			| undefined;
		expect(row?.path).toBe("/new-page");
	});

	it("normalises path without leading slash", async () => {
		const result = await createRuntimeStructuredPageRoute(
			"services",
			{ title: "Services", templateKey: "content" },
			actor,
			locals,
		);
		expect(result).toMatchObject({ ok: true });
		const row = db.prepare("SELECT path FROM cms_route_variants WHERE path = '/services'").get() as
			| { path: string }
			| undefined;
		expect(row?.path).toBe("/services");
	});

	it("rejects duplicate path", async () => {
		seedStructuredPageRoute(db, "/about");
		const result = await createRuntimeStructuredPageRoute(
			"/about",
			{ title: "About", templateKey: "content" },
			actor,
			locals,
		);
		expect(result).toMatchObject({ ok: false });
		expect((result as { error: string }).error).toContain("already in use");
	});

	it("rejects empty title", async () => {
		const result = await createRuntimeStructuredPageRoute(
			"/blank-title",
			{ title: "   ", templateKey: "content" },
			actor,
			locals,
		);
		expect(result).toMatchObject({ ok: false });
	});

	it("returns not-ok when locals are null and no local registry is available", async () => {
		const result = await createRuntimeStructuredPageRoute(
			"/x",
			{ title: "X", templateKey: "content" },
			actor,
			null,
		);
		expect(result).toMatchObject({ ok: false });
	});

	it("creates without optional fields and reads back with undefined for omitted values", async () => {
		const result = await createRuntimeStructuredPageRoute(
			"/minimal-create",
			{ title: "Minimal Create", templateKey: "content" },
			actor,
			locals,
		);
		expect(result).toMatchObject({ ok: true });
		const route = await getRuntimeStructuredPageRoute("/minimal-create", locals);
		expect(route?.summary).toBeUndefined();
		expect(route?.seoTitle).toBe("Minimal Create");
	});

	it("delegates to local registry when locals=null and local registry is available", async () => {
		mockLoadLocalCmsRegistry.mockResolvedValueOnce(mockLocalRegistry);
		const result = await createRuntimeStructuredPageRoute(
			"/z",
			{ title: "Z", templateKey: "content" },
			actor,
			null,
		);
		expect(result).toMatchObject({ ok: true });
	});

	it("creates a Spanish locale route from /es/ path", async () => {
		const result = await createRuntimeStructuredPageRoute(
			"/es/nueva-pagina",
			{ title: "Nueva Pagina", templateKey: "content" },
			actor,
			locals,
		);
		expect(result).toMatchObject({ ok: true });
	});

	it("creates a route with all optional fields and reads back non-null values", async () => {
		const result = await createRuntimeStructuredPageRoute(
			"/complete-page",
			{
				title: "Complete Page",
				summary: "Page summary",
				seoTitle: "SEO Title Override",
				metaDescription: "Custom meta description",
				canonicalUrlOverride: "https://example.com/complete-page",
				robotsDirective: "noindex,nofollow",
				ogImage: "/images/og-complete.jpg",
				templateKey: "content",
				alternateLinks: [{ hreflang: "es", href: "/es/complete-page" }],
				sections: { hero: { text: "Welcome" }, body: { text: "Content" } },
				revisionNote: "Initial creation with all fields",
			},
			actor,
			locals,
		);
		expect(result).toMatchObject({ ok: true });
		const route = await getRuntimeStructuredPageRoute("/complete-page", locals);
		expect(route?.summary).toBe("Page summary");
		expect(route?.seoTitle).toBe("SEO Title Override");
		expect(route?.canonicalUrlOverride).toBe("https://example.com/complete-page");
		expect(route?.robotsDirective).toBe("noindex,nofollow");
		expect(route?.ogImage).toBe("/images/og-complete.jpg");
	});
});

// ---------------------------------------------------------------------------
// getRuntimeArchiveRoute
// ---------------------------------------------------------------------------

describe("getRuntimeArchiveRoute", () => {
	it("returns null for non-existent archive", async () => {
		const route = await getRuntimeArchiveRoute("/blog", locals);
		expect(route).toBeNull();
	});

	it("returns archive for seeded route", async () => {
		seedArchiveRoute(db, "/blog");
		const route = await getRuntimeArchiveRoute("/blog", locals);
		expect(route).not.toBeNull();
		expect(route?.path).toBe("/blog");
	});

	it("returns null when locals are null (no registry)", async () => {
		const route = await getRuntimeArchiveRoute("/blog", null);
		expect(route).toBeNull();
	});

	it("delegates to local registry when locals=null and local registry is available", async () => {
		mockLoadLocalCmsRegistry.mockResolvedValueOnce(mockLocalRegistry);
		const route = await getRuntimeArchiveRoute("/blog", null);
		expect(route).toBeNull(); // mock returns null
	});

	it("falls back to local registry when D1 query throws", async () => {
		mockLoadLocalCmsRegistry.mockResolvedValueOnce(mockLocalRegistry);
		mockLocalRegistry.getArchiveRoute.mockResolvedValueOnce({
			path: "/blog",
			title: "Local Blog",
		} as unknown);
		const route = await getRuntimeArchiveRoute("/blog", makeFailingLocals());
		expect(route).toMatchObject({ title: "Local Blog" });
	});
});

// ---------------------------------------------------------------------------
// saveRuntimeArchiveRoute
// ---------------------------------------------------------------------------

describe("saveRuntimeArchiveRoute", () => {
	it("returns not-ok for non-existent archive", async () => {
		const result = await saveRuntimeArchiveRoute("/no-archive", { title: "T" }, actor, locals);
		expect(result).toMatchObject({ ok: false });
	});

	it("returns not-ok for empty title", async () => {
		seedArchiveRoute(db, "/blog");
		const result = await saveRuntimeArchiveRoute("/blog", { title: "   " }, actor, locals);
		expect(result).toMatchObject({ ok: false });
	});

	it("updates a seeded archive route", async () => {
		seedArchiveRoute(db, "/blog");
		const result = await saveRuntimeArchiveRoute(
			"/blog",
			{
				title: "The Blog",
				summary: "Latest posts",
				seoTitle: "Blog SEO",
				metaDescription: "All the posts",
				robotsDirective: "index,follow",
			},
			actor,
			locals,
		);
		expect(result).toMatchObject({ ok: true });
		const row = db.prepare("SELECT title FROM cms_route_variants WHERE path = '/blog'").get() as {
			title: string;
		};
		expect(row.title).toBe("The Blog");
	});

	it("updates archive with all optional fields and reads back non-null values", async () => {
		seedArchiveRoute(db, "/full-archive");
		const result = await saveRuntimeArchiveRoute(
			"/full-archive",
			{
				title: "Full Archive",
				summary: "All posts",
				seoTitle: "Archive SEO Title",
				metaDescription: "Archive meta description",
				canonicalUrlOverride: "https://example.com/archive",
				robotsDirective: "index,follow",
				revisionNote: "Complete archive update",
			},
			actor,
			locals,
		);
		expect(result).toMatchObject({ ok: true });
		const route = await getRuntimeArchiveRoute("/full-archive", locals);
		expect(route?.summary).toBe("All posts");
		expect(route?.seoTitle).toBe("Archive SEO Title");
		expect(route?.canonicalUrlOverride).toBe("https://example.com/archive");
	});

	it("saves without optional fields and reads back with undefined for omitted values", async () => {
		seedArchiveRoute(db, "/minimal-archive");
		const result = await saveRuntimeArchiveRoute(
			"/minimal-archive",
			{ title: "Minimal" },
			actor,
			locals,
		);
		expect(result).toMatchObject({ ok: true });
		const route = await getRuntimeArchiveRoute("/minimal-archive", locals);
		expect(route?.summary).toBeUndefined();
		expect(route?.robotsDirective).toBeUndefined();
	});

	it("returns not-ok when locals are null and no local registry is available", async () => {
		const result = await saveRuntimeArchiveRoute("/blog", { title: "T" }, actor, null);
		expect(result).toMatchObject({ ok: false });
	});

	it("delegates to local registry when locals=null and local registry is available", async () => {
		mockLoadLocalCmsRegistry.mockResolvedValueOnce(mockLocalRegistry);
		const result = await saveRuntimeArchiveRoute("/blog", { title: "T" }, actor, null);
		expect(result).toMatchObject({ ok: true });
	});
});

// ---------------------------------------------------------------------------
// runtime-route-registry-archives — pin defaults, fallbacks, audit strings
// ---------------------------------------------------------------------------

describe("saveRuntimeArchiveRoute — input validation defaults", () => {
	it("metaDescription empty AND summary empty → stored as empty string", async () => {
		seedArchiveRoute(db, "/empty-meta");
		const r = await saveRuntimeArchiveRoute("/empty-meta", { title: "T" }, actor, locals);
		expect(r).toMatchObject({ ok: true });
		const row = db
			.prepare("SELECT meta_description, summary FROM cms_route_variants WHERE path = ?")
			.get("/empty-meta") as { meta_description: string; summary: string | null };
		expect(row.meta_description).toBe("");
		expect(row.summary).toBeNull();
	});

	it("metaDescription empty BUT summary present → metaDescription falls back to summary", async () => {
		seedArchiveRoute(db, "/meta-from-summary");
		const r = await saveRuntimeArchiveRoute(
			"/meta-from-summary",
			{ title: "T", summary: "All the posts" },
			actor,
			locals,
		);
		expect(r).toMatchObject({ ok: true });
		const row = db
			.prepare("SELECT meta_description FROM cms_route_variants WHERE path = ?")
			.get("/meta-from-summary") as { meta_description: string };
		expect(row.meta_description).toBe("All the posts");
	});

	it("metaDescription present → wins over summary", async () => {
		seedArchiveRoute(db, "/meta-explicit");
		const r = await saveRuntimeArchiveRoute(
			"/meta-explicit",
			{ title: "T", summary: "From summary", metaDescription: "Explicit meta" },
			actor,
			locals,
		);
		expect(r).toMatchObject({ ok: true });
		const row = db
			.prepare("SELECT meta_description FROM cms_route_variants WHERE path = ?")
			.get("/meta-explicit") as { meta_description: string };
		expect(row.meta_description).toBe("Explicit meta");
	});

	it("seoTitle empty → falls back to the trimmed title", async () => {
		seedArchiveRoute(db, "/seo-fallback");
		const r = await saveRuntimeArchiveRoute(
			"/seo-fallback",
			{ title: "My Title", seoTitle: "   " },
			actor,
			locals,
		);
		expect(r).toMatchObject({ ok: true });
		const row = db
			.prepare("SELECT seo_title FROM cms_route_variants WHERE path = ?")
			.get("/seo-fallback") as { seo_title: string };
		expect(row.seo_title).toBe("My Title");
	});

	it("trims all inputs before persistence and fallback evaluation", async () => {
		seedArchiveRoute(db, "/trim-all");
		await saveRuntimeArchiveRoute(
			"/trim-all",
			{
				title: "  T  ",
				summary: "  S  ",
				seoTitle: "  Seo  ",
				metaDescription: "  M  ",
				canonicalUrlOverride: "  https://x.test  ",
				robotsDirective: "  noindex  ",
			},
			actor,
			locals,
		);
		const row = db
			.prepare(
				"SELECT title, summary, seo_title, meta_description, canonical_url_override, robots_directive FROM cms_route_variants WHERE path = ?",
			)
			.get("/trim-all") as {
			title: string;
			summary: string;
			seo_title: string;
			meta_description: string;
			canonical_url_override: string;
			robots_directive: string;
		};
		expect(row).toEqual({
			title: "T",
			summary: "S",
			seo_title: "Seo",
			meta_description: "M",
			canonical_url_override: "https://x.test",
			robots_directive: "noindex",
		});
	});

	it("canonicalUrlOverride / robotsDirective omitted → stored NULL (not empty string)", async () => {
		seedArchiveRoute(db, "/nullables");
		await saveRuntimeArchiveRoute("/nullables", { title: "T" }, actor, locals);
		const row = db
			.prepare(
				"SELECT canonical_url_override, robots_directive, summary FROM cms_route_variants WHERE path = ?",
			)
			.get("/nullables") as {
			canonical_url_override: string | null;
			robots_directive: string | null;
			summary: string | null;
		};
		expect(row.canonical_url_override).toBeNull();
		expect(row.robots_directive).toBeNull();
		expect(row.summary).toBeNull();
	});

	it("empty title (whitespace) returns exact error string", async () => {
		seedArchiveRoute(db, "/blank-title");
		const r = await saveRuntimeArchiveRoute("/blank-title", { title: "   " }, actor, locals);
		expect(r).toEqual({ ok: false, error: "A title is required." });
	});

	it("non-existent archive returns exact error string", async () => {
		const r = await saveRuntimeArchiveRoute("/nope", { title: "T" }, actor, locals);
		expect(r).toEqual({ ok: false, error: "The selected archive route could not be found." });
	});

	it("locals=null without local registry returns exact unavailable error", async () => {
		const r = await saveRuntimeArchiveRoute("/blog", { title: "T" }, actor, null);
		expect(r).toEqual({ ok: false, error: "The runtime content registry is unavailable." });
	});
});

describe("saveRuntimeArchiveRoute — revision and audit side effects", () => {
	it("revisionNote present → trimmed value persisted in cms_route_revisions", async () => {
		seedArchiveRoute(db, "/rev-with-note");
		await saveRuntimeArchiveRoute(
			"/rev-with-note",
			{ title: "T", revisionNote: "  Initial draft  " },
			actor,
			locals,
		);
		const row = db
			.prepare(
				"SELECT revision_note FROM cms_route_revisions WHERE route_path = ? ORDER BY created_at DESC LIMIT 1",
			)
			.get("/rev-with-note") as { revision_note: string | null };
		expect(row.revision_note).toBe("Initial draft");
	});

	it("revisionNote omitted → stored NULL", async () => {
		seedArchiveRoute(db, "/rev-no-note");
		await saveRuntimeArchiveRoute("/rev-no-note", { title: "T" }, actor, locals);
		const row = db
			.prepare(
				"SELECT revision_note FROM cms_route_revisions WHERE route_path = ? ORDER BY created_at DESC LIMIT 1",
			)
			.get("/rev-no-note") as { revision_note: string | null };
		expect(row.revision_note).toBeNull();
	});

	it("revisionNote whitespace-only → stored NULL", async () => {
		seedArchiveRoute(db, "/rev-ws-note");
		await saveRuntimeArchiveRoute(
			"/rev-ws-note",
			{ title: "T", revisionNote: "   " },
			actor,
			locals,
		);
		const row = db
			.prepare(
				"SELECT revision_note FROM cms_route_revisions WHERE route_path = ? ORDER BY created_at DESC LIMIT 1",
			)
			.get("/rev-ws-note") as { revision_note: string | null };
		expect(row.revision_note).toBeNull();
	});

	it("audit row pins action/category/target_id/summary verbatim", async () => {
		seedArchiveRoute(db, "/audit-pin");
		await saveRuntimeArchiveRoute("/audit-pin", { title: "T" }, actor, locals);
		const row = db
			.prepare(
				"SELECT action, resource_type, resource_id, summary FROM audit_events WHERE resource_id = ? ORDER BY created_at DESC LIMIT 1",
			)
			.get("/audit-pin") as {
			action: string;
			resource_type: string;
			resource_id: string;
			summary: string;
		};
		expect(row.action).toBe("archive.update");
		expect(row.resource_type).toBe("content");
		expect(row.resource_id).toBe("/audit-pin");
		expect(row.summary).toBe("Updated archive route /audit-pin.");
	});

	it("revision snapshot_json pins all validated fields", async () => {
		seedArchiveRoute(db, "/snapshot-pin");
		await saveRuntimeArchiveRoute(
			"/snapshot-pin",
			{
				title: "Snap Title",
				summary: "Snap summary",
				seoTitle: "Snap SEO",
				metaDescription: "Snap meta",
				canonicalUrlOverride: "https://x.test/snap",
				robotsDirective: "noindex",
			},
			actor,
			locals,
		);
		const row = db
			.prepare(
				"SELECT snapshot_json FROM cms_route_revisions WHERE route_path = ? ORDER BY created_at DESC LIMIT 1",
			)
			.get("/snapshot-pin") as { snapshot_json: string };
		const snap = JSON.parse(row.snapshot_json) as Record<string, unknown>;
		expect(snap).toEqual({
			path: "/snapshot-pin",
			title: "Snap Title",
			summary: "Snap summary",
			seoTitle: "Snap SEO",
			metaDescription: "Snap meta",
			canonicalUrlOverride: "https://x.test/snap",
			robotsDirective: "noindex",
		});
	});

	it("returned route on success threads validated fields and converts nullables to undefined", async () => {
		seedArchiveRoute(db, "/return-shape");
		const r = await saveRuntimeArchiveRoute(
			"/return-shape",
			{
				title: "RT",
				summary: "RS",
				canonicalUrlOverride: "https://x.test/r",
				robotsDirective: "follow",
			},
			actor,
			locals,
		);
		expect(r.ok).toBe(true);
		if (!r.ok) return;
		expect(r.route).toEqual({
			path: "/return-shape",
			title: "RT",
			summary: "RS",
			seoTitle: "RT",
			metaDescription: "RS",
			canonicalUrlOverride: "https://x.test/r",
			robotsDirective: "follow",
		});
	});

	it("returned route omits null optional fields by mapping to undefined", async () => {
		seedArchiveRoute(db, "/return-min");
		const r = await saveRuntimeArchiveRoute("/return-min", { title: "Only" }, actor, locals);
		expect(r.ok).toBe(true);
		if (!r.ok) return;
		expect(r.route.summary).toBeUndefined();
		expect(r.route.canonicalUrlOverride).toBeUndefined();
		expect(r.route.robotsDirective).toBeUndefined();
		expect(r.route.metaDescription).toBe("");
		expect(r.route.seoTitle).toBe("Only");
	});
});

describe("getRuntimeArchiveRoute — D1 row mapping", () => {
	it("maps meta_description text to .metaDescription field (?? undefined preserves the string)", async () => {
		seedArchiveRoute(db, "/has-meta");
		db.prepare("UPDATE cms_route_variants SET meta_description = ? WHERE path = ?").run(
			"populated meta",
			"/has-meta",
		);
		const route = await getRuntimeArchiveRoute("/has-meta", locals);
		expect(route?.metaDescription).toBe("populated meta");
	});

	it("D1 row missing → returns null without consulting local registry (no fallback leak)", async () => {
		mockLoadLocalCmsRegistry.mockResolvedValueOnce(mockLocalRegistry);
		mockLocalRegistry.getArchiveRoute.mockResolvedValueOnce({
			path: "/should-not-leak",
			title: "from local",
		} as unknown);
		const route = await getRuntimeArchiveRoute("/no-such-archive", locals);
		expect(route).toBeNull();
	});

	it("revision row id is prefixed with 'revision:<variantId>:'", async () => {
		const variantId = seedArchiveRoute(db, "/rev-id-pin");
		await saveRuntimeArchiveRoute("/rev-id-pin", { title: "T" }, actor, locals);
		const row = db
			.prepare(
				"SELECT id FROM cms_route_revisions WHERE route_path = ? ORDER BY created_at DESC LIMIT 1",
			)
			.get("/rev-id-pin") as { id: string };
		expect(row.id.startsWith(`revision:${variantId}:`)).toBe(true);
		expect(row.id.length).toBeGreaterThan(`revision:${variantId}:`.length);
	});

	it("NULL row fields become undefined (not null) in returned record", async () => {
		seedArchiveRoute(db, "/has-nulls");
		const route = await getRuntimeArchiveRoute("/has-nulls", locals);
		expect(route?.summary).toBeUndefined();
		expect(route?.seoTitle).toBeUndefined();
		expect(route?.metaDescription).toBeUndefined();
		expect(route?.canonicalUrlOverride).toBeUndefined();
		expect(route?.robotsDirective).toBeUndefined();
	});
});

// ---------------------------------------------------------------------------
// D1 error recovery — withSafeRouteRegistryFallback catch block
// ---------------------------------------------------------------------------

describe("D1 error recovery — withSafeRouteRegistryFallback", () => {
	it("returns default value when D1 throws and no local registry is available", async () => {
		seedSystemRoute(db, "/sitemap.xml");
		// Drop the table so the D1 query throws; mock default rejects (no local modules)
		db.exec("DROP TABLE cms_route_variants");
		const routes = await listRuntimeSystemRoutes(locals);
		expect(routes).toEqual([]);
	});

	it("returns null default when D1 throws on a single-record fetch and no local registry is available", async () => {
		seedSystemRoute(db, "/contact");
		db.exec("DROP TABLE cms_route_variants");
		const route = await getRuntimeSystemRoute("/contact", locals);
		expect(route).toBeNull();
	});

	it("delegates to local registry when D1 throws and local registry is available", async () => {
		const mockRoute = {
			path: "/sitemap.xml",
			title: "Sitemap",
			renderStrategy: "generated_xml" as const,
			settings: null,
			updatedAt: "2024-01-01",
		};
		mockLoadLocalCmsRegistry.mockResolvedValueOnce({
			...mockLocalRegistry,
			listSystemRoutes: vi.fn().mockResolvedValue([mockRoute]),
		});
		db.exec("DROP TABLE cms_route_variants");
		const routes = await listRuntimeSystemRoutes(locals);
		expect(routes).toEqual([mockRoute]);
	});
});

// ---------------------------------------------------------------------------
// parseSettings — malformed or non-object JSON in D1 data
// ---------------------------------------------------------------------------

describe("parseSettings — malformed settings_json in D1 data", () => {
	it("returns null settings when settings_json is malformed JSON", async () => {
		const groupId = "group-malformed";
		db.prepare(
			"INSERT INTO cms_route_groups (id, kind, render_strategy, canonical_locale, canonical_path) VALUES (?, 'system', 'generated_text', 'en', '/robots-txt')",
		).run(groupId);
		db.prepare(
			"INSERT INTO cms_route_variants (id, group_id, locale, path, status, title, settings_json, updated_by) VALUES (?, ?, 'en', '/robots-txt', 'published', 'Robots', '{ bad json', 'seed')",
		).run("v-malformed", groupId);
		const route = await getRuntimeSystemRoute("/robots-txt", locals);
		expect(route).not.toBeNull();
		expect(route?.settings).toBeNull();
	});

	it("returns null settings when settings_json is a JSON primitive (not an object)", async () => {
		const groupId = "group-primitive";
		db.prepare(
			"INSERT INTO cms_route_groups (id, kind, render_strategy, canonical_locale, canonical_path) VALUES (?, 'system', 'generated_text', 'en', '/feed.xml')",
		).run(groupId);
		db.prepare(
			"INSERT INTO cms_route_variants (id, group_id, locale, path, status, title, settings_json, updated_by) VALUES (?, ?, 'en', '/feed.xml', 'published', 'Feed', 'true', 'seed')",
		).run("v-primitive", groupId);
		const route = await getRuntimeSystemRoute("/feed.xml", locals);
		expect(route).not.toBeNull();
		expect(route?.settings).toBeNull();
	});
});

// ---------------------------------------------------------------------------
// mapStructuredPageRow — alternateLinks and templateKey edge cases
// ---------------------------------------------------------------------------

describe("mapStructuredPageRow — edge cases in page settings_json", () => {
	it("falls back to empty alternateLinks when settings_json has a non-array alternateLinks value", async () => {
		const groupId = "group-non-array-links";
		const settingsJson = JSON.stringify({
			templateKey: "content",
			alternateLinks: "not-an-array",
		});
		db.prepare(
			"INSERT INTO cms_route_groups (id, kind, render_strategy, canonical_locale, canonical_path) VALUES (?, 'page', 'structured_sections', 'en', '/non-array-links')",
		).run(groupId);
		db.prepare(
			"INSERT INTO cms_route_variants (id, group_id, locale, path, status, title, settings_json, updated_by) VALUES (?, ?, 'en', '/non-array-links', 'published', 'Non-Array Links', ?, 'seed')",
		).run("v-non-array-links", groupId, settingsJson);
		const route = await getRuntimeStructuredPageRoute("/non-array-links", locals);
		expect(route).not.toBeNull();
		expect(route?.alternateLinks).toEqual([]);
	});

	it("excludes page routes whose templateKey is not in the configured template keys", async () => {
		const groupId = "group-unknown-template";
		const settingsJson = JSON.stringify({ templateKey: "unknown-template" });
		db.prepare(
			"INSERT INTO cms_route_groups (id, kind, render_strategy, canonical_locale, canonical_path) VALUES (?, 'page', 'structured_sections', 'en', '/unknown-template')",
		).run(groupId);
		db.prepare(
			"INSERT INTO cms_route_variants (id, group_id, locale, path, status, title, settings_json, updated_by) VALUES (?, ?, 'en', '/unknown-template', 'published', 'Unknown Template', ?, 'seed')",
		).run("v-unknown-template", groupId, settingsJson);
		// Single-record fetch returns null (templateKey not configured)
		expect(await getRuntimeStructuredPageRoute("/unknown-template", locals)).toBeNull();
		// List also omits this route
		const routes = await listRuntimeStructuredPageRoutes(locals);
		expect(routes.some((r) => r.path === "/unknown-template")).toBe(false);
	});
});
