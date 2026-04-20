import type { DatabaseSync } from "node:sqlite";
import { beforeEach, describe, expect, it } from "vitest";

import { createSqlitePurgeOps } from "../src/sqlite-runtime/purge.js";
import { makeDb } from "./helpers/make-db.js";

function seedUser(db: DatabaseSync, email: string, name = "Test User") {
	db.prepare(
		`INSERT INTO admin_users (email, password_hash, role, name)
     VALUES (?, 'hash', 'editor', ?)`,
	).run(email, name);
	const row = db
		.prepare("SELECT id FROM admin_users WHERE email = ? LIMIT 1")
		.get(email) as { id: number };

	// Insert a session for the user
	db.prepare(
		`INSERT INTO admin_sessions (id, user_id, csrf_token)
     VALUES (?, ?, 'csrf')`,
	).run(`sess-${email}`, row.id);

	// Insert audit events
	db.prepare(
		`INSERT INTO audit_events (user_email, action, resource_type, resource_id, summary)
     VALUES (?, 'content.update', 'content', 'post-1', 'Updated post')`,
	).run(email);

	// Insert a comment
	db.prepare(
		`INSERT INTO comments (id, author, email, body, route, status, policy)
     VALUES (?, 'Test User', ?, 'A comment', '/post-1', 'approved', 'open-moderated')`,
	).run(`comment-${email}`, email);

	// Insert a contact submission
	db.prepare(
		`INSERT INTO contact_submissions (name, email, message, submitted_at)
     VALUES ('Test User', ?, 'Hello', CURRENT_TIMESTAMP)`,
	).run(email);
}

describe("createSqlitePurgeOps — user data purge (GDPR)", () => {
	let db: DatabaseSync;
	let purge: ReturnType<typeof createSqlitePurgeOps>;

	beforeEach(() => {
		db = makeDb();
		purge = createSqlitePurgeOps(() => db);
	});

	it("revokes sessions for the user", () => {
		seedUser(db, "alice@test.com");
		const result = purge.purgeUserData("alice@test.com");
		expect(result.ok).toBe(true);
		expect(result.revokedSessions).toBe(1);
	});

	it("anonymises audit events", () => {
		seedUser(db, "alice@test.com");
		purge.purgeUserData("alice@test.com");
		const row = db
			.prepare("SELECT user_email FROM audit_events LIMIT 1")
			.get() as { user_email: string };
		expect(row.user_email).toBe("[deleted]");
	});

	it("deletes comments by the user", () => {
		seedUser(db, "alice@test.com");
		const result = purge.purgeUserData("alice@test.com");
		expect(result.deletedComments).toBe(1);
		const remaining = db
			.prepare(
				"SELECT COUNT(*) as cnt FROM comments WHERE email = 'alice@test.com'",
			)
			.get() as { cnt: number };
		expect(remaining.cnt).toBe(0);
	});

	it("deletes contact submissions by the user", () => {
		seedUser(db, "alice@test.com");
		const result = purge.purgeUserData("alice@test.com");
		expect(result.deletedContactSubmissions).toBe(1);
	});

	it("suspends admin user by default", () => {
		seedUser(db, "alice@test.com");
		const result = purge.purgeUserData("alice@test.com");
		expect(result.adminUserAction).toBe("suspended");
		const row = db
			.prepare("SELECT active FROM admin_users WHERE email = 'alice@test.com'")
			.get() as { active: number };
		expect(row.active).toBe(0);
	});

	it("deletes admin user when deleteAccount: true", () => {
		seedUser(db, "alice@test.com");
		const result = purge.purgeUserData("alice@test.com", {
			deleteAccount: true,
		});
		expect(result.adminUserAction).toBe("deleted");
		const row = db
			.prepare(
				"SELECT COUNT(*) as cnt FROM admin_users WHERE email = 'alice@test.com'",
			)
			.get() as { cnt: number };
		expect(row.cnt).toBe(0);
	});

	it("returns not_found when user does not exist", () => {
		const result = purge.purgeUserData("nobody@test.com");
		expect(result.adminUserAction).toBe("not_found");
		expect(result.revokedSessions).toBe(0);
	});
});
