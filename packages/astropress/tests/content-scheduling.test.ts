import type { DatabaseSync } from "node:sqlite";
import { describe, expect, it } from "vitest";

import type { ContentStoreRecord } from "../src/platform-contracts";
import { createSqliteContentStore } from "../src/sqlite-runtime/content.js";
import { makeDb } from "./helpers/make-db.js";

function makeStore(db: DatabaseSync) {
	let id = 0;
	return createSqliteContentStore(
		() => db,
		() => `rec_${++id}`,
	);
}

function seedPost(db: DatabaseSync, slug: string) {
	db.prepare(
		`INSERT INTO content_entries (slug, legacy_url, title, kind, template_key, source_html_path, updated_at, body, summary, seo_title, meta_description)
     VALUES (?, ?, ?, 'post', 'content', 'runtime://content/' || ?, CURRENT_TIMESTAMP, 'body', '', ?, '')`,
	).run(slug, `/${slug}`, `Title for ${slug}`, slug, `Title for ${slug}`);

	db.prepare(
		`INSERT INTO content_overrides (slug, title, status, seo_title, meta_description, updated_at, updated_by)
     VALUES (?, ?, 'draft', ?, '', CURRENT_TIMESTAMP, 'seed@test.local')`,
	).run(slug, `Title for ${slug}`, `Title for ${slug}`);
}

// ─── ContentStoreRecord shape ─────────────────────────────────────────────────

describe("ContentStoreRecord scheduledAt field", () => {
	it("scheduledAt is optional on ContentStoreRecord", () => {
		const record: ContentStoreRecord = {
			id: "rec_01",
			kind: "post",
			slug: "my-post",
			status: "draft",
		};
		expect(record.scheduledAt).toBeUndefined();
	});

	it("scheduledAt can be set to an ISO string", () => {
		const scheduled = "2026-06-01T09:00:00Z";
		const record: ContentStoreRecord = {
			id: "rec_02",
			kind: "post",
			slug: "future-post",
			status: "draft",
			scheduledAt: scheduled,
		};
		expect(record.scheduledAt).toBe(scheduled);
	});

	it("scheduledAt can be null (cleared)", () => {
		const record: ContentStoreRecord = {
			id: "rec_03",
			kind: "post",
			slug: "unscheduled-post",
			status: "draft",
			scheduledAt: null,
		};
		expect(record.scheduledAt).toBeNull();
	});
});

// ─── Content scheduling store operations ─────────────────────────────────────

describe("Content scheduling store operations", () => {
	it("scheduleContentPublish sets scheduled_at and keeps status as draft", () => {
		const db = makeDb();
		const { sqliteSchedulingRepository } = makeStore(db);
		seedPost(db, "future-post");

		const futureDate = new Date(Date.now() + 86_400_000).toISOString(); // tomorrow
		sqliteSchedulingRepository.schedulePublish("future-post", futureDate);

		const row = db
			.prepare(
				"SELECT scheduled_at, status FROM content_overrides WHERE slug = ?",
			)
			.get("future-post") as { scheduled_at: string; status: string };
		expect(row.scheduled_at).toBe(futureDate);
		expect(row.status).toBe("draft");
	});

	it("listScheduledContent returns only records with a future scheduled_at", () => {
		const db = makeDb();
		const { sqliteSchedulingRepository } = makeStore(db);
		seedPost(db, "post-a");
		seedPost(db, "post-b");

		const future = new Date(Date.now() + 86_400_000).toISOString();
		const past = new Date(Date.now() - 86_400_000).toISOString();

		sqliteSchedulingRepository.schedulePublish("post-a", future);
		// Set post-b to a past timestamp directly so it doesn't appear in listScheduled
		db.prepare(
			"UPDATE content_overrides SET scheduled_at = ? WHERE slug = ?",
		).run(past, "post-b");

		const scheduled = sqliteSchedulingRepository.listScheduled();
		const slugs = scheduled.map((s) => s.slug);
		expect(slugs).toContain("post-a");
		expect(slugs).not.toContain("post-b");
	});

	it("cancelScheduledPublish clears scheduled_at leaving status as draft", () => {
		const db = makeDb();
		const { sqliteSchedulingRepository } = makeStore(db);
		seedPost(db, "cancel-me");

		const future = new Date(Date.now() + 86_400_000).toISOString();
		sqliteSchedulingRepository.schedulePublish("cancel-me", future);
		sqliteSchedulingRepository.cancelScheduledPublish("cancel-me");

		const row = db
			.prepare(
				"SELECT scheduled_at, status FROM content_overrides WHERE slug = ?",
			)
			.get("cancel-me") as { scheduled_at: string | null; status: string };
		expect(row.scheduled_at).toBeNull();
		expect(row.status).toBe("draft");
	});

	it("scheduler run publishes records whose scheduled_at is in the past", () => {
		const db = makeDb();
		const { sqliteSchedulingRepository } = makeStore(db);
		seedPost(db, "past-post");

		// Directly set a past scheduled_at
		const past = new Date(Date.now() - 1000).toISOString();
		db.prepare(
			"UPDATE content_overrides SET scheduled_at = ? WHERE slug = ?",
		).run(past, "past-post");

		const published = sqliteSchedulingRepository.runScheduledPublishes();
		expect(published).toBeGreaterThanOrEqual(1);

		const row = db
			.prepare(
				"SELECT scheduled_at, status FROM content_overrides WHERE slug = ?",
			)
			.get("past-post") as { scheduled_at: string | null; status: string };
		expect(row.status).toBe("published");
		expect(row.scheduled_at).toBeNull();
	});

	it("scheduling a post does not immediately make it publicly visible", () => {
		const db = makeDb();
		const { sqliteSchedulingRepository } = makeStore(db);
		seedPost(db, "not-yet-visible");

		const future = new Date(Date.now() + 86_400_000).toISOString();
		sqliteSchedulingRepository.schedulePublish("not-yet-visible", future);

		const row = db
			.prepare("SELECT status FROM content_overrides WHERE slug = ?")
			.get("not-yet-visible") as { status: string };
		expect(row.status).toBe("draft");
	});
});
