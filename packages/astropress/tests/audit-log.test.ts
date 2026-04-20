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
