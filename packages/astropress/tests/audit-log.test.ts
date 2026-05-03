import { beforeAll, describe, expect, it } from "vitest";
import { registerCms } from "../src/config.js";
import {
	listAuditEvents,
	recordAuditEvent,
} from "../src/sqlite-runtime/audit-log.js";
import { makeDb } from "./helpers/make-db.js";

let db: ReturnType<typeof makeDb>;

beforeAll(() => {
	db = makeDb();
});

describe("audit log", () => {
	it("records an audit event and retrieves it", () => {
		recordAuditEvent(db, {
			userEmail: "editor@example.com",
			action: "content.published",
			resourceType: "post",
			resourceId: "my-post",
			summary: "Published post my-post",
		});

		const events = listAuditEvents(db, { limit: 10 });
		expect(events.length).toBeGreaterThanOrEqual(1);

		const event = events.find((e) => e.resourceId === "my-post");
		expect(event).toBeDefined();
		expect(event?.userEmail).toBe("editor@example.com");
		expect(event?.action).toBe("content.published");
		expect(event?.resourceType).toBe("post");
		expect(event?.summary).toBe("Published post my-post");
		expect(event?.details).toBeNull();
	});

	it("stores and retrieves structured details JSON", () => {
		recordAuditEvent(db, {
			userEmail: "admin@example.com",
			action: "user.invited",
			resourceType: "user",
			resourceId: "new@example.com",
			summary: "Invited new@example.com",
			details: { role: "editor", invitedBy: "admin@example.com" },
		});

		const events = listAuditEvents(db, { resourceId: "new@example.com" });
		expect(events.length).toBe(1);
		expect(events[0].details).toEqual({
			role: "editor",
			invitedBy: "admin@example.com",
		});
	});

	it("filters by resourceId", () => {
		recordAuditEvent(db, {
			userEmail: "admin@example.com",
			action: "content.deleted",
			resourceType: "post",
			resourceId: "another-post",
			summary: "Deleted another-post",
		});

		const filtered = listAuditEvents(db, { resourceId: "my-post" });
		expect(filtered.every((e) => e.resourceId === "my-post")).toBe(true);
	});

	it("prunes audit events older than auditRetentionDays on write", () => {
		const freshDb = makeDb();
		registerCms({
			templateKeys: [],
			siteUrl: "https://example.com",
			seedPages: [],
			archives: [],
			translationStatus: [],
			auditRetentionDays: 30,
		});

		// Insert a very old event by manipulating created_at directly
		freshDb
			.prepare(
				`INSERT INTO audit_events (user_email, action, resource_type, resource_id, summary, created_at)
       VALUES ('old@test.local', 'content.published', 'post', 'old-post', 'Old post', datetime('now', '-31 days'))`,
			)
			.run();

		const before = (
			freshDb.prepare("SELECT COUNT(*) as n FROM audit_events").get() as {
				n: number;
			}
		).n;
		expect(before).toBe(1);

		// Writing a new event should trigger pruning
		recordAuditEvent(freshDb, {
			userEmail: "new@test.local",
			action: "content.published",
			resourceType: "post",
			resourceId: "new-post",
			summary: "New post",
		});

		const after = (
			freshDb.prepare("SELECT COUNT(*) as n FROM audit_events").get() as {
				n: number;
			}
		).n;
		// Old event should be pruned; new event should remain
		expect(after).toBe(1);
		const remaining = freshDb
			.prepare("SELECT resource_id FROM audit_events")
			.get() as { resource_id: string };
		expect(remaining.resource_id).toBe("new-post");
	});

	it("does NOT prune when auditRetentionDays is 0 (kills > 0 boundary mutant)", () => {
		const freshDb = makeDb();
		registerCms({
			templateKeys: [],
			siteUrl: "https://example.com",
			seedPages: [],
			archives: [],
			translationStatus: [],
			auditRetentionDays: 0,
		});
		freshDb
			.prepare(
				`INSERT INTO audit_events (user_email, action, resource_type, resource_id, summary, created_at)
       VALUES ('old@x', 'content.published', 'post', 'old', 'old', datetime('now', '-365 days'))`,
			)
			.run();
		recordAuditEvent(freshDb, {
			userEmail: "new@x",
			action: "content.published",
			resourceType: "post",
			resourceId: "new",
			summary: "new",
		});
		// Both rows survive — pruning skipped because retention=0.
		const count = (
			freshDb.prepare("SELECT COUNT(*) as n FROM audit_events").get() as {
				n: number;
			}
		).n;
		expect(count).toBe(2);
	});

	it("falls back to 90-day retention when auditRetentionDays is undefined (pins ?? 90 default)", () => {
		const freshDb = makeDb();
		registerCms({
			templateKeys: [],
			siteUrl: "https://example.com",
			seedPages: [],
			archives: [],
			translationStatus: [],
			// auditRetentionDays intentionally omitted
		});
		// Row at 91 days should be pruned by the default 90-day window.
		freshDb
			.prepare(
				`INSERT INTO audit_events (user_email, action, resource_type, resource_id, summary, created_at)
       VALUES ('old@x', 'content.published', 'post', '91d', 'old', datetime('now', '-91 days'))`,
			)
			.run();
		// Row at 89 days should survive.
		freshDb
			.prepare(
				`INSERT INTO audit_events (user_email, action, resource_type, resource_id, summary, created_at)
       VALUES ('keep@x', 'content.published', 'post', '89d', 'keep', datetime('now', '-89 days'))`,
			)
			.run();
		recordAuditEvent(freshDb, {
			userEmail: "trigger@x",
			action: "content.published",
			resourceType: "post",
			resourceId: "trigger",
			summary: "trigger prune",
		});
		const ids = (
			freshDb
				.prepare("SELECT resource_id as id FROM audit_events ORDER BY id")
				.all() as { id: string }[]
		).map((r) => r.id);
		expect(ids).toContain("89d");
		expect(ids).toContain("trigger");
		expect(ids).not.toContain("91d");
	});

	it("listAuditEvents default limit is 50 (pins ?? 50 default)", () => {
		const freshDb = makeDb();
		// 51 rows so a default of 50 returns 50 (mutant ?? 0 would return 0).
		for (let i = 0; i < 51; i++) {
			recordAuditEvent(freshDb, {
				userEmail: "x@y",
				action: "act",
				resourceType: "post",
				resourceId: `r-${i}`,
				summary: "s",
			});
		}
		const events = listAuditEvents(freshDb);
		expect(events.length).toBe(50);
	});

	it("listAuditEvents default offset is 0 (pins ?? 0 default)", () => {
		const freshDb = makeDb();
		for (let i = 0; i < 3; i++) {
			recordAuditEvent(freshDb, {
				userEmail: "x@y",
				action: "act",
				resourceType: "post",
				resourceId: `r-${i}`,
				summary: "s",
			});
		}
		// Without offset arg → offset 0 → 3 rows. Mutant ?? 1 → 2 rows.
		const events = listAuditEvents(freshDb, { limit: 10 });
		expect(events.length).toBe(3);
	});

	it("respects limit and offset", () => {
		// Insert several events
		for (let i = 0; i < 5; i++) {
			recordAuditEvent(db, {
				userEmail: "editor@example.com",
				action: "content.updated",
				resourceType: "post",
				resourceId: `post-${i}`,
				summary: `Updated post-${i}`,
			});
		}

		const page1 = listAuditEvents(db, { limit: 3, offset: 0 });
		const page2 = listAuditEvents(db, { limit: 3, offset: 3 });

		expect(page1.length).toBe(3);
		// Page 2 should have different events than page 1
		const page1Ids = page1.map((e) => e.id);
		const page2Ids = page2.map((e) => e.id);
		expect(page1Ids.some((id) => page2Ids.includes(id))).toBe(false);
	});
});
