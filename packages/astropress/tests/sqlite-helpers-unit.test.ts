import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

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
	let adapter: ReturnType<typeof createAstropressSqliteAdapter>;

	beforeEach(async () => {
		workspace = await mkdtemp(join(tmpdir(), "sqlite-helpers-"));
		adapter = createAstropressSqliteAdapter({
			workspaceRoot: workspace,
			dbPath: join(workspace, "admin.sqlite"),
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
