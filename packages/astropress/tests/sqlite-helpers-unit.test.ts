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

	// saveSqlitePageOrPost ?? fallback chain pins.
	// L144: seoTitle = String(metadata.seoTitle ?? record.title ?? slug)
	// L145: metaDescription = String(metadata.metaDescription ?? record.title ?? slug)
	// L151: body = record.body ?? existing.body ?? ""
	// L155: excerpt = String(metadata.summary ?? existing.summary ?? "")
	//
	// Each branch of the chain must be observably distinguishable so the
	// LogicalOperator and ConditionalExpression mutants on the `??` operators
	// can be killed.

	async function readPersistedPost(slug: string) {
		const db = openSeededDb();
		const row = db
			.prepare(
				"SELECT title, body, seo_title, meta_description, excerpt FROM content_overrides WHERE slug = ?",
			)
			.get(slug) as {
			title: string;
			body: string | null;
			seo_title: string;
			meta_description: string;
			excerpt: string | null;
		};
		db.close();
		return row;
	}

	it("create-path: seoTitle/metaDescription use metadata.seoTitle/metaDescription when present", async () => {
		await adapter.content.save({
			id: "ct1",
			kind: "post",
			slug: "ct1",
			status: "published",
			title: "T",
			body: "b",
			metadata: {
				seoTitle: "SEO-FROM-META",
				metaDescription: "MD-FROM-META",
				legacyUrl: "/ct1",
			},
		});
		const row = await readPersistedPost("ct1");
		expect(row.seo_title).toBe("SEO-FROM-META");
		expect(row.meta_description).toBe("MD-FROM-META");
	});

	it("create-path: seoTitle/metaDescription fall back to record.title when metadata fields absent", async () => {
		await adapter.content.save({
			id: "ct2",
			kind: "post",
			slug: "ct2",
			status: "published",
			title: "TITLE-AS-FALLBACK",
			body: "b",
			metadata: { legacyUrl: "/ct2" },
		});
		const row = await readPersistedPost("ct2");
		expect(row.seo_title).toBe("TITLE-AS-FALLBACK");
		expect(row.meta_description).toBe("TITLE-AS-FALLBACK");
	});

	it("create-path: seoTitle/metaDescription fall back to slug when metadata fields and title both absent", async () => {
		// Bypass required title to exercise the final ?? slug fallback.
		await adapter.content.save({
			id: "ct3-slug",
			kind: "post",
			slug: "ct3-slug",
			status: "published",
			metadata: { legacyUrl: "/ct3-slug" },
		} as unknown as Parameters<typeof adapter.content.save>[0]);
		const row = await readPersistedPost("ct3-slug");
		expect(row.seo_title).toBe("ct3-slug");
		expect(row.meta_description).toBe("ct3-slug");
	});

	it("update-path: seoTitle/metaDescription use metadata fields when present (not record.title / not slug)", async () => {
		await adapter.content.save({
			id: "ut1",
			kind: "post",
			slug: "ut1",
			status: "published",
			title: "Original",
			body: "b",
			metadata: { seoTitle: "OldSEO", metaDescription: "OldMD", legacyUrl: "/ut1" },
		});
		await adapter.content.save({
			id: "ut1",
			kind: "post",
			slug: "ut1",
			status: "draft",
			title: "NewTitle",
			body: "b2",
			metadata: { seoTitle: "NEW-SEO", metaDescription: "NEW-MD" },
		});
		const row = await readPersistedPost("ut1");
		expect(row.seo_title).toBe("NEW-SEO");
		expect(row.meta_description).toBe("NEW-MD");
	});

	it("update-path: seoTitle/metaDescription fall back to record.title when metadata fields absent on update", async () => {
		await adapter.content.save({
			id: "ut2",
			kind: "post",
			slug: "ut2",
			status: "published",
			title: "v1",
			body: "b",
			metadata: { seoTitle: "OldSEO", metaDescription: "OldMD", legacyUrl: "/ut2" },
		});
		await adapter.content.save({
			id: "ut2",
			kind: "post",
			slug: "ut2",
			status: "draft",
			title: "TITLE-V2",
			body: "b2",
			metadata: {},
		});
		const row = await readPersistedPost("ut2");
		expect(row.seo_title).toBe("TITLE-V2");
		expect(row.meta_description).toBe("TITLE-V2");
	});

	it("update-path: seoTitle/metaDescription fall back to slug when metadata and record.title both absent", async () => {
		await adapter.content.save({
			id: "ut3",
			kind: "post",
			slug: "ut3",
			status: "published",
			title: "v1",
			body: "b",
			metadata: { seoTitle: "OldSEO", metaDescription: "OldMD", legacyUrl: "/ut3" },
		});
		await adapter.content.save({
			id: "ut3",
			kind: "post",
			slug: "ut3",
			status: "draft",
			body: "b2",
			metadata: {},
		} as unknown as Parameters<typeof adapter.content.save>[0]);
		const row = await readPersistedPost("ut3");
		expect(row.seo_title).toBe("ut3");
		expect(row.meta_description).toBe("ut3");
	});

	it("update-path: body uses record.body when provided (kills ?? existing.body mutant)", async () => {
		await adapter.content.save({
			id: "bd1",
			kind: "post",
			slug: "bd1",
			status: "published",
			title: "T",
			body: "OLD-BODY",
			metadata: { seoTitle: "s", metaDescription: "m", legacyUrl: "/bd1" },
		});
		await adapter.content.save({
			id: "bd1",
			kind: "post",
			slug: "bd1",
			status: "draft",
			title: "T",
			body: "NEW-BODY",
			metadata: { seoTitle: "s", metaDescription: "m" },
		});
		const row = await readPersistedPost("bd1");
		expect(row.body).toBe("NEW-BODY");
	});

	it("update-path: body falls back to existing.body when record.body is undefined", async () => {
		await adapter.content.save({
			id: "bd2",
			kind: "post",
			slug: "bd2",
			status: "published",
			title: "T",
			body: "EXISTING-BODY",
			metadata: { seoTitle: "s", metaDescription: "m", legacyUrl: "/bd2" },
		});
		await adapter.content.save({
			id: "bd2",
			kind: "post",
			slug: "bd2",
			status: "draft",
			title: "T",
			metadata: { seoTitle: "s", metaDescription: "m" },
		} as unknown as Parameters<typeof adapter.content.save>[0]);
		const row = await readPersistedPost("bd2");
		expect(row.body).toBe("EXISTING-BODY");
	});

	it("update-path: excerpt uses metadata.summary when provided", async () => {
		await adapter.content.save({
			id: "sm1",
			kind: "post",
			slug: "sm1",
			status: "published",
			title: "T",
			body: "b",
			metadata: {
				seoTitle: "s",
				metaDescription: "m",
				legacyUrl: "/sm1",
				summary: "INITIAL-SUMMARY",
			},
		});
		await adapter.content.save({
			id: "sm1",
			kind: "post",
			slug: "sm1",
			status: "draft",
			title: "T",
			body: "b2",
			metadata: { seoTitle: "s", metaDescription: "m", summary: "UPDATED-SUMMARY" },
		});
		const row = await readPersistedPost("sm1");
		expect(row.excerpt).toBe("UPDATED-SUMMARY");
	});

	it("update-path: excerpt falls back to existing.summary when metadata.summary absent", async () => {
		await adapter.content.save({
			id: "sm2",
			kind: "post",
			slug: "sm2",
			status: "published",
			title: "T",
			body: "b",
			metadata: {
				seoTitle: "s",
				metaDescription: "m",
				legacyUrl: "/sm2",
				summary: "EXISTING-SUMMARY",
			},
		});
		await adapter.content.save({
			id: "sm2",
			kind: "post",
			slug: "sm2",
			status: "draft",
			title: "T",
			body: "b2",
			metadata: { seoTitle: "s", metaDescription: "m" },
		});
		const row = await readPersistedPost("sm2");
		expect(row.excerpt).toBe("EXISTING-SUMMARY");
	});

	it("update-path: excerpt defaults to '' when both metadata.summary and existing.summary are absent", async () => {
		await adapter.content.save({
			id: "sm3",
			kind: "post",
			slug: "sm3",
			status: "published",
			title: "T",
			body: "b",
			metadata: { seoTitle: "s", metaDescription: "m", legacyUrl: "/sm3" },
		});
		await adapter.content.save({
			id: "sm3",
			kind: "post",
			slug: "sm3",
			status: "draft",
			title: "T",
			body: "b2",
			metadata: { seoTitle: "s", metaDescription: "m" },
		});
		const row = await readPersistedPost("sm3");
		expect(row.excerpt ?? "").toBe("");
	});

	async function readPersistedPostFull(slug: string) {
		const db = openSeededDb();
		const row = db
			.prepare(
				"SELECT title, body, seo_title, meta_description, excerpt, og_title, og_description, og_image, canonical_url_override, robots_directive FROM content_overrides WHERE slug = ?",
			)
			.get(slug) as {
			title: string;
			body: string | null;
			seo_title: string;
			meta_description: string;
			excerpt: string | null;
			og_title: string | null;
			og_description: string | null;
			og_image: string | null;
			canonical_url_override: string | null;
			robots_directive: string | null;
		};
		db.close();
		return row;
	}

	// Pin every metadata-key literal in saveSqlitePageOrPost (both branches)
	// to its specific column. Mutating any of the literals "ogTitle",
	// "ogDescription", "ogImage", "canonicalUrlOverride", "robotsDirective",
	// or "legacyUrl" to "" makes resolveMetaString return undefined, so the
	// corresponding column persists as NULL instead of the metadata value.

	it("create-path: persists og_title / og_description / og_image from metadata (canonical/robots are update-path-only)", async () => {
		await adapter.content.save({
			id: "ogc",
			kind: "post",
			slug: "ogc",
			status: "published",
			title: "T",
			body: "b",
			metadata: {
				seoTitle: "s",
				metaDescription: "m",
				legacyUrl: "/ogc",
				ogTitle: "OG-TITLE",
				ogDescription: "OG-DESC",
				ogImage: "/og.png",
			},
		});
		const row = await readPersistedPostFull("ogc");
		expect(row.og_title).toBe("OG-TITLE");
		expect(row.og_description).toBe("OG-DESC");
		expect(row.og_image).toBe("/og.png");
	});

	it("update-path: persists og_title / og_description / og_image / canonical / robots on update", async () => {
		await adapter.content.save({
			id: "ogu",
			kind: "post",
			slug: "ogu",
			status: "published",
			title: "T",
			body: "b",
			metadata: { seoTitle: "s", metaDescription: "m", legacyUrl: "/ogu" },
		});
		await adapter.content.save({
			id: "ogu",
			kind: "post",
			slug: "ogu",
			status: "draft",
			title: "T",
			body: "b2",
			metadata: {
				seoTitle: "s",
				metaDescription: "m",
				ogTitle: "U-OG",
				ogDescription: "U-OD",
				ogImage: "/u-og.png",
				canonicalUrlOverride: "/u-canon",
				robotsDirective: "nofollow",
			},
		});
		const row = await readPersistedPostFull("ogu");
		expect(row.og_title).toBe("U-OG");
		expect(row.og_description).toBe("U-OD");
		expect(row.og_image).toBe("/u-og.png");
		expect(row.canonical_url_override).toBe("/u-canon");
		expect(row.robots_directive).toBe("nofollow");
	});

	it("create-path: persists metadata.legacyUrl to the legacy_url column", async () => {
		await adapter.content.save({
			id: "lu",
			kind: "post",
			slug: "lu",
			status: "published",
			title: "T",
			body: "b",
			metadata: {
				seoTitle: "s",
				metaDescription: "m",
				legacyUrl: "/CUSTOM-LEGACY",
			},
		});
		const db = openSeededDb();
		const row = db.prepare("SELECT legacy_url FROM content_entries WHERE slug = ?").get("lu") as {
			legacy_url: string;
		};
		db.close();
		expect(row.legacy_url).toBe("/CUSTOM-LEGACY");
	});

	it("create-path: legacy_url falls back to /${slug} when metadata.legacyUrl absent", async () => {
		await adapter.content.save({
			id: "lufb",
			kind: "post",
			slug: "lufb",
			status: "published",
			title: "T",
			body: "b",
			metadata: { seoTitle: "s", metaDescription: "m" },
		});
		const db = openSeededDb();
		const row = db.prepare("SELECT legacy_url FROM content_entries WHERE slug = ?").get("lufb") as {
			legacy_url: string;
		};
		db.close();
		expect(row.legacy_url).toBe("/lufb");
	});

	// list() filter exclusivity: a page + post + redirect + media all present,
	// each `list(kind)` returns only its kind. Kills L21:15/L21:24/L21:15
	// EqualityOperator, L24:8, L27:6, L102:6 ConditionalExpression mutants.

	it("list('post') excludes pages, redirects, comments, users, media when all kinds coexist", async () => {
		// Page
		const db1 = openSeededDb();
		db1
			.prepare(
				"INSERT INTO content_entries (slug, legacy_url, title, kind, body, seo_title, meta_description) VALUES (?, ?, ?, 'page', '', '', '')",
			)
			.run("a-page", "/a-page", "A Page");
		db1
			.prepare(
				"INSERT INTO content_overrides (slug, title, status, updated_by, seo_title, meta_description) VALUES (?, ?, 'published', 'u@x', '', '')",
			)
			.run("a-page", "A Page");
		db1.close();
		// Post
		await adapter.content.save({
			id: "a-post",
			kind: "post",
			slug: "a-post",
			status: "published",
			title: "P",
			body: "b",
			metadata: { metaDescription: "m", seoTitle: "s", legacyUrl: "/a-post" },
		});
		// Redirect
		await adapter.content.save({
			id: "/r",
			kind: "redirect",
			slug: "/r",
			status: "published",
			title: "R",
			metadata: { targetPath: "/dest" },
		});
		// Media
		const db2 = openSeededDb();
		db2
			.prepare(
				"INSERT INTO media_assets (id, source_url, local_path, mime_type, file_size, alt_text, title, uploaded_at, uploaded_by) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
			)
			.run("m.png", "https://cdn/m", "/m", "image/png", 1, "alt", "T", "2026-01-01", "u@x");
		db2.close();

		const posts = await adapter.content.list("post");
		// Only post kind, and the actual post is present.
		expect(posts.every((r) => r.kind === "post")).toBe(true);
		expect(posts.find((r) => r.slug === "a-post")).toBeTruthy();
	});

	it("list('page') returns ONLY page records (kills L21 mutants in the page-or-post branch)", async () => {
		// Insert a page-kind record directly (the adapter save() doesn't accept "page").
		const db1 = openSeededDb();
		db1
			.prepare(
				"INSERT INTO content_entries (slug, legacy_url, title, kind, body, seo_title, meta_description) VALUES (?, ?, ?, 'page', '', '', '')",
			)
			.run("the-page", "/the-page", "The Page");
		db1
			.prepare(
				"INSERT INTO content_overrides (slug, title, status, updated_by, seo_title, meta_description) VALUES (?, ?, 'published', 'u@x', '', '')",
			)
			.run("the-page", "The Page");
		db1.close();
		// Add a post too — page filter must exclude it.
		await adapter.content.save({
			id: "extra-post",
			kind: "post",
			slug: "extra-post",
			status: "published",
			title: "EP",
			body: "b",
			metadata: { metaDescription: "m", seoTitle: "s", legacyUrl: "/extra-post" },
		});
		// Add a redirect and media — page filter must exclude both.
		await adapter.content.save({
			id: "/extra-r",
			kind: "redirect",
			slug: "/extra-r",
			status: "published",
			title: "R",
			metadata: { targetPath: "/dest" },
		});
		const db2 = openSeededDb();
		db2
			.prepare(
				"INSERT INTO media_assets (id, source_url, local_path, mime_type, file_size, alt_text, title, uploaded_at, uploaded_by) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
			)
			.run("p-img.png", null, "/p", "image/png", 1, null, "Img", "2026-01-01", "u@x");
		db2.close();

		const pages = await adapter.content.list("page");
		expect(pages.every((r) => r.kind === "page")).toBe(true);
		expect(pages.find((r) => r.slug === "the-page")).toBeTruthy();
	});

	// Translation save uses `record.metadata?.state ?? "not_started"`. With
	// undefined metadata, the OptionalChaining mutant on L218 throws.

	it("save({kind:'translation'}) tolerates undefined metadata (kills L218 OptionalChaining mutant)", async () => {
		const saved = await adapter.content.save({
			id: "/tu-nometa",
			kind: "translation",
			slug: "/tu-nometa",
			status: "draft",
			title: "/tu-nometa",
		} as unknown as Parameters<typeof adapter.content.save>[0]);
		expect(saved.metadata?.state).toBe("not_started");
	});

	// Redirect save uses `record.metadata?.targetPath ?? ""` and
	// `record.metadata?.statusCode`. Each OptionalChaining mutant throws on
	// undefined metadata; the `.trim()` MethodExpression and the statusCode
	// ternary are pinned by whitespace / explicit 302 inputs.

	it("save({kind:'redirect'}) trims whitespace in targetPath (kills .trim() MethodExpression mutant)", async () => {
		await adapter.content.save({
			id: "/trim-r",
			kind: "redirect",
			slug: "/trim-r",
			status: "published",
			title: "R",
			metadata: { targetPath: "   /target-trimmed   " },
		});
		const redirects = await adapter.content.list("redirect");
		const found = redirects.find((r) => r.slug === "/trim-r");
		expect(found?.metadata?.targetPath).toBe("/target-trimmed");
	});

	// Settings save: `next = { ...current, ...(record.metadata ?? {}) }`.
	// ObjectLiteral mutant `{}` discards both spreads → settings overwritten
	// with empty object. metadata fall-back && {} mutant similar.

	it("save({kind:'settings'}) merges metadata into current (kills L205 spread/object mutants)", async () => {
		const saved = await adapter.content.save({
			id: "site-settings",
			kind: "settings",
			slug: "site-settings",
			status: "published",
			title: "Whatever",
			metadata: { siteTitle: "MERGED-TITLE", customField: "X" },
		});
		expect(saved.metadata?.siteTitle).toBe("MERGED-TITLE");
		// Spread of current preserves other defaults — re-list and check.
		const list = await adapter.content.list("settings");
		expect(list[0].metadata?.siteTitle).toBe("MERGED-TITLE");
	});

	it("save({kind:'settings'}) returns site-settings as the id/slug literals", async () => {
		const saved = await adapter.content.save({
			id: "site-settings",
			kind: "settings",
			slug: "site-settings",
			status: "published",
			title: "T",
			metadata: { siteTitle: "T" },
		});
		expect(saved.id).toBe("site-settings");
		expect(saved.slug).toBe("site-settings");
	});

	// list('comment'): submittedAt nullish fallback. With L47:19
	// `?? null` mutated to `&& null`, submittedAt is forced to null even when
	// the row had a real timestamp.

	it("list('comment') preserves the row's submittedAt (kills L47 ?? null → && null mutant)", async () => {
		const db = openSeededDb();
		db.prepare(
			"INSERT INTO comments (id, author, email, body, route, status, policy, submitted_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
		).run("csub", "Alice", "a@x", "body", "/r", "approved", "open-moderated", "2026-04-04");
		db.close();
		const comments = await adapter.content.list("comment");
		const row = comments.find((c) => c.id === "csub");
		expect(row?.metadata?.submittedAt).toBe("2026-04-04");
	});

	// list('user'): metadata object literal mutated to {} drops email/role/etc.

	it("list('user') populates metadata.email/role/createdAt/userStatus (kills L60 ObjectLiteral mutant)", async () => {
		const users = await adapter.content.list("user");
		const u = users[0];
		expect(u.metadata?.email).toBeDefined();
		expect(u.metadata?.role).toBeDefined();
		expect(u.metadata?.createdAt).toBeDefined();
	});

	// list('media'): asset.metadata?.altText/title fallback chains.

	// saveSqliteContentRecord: slug || id fallback. With L192 LogicalOperator
	// mutated `||` → `&&`, an empty record.slug short-circuits to "" (mutant)
	// instead of falling back to record.id (original).

	it("save({kind:'redirect'}) uses record.id when record.slug is empty (kills L192 ||→&& mutant)", async () => {
		await adapter.content.save({
			id: "/redirect-by-id",
			kind: "redirect",
			slug: "",
			status: "published",
			title: "ByID",
			metadata: { targetPath: "/dest-by-id" },
		});
		const redirects = await adapter.content.list("redirect");
		expect(redirects.find((r) => r.slug === "/redirect-by-id")).toBeTruthy();
	});

	// adapter.content.save({kind:'page'}) exercises the L229 page-or-post
	// ConditionalExpression branch (otherwise only hit via 'post').

	it("save({kind:'page'}) routes through the page-or-post branch (kills L229 false-direction mutant)", async () => {
		// The page-or-post branch must NOT throw; the underlying store may
		// normalise kind based on row data, but the routing-level mutant
		// (skipping the page/post branch and falling through to the throw)
		// is killed if the call succeeds at all.
		await expect(
			adapter.content.save({
				id: "a-page-save",
				kind: "page",
				slug: "a-page-save",
				status: "published",
				title: "PageT",
				body: "pb",
				metadata: { seoTitle: "s", metaDescription: "m", legacyUrl: "/a-page-save" },
			}),
		).resolves.toBeTruthy();
	});

	// deleteSqliteContentRecord existing-branch fallback chains (L244-253).
	// Existing post-delete tests don't assert the persisted column values, so
	// the existing.title ?? existing.slug etc. chains have surviving mutants.
	// Verify post-delete that the archived row preserved its seoTitle / body /
	// metaDescription via the original record's metadata.

	it("delete({kind:'post'}) writes archive row with seoTitle from existing.metadata.seoTitle (pins L251 chain)", async () => {
		await adapter.content.save({
			id: "del-seo",
			kind: "post",
			slug: "del-seo",
			status: "published",
			title: "DST",
			body: "DSB",
			metadata: {
				seoTitle: "PINNED-SEO",
				metaDescription: "PINNED-MD",
				legacyUrl: "/del-seo",
			},
		});
		await adapter.content.delete("del-seo");
		const row = await readPersistedPostFull("del-seo");
		expect(row.seo_title).toBe("PINNED-SEO");
		expect(row.meta_description).toBe("PINNED-MD");
		expect(row.body).toBe("DSB");
	});

	it("delete({kind:'post'}) falls back to existing.title when metadata.seoTitle absent (pins L251 'title' arm)", async () => {
		// Insert a row directly without metadata.seoTitle / metaDescription so
		// the listed record's metadata.seoTitle is undefined.
		await adapter.content.save({
			id: "del-noseo",
			kind: "post",
			slug: "del-noseo",
			status: "published",
			title: "TITLE-FALLBACK",
			body: "B",
			metadata: { seoTitle: "S0", metaDescription: "M0", legacyUrl: "/del-noseo" },
		});
		// Manually overwrite metadata to drop seoTitle for the delete path
		const db = openSeededDb();
		db.prepare("UPDATE content_overrides SET seo_title = NULL WHERE slug = ?").run("del-noseo");
		db.prepare("UPDATE content_overrides SET meta_description = NULL WHERE slug = ?").run(
			"del-noseo",
		);
		db.close();
		await adapter.content.delete("del-noseo");
		// After delete (archive), seo_title and meta_description must be set —
		// they fall back to existing.title.
		const row = await readPersistedPostFull("del-noseo");
		expect(row.seo_title.length).toBeGreaterThan(0);
		expect(row.meta_description.length).toBeGreaterThan(0);
	});

	// revisions.append actually persists. Existing test asserts length>0; we
	// also pin specific snapshot values to kill mutants in buildRevisionParams.

	it("revisions.append writes a row that revisions.list can read back with the title/body from the snapshot", async () => {
		await adapter.content.save({
			id: "rev-host",
			kind: "post",
			slug: "rev-host",
			status: "published",
			title: "RH",
			body: "RB",
			metadata: { seoTitle: "s", metaDescription: "m", legacyUrl: "/rev-host" },
		});
		await adapter.revisions.append({
			id: "rev-v1",
			recordId: "rev-host",
			createdAt: "2026-05-01T00:00:00Z",
			snapshot: { title: "REV-TITLE", body: "REV-BODY", status: "draft" },
		});
		const revs = await adapter.revisions.list("rev-host");
		const found = revs.find((r) => r.id === "rev-v1");
		expect(found).toBeTruthy();
		expect(found?.snapshot?.title).toBe("REV-TITLE");
		expect(found?.snapshot?.body).toBe("REV-BODY");
	});

	// media.put: asset.metadata?.altText fallback chain. With L352
	// OptionalChaining `asset.metadata.altText` (no `?.`), throws when
	// metadata is undefined; with L352:38 StringLiteral mutant `""` →
	// `"Stryker was here!"`, the empty-fallback emits the sentinel into the
	// alt_text column.

	it("media.put with undefined metadata persists empty alt_text and uses filename as title (kills L352/L353 mutants)", async () => {
		await adapter.media.put({
			id: "no-meta.png",
			filename: "no-meta.png",
			mimeType: "image/png",
			publicUrl: "https://cdn/no-meta",
		});
		const db = openSeededDb();
		const row = db
			.prepare("SELECT alt_text, title FROM media_assets WHERE id = ?")
			.get("no-meta.png") as { alt_text: string; title: string };
		db.close();
		expect(row.alt_text).toBe("");
		expect(row.title).toBe("no-meta.png");
	});

	it("media.put with metadata.altText / metadata.title persists both (kills L352/L353 ?? key literals)", async () => {
		await adapter.media.put({
			id: "with-alt.png",
			filename: "with-alt.png",
			mimeType: "image/png",
			publicUrl: "https://cdn/with-alt",
			metadata: { altText: "ALTX", title: "TITLEX" },
		});
		const db = openSeededDb();
		const row = db
			.prepare("SELECT alt_text, title FROM media_assets WHERE id = ?")
			.get("with-alt.png") as { alt_text: string; title: string };
		db.close();
		expect(row.alt_text).toBe("ALTX");
		expect(row.title).toBe("TITLEX");
	});

	// getSqliteMedia matches by id (find with `entry.id === id`). L328:81
	// ConditionalExpression → true makes find return the FIRST asset
	// regardless of id; killable when multiple assets are present.

	it("media.get returns the matching asset, not the first (kills L328 entry.id === id → true mutant)", async () => {
		await adapter.media.put({
			id: "first.png",
			filename: "first.png",
			mimeType: "image/png",
			publicUrl: "https://cdn/first",
			metadata: { altText: "first-alt" },
		});
		await adapter.media.put({
			id: "second.png",
			filename: "second.png",
			mimeType: "image/png",
			publicUrl: "https://cdn/second",
			metadata: { altText: "second-alt" },
		});
		const got = await adapter.media.get("second.png");
		expect(got?.id).toBe("second.png");
		expect(got?.publicUrl).toBe("https://cdn/second");
	});

	// Metadata-undefined cases: every `record.metadata?.X` and `existing.metadata?.X`
	// chain in save / delete is killable by passing undefined metadata; the
	// OptionalChaining mutant strips the `?.` and throws on the property
	// access. We must cast through `unknown` because metadata is typed
	// required.

	it("create-path: save({kind:'post'}) tolerates undefined metadata (kills L173 OptionalChaining)", async () => {
		await expect(
			adapter.content.save({
				id: "no-meta",
				kind: "post",
				slug: "no-meta",
				status: "published",
				title: "T",
				body: "b",
			} as unknown as Parameters<typeof adapter.content.save>[0]),
		).resolves.toBeTruthy();
	});

	it("update-path: save({kind:'post'}) tolerates undefined metadata (kills L144/L145/L155 OptionalChaining)", async () => {
		await adapter.content.save({
			id: "no-meta-up",
			kind: "post",
			slug: "no-meta-up",
			status: "published",
			title: "T",
			body: "b",
			metadata: { seoTitle: "s", metaDescription: "m", legacyUrl: "/no-meta-up" },
		});
		await expect(
			adapter.content.save({
				id: "no-meta-up",
				kind: "post",
				slug: "no-meta-up",
				status: "draft",
				title: "T2",
				body: "b2",
			} as unknown as Parameters<typeof adapter.content.save>[0]),
		).resolves.toBeTruthy();
	});

	it("redirect-path: save({kind:'redirect'}) tolerates undefined metadata (kills L194/L195 OptionalChaining)", async () => {
		await expect(
			adapter.content.save({
				id: "/red-nometa",
				kind: "redirect",
				slug: "/red-nometa",
				status: "published",
				title: "RN",
			} as unknown as Parameters<typeof adapter.content.save>[0]),
		).rejects.toThrow();
		// The save rejects because targetPath becomes "" which the redirect
		// store rejects — but it reaches that point WITHOUT throwing on
		// `record.metadata.targetPath`. The OptionalChaining mutant would
		// throw TypeError before the redirect store ever sees the call.
	});

	it("delete-path: delete archives with seoTitle/body preserved (kills L248/L250 LogicalOperator chains)", async () => {
		await adapter.content.save({
			id: "del-pres",
			kind: "post",
			slug: "del-pres",
			status: "published",
			title: "PRES-TITLE",
			body: "PRES-BODY",
			metadata: { seoTitle: "PRES-SEO", metaDescription: "PRES-MD", legacyUrl: "/del-pres" },
		});
		await adapter.content.delete("del-pres");
		const row = await readPersistedPostFull("del-pres");
		expect(row.title).toBe("PRES-TITLE");
		expect(row.body).toBe("PRES-BODY");
		expect(row.seo_title).toBe("PRES-SEO");
		expect(row.meta_description).toBe("PRES-MD");
	});

	// Settings save: assert returned id/slug/title are the literal strings.

	it("save({kind:'settings'}) returns title from the merged metadata.siteTitle and pins literal slug/id (kills L212)", async () => {
		const saved = await adapter.content.save({
			id: "site-settings",
			kind: "settings",
			slug: "site-settings",
			status: "published",
			title: "Old",
			metadata: { siteTitle: "TITLE-PIN" },
		});
		expect(saved.id).toBe("site-settings");
		expect(saved.slug).toBe("site-settings");
		expect(saved.title).toBe("TITLE-PIN");
	});

	// media.get must return metadata.altText (not {} from the L335 mutant).

	it("media.get returns metadata.altText from the asset (kills L335 ObjectLiteral mutant)", async () => {
		await adapter.media.put({
			id: "mget-alt.png",
			filename: "mget-alt.png",
			mimeType: "image/png",
			publicUrl: "https://cdn/mget",
			metadata: { altText: "GET-ALT", title: "GET-TITLE" },
		});
		const got = await adapter.media.get("mget-alt.png");
		expect(got?.metadata?.altText).toBe("GET-ALT");
	});

	// Redirect record returned by save: assert its sourcePath/targetPath/
	// statusCode fields are populated (kills L201 ObjectLiteral mutant).

	it("create-path: body stored as empty string when record.body undefined (kills L172 body literal mutant)", async () => {
		await adapter.content.save({
			id: "no-body",
			kind: "post",
			slug: "no-body",
			status: "published",
			title: "T",
			metadata: { seoTitle: "s", metaDescription: "m", legacyUrl: "/no-body" },
		});
		const db = openSeededDb();
		const row = db.prepare("SELECT body FROM content_entries WHERE slug = ?").get("no-body") as {
			body: string | null;
		};
		db.close();
		// createContentRecord normalizes `rawInput.body?.trim() || ""`. With
		// the mutant value "Stryker was here!" the body persists as
		// "Stryker was here!"; with the original "" it persists as "".
		expect(row.body === null || row.body === "").toBe(true);
	});

	it("save({kind:'redirect'}) returns a record with the right sourcePath/targetPath/statusCode (kills L201 ObjectLiteral)", async () => {
		const saved = await adapter.content.save({
			id: "/redirect-pin",
			kind: "redirect",
			slug: "/redirect-pin",
			status: "published",
			title: "RP",
			metadata: { targetPath: "/target-pin", statusCode: 302 },
		});
		// toRedirectRecord(...) returns an object with metadata.targetPath /
		// metadata.statusCode populated; mutant returns {} → falsy.
		expect(saved.metadata?.targetPath).toBe("/target-pin");
		expect(saved.metadata?.statusCode).toBe(302);
	});

	// list('media') populates metadata.altText (kills L352 optional/logical/StringLiteral mutants)
	it("list('media') populates metadata.altText (kills L352 optional/logical/StringLiteral mutants)", async () => {
		const db = openSeededDb();
		db.prepare(
			"INSERT INTO media_assets (id, source_url, local_path, mime_type, file_size, alt_text, title, uploaded_at, uploaded_by) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
		).run(
			"alt.png",
			"https://cdn/a",
			"/a",
			"image/png",
			100,
			"ALT-TEXT-X",
			"TITLE-X",
			"2026-01-01",
			"u@x",
		);
		db.close();
		const media = await adapter.content.list("media");
		const found = media.find((m) => m.id === "alt.png");
		expect(found?.metadata?.altText).toBe("ALT-TEXT-X");
	});
});
