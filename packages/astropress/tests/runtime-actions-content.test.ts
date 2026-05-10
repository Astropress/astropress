import type { DatabaseSync } from "node:sqlite";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { registerCms } from "../src/config";
import {
	createRuntimeContentRecord,
	restoreRuntimeRevision,
	saveRuntimeContentState,
} from "../src/runtime-actions-content";
import { makeDb, STANDARD_ACTOR, STANDARD_CMS_CONFIG } from "./helpers/make-db.js";
import { makeLocals } from "./helpers/make-locals.js";

const actor = STANDARD_ACTOR;

let db: DatabaseSync;
let locals: App.Locals;

beforeEach(() => {
	db = makeDb();
	locals = makeLocals(db);
	registerCms(STANDARD_CMS_CONFIG);

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
		"Summary",
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
		"Hello SEO",
		"Hello meta",
		"admin@test.local",
	);
});

describe("saveRuntimeContentState", () => {
	it("updates override and creates a revision", async () => {
		const result = await saveRuntimeContentState(
			"hello-world",
			{
				title: "Updated",
				status: "published",
				seoTitle: "SEO Updated",
				metaDescription: "Meta updated",
			},
			actor,
			locals,
		);
		expect(result).toMatchObject({ ok: true });
		const override = db
			.prepare("SELECT title FROM content_overrides WHERE slug = 'hello-world'")
			.get() as { title: string };
		expect(override.title).toBe("Updated");
		const revCount = (
			db
				.prepare("SELECT COUNT(*) as n FROM content_revisions WHERE slug = 'hello-world'")
				.get() as { n: number }
		).n;
		expect(revCount).toBeGreaterThanOrEqual(2);
	});

	it("normalises draft status", async () => {
		const result = await saveRuntimeContentState(
			"hello-world",
			{
				title: "Draft",
				status: "draft",
				seoTitle: "SEO",
				metaDescription: "Meta",
			},
			actor,
			locals,
		);
		expect(result).toMatchObject({ ok: true });
		const override = db
			.prepare("SELECT status FROM content_overrides WHERE slug = 'hello-world'")
			.get() as { status: string };
		expect(override.status).toBe("draft");
	});

	it("returns not-ok for missing required fields", async () => {
		const result = await saveRuntimeContentState(
			"hello-world",
			{ title: "", status: "published", seoTitle: "X", metaDescription: "X" },
			actor,
			locals,
		);
		expect(result).toMatchObject({ ok: false });
	});

	it("returns not-ok for unknown slug", async () => {
		const result = await saveRuntimeContentState(
			"no-such-slug",
			{ title: "X", status: "published", seoTitle: "X", metaDescription: "X" },
			actor,
			locals,
		);
		expect(result).toMatchObject({ ok: false });
	});

	it("returns conflict error when lastKnownUpdatedAt does not match stored updated_at", async () => {
		// First, save once to establish an updated_at
		await saveRuntimeContentState(
			"hello-world",
			{
				title: "First save",
				status: "published",
				seoTitle: "SEO",
				metaDescription: "Meta",
			},
			actor,
			locals,
		);
		// Now simulate a second editor submitting with a stale timestamp
		const result = await saveRuntimeContentState(
			"hello-world",
			{
				title: "Conflict save",
				status: "published",
				seoTitle: "SEO",
				metaDescription: "Meta",
				lastKnownUpdatedAt: "2000-01-01 00:00:00",
			},
			actor,
			locals,
		);
		expect(result).toMatchObject({ ok: false, conflict: true });
		expect((result as { error: string }).error).toMatch(/modified by another editor/);
	});

	it("succeeds when lastKnownUpdatedAt matches stored updated_at", async () => {
		const currentOverride = db
			.prepare("SELECT updated_at FROM content_overrides WHERE slug = 'hello-world'")
			.get() as { updated_at: string };
		const result = await saveRuntimeContentState(
			"hello-world",
			{
				title: "Matching save",
				status: "published",
				seoTitle: "SEO",
				metaDescription: "Meta",
				lastKnownUpdatedAt: currentOverride.updated_at,
			},
			actor,
			locals,
		);
		expect(result).toMatchObject({ ok: true });
	});

	it("rejects save when a required content type field is missing from metadata", async () => {
		registerCms({
			templateKeys: ["content"],
			siteUrl: "https://example.com",
			seedPages: [],
			archives: [],
			translationStatus: [],
			contentTypes: [
				{
					key: "content",
					label: "Content",
					fields: [
						{
							name: "subtitle",
							label: "Subtitle",
							type: "text",
							required: true,
						},
					],
				},
			],
		});
		const result = await saveRuntimeContentState(
			"hello-world",
			{
				title: "Missing field",
				status: "published",
				seoTitle: "SEO",
				metaDescription: "Meta",
				metadata: {},
			},
			actor,
			locals,
		);
		expect(result).toMatchObject({ ok: false });
		expect((result as { error: string }).error).toMatch(/Subtitle.*required/);
	});

	it("accepts save when content type metadata passes field validation", async () => {
		registerCms({
			templateKeys: ["content"],
			siteUrl: "https://example.com",
			seedPages: [],
			archives: [],
			translationStatus: [],
			contentTypes: [
				{
					key: "content",
					label: "Content",
					fields: [
						{
							name: "subtitle",
							label: "Subtitle",
							type: "text",
							required: true,
						},
					],
				},
			],
		});
		const result = await saveRuntimeContentState(
			"hello-world",
			{
				title: "Valid field",
				status: "published",
				seoTitle: "SEO",
				metaDescription: "Meta",
				metadata: { subtitle: "My Subtitle" },
			},
			actor,
			locals,
		);
		expect(result).toMatchObject({ ok: true });
		const saved = db
			.prepare("SELECT metadata FROM content_overrides WHERE slug = 'hello-world'")
			.get() as { metadata: string };
		expect(JSON.parse(saved.metadata)).toMatchObject({
			subtitle: "My Subtitle",
		});
	});

	it("rejects save when a custom validate function returns an error string", async () => {
		registerCms({
			templateKeys: ["content"],
			siteUrl: "https://example.com",
			seedPages: [],
			archives: [],
			translationStatus: [],
			contentTypes: [
				{
					key: "content",
					label: "Content",
					fields: [
						{
							name: "capacity",
							label: "Max Capacity",
							type: "number",
							validate: (v) => Number(v) > 0 || "Capacity must be a positive number",
						},
					],
				},
			],
		});
		const result = await saveRuntimeContentState(
			"hello-world",
			{
				title: "Bad capacity",
				status: "published",
				seoTitle: "SEO",
				metaDescription: "Meta",
				metadata: { capacity: -5 },
			},
			actor,
			locals,
		);
		expect(result).toMatchObject({ ok: false });
		expect((result as { error: string }).error).toContain("Capacity must be a positive number");
	});

	it("saves with all optional fields populated", async () => {
		const result = await saveRuntimeContentState(
			"hello-world",
			{
				title: "Full Save",
				status: "draft",
				body: "<p>Rich body</p>",
				scheduledAt: "2026-06-01T12:00:00.000Z",
				revisionNote: "test revision",
				seoTitle: "SEO Full",
				metaDescription: "Meta full",
				excerpt: "Short excerpt",
				ogTitle: "OG Title",
				ogDescription: "OG Desc",
				ogImage: "https://example.com/img.jpg",
				canonicalUrlOverride: "https://example.com/canonical",
				robotsDirective: "noindex",
			},
			actor,
			locals,
		);
		expect(result).toMatchObject({ ok: true });
	});

	it("saves author/category/tag assignments", async () => {
		const { lastInsertRowid: authorId } = db
			.prepare("INSERT INTO authors (name, slug) VALUES (?, ?)")
			.run("Author A", "author-a");
		const { lastInsertRowid: catId } = db
			.prepare("INSERT INTO categories (name, slug) VALUES (?, ?)")
			.run("Cat A", "cat-a");
		const { lastInsertRowid: tagId } = db
			.prepare("INSERT INTO tags (name, slug) VALUES (?, ?)")
			.run("Tag A", "tag-a");

		const result = await saveRuntimeContentState(
			"hello-world",
			{
				title: "With Assignments",
				status: "published",
				seoTitle: "SEO",
				metaDescription: "Meta",
				authorIds: [Number(authorId)],
				categoryIds: [Number(catId)],
				tagIds: [Number(tagId)],
			},
			actor,
			locals,
		);
		expect(result).toMatchObject({ ok: true });
		const authorRow = db
			.prepare("SELECT author_id FROM content_authors WHERE slug = 'hello-world'")
			.get() as { author_id: number } | undefined;
		expect(authorRow?.author_id).toBe(Number(authorId));
	});
});

