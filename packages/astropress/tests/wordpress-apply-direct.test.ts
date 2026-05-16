// Direct unit + integration tests for src/import/wordpress-apply.ts. Earlier
// branches-style tests drove the WXR parser → applyImportToLocalRuntime path
// end-to-end but only inspected top-level counts. This file exercises every
// internal branch by hand-building a ParsedBundle and asserting on the
// resulting sqlite DB rows.
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { DatabaseSync } from "node:sqlite";

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import {
	applyImportToLocalRuntime,
	fileSizeOrNull,
	resolveLocalAdminDbPath,
} from "../src/import/wordpress-apply.js";
import type { ParsedBundle } from "../src/import/wordpress-xml.js";

const EMPTY_ENTITY_COUNTS = {
	posts: 0,
	pages: 0,
	attachments: 0,
	redirects: 0,
	comments: 0,
	users: 0,
	categories: 0,
	tags: 0,
	skipped: 0,
};

function emptyBundle(overrides: Partial<ParsedBundle> = {}): ParsedBundle {
	return {
		authors: [],
		terms: [],
		contentRecords: [],
		mediaAssets: [],
		comments: [],
		redirects: [],
		entityCounts: EMPTY_ENTITY_COUNTS,
		remediationCandidates: [],
		unsupportedPatterns: [],
		warnings: [],
		...overrides,
	};
}

function defaultPlan(
	overrides: Partial<Parameters<typeof applyImportToLocalRuntime>[0]["plan"]> = {},
) {
	return {
		includeComments: true,
		includeUsers: true,
		includeMedia: true,
		downloadMedia: false,
		applyLocal: true,
		permalinkStrategy: "preserve-wordpress-links" as const,
		resumeSupported: true,
		entityCounts: EMPTY_ENTITY_COUNTS,
		reviewRequired: false,
		manualTasks: [],
		...overrides,
	};
}

let workspace: string;
let adminDbPath: string;

beforeEach(async () => {
	workspace = await mkdtemp(join(tmpdir(), "astropress-wp-apply-direct-"));
	adminDbPath = join(workspace, ".data", "admin.sqlite");
});

afterEach(async () => {
	await rm(workspace, { recursive: true, force: true });
});

describe("resolveLocalAdminDbPath", () => {
	it("returns the adminDbPath unchanged when it is absolute (kills isAbsolute true-branch)", () => {
		const abs = "/var/data/admin.sqlite";
		expect(resolveLocalAdminDbPath("/home/site", abs)).toBe(abs);
	});

	it("joins workspaceRoot + adminDbPath when the path is relative (kills isAbsolute false-branch)", () => {
		const result = resolveLocalAdminDbPath("/home/site", "rel/admin.sqlite");
		expect(result).toBe("/home/site/rel/admin.sqlite");
	});

	it("falls back to the seed toolkit default when adminDbPath is omitted (kills the if (adminDbPath) ConditionalExpression and BlockStatement)", () => {
		const result = resolveLocalAdminDbPath("/home/site");
		// Default lands under workspaceRoot/.data/...
		expect(result.startsWith("/home/site/")).toBe(true);
		expect(result).not.toBe("/home/site");
	});

	it("falls back to default when adminDbPath is an empty string (covers the !adminDbPath truthiness flip)", () => {
		const result = resolveLocalAdminDbPath("/home/site", "");
		expect(result.startsWith("/home/site/")).toBe(true);
	});
});

describe("fileSizeOrNull", () => {
	it("returns the file size in bytes for an existing file", async () => {
		const target = join(workspace, "size.txt");
		await writeFile(target, "hello", "utf8");
		expect(await fileSizeOrNull(target)).toBe(5);
	});

	it("returns null when the path does not exist (kills the try/catch BlockStatement and the return-null mutant)", async () => {
		expect(await fileSizeOrNull(join(workspace, "missing.bin"))).toBeNull();
	});
});

