// Behavioral + mutation-coverage tests for the sqlite flash store
// (src/sqlite-runtime/flash.ts). The flash store is the fix for the
// secret-in-URL class (#113/#115/#133): secrets are handed off via an opaque
// id and read exactly once, server-side. The single-use and expiry guarantees
// are what make putting only `flash=<id>` in the URL safe, so they are asserted
// directly here.
import { describe, expect, it, vi } from "vitest";

import { createFlashStore, FLASH_DEFAULT_TTL_MS, newFlashId } from "../src/sqlite-runtime/flash.js";
import { makeDb } from "./helpers/make-db.js";

function makeStore() {
	const db = makeDb();
	return { db, store: createFlashStore(db) };
}

describe("createFlashStore", () => {
	it("put returns an opaque, non-empty id and consume returns the payload once", async () => {
		const { store } = makeStore();
		const { id } = await store.put("super-secret-token");
		expect(id).toMatch(/^flash_[0-9a-f]{36}$/);

		const first = await store.consume(id);
		expect(first).toBe("super-secret-token");
	});

	it("consume is single-use: a second read of the same id returns null", async () => {
		const { store } = makeStore();
		const { id } = await store.put("once-only");

		expect(await store.consume(id)).toBe("once-only");
		expect(await store.consume(id)).toBeNull();
	});

	it("consume deletes the row even when the payload is read (no residue)", async () => {
		const { db, store } = makeStore();
		const { id } = await store.put("leave-no-trace");
		await store.consume(id);

		const row = db.prepare("SELECT id FROM admin_flash WHERE id = ?").get(id);
		expect(row).toBeUndefined();
	});

	it("consume returns null for an unknown id", async () => {
		const { store } = makeStore();
		expect(await store.consume("flash_does-not-exist")).toBeNull();
	});

	it("expired entries are treated as absent and are not readable", async () => {
		const { store } = makeStore();
		const { id } = await store.put("stale", -1);
		expect(await store.consume(id)).toBeNull();
	});

	it("consume of an expired id still deletes the row so it cannot be replayed", async () => {
		const { db, store } = makeStore();
		const { id } = await store.put("stale", -1);
		await store.consume(id);
		const row = db.prepare("SELECT id FROM admin_flash WHERE id = ?").get(id);
		expect(row).toBeUndefined();
	});

	it("put sweeps already-expired rows so the table does not grow unbounded", async () => {
		const { db, store } = makeStore();
		await store.put("old", -1);
		// A fresh put runs the sweep, removing the expired row above.
		await store.put("fresh");
		const remaining = db.prepare("SELECT payload FROM admin_flash").all() as Array<{
			payload: string;
		}>;
		expect(remaining.map((r) => r.payload)).toEqual(["fresh"]);
	});

	it("default TTL stores an entry that is still readable shortly after", async () => {
		const { db, store } = makeStore();
		const before = Date.now();
		const { id } = await store.put("ttl-default");
		const row = db.prepare("SELECT expires_at_ms FROM admin_flash WHERE id = ?").get(id) as {
			expires_at_ms: number;
		};
		expect(row.expires_at_ms).toBeGreaterThanOrEqual(before + FLASH_DEFAULT_TTL_MS);
		expect(await store.consume(id)).toBe("ttl-default");
	});

	it("two put calls yield distinct ids", async () => {
		const { store } = makeStore();
		const a = await store.put("a");
		const b = await store.put("b");
		expect(a.id).not.toBe(b.id);
	});

	it("newFlashId emits unique opaque ids", () => {
		expect(newFlashId()).not.toBe(newFlashId());
	});

	it("treats an entry whose expiry equals the current instant as expired (boundary: <=)", async () => {
		// Pin time so expires_at_ms === Date.now() exactly at consume. The guard
		// is `expires_at_ms <= now`: at the boundary the entry is expired. A
		// `<` mutant would (wrongly) return the payload — this asserts the `=`.
		const fixed = 1_700_000_000_000;
		const spy = vi.spyOn(Date, "now").mockReturnValue(fixed);
		try {
			const { db, store } = makeStore();
			const { id } = await store.put("edge", 0); // expires_at_ms = fixed + 0
			expect(await store.consume(id)).toBeNull();
			// Still consumed (deleted) so the boundary entry can't be replayed.
			expect(db.prepare("SELECT id FROM admin_flash WHERE id = ?").get(id)).toBeUndefined();
		} finally {
			spy.mockRestore();
		}
	});
});