describe("createRuntimeContentRecord", () => {
	it("creates a new content entry with override and revision", async () => {
		const result = await createRuntimeContentRecord(
			{
				title: "New Post",
				slug: "new-post",
				status: "draft",
				seoTitle: "SEO",
				metaDescription: "Meta",
			},
			actor,
			locals,
		);
		expect(result).toMatchObject({ ok: true });
		const entry = db.prepare("SELECT slug FROM content_entries WHERE slug = 'new-post'").get() as
			| { slug: string }
			| undefined;
		expect(entry?.slug).toBe("new-post");
	});

	it("slugifies the slug input", async () => {
		const result = await createRuntimeContentRecord(
			{
				title: "My Post",
				slug: "My Post Title!",
				status: "published",
				seoTitle: "SEO",
				metaDescription: "Meta",
			},
			actor,
			locals,
		);
		expect(result).toMatchObject({ ok: true });
		expect((result as { state: { slug: string } }).state.slug).toBe("my-post-title");
	});

	it("returns not-ok for missing required fields", async () => {
		const result = await createRuntimeContentRecord(
			{
				title: "",
				slug: "empty-title",
				status: "published",
				seoTitle: "SEO",
				metaDescription: "Meta",
			},
			actor,
			locals,
		);
		expect(result).toMatchObject({ ok: false });
	});

	it("returns not-ok for duplicate slug", async () => {
		const result = await createRuntimeContentRecord(
			{
				title: "Duplicate",
				slug: "hello-world",
				status: "draft",
				seoTitle: "SEO",
				metaDescription: "Meta",
			},
			actor,
			locals,
		);
		expect(result).toMatchObject({ ok: false });
	});

	it("normalises legacyUrl by prepending slash when missing", async () => {
		const result = await createRuntimeContentRecord(
			{
				title: "No Slash",
				slug: "no-slash-url",
				legacyUrl: "no-slash-url",
				status: "draft",
				seoTitle: "SEO",
				metaDescription: "Meta",
			},
			actor,
			locals,
		);
		expect(result).toMatchObject({ ok: true });
		expect((result as { state: { legacyUrl: string } }).state.legacyUrl).toBe("/no-slash-url");
	});

	it("falls back to title when seoTitle is empty", async () => {
		const result = await createRuntimeContentRecord(
			{
				title: "Fallback Title",
				slug: "fallback-seo",
				status: "draft",
				seoTitle: "  ",
				metaDescription: "Meta",
			},
			actor,
			locals,
		);
		expect(result).toMatchObject({ ok: true });
	});

	it("creates with all optional fields populated", async () => {
		const result = await createRuntimeContentRecord(
			{
				title: "Full Record",
				slug: "full-record",
				legacyUrl: "/full-record",
				status: "published",
				body: "<p>Body</p>",
				summary: "Summary text",
				seoTitle: "SEO",
				metaDescription: "Meta",
				excerpt: "Short",
				ogTitle: "OG Title",
				ogDescription: "OG Desc",
				ogImage: "https://example.com/img.jpg",
				canonicalUrlOverride: "https://example.com/canonical",
				robotsDirective: "noindex",
			},
			actor,
			locals,
		);
		expect(result).toMatchObject({ ok: true });
	});
});

