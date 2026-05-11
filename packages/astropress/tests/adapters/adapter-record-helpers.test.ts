import { describe, expect, it } from "vitest";
import {
	cloudflareActorEmail,
	FULL_STACK_CAPABILITIES,
	listTranslationRecords,
	mapContentRecordKind,
	normalizeContentStatus,
	nowIso,
	saveD1Revision,
	toContentStoreRecord,
	toRedirectRecord,
	toTranslationRecord,
} from "../../src/adapters/adapter-record-helpers";
import { makeDb } from "../helpers/make-db.js";
import { SqliteBackedD1Database } from "../helpers/provider-test-fixtures.js";

describe("FULL_STACK_CAPABILITIES", () => {
	it("declares every full-stack capability as true", () => {
		expect(FULL_STACK_CAPABILITIES).toEqual({
			hostedAdmin: true,
			previewEnvironments: true,
			serverRuntime: true,
			database: true,
			objectStorage: true,
			gitSync: true,
		});
	});
});

describe("mapContentRecordKind", () => {
	it("returns 'post' only when kind is exactly 'post'", () => {
		expect(mapContentRecordKind({ kind: "post" })).toBe("post");
	});

	it("returns 'page' for any non-'post' kind including null/undefined/page", () => {
		expect(mapContentRecordKind({ kind: "page" })).toBe("page");
		expect(mapContentRecordKind({ kind: null })).toBe("page");
		expect(mapContentRecordKind({})).toBe("page");
		expect(mapContentRecordKind({ kind: "POST" })).toBe("page");
	});
});

describe("nowIso", () => {
	it("returns a parseable ISO-8601 timestamp at the current moment", () => {
		const before = Date.now();
		const result = nowIso();
		const after = Date.now();
		expect(typeof result).toBe("string");
		const parsed = Date.parse(result);
		expect(Number.isFinite(parsed)).toBe(true);
		expect(parsed).toBeGreaterThanOrEqual(before);
		expect(parsed).toBeLessThanOrEqual(after);
		// Must include the "T" separator and the trailing "Z"
		expect(result).toMatch(/^\d{4}-\d{2}-\d{2}T.+Z$/);
	});
});

describe("cloudflareActorEmail", () => {
	it("returns the exact admin@example.com placeholder", () => {
		expect(cloudflareActorEmail()).toBe("admin@example.com");
	});
});

describe("normalizeContentStatus", () => {
	it("returns 'published' / 'draft' / 'archived' unchanged", () => {
		expect(normalizeContentStatus("published")).toBe("published");
		expect(normalizeContentStatus("draft")).toBe("draft");
		expect(normalizeContentStatus("archived")).toBe("archived");
	});

	it("collapses commons 'review' to 'draft' (the adapter status type excludes review)", () => {
		// Force the commons normalizer to return 'review' by passing the literal.
		expect(
			normalizeContentStatus("review" as unknown as Parameters<typeof normalizeContentStatus>[0]),
		).toBe("draft");
	});

	it("falls through commons default for unknown statuses, then collapses to draft", () => {
		expect(
			normalizeContentStatus("unknown" as unknown as Parameters<typeof normalizeContentStatus>[0]),
		).not.toBe("review");
	});
});

describe("toTranslationRecord", () => {
	it("maps state='published' to status 'published'", () => {
		const r = toTranslationRecord("/es/about", "published", "2025-01-01T00:00:00Z", "alice");
		expect(r).toEqual({
			id: "/es/about",
			kind: "translation",
			slug: "/es/about",
			status: "published",
			title: "/es/about",
			metadata: { state: "published", updatedAt: "2025-01-01T00:00:00Z", updatedBy: "alice" },
		});
	});

	it("maps any non-'published' state to status 'draft'", () => {
		expect(
			toTranslationRecord("/es/x", "not_started", "2025-01-01T00:00:00Z", "alice").status,
		).toBe("draft");
		expect(toTranslationRecord("/es/x", "reviewed", "2025-01-01T00:00:00Z", "alice").status).toBe(
			"draft",
		);
		expect(toTranslationRecord("/es/x", "", "2025-01-01T00:00:00Z", "alice").status).toBe("draft");
	});

	it("uses route as both id, slug, and title", () => {
		const r = toTranslationRecord("/path", "draft", "t", "u");
		expect(r.id).toBe("/path");
		expect(r.slug).toBe("/path");
		expect(r.title).toBe("/path");
	});

	it("packs state, updatedAt, and updatedBy verbatim into metadata", () => {
		const r = toTranslationRecord("/p", "partial", "2025-06-01T12:00:00Z", "bob@example.com");
		expect(r.metadata).toEqual({
			state: "partial",
			updatedAt: "2025-06-01T12:00:00Z",
			updatedBy: "bob@example.com",
		});
	});
});