describe("applyImportToLocalRuntime — terms, content, media, comments, redirects", () => {
	it("imports both category AND tag terms — kills the term.kind === 'category' EqualityOperator", async () => {
		const bundle = emptyBundle({
			terms: [
				{ kind: "category", slug: "news", name: "News" },
				{ kind: "tag", slug: "featured", name: "Featured" },
			],
		});
		await applyImportToLocalRuntime({
			bundle,
			workspaceRoot: workspace,
			adminDbPath,
			plan: defaultPlan(),
		});
		const db = new DatabaseSync(adminDbPath);
		const cats = db
			.prepare("SELECT slug, name FROM categories WHERE deleted_at IS NULL ORDER BY slug")
			.all() as Array<{ slug: string; name: string }>;
		const tags = db
			.prepare("SELECT slug, name FROM tags WHERE deleted_at IS NULL ORDER BY slug")
			.all() as Array<{ slug: string; name: string }>;
		expect(cats).toEqual([{ slug: "news", name: "News" }]);
		expect(tags).toEqual([{ slug: "featured", name: "Featured" }]);
		db.close();
	});

	it("maps record.status 'archived' to archived, 'draft' to draft, and any other value to published — kills the contentStatus ternary EqualityOperator/Conditional mutants", async () => {
		const bundle = emptyBundle({
			contentRecords: [
				{
					id: "1",
					legacyId: "1",
					kind: "post",
					slug: "arch",
					title: "Archived",
					body: "<p>a</p>",
					status: "archived",
					legacyUrl: "/arch/",
					authorLogins: [],
					categorySlugs: [],
					tagSlugs: [],
					oldSlugs: [],
				},
				{
					id: "2",
					legacyId: "2",
					kind: "post",
					slug: "draft",
					title: "Draft",
					body: "<p>d</p>",
					status: "draft",
					legacyUrl: "/draft/",
					authorLogins: [],
					categorySlugs: [],
					tagSlugs: [],
					oldSlugs: [],
				},
				{
					id: "3",
					legacyId: "3",
					kind: "post",
					slug: "pub",
					title: "Pub",
					body: "<p>p</p>",
					status: "published",
					legacyUrl: "/pub/",
					authorLogins: [],
					categorySlugs: [],
					tagSlugs: [],
					oldSlugs: [],
				},
			],
		});
		await applyImportToLocalRuntime({
			bundle,
			workspaceRoot: workspace,
			adminDbPath,
			plan: defaultPlan(),
		});
		const db = new DatabaseSync(adminDbPath);
		const rows = db
			.prepare("SELECT slug, status FROM content_overrides ORDER BY slug")
			.all() as Array<{ slug: string; status: string }>;
		const byslug = Object.fromEntries(rows.map((r) => [r.slug, r.status]));
		expect(byslug.arch).toBe("archived");
		expect(byslug.draft).toBe("draft");
		expect(byslug.pub).toBe("published");
		db.close();
	});

	it("resolves authorIds/categoryIds/tagIds from the lookup maps; missing slugs are filtered out — kills the .filter typeof v === 'number' EqualityOperator and the .map ArrowFunction mutants", async () => {
		const bundle = emptyBundle({
			authors: [{ id: "1", login: "alice", displayName: "Alice" }],
			terms: [
				{ kind: "category", slug: "news", name: "News" },
				{ kind: "tag", slug: "featured", name: "Featured" },
			],
			contentRecords: [
				{
					id: "10",
					legacyId: "10",
					kind: "post",
					slug: "with-refs",
					title: "Refs",
					body: "<p>r</p>",
					status: "published",
					legacyUrl: "/with-refs/",
					authorLogins: ["alice", "ghost"],
					categorySlugs: ["news", "missing-cat"],
					tagSlugs: ["featured", "missing-tag"],
					oldSlugs: [],
				},
			],
		});
		await applyImportToLocalRuntime({
			bundle,
			workspaceRoot: workspace,
			adminDbPath,
			plan: defaultPlan(),
		});
		const db = new DatabaseSync(adminDbPath);
		// Joined rows should include exactly the resolvable ids.
		const authors = db
			.prepare(
				"SELECT a.slug FROM content_authors ca JOIN authors a ON a.id = ca.author_id WHERE ca.slug = ?",
			)
			.all("with-refs") as Array<{ slug: string }>;
		const cats = db
			.prepare(
				"SELECT c.slug FROM content_categories cc JOIN categories c ON c.id = cc.category_id WHERE cc.slug = ?",
			)
			.all("with-refs") as Array<{ slug: string }>;
		const tags = db
			.prepare(
				"SELECT t.slug FROM content_tags ct JOIN tags t ON t.id = ct.tag_id WHERE ct.slug = ?",
			)
			.all("with-refs") as Array<{ slug: string }>;
		expect(authors.map((r) => r.slug)).toEqual(["alice"]);
		expect(cats.map((r) => r.slug)).toEqual(["news"]);
		expect(tags.map((r) => r.slug)).toEqual(["featured"]);
		db.close();
	});

	it("on second import takes the `if (existing)` branch and updates the legacy_url + summary + kind — kills the existing/created path divergence mutants", async () => {
		const initial = emptyBundle({
			contentRecords: [
				{
					id: "20",
					legacyId: "20",
					kind: "post",
					slug: "iterate",
					title: "First",
					body: "<p>v1</p>",
					excerpt: "first-summary",
					status: "published",
					legacyUrl: "/iterate-old/",
					authorLogins: [],
					categorySlugs: [],
					tagSlugs: [],
					oldSlugs: [],
				},
			],
		});
		await applyImportToLocalRuntime({
			bundle: initial,
			workspaceRoot: workspace,
			adminDbPath,
			plan: defaultPlan(),
		});

		const second = emptyBundle({
			contentRecords: [
				{
					...initial.contentRecords[0],
					kind: "page",
					legacyUrl: "/iterate-new/",
					excerpt: "second-summary",
					title: "Second",
				},
			],
		});
		await applyImportToLocalRuntime({
			bundle: second,
			workspaceRoot: workspace,
			adminDbPath,
			plan: defaultPlan(),
		});

		const db = new DatabaseSync(adminDbPath);
		const row = db
			.prepare("SELECT legacy_url, summary, kind FROM content_entries WHERE slug = ?")
			.get("iterate") as { legacy_url: string; summary: string; kind: string };
		expect(row).toMatchObject({
			legacy_url: "/iterate-new/",
			summary: "second-summary",
			kind: "page",
		});
		db.close();
	});

	it("for a fresh record with no excerpt, the SQL_UPDATE_ENTRY_LEGACY_FULL summary lands as '' (kills record.excerpt ?? '' nullish-coalesce flip)", async () => {
		const bundle = emptyBundle({
			contentRecords: [
				{
					id: "21",
					legacyId: "21",
					kind: "post",
					slug: "no-excerpt",
					title: "No Excerpt",
					body: "<p>b</p>",
					// excerpt omitted
					status: "published",
					legacyUrl: "/no-excerpt/",
					authorLogins: [],
					categorySlugs: [],
					tagSlugs: [],
					oldSlugs: [],
				},
			],
		});
		await applyImportToLocalRuntime({
			bundle,
			workspaceRoot: workspace,
			adminDbPath,
			plan: defaultPlan(),
		});
		const db = new DatabaseSync(adminDbPath);
		const row = db
			.prepare("SELECT summary FROM content_entries WHERE slug = ?")
			.get("no-excerpt") as { summary: string };
		expect(row.summary).toBe("");
		db.close();
	});

	it("media import with downloaded file present: local_path points at downloads/<file> and file_size > 0 (kills 'downloads' StringLiteral and hasDownloadedFile branch)", async () => {
		const artifactDir = join(workspace, "artifacts");
		const downloadsDir = join(artifactDir, "downloads");
		await mkdir(downloadsDir, { recursive: true });
		await writeFile(join(downloadsDir, "hero.png"), "PNGBYTES");
		const bundle = emptyBundle({
			mediaAssets: [
				{
					id: "m1",
					legacyId: "m1",
					slug: "hero-image",
					title: "Hero Image",
					sourceUrl: "https://example.org/hero.png",
					legacyUrl: "/hero.png",
					filename: "hero.png",
					mimeType: "image/png",
				},
			],
		});
		await applyImportToLocalRuntime({
			bundle,
			workspaceRoot: workspace,
			artifactDir,
			adminDbPath,
			plan: defaultPlan(),
		});
		const db = new DatabaseSync(adminDbPath);
		const row = db
			.prepare(
				"SELECT id, local_path, file_size, alt_text, uploaded_by FROM media_assets WHERE id = ?",
			)
			.get("m1") as {
			id: string;
			local_path: string;
			file_size: number;
			alt_text: string;
			uploaded_by: string;
		};
		expect(row.local_path).toBe(join(downloadsDir, "hero.png"));
		expect(row.file_size).toBe(8);
		// alt_text is hardcoded to "" — kills the StringLiteral mutant at line 183
		expect(row.alt_text).toBe("");
		expect(row.uploaded_by).toBe("wordpress-import@astropress.local");
		db.close();
	});

	it("media import without artifactDir: local_path falls back to legacyUrl, file_size is null (kills artifactDir-undefined ternary)", async () => {
		const bundle = emptyBundle({
			mediaAssets: [
				{
					id: "m2",
					legacyId: "m2",
					slug: "doc",
					title: "Doc",
					sourceUrl: "https://example.org/doc.pdf",
					legacyUrl: "/doc.pdf",
					filename: "doc.pdf",
					mimeType: "application/pdf",
				},
			],
		});
		await applyImportToLocalRuntime({
			bundle,
			workspaceRoot: workspace,
			adminDbPath,
			plan: defaultPlan(),
		});
		const db = new DatabaseSync(adminDbPath);
		const row = db
			.prepare("SELECT local_path, file_size FROM media_assets WHERE id = ?")
			.get("m2") as { local_path: string; file_size: number | null };
		expect(row.local_path).toBe("/doc.pdf");
		expect(row.file_size).toBeNull();
		db.close();
	});

	it("media import with artifactDir but missing downloaded file: local_path falls back to legacyUrl (kills the !== null EqualityOperator)", async () => {
		const artifactDir = join(workspace, "artifacts-empty");
		await mkdir(artifactDir, { recursive: true });
		const bundle = emptyBundle({
			mediaAssets: [
				{
					id: "m3",
					legacyId: "m3",
					slug: "missing",
					title: "Missing",
					sourceUrl: "https://example.org/missing.png",
					legacyUrl: "/missing.png",
					filename: "missing.png",
					mimeType: "image/png",
				},
			],
		});
		await applyImportToLocalRuntime({
			bundle,
			workspaceRoot: workspace,
			artifactDir,
			adminDbPath,
			plan: defaultPlan(),
		});
		const db = new DatabaseSync(adminDbPath);
		const row = db
			.prepare("SELECT local_path, file_size FROM media_assets WHERE id = ?")
			.get("m3") as { local_path: string; file_size: number | null };
		expect(row.local_path).toBe("/missing.png");
		expect(row.file_size).toBeNull();
		db.close();
	});

	it("respects plan.includeUsers === false (kills the includeUsers ConditionalExpression in applyImportToLocalRuntime)", async () => {
		const bundle = emptyBundle({
			authors: [{ id: "a1", login: "skipme", displayName: "Skip" }],
		});
		const out = await applyImportToLocalRuntime({
			bundle,
			workspaceRoot: workspace,
			adminDbPath,
			plan: defaultPlan({ includeUsers: false }),
		});
		expect(out.appliedUsers).toBe(0);
		const db = new DatabaseSync(adminDbPath);
		const rows = db.prepare("SELECT count(*) AS c FROM authors WHERE slug = ?").get("skipme") as {
			c: number;
		};
		expect(rows.c).toBe(0);
		db.close();
	});

	it("respects plan.includeComments === false (kills the includeComments ConditionalExpression)", async () => {
		const bundle = emptyBundle({
			contentRecords: [
				{
					id: "30",
					legacyId: "30",
					kind: "post",
					slug: "host",
					title: "Host",
					body: "<p>h</p>",
					status: "published",
					legacyUrl: "/host/",
					authorLogins: [],
					categorySlugs: [],
					tagSlugs: [],
					oldSlugs: [],
				},
			],
			comments: [
				{
					id: "c1",
					legacyId: "c1",
					recordId: "30",
					authorName: "Alice",
					body: "Skip me",
					status: "approved",
				},
			],
		});
		await applyImportToLocalRuntime({
			bundle,
			workspaceRoot: workspace,
			adminDbPath,
			plan: defaultPlan({ includeComments: false }),
		});
		const db = new DatabaseSync(adminDbPath);
		const row = db.prepare("SELECT count(*) AS c FROM comments").get() as { c: number };
		expect(row.c).toBe(0);
		db.close();
	});

	it("respects plan.includeMedia === false (kills the includeMedia ConditionalExpression — importMediaAssets is not invoked)", async () => {
		const artifactDir = join(workspace, "art2");
		const downloadsDir = join(artifactDir, "downloads");
		await mkdir(downloadsDir, { recursive: true });
		await writeFile(join(downloadsDir, "img.png"), "DATA");
		const bundle = emptyBundle({
			mediaAssets: [
				{
					id: "m9",
					legacyId: "m9",
					slug: "img",
					title: "Img",
					sourceUrl: "https://example.org/img.png",
					legacyUrl: "/img.png",
					filename: "img.png",
					mimeType: "image/png",
				},
			],
		});
		await applyImportToLocalRuntime({
			bundle,
			workspaceRoot: workspace,
			artifactDir,
			adminDbPath,
			plan: defaultPlan({ includeMedia: false }),
		});
		const db = new DatabaseSync(adminDbPath);
		const row = db.prepare("SELECT count(*) AS c FROM media_assets").get() as { c: number };
		expect(row.c).toBe(0);
		db.close();
	});

	it("comment.route falls back to '/' when contentRouteByImportId has no matching key (kills the comment.recordId ?? '/' LogicalOperator)", async () => {
		const bundle = emptyBundle({
			// no contentRecords → contentRouteByImportId is empty
			comments: [
				{
					id: "c2",
					legacyId: "c2",
					recordId: "orphan",
					authorName: "Bob",
					body: "Orphan comment",
					status: "approved",
				},
			],
		});
		await applyImportToLocalRuntime({
			bundle,
			workspaceRoot: workspace,
			adminDbPath,
			plan: defaultPlan(),
		});
		const db = new DatabaseSync(adminDbPath);
		const row = db.prepare("SELECT route FROM comments WHERE id = ?").get("c2") as {
			route: string;
		};
		expect(row.route).toBe("/");
		db.close();
	});

	it("comment.route is the imported record's legacyUrl when the comment.recordId matches a contentRecord (kills the OR-left-side reference vs the `/` fallback)", async () => {
		const bundle = emptyBundle({
			contentRecords: [
				{
					id: "40",
					legacyId: "40-legacy",
					kind: "post",
					slug: "post-w-comment",
					title: "PWC",
					body: "<p>p</p>",
					status: "published",
					legacyUrl: "/post-w-comment/",
					authorLogins: [],
					categorySlugs: [],
					tagSlugs: [],
					oldSlugs: [],
				},
			],
			comments: [
				{
					id: "c3",
					legacyId: "c3",
					recordId: "40-legacy",
					authorName: "Carol",
					body: "Hi",
					status: "approved",
				},
			],
		});
		await applyImportToLocalRuntime({
			bundle,
			workspaceRoot: workspace,
			adminDbPath,
			plan: defaultPlan(),
		});
		const db = new DatabaseSync(adminDbPath);
		const row = db.prepare("SELECT route FROM comments WHERE id = ?").get("c3") as {
			route: string;
		};
		expect(row.route).toBe("/post-w-comment/");
		db.close();
	});

	it("comment.createdAt falls back to a fresh ISO timestamp when not provided (kills the comment.createdAt ?? new Date().toISOString() mutant)", async () => {
		const bundle = emptyBundle({
			comments: [
				{
					id: "c4",
					legacyId: "c4",
					recordId: "x",
					authorName: "Dan",
					body: "Hi",
					status: "approved",
					// createdAt omitted
				},
			],
		});
		const before = Date.now();
		await applyImportToLocalRuntime({
			bundle,
			workspaceRoot: workspace,
			adminDbPath,
			plan: defaultPlan(),
		});
		const db = new DatabaseSync(adminDbPath);
		const row = db.prepare("SELECT submitted_at FROM comments WHERE id = ?").get("c4") as {
			submitted_at: string;
		};
		const submitted = Date.parse(row.submitted_at);
		expect(submitted).toBeGreaterThanOrEqual(before - 1000);
		db.close();
	});

	it("contentStatus 'published' lands as 'published' on a fresh single-record bundle — isolates the third ternary literal at line 85:86", async () => {
		const bundle = emptyBundle({
			contentRecords: [
				{
					id: "p-iso",
					legacyId: "p-iso",
					kind: "post",
					slug: "p-iso",
					title: "Pub Iso",
					body: "<p>p</p>",
					status: "published",
					legacyUrl: "/p-iso/",
					authorLogins: [],
					categorySlugs: [],
					tagSlugs: [],
					oldSlugs: [],
				},
			],
		});
		await applyImportToLocalRuntime({
			bundle,
			workspaceRoot: workspace,
			adminDbPath,
			plan: defaultPlan(),
		});
		const db = new DatabaseSync(adminDbPath);
		const row = db.prepare("SELECT status FROM content_overrides WHERE slug = ?").get("p-iso") as {
			status: string;
		};
		// Original code maps any non-archived non-draft to "published"; if the
		// literal is mutated to "" the CHECK constraint rejects the override.
		expect(row.status).toBe("published");
		db.close();
	});

	it("revisionNote of content_revisions persists `WordPress import <legacyId>` — kills the line 105 template-literal StringLiteral mutant", async () => {
		const bundle = emptyBundle({
			contentRecords: [
				{
					id: "rv1",
					legacyId: "legacy-99",
					kind: "post",
					slug: "rv-slug",
					title: "Rev",
					body: "<p>r</p>",
					status: "published",
					legacyUrl: "/rv-slug/",
					authorLogins: [],
					categorySlugs: [],
					tagSlugs: [],
					oldSlugs: [],
				},
			],
		});
		await applyImportToLocalRuntime({
			bundle,
			workspaceRoot: workspace,
			adminDbPath,
			plan: defaultPlan(),
		});
		const db = new DatabaseSync(adminDbPath);
		// Two revisions can land in the same slug — the create-content path (note "Created new
		// post.") and the wordpress-apply path (note "WordPress import legacy-99"). ORDER BY id DESC
		// is non-deterministic because ids are random UUIDs, so filter for the WP import note
		// directly to make the assertion deterministic.
		const wpRev = db
			.prepare(
				"SELECT revision_note FROM content_revisions WHERE slug = ? AND revision_note LIKE 'WordPress import%' LIMIT 1",
			)
			.get("rv-slug") as { revision_note: string } | undefined;
		expect(wpRev?.revision_note).toBe("WordPress import legacy-99");
		db.close();
	});

	it("on second import with no excerpt, SQL_UPDATE_ENTRY_LEGACY (existing branch) sets summary to '' — kills the line 117 `?? ''` StringLiteral mutant", async () => {
		const first = emptyBundle({
			contentRecords: [
				{
					id: "u1",
					legacyId: "u1",
					kind: "post",
					slug: "update-summary",
					title: "First",
					body: "<p>v1</p>",
					excerpt: "first-summary",
					status: "published",
					legacyUrl: "/update-summary/",
					authorLogins: [],
					categorySlugs: [],
					tagSlugs: [],
					oldSlugs: [],
				},
			],
		});
		await applyImportToLocalRuntime({
			bundle: first,
			workspaceRoot: workspace,
			adminDbPath,
			plan: defaultPlan(),
		});

		const second = emptyBundle({
			contentRecords: [
				{
					...first.contentRecords[0],
					excerpt: undefined,
					title: "Second",
				},
			],
		});
		await applyImportToLocalRuntime({
			bundle: second,
			workspaceRoot: workspace,
			adminDbPath,
			plan: defaultPlan(),
		});

		const db = new DatabaseSync(adminDbPath);
		const row = db
			.prepare("SELECT summary FROM content_entries WHERE slug = ?")
			.get("update-summary") as { summary: string };
		expect(row.summary).toBe("");
		db.close();
	});

	it("does NOT insert extra content_authors/content_categories/content_tags rows for unresolved logins/slugs — kills the .filter typeof===number ConditionalExpression and the .map MethodExpression", async () => {
		// Same shape as the earlier resolution test, but with stronger COUNT assertions:
		// if the filter is removed, the upstream .map produces [number, undefined] arrays
		// which would yield extra junk rows (null author_id / null category_id / null tag_id).
		const bundle = emptyBundle({
			authors: [{ id: "1", login: "alice", displayName: "Alice" }],
			terms: [
				{ kind: "category", slug: "news", name: "News" },
				{ kind: "tag", slug: "featured", name: "Featured" },
			],
			contentRecords: [
				{
					id: "ref-strict",
					legacyId: "ref-strict",
					kind: "post",
					slug: "ref-strict",
					title: "Ref Strict",
					body: "<p>r</p>",
					status: "published",
					legacyUrl: "/ref-strict/",
					authorLogins: ["alice", "ghost1", "ghost2"],
					categorySlugs: ["news", "ghost-cat-1", "ghost-cat-2"],
					tagSlugs: ["featured", "ghost-tag-1", "ghost-tag-2"],
					oldSlugs: [],
				},
			],
		});
		await applyImportToLocalRuntime({
			bundle,
			workspaceRoot: workspace,
			adminDbPath,
			plan: defaultPlan(),
		});
		const db = new DatabaseSync(adminDbPath);
		const ac = db
			.prepare("SELECT COUNT(*) AS c FROM content_authors WHERE slug = ?")
			.get("ref-strict") as { c: number };
		const cc = db
			.prepare("SELECT COUNT(*) AS c FROM content_categories WHERE slug = ?")
			.get("ref-strict") as { c: number };
		const tc = db
			.prepare("SELECT COUNT(*) AS c FROM content_tags WHERE slug = ?")
			.get("ref-strict") as { c: number };
		// Exactly one each — no rows for ghost lookups (filter strips undefined).
		expect(ac.c).toBe(1);
		expect(cc.c).toBe(1);
		expect(tc.c).toBe(1);
		db.close();
	});

	it("imports redirects with status 301 and a non-empty source_path (kills the redirect upsert string and 301 numeric-literal mutants)", async () => {
		const bundle = emptyBundle({
			redirects: [
				{
					id: "r1",
					sourcePath: "/old-path/",
					targetPath: "/new-path/",
					reason: "imported",
					recordId: "any",
				},
			],
		});
		const result = await applyImportToLocalRuntime({
			bundle,
			workspaceRoot: workspace,
			adminDbPath,
			plan: defaultPlan(),
		});
		expect(result.appliedRedirects).toBe(1);
		const db = new DatabaseSync(adminDbPath);
		const row = db
			.prepare(
				"SELECT source_path, target_path, status_code FROM redirect_rules WHERE source_path = ?",
			)
			.get("/old-path/") as { source_path: string; target_path: string; status_code: number };
		expect(row).toEqual({
			source_path: "/old-path/",
			target_path: "/new-path/",
			status_code: 301,
		});
		db.close();
	});
});