describe("restoreRuntimeRevision", () => {
	it("restores an existing revision into the override and writes a content.restore audit row", async () => {
		const result = await restoreRuntimeRevision("hello-world", "rev-1", actor, locals);
		expect(result).toMatchObject({ ok: true });

		const audit = db
			.prepare(
				"SELECT action, resource_type, resource_id, summary FROM audit_events WHERE action = 'content.restore' ORDER BY id DESC LIMIT 1",
			)
			.get() as Record<string, unknown> | undefined;
		expect(audit?.action).toBe("content.restore");
		expect(audit?.resource_type).toBe("content");
		expect(audit?.resource_id).toBe("hello-world");
		expect(audit?.summary).toBe("Restored revision rev-1 for hello-world.");
	});

	it("returns the documented 'Revision not found.' error for an unknown revision id", async () => {
		const result = await restoreRuntimeRevision("hello-world", "rev-ghost", actor, locals);
		expect(result).toEqual({ ok: false, error: "Revision not found." });
	});

	it("returns the documented 'could not be found' error for an unknown slug", async () => {
		const result = await restoreRuntimeRevision("no-such-slug", "rev-1", actor, locals);
		expect(result).toEqual({
			ok: false,
			error: "The selected content record could not be found.",
		});
	});

	it("uses the documented '[]' fallback for null author/category/tag id columns and persists '' for null body in the new revision", async () => {
		// Insert a revision whose body and id-list columns are explicitly NULL.
		db.prepare(
			`INSERT INTO content_revisions (id, slug, source, title, status, body, seo_title, meta_description, author_ids, category_ids, tag_ids, created_by)
       VALUES ('rev-nulls', 'hello-world', 'reviewed', 'NullsTitle', 'published', NULL, 'S', 'M', NULL, NULL, NULL, 'admin@test.local')`,
		).run();

		const result = await restoreRuntimeRevision("hello-world", "rev-nulls", actor, locals);
		expect(result).toMatchObject({ ok: true });

		// The newly inserted revision (the one written by the restore step itself) must
		// carry the documented fallbacks: author_ids/category_ids/tag_ids = '[]', body = ''.
		const inserted = db
			.prepare(
				"SELECT body, author_ids, category_ids, tag_ids FROM content_revisions WHERE slug = 'hello-world' AND source = 'reviewed' ORDER BY id DESC LIMIT 1",
			)
			.get() as Record<string, unknown> | undefined;
		expect(inserted).toBeDefined();
		expect(inserted?.body).toBe("");
		expect(inserted?.author_ids).toBe("[]");
		expect(inserted?.category_ids).toBe("[]");
		expect(inserted?.tag_ids).toBe("[]");
	});
});