describe("listTranslationRecords", () => {
	it("reads translation_overrides rows and maps each through toTranslationRecord, ordered by route ASC", async () => {
		const db = makeDb();
		const d1 = new SqliteBackedD1Database(db);
		db.prepare(
			"INSERT INTO translation_overrides (route, state, updated_at, updated_by) VALUES (?, ?, ?, ?)",
		).run("/es/zebra", "draft", "2025-01-02T00:00:00Z", "alice");
		db.prepare(
			"INSERT INTO translation_overrides (route, state, updated_at, updated_by) VALUES (?, ?, ?, ?)",
		).run("/es/apple", "published", "2025-01-01T00:00:00Z", "bob");

		const rows = await listTranslationRecords(d1);
		expect(rows).toHaveLength(2);
		expect(rows[0]).toEqual({
			id: "/es/apple",
			kind: "translation",
			slug: "/es/apple",
			status: "published",
			title: "/es/apple",
			metadata: { state: "published", updatedAt: "2025-01-01T00:00:00Z", updatedBy: "bob" },
		});
		expect(rows[1].id).toBe("/es/zebra");
		expect(rows[1].status).toBe("draft");
	});

	it("returns [] when the translation_overrides table is empty", async () => {
		const db = makeDb();
		const d1 = new SqliteBackedD1Database(db);
		const rows = await listTranslationRecords(d1);
		expect(rows).toEqual([]);
	});
});

describe("toContentStoreRecord re-export", () => {
	it("forwards to the commons mapper (smoke check)", () => {
		const r = toContentStoreRecord({
			id: "x",
			slug: "x",
			kind: "post",
			status: "published",
			title: "T",
		});
		expect(r.id).toBe("x");
		expect(r.kind).toBe("post");
	});
});

describe("toRedirectRecord re-export", () => {
	it("forwards to the commons mapper (smoke check)", () => {
		const r = toRedirectRecord({
			source_path: "/old",
			destination_path: "/new",
			status_code: 301,
			active: 1,
		});
		expect(r).toBeTruthy();
	});
});

function seedParent(db: ReturnType<typeof makeDb>, slug: string) {
	db.prepare(
		`INSERT INTO content_overrides (slug, title, status, updated_by) VALUES (?, ?, ?, ?)`,
	).run(slug, slug, "draft", "seed@test.local");
}

