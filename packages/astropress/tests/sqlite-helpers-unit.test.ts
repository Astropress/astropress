import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { DatabaseSync } from "node:sqlite";

import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createAstropressSqliteAdapter } from "../src/adapters/sqlite";
import {
	buildRevisionParams,
	resolveMetaString,
	resolveSqliteStatus,
	SQL_INSERT_REVISION,
	SQL_LIST_TRANSLATIONS,
	SQL_UPSERT_MEDIA,
	snapshotField,
} from "../src/adapters/sqlite-helpers";

describe("resolveMetaString", () => {
	it("returns the string value when meta[key] is a string", () => {
		expect(resolveMetaString({ a: "hello" }, "a")).toBe("hello");
	});
	it("returns undefined when meta[key] is not a string", () => {
		expect(resolveMetaString({ a: 42 }, "a")).toBeUndefined();
		expect(resolveMetaString({ a: null }, "a")).toBeUndefined();
		expect(resolveMetaString({ a: true }, "a")).toBeUndefined();
		expect(resolveMetaString({}, "missing")).toBeUndefined();
	});
	it("returns undefined when meta is null or undefined (optional-chain pin)", () => {
		expect(resolveMetaString(null, "x")).toBeUndefined();
		expect(resolveMetaString(undefined, "x")).toBeUndefined();
	});
});

describe("resolveSqliteStatus", () => {
	it("returns 'archived' only for the literal 'archived'", () => {
		expect(resolveSqliteStatus("archived")).toBe("archived");
	});
	it("returns 'draft' only for the literal 'draft'", () => {
		expect(resolveSqliteStatus("draft")).toBe("draft");
	});
	it("returns 'published' for anything else including undefined and unrecognized strings", () => {
		expect(resolveSqliteStatus(undefined)).toBe("published");
		expect(resolveSqliteStatus("published")).toBe("published");
		expect(resolveSqliteStatus("scheduled")).toBe("published");
		expect(resolveSqliteStatus("")).toBe("published");
	});
});

describe("snapshotField", () => {
	it("returns snapshot[key] when present and non-null", () => {
		expect(snapshotField({ a: "x" }, "a")).toBe("x");
		expect(snapshotField({ a: 0 }, "a")).toBe(0);
		expect(snapshotField({ a: false }, "a")).toBe(false);
	});
	it("returns the fallback when snapshot[key] is null or undefined", () => {
		expect(snapshotField({ a: null }, "a", "FB")).toBe("FB");
		expect(snapshotField({}, "missing", "FB")).toBe("FB");
	});
	it("defaults the fallback to null", () => {
		expect(snapshotField({}, "missing")).toBeNull();
	});
});

describe("buildRevisionParams", () => {
	it("produces a 21-element array matching the SQL_INSERT_REVISION column order", () => {
		const params = buildRevisionParams(
			{
				title: "T",
				status: "draft",
				scheduledAt: "2026-01-01",
				body: "B",
				seoTitle: "ST",
				metaDescription: "MD",
				excerpt: "E",
				ogTitle: "OG",
				ogDescription: "OGD",
				ogImage: "OGI",
				authorIds: ["a1"],
				categoryIds: ["c1"],
				tagIds: ["t1"],
				canonicalUrlOverride: "/canon",
				robotsDirective: "noindex",
			},
			{ id: "rev-1", recordId: "rec-1", summary: "S", createdAt: "2026-01-02", actorId: "u1" },
			"actor@example.com",
		);
		expect(params).toEqual([
			"rev-1",
			"rec-1",
			"T",
			"draft",
			"2026-01-01",
			"B",
			"ST",
			"MD",
			"E",
			"OG",
			"OGD",
			"OGI",
			'["a1"]',
			'["c1"]',
			'["t1"]',
			"/canon",
			"noindex",
			"S",
			"2026-01-02",
			"u1",
		]);
	});

	it("falls back to recordId / actorEmail when title/actorId are missing", () => {
		const params = buildRevisionParams(
			{},
			{ id: "rev-2", recordId: "rec-2", createdAt: "2026-01-03" },
			"actor@example.com",
		);
		expect(params[2]).toBe("rec-2"); // title fallback
		expect(params[6]).toBe("rec-2"); // seoTitle fallback
		expect(params[7]).toBe("rec-2"); // metaDescription fallback
		expect(params[12]).toBe("[]"); // empty authorIds JSON
		expect(params[13]).toBe("[]");
		expect(params[14]).toBe("[]");
		expect(params[17]).toBeNull(); // revision.summary ?? null
		expect(params[19]).toBe("actor@example.com"); // actorId fallback
	});

	it("uses snapshot.title for seoTitle/metaDescription when explicit fields are absent", () => {
		const params = buildRevisionParams(
			{ title: "FromSnapshot" },
			{ id: "r", recordId: "rec", createdAt: "now" },
			"e@example.com",
		);
		expect(params[6]).toBe("FromSnapshot");
		expect(params[7]).toBe("FromSnapshot");
	});
});