describe("purgeCdnCache", () => {
	it("is a no-op and resolves successfully when no cdnPurgeWebhook is configured", async () => {
		const { purgeCdnCache } = await import("../src/cache-purge");
		registerCms({
			templateKeys: ["home"],
			siteUrl: "https://example.com",
			seedPages: [],
			archives: [],
			translationStatus: [],
		});
		// Should resolve without throwing (no webhook configured, no CF env vars)
		await expect(
			purgeCdnCache("my-slug", {
				siteUrl: "https://example.com",
				templateKeys: ["home"],
				seedPages: [],
				archives: [],
				translationStatus: [],
			}),
		).resolves.toBeUndefined();
	});

	it("POSTs to cdnPurgeWebhook with slug and purgedAt when configured", async () => {
		const { purgeCdnCache } = await import("../src/cache-purge");
		const requests: { url: string; body: unknown }[] = [];
		vi.stubGlobal("fetch", async (url: string, init: RequestInit) => {
			requests.push({ url, body: JSON.parse(init.body as string) });
			return new Response(null, { status: 200 });
		});

		await purgeCdnCache("test-slug", {
			siteUrl: "https://example.com",
			templateKeys: ["home"],
			seedPages: [],
			archives: [],
			translationStatus: [],
			cdnPurgeWebhook: "https://hooks.example.com/purge",
		});

		vi.unstubAllGlobals();
		expect(requests).toHaveLength(1);
		expect(requests[0].url).toBe("https://hooks.example.com/purge");
		expect((requests[0].body as Record<string, unknown>).slug).toBe("test-slug");
		expect(typeof (requests[0].body as Record<string, unknown>).purgedAt).toBe("string");
	});

	it("uses the registryFields parameter (admin-connected Cloudflare) over env and config", async () => {
		const { purgeCdnCache } = await import("../src/cache-purge");
		const requests: { url: string; auth: string | null }[] = [];
		vi.stubGlobal("fetch", async (url: string, init: RequestInit) => {
			const headers =
				init.headers instanceof Headers
					? init.headers
					: new Headers(init.headers as Record<string, string>);
			requests.push({ url, auth: headers.get("authorization") });
			return new Response(null, { status: 200 });
		});

		await purgeCdnCache(
			"slug",
			{
				siteUrl: "https://example.com",
				templateKeys: ["home"],
				seedPages: [],
				archives: [],
				translationStatus: [],
				cdnPurgeWebhook: "https://hooks.example.com/purge",
			},
			{ apiToken: "registry-tok", zoneId: "registry-zone" },
		);
		vi.unstubAllGlobals();

		// The Cloudflare call must use the registry token, not anything from env/config.
		const cf = requests.find((r) => r.url.startsWith("https://api.cloudflare.com/"));
		expect(cf?.auth).toBe("Bearer registry-tok");
		expect(cf?.url).toBe("https://api.cloudflare.com/client/v4/zones/registry-zone/purge_cache");
	});

	it("does not throw when the webhook returns a non-200 status", async () => {
		const { purgeCdnCache } = await import("../src/cache-purge");
		vi.stubGlobal("fetch", async () => new Response("Server Error", { status: 500 }));

		await expect(
			purgeCdnCache("test-slug", {
				siteUrl: "https://example.com",
				templateKeys: ["home"],
				seedPages: [],
				archives: [],
				translationStatus: [],
				cdnPurgeWebhook: "https://hooks.example.com/purge",
			}),
		).resolves.toBeUndefined();

		vi.unstubAllGlobals();
	});
});

