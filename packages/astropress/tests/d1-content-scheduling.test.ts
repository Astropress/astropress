import type { DatabaseSync } from "node:sqlite";

import { beforeEach, describe, expect, it } from "vitest";

import { createD1SchedulingPart } from "../src/d1-store-content.js";
import { makeDb } from "./helpers/make-db.js";
import { SqliteBackedD1Database } from "./helpers/provider-test-fixtures.js";

function seedEntry(db: DatabaseSync, slug: string) {
	db.prepare(
		`INSERT INTO content_entries (slug, legacy_url, title, kind, template_key, source_html_path, updated_at)
     VALUES (?, ?, ?, 'post', 'content', 'runtime://content/' || ?, CURRENT_TIMESTAMP)`,
	).run(slug, `/${slug}`, `Title for ${slug}`, slug);
}

function makeScheduling(db: DatabaseSync) {
	return createD1SchedulingPart(new SqliteBackedD1Database(db));
}

describe("D1 scheduling — schedulePublish", () => {
	let db: DatabaseSync;

	beforeEach(() => {
		db = makeDb();
		seedEntry(db, "my-post");
	});

	it("creates an override with scheduled_at when none exists", async () => {
		const scheduling = makeScheduling(db);
		const future = new Date(Date.now() + 60_000).toISOString();
		await scheduling.schedulePublish("my-post", future);

		const row = db
			.prepare(
				"SELECT slug, status, scheduled_at FROM content_overrides WHERE slug = ?",
			)
			.get("my-post") as {
			slug: string;
			status: string;
			scheduled_at: string;
		};
		expect(row).toBeDefined();
		expect(row.slug).toBe("my-post");
		expect(row.status).toBe("draft");
		expect(row.scheduled_at).toBe(future);
	});

	it("updates existing override's scheduled_at", async () => {
		const scheduling = makeScheduling(db);
		db.prepare(
			`INSERT INTO content_overrides (slug, title, status, seo_title, meta_description, updated_at, updated_by)
       VALUES ('my-post', 'Title for my-post', 'draft', 'Title for my-post', '', CURRENT_TIMESTAMP, 'test@test.com')`,
		).run();

		const future = new Date(Date.now() + 120_000).toISOString();
		await scheduling.schedulePublish("my-post", future);

		const row = db
			.prepare("SELECT scheduled_at FROM content_overrides WHERE slug = ?")
			.get("my-post") as {
			scheduled_at: string;
		};
		expect(row.scheduled_at).toBe(future);
	});
});

describe("D1 scheduling — listScheduled", () => {
	let db: DatabaseSync;

	beforeEach(() => {
		db = makeDb();
		seedEntry(db, "future-post");
		seedEntry(db, "past-post");
	});

	it("returns only future-scheduled entries", async () => {
		const scheduling = makeScheduling(db);
		const future = new Date(Date.now() + 60_000).toISOString();
		const past = new Date(Date.now() - 60_000).toISOString();

		db.prepare(
			`INSERT INTO content_overrides (slug, title, status, scheduled_at, seo_title, meta_description, updated_at, updated_by)
       VALUES ('future-post', 'Future Post', 'draft', ?, 'Future Post', '', CURRENT_TIMESTAMP, 'scheduler')`,
		).run(future);
		db.prepare(
			`INSERT INTO content_overrides (slug, title, status, scheduled_at, seo_title, meta_description, updated_at, updated_by)
       VALUES ('past-post', 'Past Post', 'draft', ?, 'Past Post', '', CURRENT_TIMESTAMP, 'scheduler')`,
		).run(past);

		const list = await scheduling.listScheduled();
		expect(list).toHaveLength(1);
		expect(list[0].slug).toBe("future-post");
		expect(list[0].scheduledAt).toBe(future);
	});

	it("returns empty array when no scheduled entries", async () => {
		const list = await makeScheduling(db).listScheduled();
		expect(list).toEqual([]);
	});
});

describe("D1 scheduling — cancelScheduledPublish", () => {
	it("clears scheduled_at without changing status", async () => {
		const db = makeDb();
		seedEntry(db, "cancel-post");
		const future = new Date(Date.now() + 60_000).toISOString();
		db.prepare(
			`INSERT INTO content_overrides (slug, title, status, scheduled_at, seo_title, meta_description, updated_at, updated_by)
       VALUES ('cancel-post', 'Cancel Post', 'draft', ?, 'Cancel Post', '', CURRENT_TIMESTAMP, 'scheduler')`,
		).run(future);

		await makeScheduling(db).cancelScheduledPublish("cancel-post");

		const row = db
			.prepare(
				"SELECT status, scheduled_at FROM content_overrides WHERE slug = ?",
			)
			.get("cancel-post") as {
			status: string;
			scheduled_at: string | null;
		};
		expect(row.status).toBe("draft");
		expect(row.scheduled_at).toBeNull();
	});
});

describe("D1 scheduling — runScheduledPublishes", () => {
	it("publishes past-due entries and returns count", async () => {
		const db = makeDb();
		seedEntry(db, "due-post");
		seedEntry(db, "not-due-post");
		const past = new Date(Date.now() - 60_000).toISOString();
		const future = new Date(Date.now() + 60_000).toISOString();

		db.prepare(
			`INSERT INTO content_overrides (slug, title, status, scheduled_at, seo_title, meta_description, updated_at, updated_by)
       VALUES ('due-post', 'Due Post', 'draft', ?, 'Due Post', '', CURRENT_TIMESTAMP, 'scheduler')`,
		).run(past);
		db.prepare(
			`INSERT INTO content_overrides (slug, title, status, scheduled_at, seo_title, meta_description, updated_at, updated_by)
       VALUES ('not-due-post', 'Not Due Post', 'draft', ?, 'Not Due Post', '', CURRENT_TIMESTAMP, 'scheduler')`,
		).run(future);

		const count = await makeScheduling(db).runScheduledPublishes();
		expect(count).toBe(1);

		const due = db
			.prepare(
				"SELECT status, scheduled_at FROM content_overrides WHERE slug = ?",
			)
			.get("due-post") as {
			status: string;
			scheduled_at: string | null;
		};
		expect(due.status).toBe("published");
		expect(due.scheduled_at).toBeNull();

		const notDue = db
			.prepare(
				"SELECT status, scheduled_at FROM content_overrides WHERE slug = ?",
			)
			.get("not-due-post") as {
			status: string;
			scheduled_at: string;
		};
		expect(notDue.status).toBe("draft");
		expect(notDue.scheduled_at).toBe(future);
	});

	it("returns 0 when no entries are due", async () => {
		const db = makeDb();
		const count = await makeScheduling(db).runScheduledPublishes();
		expect(count).toBe(0);
	});
});