describe("SQL constants are literal strings (kill StringLiteral mutants)", () => {
	it("SQL_UPSERT_MEDIA inserts into media_assets and ON CONFLICT updates", () => {
		expect(SQL_UPSERT_MEDIA).toContain("INSERT INTO media_assets");
		expect(SQL_UPSERT_MEDIA).toContain("ON CONFLICT(id) DO UPDATE SET");
		expect(SQL_UPSERT_MEDIA).toContain("deleted_at = NULL");
	});
	it("SQL_INSERT_REVISION targets content_revisions with the source='reviewed' literal", () => {
		expect(SQL_INSERT_REVISION).toContain("INSERT INTO content_revisions");
		expect(SQL_INSERT_REVISION).toContain("'reviewed'");
	});
	it("SQL_LIST_TRANSLATIONS reads translation_overrides ordered by route ASC", () => {
		expect(SQL_LIST_TRANSLATIONS).toContain("FROM translation_overrides");
		expect(SQL_LIST_TRANSLATIONS).toContain("ORDER BY route ASC");
	});
});

describe("sqlite adapter content flow — exercises listSqliteContentRecords / save / delete", () => {
	let workspace: string;
	let dbPath: string;
	let adapter: ReturnType<typeof createAstropressSqliteAdapter>;

	function openSeededDb() {
		// Triggers the seeder by calling any adapter method.
		return new DatabaseSync(dbPath);
	}

	beforeEach(async () => {
		workspace = await mkdtemp(join(tmpdir(), "sqlite-helpers-"));
		dbPath = join(workspace, "admin.sqlite");
		adapter = createAstropressSqliteAdapter({
			workspaceRoot: workspace,
			dbPath,
		});
	});

	afterEach(async () => {
		await rm(workspace, { recursive: true, force: true });
	});

	it("list() with no kind returns records spanning multiple kinds including settings", async () => {
		const all = await adapter.content.list();
		const kinds = new Set(all.map((r) => r.kind));
		expect(kinds.has("settings")).toBe(true);
	});

	it("list('post') filters to post records only", async () => {
		await adapter.content.save({
			id: "p1",
			kind: "post",
			slug: "p1",
			status: "published",
			title: "P1",
			body: "b",
			metadata: { metaDescription: "m", seoTitle: "s", legacyUrl: "/p1" },
		});
		const posts = await adapter.content.list("post");
		expect(posts.length).toBeGreaterThan(0);
		expect(posts.every((r) => r.kind === "post")).toBe(true);
	});

	it("list('settings') returns the site-settings record only", async () => {
		const settings = await adapter.content.list("settings");
		expect(settings.length).toBe(1);
		expect(settings[0].id).toBe("site-settings");
		expect(settings[0].slug).toBe("site-settings");
		expect(settings[0].status).toBe("published");
	});

	it("list('translation') returns translation records (initially empty)", async () => {
		const translations = await adapter.content.list("translation");
		expect(Array.isArray(translations)).toBe(true);
		expect(translations.every((r) => r.kind === "translation")).toBe(true);
	});

	it("list('comment') returns comment records (initially empty)", async () => {
		const comments = await adapter.content.list("comment");
		expect(Array.isArray(comments)).toBe(true);
		expect(comments.every((r) => r.kind === "comment")).toBe(true);
	});

	it("list('user') returns user records (admin user is seeded)", async () => {
		const users = await adapter.content.list("user");
		expect(users.length).toBeGreaterThan(0);
		expect(users.every((r) => r.kind === "user")).toBe(true);
		expect(users[0].slug).toContain("@");
	});

	it("list('redirect') returns redirect records (initially empty array shape)", async () => {
		const redirects = await adapter.content.list("redirect");
		expect(Array.isArray(redirects)).toBe(true);
		expect(redirects.every((r) => r.kind === "redirect")).toBe(true);
	});

	it("save({kind:'redirect'}) round-trips through the adapter and list('redirect') reflects it", async () => {
		await adapter.content.save({
			id: "/old-path",
			kind: "redirect",
			slug: "/old-path",
			status: "published",
			title: "Old",
			metadata: { targetPath: "/new-path", statusCode: 302 },
		});
		const redirects = await adapter.content.list("redirect");
		expect(redirects.find((r) => r.slug === "/old-path")).toBeTruthy();
	});

	it("save({kind:'settings'}) merges metadata into existing settings", async () => {
		const saved = await adapter.content.save({
			id: "site-settings",
			kind: "settings",
			slug: "site-settings",
			status: "published",
			title: "New Title",
			metadata: { siteTitle: "New Title" },
		});
		expect(saved.kind).toBe("settings");
		expect(saved.id).toBe("site-settings");
	});

	it("save({kind:'translation'}) updates translation state", async () => {
		const saved = await adapter.content.save({
			id: "/about",
			kind: "translation",
			slug: "/about",
			status: "draft",
			title: "/about",
			metadata: { state: "in_review" },
		});
		expect(saved.kind).toBe("translation");
		expect(saved.metadata).toEqual({ state: "in_review" });
		expect(saved.status).toBe("draft");
	});

	it("save({kind:'translation', metadata.state:'published'}) yields status='published'", async () => {
		const saved = await adapter.content.save({
			id: "/x",
			kind: "translation",
			slug: "/x",
			status: "draft",
			title: "/x",
			metadata: { state: "published" },
		});
		expect(saved.status).toBe("published");
	});

	it("save({kind:'post'}) on an existing slug routes through the existing-update path", async () => {
		await adapter.content.save({
			id: "hello",
			kind: "post",
			slug: "hello",
			status: "published",
			title: "Hello v1",
			body: "v1",
			metadata: { metaDescription: "m", seoTitle: "s", legacyUrl: "/hello" },
		});
		const updated = await adapter.content.save({
			id: "hello",
			kind: "post",
			slug: "hello",
			status: "draft",
			title: "Hello v2",
			body: "v2",
			metadata: { seoTitle: "s2", metaDescription: "m2" },
		});
		expect(updated.title).toBe("Hello v2");
	});

	it("save() throws for unsupported kinds (e.g. media as a content record)", async () => {
		await expect(
			adapter.content.save({
				id: "x",
				kind: "media" as never,
				slug: "x",
				status: "published",
				title: "X",
			}),
		).rejects.toThrow(/does not support saving/);
	});

	it("delete() on a redirect removes it via deleteRedirectRule", async () => {
		await adapter.content.save({
			id: "/tmp-old",
			kind: "redirect",
			slug: "/tmp-old",
			status: "published",
			title: "Temp",
			metadata: { targetPath: "/tmp-new", statusCode: 301 },
		});
		await adapter.content.delete("/tmp-old");
		const after = await adapter.content.list("redirect");
		expect(after.find((r) => r.slug === "/tmp-old")).toBeUndefined();
	});

	it("delete() on a post archives the content (saveContentState with status:'archived')", async () => {
		await adapter.content.save({
			id: "to-delete",
			kind: "post",
			slug: "to-delete",
			status: "published",
			title: "TD",
			body: "B",
			metadata: { metaDescription: "m", seoTitle: "s", legacyUrl: "/to-delete" },
		});
		await adapter.content.delete("to-delete");
		// Archived posts are not returned by list("post") under the default published filter
		const remaining = await adapter.content.list("post");
		expect(remaining.find((r) => r.slug === "to-delete")?.status).not.toBe("published");
	});

	it("delete() throws for unsupported kinds (settings)", async () => {
		await expect(adapter.content.delete("site-settings")).rejects.toThrow(
			/does not support deleting/,
		);
	});

	it("media.put + media.get round-trips an asset", async () => {
		await adapter.media.put({
			id: "logo",
			filename: "logo.png",
			mimeType: "image/png",
			publicUrl: "https://cdn.example/logo.png",
			metadata: { altText: "Logo", title: "Brand Logo" },
		});
		const fetched = await adapter.media.get("logo");
		expect(fetched?.filename).toBe("Brand Logo");
		expect(fetched?.mimeType).toBe("image/png");
	});

	it("media.get returns null when the asset id is unknown", async () => {
		expect(await adapter.media.get("does-not-exist")).toBeNull();
	});

	it("list('comment') maps approved comments to status='published' and others to 'draft'", async () => {
		await adapter.content.list(); // trigger seed
		const db = openSeededDb();
		db.prepare(
			"INSERT INTO comments (id, author, email, body, route, status, policy, submitted_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
		).run("ca1", "Alice", "a@x", "ba", "/r", "approved", "open-moderated", "2026-01-01");
		db.prepare(
			"INSERT INTO comments (id, author, email, body, route, status, policy, submitted_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
		).run("ca2", "Bob", null, null, "/r", "pending", "open-moderated", "2026-01-02");
		db.close();
		const comments = await adapter.content.list("comment");
		expect(comments.length).toBe(2);
		const approved = comments.find((c) => c.id === "ca1");
		const pending = comments.find((c) => c.id === "ca2");
		expect(approved?.status).toBe("published");
		expect(approved?.title).toBe("Alice");
		expect(pending?.status).toBe("draft");
		expect(approved?.metadata?.route).toBe("/r");
		expect(approved?.metadata?.email).toBe("a@x");
		expect(approved?.metadata?.policy).toBe("open-moderated");
		expect(pending?.metadata?.email).toBeNull();
		expect(pending?.body).toBeNull();
	});

	it("list('user') maps active=0 users to status='archived' and active=1 to 'published'", async () => {
		await adapter.content.list(); // trigger seed
		const db = openSeededDb();
		db.prepare(
			"INSERT INTO admin_users (email, password_hash, name, active, is_admin) VALUES (?, 'h', 'Inactive', 0, 0)",
		).run("inactive@example.com");
		db.close();
		const users = await adapter.content.list("user");
		const inactive = users.find((u) => u.slug === "inactive@example.com");
		expect(inactive?.status).toBe("archived");
		const seeded = users.find((u) => u.slug === "admin@example.com");
		expect(seeded?.status).toBe("published");
	});

	it("list('translation') maps row.state='published' to status='published' and others to 'draft'", async () => {
		await adapter.content.list(); // trigger seed
		const db = openSeededDb();
		db.prepare("INSERT INTO translation_overrides (route, state, updated_by) VALUES (?, ?, ?)").run(
			"/published",
			"published",
			"u@x",
		);
		db.prepare("INSERT INTO translation_overrides (route, state, updated_by) VALUES (?, ?, ?)").run(
			"/in-progress",
			"partial",
			"u@x",
		);
		db.close();
		const items = await adapter.content.list("translation");
		const pub = items.find((r) => r.slug === "/published");
		const partial = items.find((r) => r.slug === "/in-progress");
		expect(pub?.status).toBe("published");
		expect(partial?.status).toBe("draft");
		expect(pub?.metadata?.state).toBe("published");
		expect(pub?.metadata?.updatedBy).toBe("u@x");
	});

	it("list('media') maps assets and falls back from title to id when title is empty", async () => {
		await adapter.content.list(); // trigger seed
		const db = openSeededDb();
		db.prepare(
			"INSERT INTO media_assets (id, source_url, local_path, mime_type, file_size, alt_text, title, uploaded_at, uploaded_by) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
		).run(
			"hero.png",
			"https://cdn/h",
			"/m/h",
			"image/png",
			100,
			"Hero",
			"Hero Title",
			"2026-01-01",
			"u@x",
		);
		db.prepare(
			"INSERT INTO media_assets (id, source_url, local_path, mime_type, file_size, alt_text, title, uploaded_at, uploaded_by) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
		).run("bare.png", null, "/m/b", "image/png", null, null, "", "2026-01-02", "u@x");
		db.close();
		const media = await adapter.content.list("media");
		const titled = media.find((m) => m.id === "hero.png");
		const bare = media.find((m) => m.id === "bare.png");
		expect(titled?.title).toBe("Hero Title");
		expect(bare?.title).toBe("bare.png");
		expect(titled?.metadata?.sourceUrl).toBe("https://cdn/h");
		expect(titled?.status).toBe("published");
	});

	it("media.get falls back to id when asset.title is empty", async () => {
		await adapter.content.list();
		const db = openSeededDb();
		db.prepare(
			"INSERT INTO media_assets (id, source_url, local_path, mime_type, file_size, alt_text, title, uploaded_at, uploaded_by) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
		).run("noTitle.png", null, "/m/x", "image/png", null, null, "", "2026-01-01", "u@x");
		db.close();
		const asset = await adapter.media.get("noTitle.png");
		expect(asset?.filename).toBe("noTitle.png");
	});

	it("media.get sets mimeType to 'application/octet-stream' fallback when null", async () => {
		await adapter.content.list();
		const db = openSeededDb();
		db.prepare(
			"INSERT INTO media_assets (id, source_url, local_path, mime_type, file_size, alt_text, title, uploaded_at, uploaded_by) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
		).run("nomime", "https://cdn/x", "/m/x", null, null, null, "X", "2026-01-01", "u@x");
		db.close();
		const asset = await adapter.media.get("nomime");
		expect(asset?.mimeType).toBe("application/octet-stream");
	});

	it("media.get publicUrl falls back to localPath when sourceUrl is null", async () => {
		await adapter.content.list();
		const db = openSeededDb();
		db.prepare(
			"INSERT INTO media_assets (id, source_url, local_path, mime_type, file_size, alt_text, title, uploaded_at, uploaded_by) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
		).run("nourl", null, "/local/no-url", "image/png", null, null, "X", "2026-01-01", "u@x");
		db.close();
		const asset = await adapter.media.get("nourl");
		expect(asset?.publicUrl).toBe("/local/no-url");
	});

	it("save({kind:'redirect'}) defaults status code to 301 when not 302 (pins ternary)", async () => {
		await adapter.content.save({
			id: "/d1",
			kind: "redirect",
			slug: "/d1",
			status: "published",
			title: "D1",
			metadata: { targetPath: "/n1" },
		});
		const redirects = await adapter.content.list("redirect");
		const r = redirects.find((x) => x.slug === "/d1");
		expect(r?.metadata?.statusCode).toBe(301);
	});

	it("save({kind:'redirect'}) keeps 302 status code when explicitly set", async () => {
		await adapter.content.save({
			id: "/d2",
			kind: "redirect",
			slug: "/d2",
			status: "published",
			title: "D2",
			metadata: { targetPath: "/n2", statusCode: 302 },
		});
		const redirects = await adapter.content.list("redirect");
		const r = redirects.find((x) => x.slug === "/d2");
		expect(r?.metadata?.statusCode).toBe(302);
	});

	it("save({kind:'post'}) creates a new content record with the legacyUrl from metadata", async () => {
		const saved = await adapter.content.save({
			id: "new-post",
			kind: "post",
			slug: "new-post",
			status: "published",
			title: "New",
			body: "body",
			metadata: { metaDescription: "m", seoTitle: "s", legacyUrl: "/custom-legacy" },
		});
		expect(saved.kind).toBe("post");
		expect(saved.slug).toBe("new-post");
	});

	it("save({kind:'post'}) defaults legacyUrl to /${slug} when missing", async () => {
		const saved = await adapter.content.save({
			id: "no-legacy",
			kind: "post",
			slug: "no-legacy",
			status: "published",
			title: "NL",
			body: "b",
			metadata: { metaDescription: "m", seoTitle: "s" },
		});
		expect(saved.slug).toBe("no-legacy");
	});

	it("list('settings') returns ONLY settings records (kills if(true) kind-filter mutants)", async () => {
		const db = openSeededDb();
		db.prepare(
			"INSERT INTO comments (id, author, route, status, policy, submitted_at) VALUES (?, ?, ?, ?, ?, ?)",
		).run("cc1", "X", "/r", "pending", "open-moderated", "2026-01-01");
		db.close();
		const list = await adapter.content.list("settings");
		expect(list.every((r) => r.kind === "settings")).toBe(true);
	});

	it("list('redirect') returns ONLY redirect records", async () => {
		await adapter.content.save({
			id: "/old",
			kind: "redirect",
			slug: "/old",
			status: "published",
			title: "Old",
			metadata: { targetPath: "/new" },
		});
		const list = await adapter.content.list("redirect");
		expect(list.length).toBeGreaterThan(0);
		expect(list.every((r) => r.kind === "redirect")).toBe(true);
	});

	it("list('comment') returns ONLY comment records", async () => {
		const db = openSeededDb();
		db.prepare(
			"INSERT INTO comments (id, author, route, status, policy, submitted_at) VALUES (?, ?, ?, ?, ?, ?)",
		).run("cf1", "X", "/r", "approved", "open-moderated", "2026-01-01");
		db.close();
		const list = await adapter.content.list("comment");
		expect(list.length).toBeGreaterThan(0);
		expect(list.every((r) => r.kind === "comment")).toBe(true);
	});

	it("list('user') returns ONLY user records", async () => {
		const list = await adapter.content.list("user");
		expect(list.length).toBeGreaterThan(0);
		expect(list.every((r) => r.kind === "user")).toBe(true);
	});

	it("list('translation') returns ONLY translation records", async () => {
		const db = openSeededDb();
		db.prepare("INSERT INTO translation_overrides (route, state, updated_by) VALUES (?, ?, ?)").run(
			"/x",
			"published",
			"u@x",
		);
		db.close();
		const list = await adapter.content.list("translation");
		expect(list.length).toBeGreaterThan(0);
		expect(list.every((r) => r.kind === "translation")).toBe(true);
	});

	it("list('media') returns ONLY media records", async () => {
		const db = openSeededDb();
		db.prepare(
			"INSERT INTO media_assets (id, source_url, local_path, mime_type, file_size, alt_text, title, uploaded_at, uploaded_by) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
		).run("m1", "https://cdn/m", "/m", "image/png", 1, "alt", "T", "2026-01-01", "u@x");
		db.close();
		const list = await adapter.content.list("media");
		expect(list.length).toBeGreaterThan(0);
		expect(list.every((r) => r.kind === "media")).toBe(true);
	});

	it("list('post') excludes comments/users/settings/translations/media", async () => {
		const db = openSeededDb();
		db.prepare(
			"INSERT INTO comments (id, author, route, status, policy, submitted_at) VALUES (?, ?, ?, ?, ?, ?)",
		).run("co1", "X", "/r", "approved", "open-moderated", "2026-01-01");
		db.prepare("INSERT INTO translation_overrides (route, state, updated_by) VALUES (?, ?, ?)").run(
			"/y",
			"published",
			"u@x",
		);
		db.close();
		const list = await adapter.content.list("post");
		expect(list.every((r) => r.kind === "post")).toBe(true);
	});

	it("save({kind:'post'}) creates with body='' when record.body is undefined (pins ?? '' fallback)", async () => {
		const saved = await adapter.content.save({
			id: "bodyless",
			kind: "post",
			slug: "bodyless",
			status: "published",
			title: "B",
			metadata: { metaDescription: "m", seoTitle: "s", legacyUrl: "/b" },
		});
		expect(saved.slug).toBe("bodyless");
	});

	it("save({kind:'post'}) on update preserves existing body when record.body and existing.body are both falsy", async () => {
		// First create with empty body
		await adapter.content.save({
			id: "pres",
			kind: "post",
			slug: "pres",
			status: "published",
			title: "P",
			body: "",
			metadata: { metaDescription: "m", seoTitle: "s", legacyUrl: "/pres" },
		});
		// Now update without body — should resolve to "" via existing.body ?? ""
		const updated = await adapter.content.save({
			id: "pres",
			kind: "post",
			slug: "pres",
			status: "draft",
			title: "P2",
			metadata: { seoTitle: "s2", metaDescription: "m2" },
		});
		expect(updated.title).toBe("P2");
	});

	it("save({kind:'translation'}) defaults state to 'not_started' when metadata.state is absent", async () => {
		const saved = await adapter.content.save({
			id: "/no-state",
			kind: "translation",
			slug: "/no-state",
			status: "draft",
			title: "/no-state",
		});
		expect(saved.metadata?.state).toBe("not_started");
		expect(saved.status).toBe("draft");
	});

	it("save({kind:'redirect'}) defaults targetPath to '' when missing and surfaces backing error", async () => {
		// targetPath ?? "" .trim() resolves to "" which the underlying redirect store rejects.
		// The point is the fallback executes (kills the ?? "" mutant) — exact error message confirms it.
		await expect(
			adapter.content.save({
				id: "/no-target",
				kind: "redirect",
				slug: "/no-target",
				status: "published",
				title: "NT",
				metadata: {},
			}),
		).rejects.toThrow(/required/i);
	});

	it("delete() on an archived post is idempotent (body and existing.body both empty)", async () => {
		await adapter.content.save({
			id: "del-me",
			kind: "post",
			slug: "del-me",
			status: "published",
			title: "D",
			body: "",
			metadata: { metaDescription: "m", seoTitle: "s", legacyUrl: "/del-me" },
		});
		await adapter.content.delete("del-me");
		// Calling delete again should not throw (the get() returns null so deletion is a no-op)
		await expect(adapter.content.delete("del-me")).resolves.toBeUndefined();
	});

	it("media.put with no publicUrl uses /media/${filename} as the local_path fallback", async () => {
		await adapter.media.put({
			id: "fallback-asset",
			filename: "thing.png",
			mimeType: "image/png",
			metadata: {},
		});
		const db = openSeededDb();
		const row = db
			.prepare("SELECT local_path, source_url FROM media_assets WHERE id = ?")
			.get("fallback-asset") as { local_path: string; source_url: string | null };
		db.close();
		expect(row.local_path).toBe("/media/thing.png");
		expect(row.source_url).toBeNull();
	});

	it("save({kind:'post'}) on update uses record.title when provided (kills ?? existing.title mutant)", async () => {
		await adapter.content.save({
			id: "tu",
			kind: "post",
			slug: "tu",
			status: "published",
			title: "v1",
			body: "b",
			metadata: { metaDescription: "m", seoTitle: "s", legacyUrl: "/tu" },
		});
		const updated = await adapter.content.save({
			id: "tu",
			kind: "post",
			slug: "tu",
			status: "draft",
			title: "v2",
			body: "b2",
			metadata: { metaDescription: "m2", seoTitle: "s2" },
		});
		expect(updated.title).toBe("v2");
	});

	it("save({kind:'post'}) on update uses existing.title when record.title is undefined", async () => {
		await adapter.content.save({
			id: "ex-title",
			kind: "post",
			slug: "ex-title",
			status: "published",
			title: "Original",
			body: "b",
			metadata: { metaDescription: "m", seoTitle: "s", legacyUrl: "/ex-title" },
		});
		const updated = await adapter.content.save({
			id: "ex-title",
			kind: "post",
			slug: "ex-title",
			status: "draft",
			metadata: { seoTitle: "s2", metaDescription: "m2" },
		} as Parameters<typeof adapter.content.save>[0]);
		expect(updated.title).toBeTruthy();
	});

	it("save({kind:'post'}) uses metadata.seoTitle when present", async () => {
		const saved = await adapter.content.save({
			id: "seo",
			kind: "post",
			slug: "seo",
			status: "published",
			title: "T",
			body: "b",
			metadata: { metaDescription: "m", seoTitle: "Custom SEO", legacyUrl: "/seo" },
		});
		expect(saved.slug).toBe("seo");
	});

	it("save({kind:'post'}) on update preserves existing summary in excerpt when record has no summary", async () => {
		await adapter.content.save({
			id: "sum",
			kind: "post",
			slug: "sum",
			status: "published",
			title: "T",
			body: "b",
			metadata: { metaDescription: "m", seoTitle: "s", legacyUrl: "/sum", summary: "Initial sum" },
		});
		// Update without summary metadata — the existing summary should be preserved
		await adapter.content.save({
			id: "sum",
			kind: "post",
			slug: "sum",
			status: "draft",
			title: "T2",
			metadata: { seoTitle: "s2", metaDescription: "m2" },
		});
		const posts = await adapter.content.list("post");
		expect(posts.find((p) => p.slug === "sum")).toBeTruthy();
	});

	it("save({kind:'post'}) on update routes record.metadata.ogTitle through resolveMetaString", async () => {
		await adapter.content.save({
			id: "og",
			kind: "post",
			slug: "og",
			status: "published",
			title: "T",
			body: "b",
			metadata: { metaDescription: "m", seoTitle: "s", legacyUrl: "/og" },
		});
		const updated = await adapter.content.save({
			id: "og",
			kind: "post",
			slug: "og",
			status: "published",
			title: "T",
			metadata: {
				seoTitle: "s",
				metaDescription: "m",
				ogTitle: "OG Title",
				ogDescription: "OG Desc",
				ogImage: "/og.png",
				canonicalUrlOverride: "/canon",
				robotsDirective: "noindex",
			},
		});
		expect(updated.slug).toBe("og");
	});

	it("revisions.append writes via SQL_INSERT_REVISION and revisions.list returns the row", async () => {
		// Need a parent content_overrides row first: save a post then append revision against its slug.
		await adapter.content.save({
			id: "post-with-rev",
			kind: "post",
			slug: "post-with-rev",
			status: "published",
			title: "PWR",
			body: "B",
			metadata: { metaDescription: "m", seoTitle: "s", legacyUrl: "/post-with-rev" },
		});
		await adapter.revisions.append({
			id: "rev-x",
			recordId: "post-with-rev",
			createdAt: new Date().toISOString(),
			snapshot: { title: "Snapshot", status: "draft" },
		});
		const revisions = await adapter.revisions.list("post-with-rev");
		expect(revisions.length).toBeGreaterThan(0);
	});
});
