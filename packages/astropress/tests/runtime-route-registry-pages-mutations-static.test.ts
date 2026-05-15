// Static-import counterpart to runtime-route-registry.test.ts. The sibling
// uses dynamic imports + vi.resetModules to swap in local-registry mocks,
// which breaks stryker per-test coverage tracking for this source file.
// This file pins the audit-event content, exact error strings, settings-JSON
// shape, trim behaviour, and alternate-links/sections defaulting for every
// branch of saveRuntimeStructuredPageRoute and createRuntimeStructuredPageRoute.
import type { DatabaseSync } from "node:sqlite";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { registerCms } from "../src/config";
import {
	createRuntimeStructuredPageRoute,
	saveRuntimeStructuredPageRoute,
} from "../src/runtime-route-registry-pages-mutations.js";
import { makeDb, STANDARD_ACTOR } from "./helpers/make-db.js";
import { makeLocals } from "./helpers/make-locals.js";

const { mockLoadLocalCmsRegistry } = vi.hoisted(() => ({
	mockLoadLocalCmsRegistry: vi.fn(),
}));

vi.mock("../src/local-runtime-modules", () => ({
	loadLocalCmsRegistry: mockLoadLocalCmsRegistry,
}));
vi.mock("../src/local-runtime-modules.js", () => ({
	loadLocalCmsRegistry: mockLoadLocalCmsRegistry,
}));

const actor = STANDARD_ACTOR;
let db: DatabaseSync;
let locals: App.Locals;

beforeEach(() => {
	db = makeDb();
	locals = makeLocals(db);
	registerCms({
		templateKeys: ["content"],
		siteUrl: "https://example.com",
		seedPages: [],
		archives: [],
		translationStatus: [],
	});
	// Default: loading the local registry throws (no host).
	mockLoadLocalCmsRegistry.mockReset();
	mockLoadLocalCmsRegistry.mockRejectedValue(new Error("no host"));
});