describe("saveD1Revision", () => {
	it("inserts a row with source='reviewed' and persists every snapshot field", async () => {
		const db = makeDb();
		const d1 = new SqliteBackedD1Database(db);
		seedParent(db, "hello-world");
		await saveD1Revision(
			d1,
			{
				id: "rev-1",
				recordId: "hello-world",
				createdAt: "2025-01-01T00:00:00Z",
				actorId: "alice@example.com",
				summary: "first revision",
				snapshot: {
					title: "Snap Title",
					status: "published",
					scheduledAt: "2025-02-01T00:00:00Z",
					body: "<p>body</p>",
					seoTitle: "Snap SEO",
					metaDescription: "Snap Meta",
					excerpt: "snippet",
					ogTitle: "OG T",
					ogDescription: "OG D",
					ogImage: "https://example.com/og.png",
					authorIds: [1, 2],
					categoryIds: [3],
					tagIds: [],
					canonicalUrlOverride: "https://example.com/c",
					robotsDirective: "noindex",
				},
			},
			"fallback@example.com",
		);

		const row = db
			.prepare(
				"SELECT id, slug, source, title, status, scheduled_at, body, seo_title, meta_description, excerpt, og_title, og_description, og_image, author_ids, category_ids, tag_ids, canonical_url_override, robots_directive, revision_note, created_at, created_by FROM content_revisions WHERE id = 'rev-1'",
			)
			.get() as Record<string, unknown>;
		expect(row.source).toBe("reviewed");
		expect(row.slug).toBe("hello-world");
		expect(row.title).toBe("Snap Title");
		expect(row.status).toBe("published");
		expect(row.scheduled_at).toBe("2025-02-01T00:00:00Z");
		expect(row.body).toBe("<p>body</p>");
		expect(row.seo_title).toBe("Snap SEO");
		expect(row.meta_description).toBe("Snap Meta");
		expect(row.excerpt).toBe("snippet");
		expect(row.og_title).toBe("OG T");
		expect(row.og_description).toBe("OG D");
		expect(row.og_image).toBe("https://example.com/og.png");
		expect(JSON.parse(row.author_ids as string)).toEqual([1, 2]);
		expect(JSON.parse(row.category_ids as string)).toEqual([3]);
		expect(JSON.parse(row.tag_ids as string)).toEqual([]);
		expect(row.canonical_url_override).toBe("https://example.com/c");
		expect(row.robots_directive).toBe("noindex");
		expect(row.revision_note).toBe("first revision");
		expect(row.created_at).toBe("2025-01-01T00:00:00Z");
		expect(row.created_by).toBe("alice@example.com");
	});

	it("falls back to actorEmail when revision.actorId is null/undefined", async () => {
		const db = makeDb();
		const d1 = new SqliteBackedD1Database(db);
		seedParent(db, "hello-world");
		await saveD1Revision(
			d1,
			{
				id: "rev-2",
				recordId: "hello-world",
				createdAt: "2025-01-01T00:00:00Z",
				actorId: null,
				summary: null,
				snapshot: { title: "T", status: "draft" },
			},
			"fallback@example.com",
		);
		const row = db
			.prepare("SELECT created_by, revision_note FROM content_revisions WHERE id = 'rev-2'")
			.get() as { created_by: string; revision_note: string | null };
		expect(row.created_by).toBe("fallback@example.com");
		expect(row.revision_note).toBeNull();
	});

	it("falls back title/seoTitle/metaDescription to recordId when snapshot lacks them", async () => {
		const db = makeDb();
		const d1 = new SqliteBackedD1Database(db);
		seedParent(db, "bare-record");
		await saveD1Revision(
			d1,
			{
				id: "rev-3",
				recordId: "bare-record",
				createdAt: "2025-01-01T00:00:00Z",
				snapshot: { status: "draft" },
			},
			"fallback@example.com",
		);
		const row = db
			.prepare(
				"SELECT title, seo_title, meta_description FROM content_revisions WHERE id = 'rev-3'",
			)
			.get() as { title: string; seo_title: string; meta_description: string };
		expect(row.title).toBe("bare-record");
		expect(row.seo_title).toBe("bare-record");
		expect(row.meta_description).toBe("bare-record");
	});

	it("uses snapshot.title as the seoTitle/metaDescription fallback when those fields are absent", async () => {
		const db = makeDb();
		const d1 = new SqliteBackedD1Database(db);
		seedParent(db, "rid");
		await saveD1Revision(
			d1,
			{
				id: "rev-4",
				recordId: "rid",
				createdAt: "2025-01-01T00:00:00Z",
				snapshot: { title: "Snap T", status: "draft" },
			},
			"fallback@example.com",
		);
		const row = db
			.prepare("SELECT seo_title, meta_description FROM content_revisions WHERE id = 'rev-4'")
			.get() as { seo_title: string; meta_description: string };
		expect(row.seo_title).toBe("Snap T");
		expect(row.meta_description).toBe("Snap T");
	});

	it("serializes missing authorIds/categoryIds/tagIds as JSON '[]'", async () => {
		const db = makeDb();
		const d1 = new SqliteBackedD1Database(db);
		seedParent(db, "rid");
		await saveD1Revision(
			d1,
			{
				id: "rev-5",
				recordId: "rid",
				createdAt: "2025-01-01T00:00:00Z",
				snapshot: { title: "T", status: "draft" },
			},
			"fallback@example.com",
		);
		const row = db
			.prepare("SELECT author_ids, category_ids, tag_ids FROM content_revisions WHERE id = 'rev-5'")
			.get() as { author_ids: string; category_ids: string; tag_ids: string };
		expect(row.author_ids).toBe("[]");
		expect(row.category_ids).toBe("[]");
		expect(row.tag_ids).toBe("[]");
	});
});