// ---------------------------------------------------------------------------
// Exact-shape assertions, audit-row assertions, plugin-event payload assertions.
// ---------------------------------------------------------------------------

describe("saveRuntimeContentState — error strings, audit, plugin events", () => {
	it("returns the documented 'content record could not be found' error for unknown slug", async () => {
		const result = await saveRuntimeContentState(
			"no-such-slug",
			{ title: "X", status: "published", seoTitle: "X", metaDescription: "X" },
			actor,
			locals,
		);
		expect(result).toEqual({
			ok: false,
			error: "The selected content record could not be found.",
		});
	});

	it("returns the documented 'Title, SEO title, and meta description are required.' error when any required field is empty after trim", async () => {
		const result = await saveRuntimeContentState(
			"hello-world",
			{ title: "   ", status: "published", seoTitle: "SEO", metaDescription: "Meta" },
			actor,
			locals,
		);
		expect(result).toEqual({
			ok: false,
			error: "Title, SEO title, and meta description are required.",
		});
	});

	it("trims input.title / input.seoTitle / input.metaDescription before persistence", async () => {
		const result = await saveRuntimeContentState(
			"hello-world",
			{
				title: "  Trimmed Title  ",
				status: "published",
				seoTitle: "  SEO  ",
				metaDescription: "  Meta  ",
			},
			actor,
			locals,
		);
		expect(result).toMatchObject({ ok: true });
		const override = db
			.prepare(
				"SELECT title, seo_title, meta_description FROM content_overrides WHERE slug = 'hello-world'",
			)
			.get() as Record<string, unknown>;
		expect(override).toMatchObject({
			title: "Trimmed Title",
			seo_title: "SEO",
			meta_description: "Meta",
		});
	});

	it("uses pageRecord.body when input.body is empty/whitespace", async () => {
		const result = await saveRuntimeContentState(
			"hello-world",
			{
				title: "Body Fallback",
				status: "published",
				seoTitle: "SEO",
				metaDescription: "Meta",
				body: "   ",
			},
			actor,
			locals,
		);
		expect(result).toMatchObject({ ok: true });
		const override = db
			.prepare("SELECT body FROM content_overrides WHERE slug = 'hello-world'")
			.get() as { body: string };
		// Falls back to pageRecord.body which is the seeded "<p>Body</p>".
		expect(override.body).toBe("<p>Body</p>");
	});

	it("emits a content.update audit row with resource_type='content' and the documented summary referencing legacy_url", async () => {
		const result = await saveRuntimeContentState(
			"hello-world",
			{
				title: "Audited Save",
				status: "draft",
				seoTitle: "SEO",
				metaDescription: "Meta",
			},
			actor,
			locals,
		);
		expect(result).toMatchObject({ ok: true });

		const audit = db
			.prepare(
				"SELECT action, resource_type, resource_id, summary FROM audit_events WHERE action = 'content.update' ORDER BY id DESC LIMIT 1",
			)
			.get() as Record<string, unknown> | undefined;
		expect(audit).toMatchObject({
			action: "content.update",
			resource_type: "content",
			resource_id: "hello-world",
			summary: "Updated reviewed metadata for /hello-world.",
		});
	});

	it("fires onContentSave with the documented {slug, kind:'post', status, actor.email} payload but NOT onContentPublish for a draft save", async () => {
		const saveEvents: unknown[] = [];
		const publishEvents: unknown[] = [];
		registerCms({
			...STANDARD_CMS_CONFIG,
			plugins: [
				{
					name: "capture",
					onContentSave: (event) => {
						saveEvents.push(event);
					},
					onContentPublish: (event) => {
						publishEvents.push(event);
					},
				},
			],
		});

		await saveRuntimeContentState(
			"hello-world",
			{
				title: "Draft event",
				status: "draft",
				seoTitle: "SEO",
				metaDescription: "Meta",
			},
			actor,
			locals,
		);
		expect(saveEvents).toHaveLength(1);
		expect(saveEvents[0]).toEqual({
			slug: "hello-world",
			kind: "post",
			status: "draft",
			actor: actor.email,
		});
		expect(publishEvents).toHaveLength(0);
	});

	it("ALSO fires onContentPublish for a 'published' save (in addition to onContentSave)", async () => {
		const saveEvents: unknown[] = [];
		const publishEvents: unknown[] = [];
		registerCms({
			...STANDARD_CMS_CONFIG,
			plugins: [
				{
					name: "capture",
					onContentSave: (event) => {
						saveEvents.push(event);
					},
					onContentPublish: (event) => {
						publishEvents.push(event);
					},
				},
			],
		});

		await saveRuntimeContentState(
			"hello-world",
			{
				title: "Published event",
				status: "published",
				seoTitle: "SEO",
				metaDescription: "Meta",
			},
			actor,
			locals,
		);
		expect(saveEvents).toHaveLength(1);
		expect(publishEvents).toHaveLength(1);
		expect(publishEvents[0]).toEqual({
			slug: "hello-world",
			kind: "post",
			status: "published",
			actor: actor.email,
		});
	});

	it("returns ok with state.title/status/seoTitle/metaDescription matching the saved values", async () => {
		const result = await saveRuntimeContentState(
			"hello-world",
			{
				title: "Echo",
				status: "draft",
				seoTitle: "Echo SEO",
				metaDescription: "Echo meta",
				scheduledAt: "2030-01-01T00:00:00.000Z",
			},
			actor,
			locals,
		);
		expect(result.ok).toBe(true);
		if (!result.ok) return;
		expect(result.state).toMatchObject({
			title: "Echo",
			status: "draft",
			seoTitle: "Echo SEO",
			metaDescription: "Echo meta",
			scheduledAt: "2030-01-01T00:00:00.000Z",
		});
	});
});