function seedStructuredPageRoute(path: string, templateKey = "content") {
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

describe("saveRuntimeStructuredPageRoute — branches and content pinning", () => {
	it("returns the exact 'could not be found' error for an unknown path", async () => {
		const result = await saveRuntimeStructuredPageRoute(
			"/missing",
			{ title: "T", templateKey: "content" },
			actor,
			locals,
		);
		expect(result).toEqual({
			ok: false,
			error: "The selected route page could not be found.",
		});
	});

	it("returns the exact 'title required' error when title is whitespace", async () => {
		seedStructuredPageRoute("/p");
		const result = await saveRuntimeStructuredPageRoute(
			"/p",
			{ title: "   ", templateKey: "content" },
			actor,
			locals,
		);
		expect(result).toEqual({ ok: false, error: "A title is required." });
	});

	it("returns the exact 'registry unavailable' error when locals=null and no local registry exists", async () => {
		const result = await saveRuntimeStructuredPageRoute(
			"/x",
			{ title: "T", templateKey: "content" },
			actor,
			null,
		);
		expect(result).toEqual({
			ok: false,
			error: "The runtime content registry is unavailable.",
		});
	});

	it("trims title, summary, seoTitle, metaDescription, canonicalUrlOverride, robotsDirective, ogImage before persisting", async () => {
		seedStructuredPageRoute("/trim");
		await saveRuntimeStructuredPageRoute(
			"/trim",
			{
				title: "  Title  ",
				summary: "  Sum  ",
				seoTitle: "  SeoT  ",
				metaDescription: "  Meta  ",
				canonicalUrlOverride: "  https://c  ",
				robotsDirective: "  noindex  ",
				ogImage: "  https://og  ",
				templateKey: "content",
				alternateLinks: [{ hreflang: "en", href: "/" }],
				sections: { hero: { kind: "hero" } },
			},
			actor,
			locals,
		);
		const row = db
			.prepare(
				"SELECT title, summary, seo_title, meta_description, canonical_url_override, robots_directive, og_image, settings_json, sections_json, updated_by FROM cms_route_variants WHERE path = '/trim'",
			)
			.get() as Record<string, string>;
		expect(row).toMatchObject({
			title: "Title",
			summary: "Sum",
			seo_title: "SeoT",
			meta_description: "Meta",
			canonical_url_override: "https://c",
			robots_directive: "noindex",
			og_image: "https://og",
			updated_by: actor.email,
		});
		const settings = JSON.parse(row.settings_json as string);
		expect(settings).toEqual({
			templateKey: "content",
			alternateLinks: [{ hreflang: "en", href: "/" }],
		});
		const sections = JSON.parse(row.sections_json as string);
		expect(sections).toEqual({ hero: { kind: "hero" } });
	});

	it("falls back to title when seoTitle is omitted, and to summary→title cascade for metaDescription", async () => {
		seedStructuredPageRoute("/fall");
		await saveRuntimeStructuredPageRoute(
			"/fall",
			{ title: "Main Title", summary: "Sumry", templateKey: "content" },
			actor,
			locals,
		);
		const row = db
			.prepare("SELECT seo_title, meta_description FROM cms_route_variants WHERE path = '/fall'")
			.get() as { seo_title: string; meta_description: string };
		expect(row.seo_title).toBe("Main Title");
		expect(row.meta_description).toBe("Sumry");

		seedStructuredPageRoute("/fall2");
		await saveRuntimeStructuredPageRoute(
			"/fall2",
			{ title: "Only Title", templateKey: "content" },
			actor,
			locals,
		);
		const row2 = db
			.prepare("SELECT seo_title, meta_description FROM cms_route_variants WHERE path = '/fall2'")
			.get() as { seo_title: string; meta_description: string };
		expect(row2.seo_title).toBe("Only Title");
		expect(row2.meta_description).toBe("Only Title");
	});

	it("stores null for summary, canonical, robots, ogImage when those are omitted", async () => {
		seedStructuredPageRoute("/null");
		await saveRuntimeStructuredPageRoute(
			"/null",
			{ title: "T", templateKey: "content" },
			actor,
			locals,
		);
		const row = db
			.prepare(
				"SELECT summary, canonical_url_override, robots_directive, og_image, sections_json FROM cms_route_variants WHERE path = '/null'",
			)
			.get() as Record<string, string | null>;
		expect(row.summary).toBeNull();
		expect(row.canonical_url_override).toBeNull();
		expect(row.robots_directive).toBeNull();
		expect(row.og_image).toBeNull();
		expect(row.sections_json).toBeNull();
	});

	it("writes a system.update audit event with the route path in the summary", async () => {
		seedStructuredPageRoute("/audit");
		await saveRuntimeStructuredPageRoute(
			"/audit",
			{ title: "T", templateKey: "content" },
			actor,
			locals,
		);
		const row = db
			.prepare(
				"SELECT user_email, action, resource_type, resource_id, summary FROM audit_events ORDER BY id DESC LIMIT 1",
			)
			.get() as Record<string, string>;
		expect(row).toEqual({
			user_email: actor.email,
			action: "system.update",
			resource_type: "content",
			resource_id: "/audit",
			summary: "Updated system route /audit.",
		});
	});

	it("trims revisionNote (whitespace becomes null in the revision row)", async () => {
		seedStructuredPageRoute("/rev");
		await saveRuntimeStructuredPageRoute(
			"/rev",
			{ title: "T", templateKey: "content", revisionNote: "   " },
			actor,
			locals,
		);
		const row = db
			.prepare("SELECT revision_note FROM cms_route_revisions ORDER BY id DESC LIMIT 1")
			.get() as { revision_note: string | null };
		expect(row.revision_note).toBeNull();

		seedStructuredPageRoute("/rev2");
		await saveRuntimeStructuredPageRoute(
			"/rev2",
			{ title: "T", templateKey: "content", revisionNote: "  edited  " },
			actor,
			locals,
		);
		const row2 = db
			.prepare("SELECT revision_note FROM cms_route_revisions WHERE route_path = '/rev2'")
			.get() as { revision_note: string };
		expect(row2.revision_note).toBe("edited");
	});

	it("revision id is prefixed 'revision:<variantId>:' and snapshot_json carries the canonical fields", async () => {
		const variantId = seedStructuredPageRoute("/snap");
		await saveRuntimeStructuredPageRoute(
			"/snap",
			{
				title: "T",
				summary: "S",
				templateKey: "content",
				alternateLinks: [{ hreflang: "fr", href: "/fr" }],
				sections: { a: 1 },
			},
			actor,
			locals,
		);
		const row = db
			.prepare("SELECT id, snapshot_json FROM cms_route_revisions ORDER BY id DESC LIMIT 1")
			.get() as { id: string; snapshot_json: string };
		expect(row.id.startsWith(`revision:${variantId}:`)).toBe(true);
		expect(row.id.length).toBeGreaterThan(`revision:${variantId}:`.length);
		const snap = JSON.parse(row.snapshot_json);
		expect(snap).toMatchObject({
			path: "/snap",
			title: "T",
			summary: "S",
			templateKey: "content",
			alternateLinks: [{ hreflang: "fr", href: "/fr" }],
			sections: { a: 1 },
		});
	});

	it("returned route shape echoes the input and defaults alternateLinks=[] / sections=null", async () => {
		seedStructuredPageRoute("/shape");
		const result = (await saveRuntimeStructuredPageRoute(
			"/shape",
			{ title: "T", templateKey: "content" },
			actor,
			locals,
		)) as { ok: true; route: Record<string, unknown> };
		expect(result.ok).toBe(true);
		expect(result.route).toEqual({
			path: "/shape",
			title: "T",
			summary: undefined,
			seoTitle: "T",
			metaDescription: "T",
			canonicalUrlOverride: undefined,
			robotsDirective: undefined,
			ogImage: undefined,
			templateKey: "content",
			alternateLinks: [],
			sections: null,
		});
	});
});

describe("createRuntimeStructuredPageRoute — branches and content pinning", () => {
	it("returns the exact 'already in use' error when path is taken", async () => {
		seedStructuredPageRoute("/dup");
		const result = await createRuntimeStructuredPageRoute(
			"/dup",
			{ title: "T", templateKey: "content" },
			actor,
			locals,
		);
		expect(result).toEqual({ ok: false, error: "That public path is already in use." });
	});

	it("returns the exact 'title required' error when title is whitespace", async () => {
		const result = await createRuntimeStructuredPageRoute(
			"/new",
			{ title: "   ", templateKey: "content" },
			actor,
			locals,
		);
		expect(result).toEqual({ ok: false, error: "A title is required." });
	});

	it("returns the exact 'registry unavailable' error when locals=null and no local registry exists", async () => {
		const result = await createRuntimeStructuredPageRoute(
			"/new",
			{ title: "T", templateKey: "content" },
			actor,
			null,
		);
		expect(result).toEqual({
			ok: false,
			error: "The runtime content registry is unavailable.",
		});
	});

	it("group id has 'route-group:' prefix and variant id has 'route-variant:' prefix", async () => {
		await createRuntimeStructuredPageRoute(
			"/idp",
			{ title: "T", templateKey: "content" },
			actor,
			locals,
		);
		const group = db
			.prepare("SELECT id FROM cms_route_groups WHERE canonical_path = '/idp'")
			.get() as { id: string };
		const variant = db.prepare("SELECT id FROM cms_route_variants WHERE path = '/idp'").get() as {
			id: string;
		};
		expect(group.id.startsWith("route-group:")).toBe(true);
		expect(variant.id.startsWith("route-variant:")).toBe(true);
	});

	it("revision id is prefixed 'revision:<variantId>:' and revisionNote defaults to 'Created route page.'", async () => {
		await createRuntimeStructuredPageRoute(
			"/rev",
			{ title: "T", templateKey: "content" },
			actor,
			locals,
		);
		const variant = db.prepare("SELECT id FROM cms_route_variants WHERE path = '/rev'").get() as {
			id: string;
		};
		const rev = db
			.prepare("SELECT id, revision_note FROM cms_route_revisions ORDER BY id DESC LIMIT 1")
			.get() as { id: string; revision_note: string };
		expect(rev.id.startsWith(`revision:${variant.id}:`)).toBe(true);
		expect(rev.revision_note).toBe("Created route page.");
	});

	it("create writes a system.update audit event with the new path in the summary", async () => {
		await createRuntimeStructuredPageRoute(
			"/cau",
			{ title: "T", templateKey: "content" },
			actor,
			locals,
		);
		const row = db
			.prepare(
				"SELECT user_email, action, resource_type, resource_id, summary FROM audit_events ORDER BY id DESC LIMIT 1",
			)
			.get() as Record<string, string>;
		expect(row).toEqual({
			user_email: actor.email,
			action: "system.update",
			resource_type: "content",
			resource_id: "/cau",
			summary: "Updated system route /cau.",
		});
	});

	it("create echoes input and defaults alternateLinks=[] / sections=null on the returned route", async () => {
		const result = (await createRuntimeStructuredPageRoute(
			"/echo",
			{ title: "T", templateKey: "content" },
			actor,
			locals,
		)) as { ok: true; route: Record<string, unknown> };
		expect(result.ok).toBe(true);
		expect(result.route).toEqual({
			path: "/echo",
			title: "T",
			summary: undefined,
			seoTitle: "T",
			metaDescription: "T",
			canonicalUrlOverride: undefined,
			robotsDirective: undefined,
			ogImage: undefined,
			templateKey: "content",
			alternateLinks: [],
			sections: null,
		});
	});
});
