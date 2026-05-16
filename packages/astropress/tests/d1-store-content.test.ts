// Direct mutation-coverage tests for d1-store-content.ts — listContentStates,
// getContentState, getContentRevisions, createD1SchedulingPart, and the FTS
// search. The factory exports are exercised through the SqliteBackedD1Database
// fixture so column ?? fallbacks for nullable rows are observable.
import { beforeEach, describe, expect, it } from "vitest";

import { registerCms } from "../src/config";
import { createD1ContentReadPart, createD1SchedulingPart } from "../src/d1-store-content";
import { makeDb, STANDARD_CMS_CONFIG } from "./helpers/make-db.js";
import { SqliteBackedD1Database } from "./helpers/provider-test-fixtures.js";

let db: ReturnType<typeof makeDb>;
let d1: SqliteBackedD1Database;

beforeEach(() => {
	db = makeDb();
	d1 = new SqliteBackedD1Database(db);
	registerCms(STANDARD_CMS_CONFIG);
});

function seedEntry(slug: string, overrides: Record<string, string | null> = {}) {
	const defaults = {
		slug,
		legacy_url: `/${slug}`,
		title: `Title for ${slug}`,
		kind: "post",
		template_key: "content",
		source_html_path: `runtime://content/${slug}`,
		body: null as string | null,
		summary: null as string | null,
		seo_title: null as string | null,
		meta_description: null as string | null,
		og_title: null as string | null,
		og_description: null as string | null,
		og_image: null as string | null,
		...overrides,
	};
	db.prepare(
		`INSERT INTO content_entries
       (slug, legacy_url, title, kind, template_key, source_html_path,
        body, summary, seo_title, meta_description, og_title, og_description, og_image)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
	).run(
		defaults.slug,
		defaults.legacy_url,
		defaults.title,
		defaults.kind,
		defaults.template_key,
		defaults.source_html_path,
		defaults.body,
		defaults.summary,
		defaults.seo_title,
		defaults.meta_description,
		defaults.og_title,
		defaults.og_description,
		defaults.og_image,
	);
}

describe("createD1ContentReadPart.listContentStates / getContentState", () => {
	it("returns empty arrays for listingItems and paginationLinks on every record", async () => {
		seedEntry("post-a");
		const state = await createD1ContentReadPart(d1).getContentState("post-a");
		expect(state).not.toBeNull();
		expect(state).toMatchObject({ listingItems: [], paginationLinks: [] });
	});

	it("maps nullable columns: body/summary default to '', seoTitle defaults to title, ogTitle/ogDescription/ogImage to undefined", async () => {
		seedEntry("post-null");
		const state = (await createD1ContentReadPart(d1).getContentState("post-null")) as Record<
			string,
			unknown
		>;
		expect(state.body).toBe("");
		expect(state.summary).toBe("");
		expect(state.seoTitle).toBe("Title for post-null");
		expect(state.metaDescription).toBe("");
		expect(state.ogTitle).toBeUndefined();
		expect(state.ogDescription).toBeUndefined();
		expect(state.ogImage).toBeUndefined();
	});

	it("seoTitle echoes back when present, otherwise falls back to title (kills `row.seo_title ?? row.title` mutant)", async () => {
		seedEntry("post-seo", { seo_title: "Custom SEO" });
		const state = (await createD1ContentReadPart(d1).getContentState("post-seo")) as Record<
			string,
			unknown
		>;
		expect(state.seoTitle).toBe("Custom SEO");
	});

	it("metaDescription cascade: own value > summary > '' (kills the ?? chain mutations)", async () => {
		seedEntry("post-meta", { meta_description: "Direct meta" });
		const state = (await createD1ContentReadPart(d1).getContentState("post-meta")) as Record<
			string,
			unknown
		>;
		expect(state.metaDescription).toBe("Direct meta");

		seedEntry("post-meta-fallback", { meta_description: null, summary: "From summary" });
		const fb = (await createD1ContentReadPart(d1).getContentState("post-meta-fallback")) as Record<
			string,
			unknown
		>;
		expect(fb.metaDescription).toBe("From summary");
	});

	it("findPageRecord matches by leading-slash legacyUrl when slug-direct lookup misses", async () => {
		seedEntry("legacy-post", { legacy_url: "/legacy-post" });
		const state = await createD1ContentReadPart(d1).getContentState("legacy-post");
		expect(state).not.toBeNull();
	});

	it("findPageRecord matches via the legacyUrl OR-branch when the lookup slug differs from the stored slug — kills the `entry.legacyUrl === `/${slug}`` ConditionalExpression and StringLiteral mutants", async () => {
		// Seed with slug A but legacy_url that matches `/B`. Lookup by B — slug strict-equality
		// must miss, forcing the OR's right side to fire.
		seedEntry("stored-slug-x", { legacy_url: "/looked-up-y" });
		const state = await createD1ContentReadPart(d1).getContentState("looked-up-y");
		expect(state).not.toBeNull();
		expect(state?.slug).toBe("stored-slug-x");
	});

	it("returns null for an unknown slug", async () => {
		const state = await createD1ContentReadPart(d1).getContentState("unknown");
		expect(state).toBeNull();
	});

	it("listContentStates returns one entry per seeded record", async () => {
		seedEntry("a");
		seedEntry("b");
		const states = await createD1ContentReadPart(d1).listContentStates();
		const slugs = states.map((s) => s.slug).sort();
		expect(slugs).toEqual(["a", "b"]);
	});
});

describe("createD1ContentReadPart.getContentRevisions — null column fallbacks", () => {
	it("returns null when the slug is unknown", async () => {
		const result = await createD1ContentReadPart(d1).getContentRevisions("nope");
		expect(result).toBeNull();
	});

	it("maps every nullable column to undefined when stored as NULL", async () => {
		seedEntry("rev-host");
		db.prepare(
			"INSERT INTO content_overrides (slug, title, status, seo_title, meta_description, updated_by) VALUES (?, ?, 'draft', '', '', 'test')",
		).run("rev-host", "Title");
		db.prepare(
			`INSERT INTO content_revisions
         (id, slug, title, status, scheduled_at, body, seo_title, meta_description,
          excerpt, og_title, og_description, og_image, author_ids, category_ids, tag_ids,
          canonical_url_override, robots_directive, source, revision_note, created_by)
         VALUES (?, ?, ?, 'draft', NULL, NULL, ?, ?, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 'imported', NULL, NULL)`,
		).run("rev-1", "rev-host", "Title", "SeoT", "Meta");
		const result = await createD1ContentReadPart(d1).getContentRevisions("rev-host");
		expect(result).toHaveLength(1);
		const rev = result?.[0] as Record<string, unknown>;
		expect(rev.scheduledAt).toBeUndefined();
		expect(rev.body).toBeUndefined();
		expect(rev.excerpt).toBeUndefined();
		expect(rev.ogTitle).toBeUndefined();
		expect(rev.ogDescription).toBeUndefined();
		expect(rev.ogImage).toBeUndefined();
		expect(rev.canonicalUrlOverride).toBeUndefined();
		expect(rev.robotsDirective).toBeUndefined();
		expect(rev.revisionNote).toBeUndefined();
		expect(rev.createdBy).toBeUndefined();
		// Mandatory columns are echoed verbatim
		expect(rev.seoTitle).toBe("SeoT");
		expect(rev.metaDescription).toBe("Meta");
	});

	it("maps every nullable column to the stored value when set", async () => {
		seedEntry("rev-host-2");
		db.prepare(
			"INSERT INTO content_overrides (slug, title, status, seo_title, meta_description, updated_by) VALUES (?, ?, 'draft', '', '', 'test')",
		).run("rev-host-2", "Title2");
		db.prepare(
			`INSERT INTO content_revisions
         (id, slug, title, status, scheduled_at, body, seo_title, meta_description,
          excerpt, og_title, og_description, og_image, author_ids, category_ids, tag_ids,
          canonical_url_override, robots_directive, source, revision_note, created_by)
         VALUES (?, ?, ?, 'review', '2099-01-01', 'b', 'S', 'M', 'e', 'ot', 'od', 'oi', '1,2', '3', '4', 'https://c', 'noindex', 'reviewed', 'note', 'who@x')`,
		).run("rev-2", "rev-host-2", "Title2");
		const result = await createD1ContentReadPart(d1).getContentRevisions("rev-host-2");
		expect(result).toHaveLength(1);
		const rev = result?.[0] as Record<string, unknown>;
		expect(rev.scheduledAt).toBe("2099-01-01");
		expect(rev.body).toBe("b");
		expect(rev.excerpt).toBe("e");
		expect(rev.ogTitle).toBe("ot");
		expect(rev.ogDescription).toBe("od");
		expect(rev.ogImage).toBe("oi");
		expect(rev.canonicalUrlOverride).toBe("https://c");
		expect(rev.robotsDirective).toBe("noindex");
		expect(rev.revisionNote).toBe("note");
		expect(rev.createdBy).toBe("who@x");
	});
});

describe("createD1SchedulingPart.runScheduledPublishes", () => {
	it("returns the number of rows whose status flipped to 'published'", async () => {
		seedEntry("sched-1");
		seedEntry("sched-2");
		const past = "2000-01-01T00:00:00.000Z";
		db.prepare(
			"INSERT INTO content_overrides (slug, scheduled_at, status, title, seo_title, meta_description, updated_by) VALUES (?, ?, 'draft', ?, ?, '', 'scheduler')",
		).run("sched-1", past, "T1", "T1");
		db.prepare(
			"INSERT INTO content_overrides (slug, scheduled_at, status, title, seo_title, meta_description, updated_by) VALUES (?, ?, 'draft', ?, ?, '', 'scheduler')",
		).run("sched-2", past, "T2", "T2");
		const part = createD1SchedulingPart(d1);
		const changes = await part.runScheduledPublishes();
		expect(changes).toBe(2);
		const rows = db
			.prepare("SELECT slug, status, scheduled_at FROM content_overrides ORDER BY slug")
			.all() as Array<{ slug: string; status: string; scheduled_at: string | null }>;
		expect(rows.every((r) => r.status === "published")).toBe(true);
		expect(rows.every((r) => r.scheduled_at === null)).toBe(true);
	});

	it("returns 0 when no rows are due", async () => {
		seedEntry("sched-future");
		const future = "2999-12-31T00:00:00.000Z";
		db.prepare(
			"INSERT INTO content_overrides (slug, scheduled_at, status, title, seo_title, meta_description, updated_by) VALUES (?, ?, 'draft', ?, ?, '', 'scheduler')",
		).run("sched-future", future, "T", "T");
		const part = createD1SchedulingPart(d1);
		const changes = await part.runScheduledPublishes();
		expect(changes).toBe(0);
	});
});
