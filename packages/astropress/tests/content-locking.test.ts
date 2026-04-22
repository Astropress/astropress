import type { DatabaseSync } from "node:sqlite";
import { beforeEach, describe, expect, it } from "vitest";

import { createSqliteLocksOps } from "../src/sqlite-runtime/locks.js";
import { makeDb } from "./helpers/make-db.js";

describe("createSqliteLocksOps — pessimistic content locking", () => {
	let db: DatabaseSync;
	let locks: ReturnType<typeof createSqliteLocksOps>;

	beforeEach(() => {
		db = makeDb();
		locks = createSqliteLocksOps(() => db);
	});

	it("acquire succeeds for first requester", () => {
		const result = locks.acquireLock("my-post", "alice@test.com", "Alice");
		expect(result.ok).toBe(true);
		if (result.ok) {
			expect(result.lockToken).toBeTruthy();
			expect(result.expiresAt).toBeTruthy();
		}
	});

	it("acquire returns conflict when another user holds the lock", () => {
		locks.acquireLock("my-post", "alice@test.com", "Alice");
		const conflict = locks.acquireLock("my-post", "bob@test.com", "Bob");
		expect(conflict.ok).toBe(false);
		if (!conflict.ok && conflict.conflict) {
			expect(conflict.lockedByEmail).toBe("alice@test.com");
			expect(conflict.lockedByName).toBe("Alice");
			expect(conflict.expiresAt).toBeTruthy();
		}
	});

	it("same user re-acquiring refreshes the lock", () => {
		const first = locks.acquireLock("my-post", "alice@test.com", "Alice");
		const second = locks.acquireLock("my-post", "alice@test.com", "Alice");
		expect(first.ok).toBe(true);
		expect(second.ok).toBe(true);
		if (first.ok && second.ok) {
			expect(second.lockToken).not.toBe(first.lockToken);
		}
	});

	it("heartbeat (refreshLock) extends expiry and returns true", () => {
		const acquired = locks.acquireLock("my-post", "alice@test.com", "Alice");
		expect(acquired.ok).toBe(true);
		if (!acquired.ok) return;

		const refreshed = locks.refreshLock("my-post", acquired.lockToken);
		expect(refreshed).toBe(true);
	});

	it("refreshLock returns false for unknown token", () => {
		locks.acquireLock("my-post", "alice@test.com", "Alice");
		const refreshed = locks.refreshLock("my-post", "bad-token");
		expect(refreshed).toBe(false);
	});

	it("release enables immediate re-acquire by another user", () => {
		const acquired = locks.acquireLock("my-post", "alice@test.com", "Alice");
		expect(acquired.ok).toBe(true);
		if (!acquired.ok) return;

		locks.releaseLock("my-post", acquired.lockToken);

		const bob = locks.acquireLock("my-post", "bob@test.com", "Bob");
		expect(bob.ok).toBe(true);
	});

	it("expired lock allows re-acquire by another user", () => {
		// Insert an expired lock row directly
		const pastExpiry = new Date(Date.now() - 1000).toISOString();
		db.prepare(
			`INSERT INTO content_locks (slug, locked_by_email, locked_by_name, lock_token, expires_at)
       VALUES (?, ?, ?, ?, ?)`,
		).run("stale-post", "alice@test.com", "Alice", "old-token", pastExpiry);

		const bob = locks.acquireLock("stale-post", "bob@test.com", "Bob");
		expect(bob.ok).toBe(true);
	});
});