// ---------------------------------------------------------------------------
// createRuntimeContentRecord — error strings, audit, body/summary fallbacks
// ---------------------------------------------------------------------------

describe("createRuntimeContentRecord — error strings, audit, fallbacks", () => {
	it("returns the documented 'Title, slug, and meta description are required.' error", async () => {
		const result = await createRuntimeContentRecord(
			{
				title: "   ",
				slug: "empty",
				status: "draft",
				seoTitle: "SEO",
				metaDescription: "Meta",
			},
			actor,
			locals,
		);
		expect(result).toEqual({
			ok: false,
			error: "Title, slug, and meta description are required.",
		});
	});

	it("returns the documented 'That slug is already in use.' error when the slug exists", async () => {
		const result = await createRuntimeContentRecord(
			{
				title: "Dup",
				slug: "hello-world",
				status: "draft",
				seoTitle: "SEO",
				metaDescription: "Meta",
			},
			actor,
			locals,
		);
		expect(result).toEqual({
			ok: false,
			error: "That slug is already in use.",
		});
	});

	it("persists body='' and summary='' (the documented '' defaults) when neither is provided", async () => {
		const result = await createRuntimeContentRecord(
			{
				title: "Empty defaults",
				slug: "empty-defaults",
				status: "draft",
				seoTitle: "SEO",
				metaDescription: "Meta",
			},
			actor,
			locals,
		);
		expect(result.ok).toBe(true);
		const row = db
			.prepare("SELECT body, summary FROM content_entries WHERE slug = 'empty-defaults'")
			.get() as { body: string; summary: string };
		expect(row.body).toBe("");
		expect(row.summary).toBe("");
	});

	it("emits a content.create audit row with resource_type='content' and the documented 'Created post <legacy_url>.' summary", async () => {
		await createRuntimeContentRecord(
			{
				title: "Audited Create",
				slug: "audited-create",
				status: "draft",
				seoTitle: "SEO",
				metaDescription: "Meta",
			},
			actor,
			locals,
		);
		const audit = db
			.prepare(
				"SELECT action, resource_type, resource_id, summary FROM audit_events WHERE action = 'content.create' ORDER BY id DESC LIMIT 1",
			)
			.get() as Record<string, unknown> | undefined;
		expect(audit).toMatchObject({
			action: "content.create",
			resource_type: "content",
			resource_id: "audited-create",
			summary: "Created post /audited-create.",
		});
	});

	it("inserts the initial revision with author_ids/category_ids/tag_ids='[]' and revisionNote='Created new post.'", async () => {
		await createRuntimeContentRecord(
			{
				title: "Revnote check",
				slug: "revnote-check",
				status: "draft",
				seoTitle: "SEO",
				metaDescription: "Meta",
			},
			actor,
			locals,
		);
		const rev = db
			.prepare(
				"SELECT author_ids, category_ids, tag_ids, revision_note FROM content_revisions WHERE slug = 'revnote-check' ORDER BY id DESC LIMIT 1",
			)
			.get() as Record<string, unknown>;
		expect(rev).toMatchObject({
			author_ids: "[]",
			category_ids: "[]",
			tag_ids: "[]",
			revision_note: "Created new post.",
		});
	});

	it("falls back to title when seoTitle trims to empty (persists title verbatim)", async () => {
		const result = await createRuntimeContentRecord(
			{
				title: "Fallback Title 2",
				slug: "fallback-seo-2",
				status: "draft",
				seoTitle: "   ",
				metaDescription: "Meta",
			},
			actor,
			locals,
		);
		expect(result.ok).toBe(true);
		const row = db
			.prepare("SELECT seo_title FROM content_entries WHERE slug = 'fallback-seo-2'")
			.get() as { seo_title: string };
		expect(row.seo_title).toBe("Fallback Title 2");
	});

	it("trims input.metaDescription / input.body / input.summary before persistence (does not store whitespace verbatim)", async () => {
		const result = await createRuntimeContentRecord(
			{
				title: "Trimmed",
				slug: "trim-check",
				status: "draft",
				seoTitle: "SEO",
				metaDescription: "  Trimmed Meta  ",
				body: "  Trimmed body  ",
				summary: "  Trimmed summary  ",
			},
			actor,
			locals,
		);
		expect(result.ok).toBe(true);
		const row = db
			.prepare(
				"SELECT body, summary, meta_description FROM content_entries WHERE slug = 'trim-check'",
			)
			.get() as Record<string, string>;
		expect(row.body).toBe("Trimmed body");
		expect(row.summary).toBe("Trimmed summary");
		expect(row.meta_description).toBe("Trimmed Meta");
	});

	it("rejects a slug that collides only by legacyUrl (NOT by slug) — duplicate check uses `||` not `&&`", async () => {
		// /hello-world already exists. A fresh slug 'fresh-slug' with legacyUrl '/hello-world'
		// should be rejected because the legacyUrl lookup hits the existing record.
		const result = await createRuntimeContentRecord(
			{
				title: "Dup by legacy URL",
				slug: "fresh-slug",
				legacyUrl: "/hello-world",
				status: "draft",
				seoTitle: "SEO",
				metaDescription: "Meta",
			},
			actor,
			locals,
		);
		expect(result).toEqual({ ok: false, error: "That slug is already in use." });
	});

	it("strips ONLY the leading slash from legacyUrl when probing for duplicates (Regex /^\\//, not /\\/g/)", async () => {
		// Seed a record at a multi-segment legacyUrl '/section/page-x' so we can verify
		// the duplicate check uses 'section/page-x' (single leading-slash strip), not
		// 'sectionpage-x' (all slashes stripped — which would not match anything).
		db.prepare(
			`INSERT INTO content_entries (slug, legacy_url, title, kind, template_key, source_html_path)
       VALUES ('alpha', '/section/page-x', 'A', 'post', 'content', 'runtime://content/alpha')`,
		).run();
		const result = await createRuntimeContentRecord(
			{
				title: "Probing slash",
				slug: "fresh-slug-2",
				legacyUrl: "/section/page-x",
				status: "draft",
				seoTitle: "SEO",
				metaDescription: "Meta",
			},
			actor,
			locals,
		);
		expect(result).toEqual({ ok: false, error: "That slug is already in use." });
	});

	it("uses summary as the excerpt fallback when excerpt is empty (?? null only fires when both are absent)", async () => {
		await createRuntimeContentRecord(
			{
				title: "Excerpt fallback",
				slug: "excerpt-fallback",
				status: "draft",
				seoTitle: "SEO",
				metaDescription: "Meta",
				summary: "Use this as excerpt",
			},
			actor,
			locals,
		);
		const row = db
			.prepare("SELECT excerpt FROM content_overrides WHERE slug = 'excerpt-fallback'")
			.get() as { excerpt: string | null };
		expect(row.excerpt).toBe("Use this as excerpt");
	});

	it("persists excerpt=NULL when both excerpt and summary are absent", async () => {
		await createRuntimeContentRecord(
			{
				title: "Null excerpt",
				slug: "null-excerpt",
				status: "draft",
				seoTitle: "SEO",
				metaDescription: "Meta",
			},
			actor,
			locals,
		);
		const row = db
			.prepare("SELECT excerpt FROM content_overrides WHERE slug = 'null-excerpt'")
			.get() as { excerpt: string | null };
		expect(row.excerpt).toBeNull();
	});

	it("uses 'runtime://content/<slug>' as the source_html_path", async () => {
		await createRuntimeContentRecord(
			{
				title: "Source path",
				slug: "source-path",
				status: "draft",
				seoTitle: "SEO",
				metaDescription: "Meta",
			},
			actor,
			locals,
		);
		const row = db
			.prepare("SELECT source_html_path FROM content_entries WHERE slug = 'source-path'")
			.get() as { source_html_path: string };
		expect(row.source_html_path).toBe("runtime://content/source-path");
	});
});
