import { describe, expect, it } from "vitest";

import { createSqliteSubmissionStore } from "../../src/sqlite-runtime/content-submissions.js";
import { makeDb } from "../helpers/make-db.js";

describe("createSqliteSubmissionStore", () => {
	it("submitContact persists a row that getContactSubmissions reads back", () => {
		const db = makeDb();
		const { sqliteSubmissionRepository } = createSqliteSubmissionStore(() => db);

		const submitted = sqliteSubmissionRepository.submitContact({
			name: "Alice",
			email: "alice@example.com",
			message: "Hello",
			submittedAt: "2026-05-03T10:00:00.000Z",
		});
		expect(submitted.ok).toBe(true);

		const rows = sqliteSubmissionRepository.getContactSubmissions();
		expect(rows).toHaveLength(1);
		expect(rows[0]?.email).toBe("alice@example.com");
		expect(rows[0]?.name).toBe("Alice");
		expect(rows[0]?.message).toBe("Hello");
	});

	it("getContactSubmissions returns rows ordered by submitted_at DESC then id DESC", () => {
		const db = makeDb();
		const { sqliteSubmissionRepository } = createSqliteSubmissionStore(() => db);

		sqliteSubmissionRepository.submitContact({
			name: "First",
			email: "first@x",
			message: "1",
			submittedAt: "2026-05-01T10:00:00.000Z",
		});
		sqliteSubmissionRepository.submitContact({
			name: "Second",
			email: "second@x",
			message: "2",
			submittedAt: "2026-05-03T10:00:00.000Z",
		});

		const rows = sqliteSubmissionRepository.getContactSubmissions();
		expect(rows.map((r) => r.email)).toEqual(["second@x", "first@x"]);
	});

	it("schedulePublish + listScheduled returns the future scheduled row", () => {
		const db = makeDb();
		const { sqliteSchedulingRepository } = createSqliteSubmissionStore(() => db);
		// Seed an existing entry so the schedulePublish UPDATE can find a row
		// to set scheduled_at on.
		db.prepare(
			"INSERT INTO content_entries (slug, legacy_url, title, kind, body) VALUES (?, ?, ?, 'page', '')",
		).run("hello-world", "/hello-world", "Hello World");

		const future = new Date(Date.now() + 60_000).toISOString();
		sqliteSchedulingRepository.schedulePublish("hello-world", future);

		const scheduled = sqliteSchedulingRepository.listScheduled();
		expect(scheduled).toHaveLength(1);
		expect(scheduled[0]?.slug).toBe("hello-world");
		expect(scheduled[0]?.scheduledAt).toBe(future);
	});

	it("cancelScheduledPublish clears scheduled_at and listScheduled drops the row", () => {
		const db = makeDb();
		const { sqliteSchedulingRepository } = createSqliteSubmissionStore(() => db);
		db.prepare(
			"INSERT INTO content_entries (slug, legacy_url, title, kind, body) VALUES (?, ?, ?, 'page', '')",
		).run("a", "/a", "A");

		const future = new Date(Date.now() + 60_000).toISOString();
		sqliteSchedulingRepository.schedulePublish("a", future);
		expect(sqliteSchedulingRepository.listScheduled()).toHaveLength(1);

		sqliteSchedulingRepository.cancelScheduledPublish("a");
		expect(sqliteSchedulingRepository.listScheduled()).toHaveLength(0);
	});

	it("runScheduledPublishes promotes due entries to published and returns the row count", () => {
		const db = makeDb();
		const { sqliteSchedulingRepository } = createSqliteSubmissionStore(() => db);
		db.prepare(
			"INSERT INTO content_entries (slug, legacy_url, title, kind, body) VALUES (?, ?, ?, 'page', '')",
		).run("due", "/due", "Due");

		const past = new Date(Date.now() - 60_000).toISOString();
		sqliteSchedulingRepository.schedulePublish("due", past);

		const changed = sqliteSchedulingRepository.runScheduledPublishes();
		expect(changed).toBe(1);
		// scheduled_at cleared after promotion.
		const row = db
			.prepare("SELECT status, scheduled_at FROM content_overrides WHERE slug = ?")
			.get("due") as { status: string; scheduled_at: string | null };
		expect(row.status).toBe("published");
		expect(row.scheduled_at).toBeNull();
	});

	it("listScheduled excludes entries whose scheduled_at is in the past", () => {
		const db = makeDb();
		const { sqliteSchedulingRepository } = createSqliteSubmissionStore(() => db);
		db.prepare(
			"INSERT INTO content_entries (slug, legacy_url, title, kind, body) VALUES (?, ?, ?, 'page', '')",
		).run("past", "/past", "P");

		const past = new Date(Date.now() - 60_000).toISOString();
		sqliteSchedulingRepository.schedulePublish("past", past);

		// Past entries don't appear in listScheduled (>now filter).
		expect(sqliteSchedulingRepository.listScheduled()).toHaveLength(0);
	});
});
