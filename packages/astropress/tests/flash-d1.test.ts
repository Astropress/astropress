// Behavioral + mutation-coverage tests for the D1 flash store
// (src/sqlite-runtime/flash-d1.ts), exercised through the SqliteBackedD1Database
// fixture. The D1 sibling must behave identically to the sqlite store on every
// host that provides a D1 binding — same single-use + expiry guarantees that
// make the opaque `flash=<id>` redirect safe. See #113/#115/#133.
import { describe, expect, it, vi } from "vitest";

import { createD1FlashStore } from "../src/sqlite-runtime/flash-d1.js";
import { makeDb } from "./helpers/make-db.js";
import { SqliteBackedD1Database } from "./helpers/provider-test-fixtures.js";

function makeStore() {
	const db = makeDb();
	const d1 = new SqliteBackedD1Database(db);
	return { db, store: createD1FlashStore(d1) };
}

describe("createD1FlashStore", () => {
	it("put then consume returns the payload exactly once", async () => {
		const { store } = makeStore();
		const { id } = await store.put("d1-secret");
		expect(id).toMatch(/^flash_[0-9a-f]{36}$/);
		expect(await store.consume(id)).toBe("d1-secret");
		expect(await store.consume(id)).toBeNull();
	});

	it("consume deletes the row (no residue)", async () => {
		const { db, store } = makeStore();
		const { id } = await store.put("gone");
		await store.consume(id);
		expect(db.prepare("SELECT id FROM admin_flash WHERE id = ?").get(id)).toBeUndefined();
	});

	it("unknown id returns null", async () => {
		const { store } = makeStore();
		expect(await store.consume("flash_nope")).toBeNull();
	});

	it("expired entry is not readable and is deleted on read", async () => {
		const { db, store } = makeStore();
		const { id } = await store.put("stale", -1);
		expect(await store.consume(id)).toBeNull();
		expect(db.prepare("SELECT id FROM admin_flash WHERE id = ?").get(id)).toBeUndefined();
	});

	it("put sweeps expired rows", async () => {
		const { db, store } = makeStore();
		await store.put("old", -1);
		await store.put("fresh");
		const remaining = db.prepare("SELECT payload FROM admin_flash").all() as Array<{
			payload: string;
		}>;
		expect(remaining.map((r) => r.payload)).toEqual(["fresh"]);
	});

	it("treats an entry whose expiry equals the current instant as expired (boundary: <=)", async () => {
		const fixed = 1_700_000_000_000;
		const spy = vi.spyOn(Date, "now").mockReturnValue(fixed);
		try {
			const { db, store } = makeStore();
			const { id } = await store.put("edge", 0); // expires_at_ms = fixed
			expect(await store.consume(id)).toBeNull();
			expect(db.prepare("SELECT id FROM admin_flash WHERE id = ?").get(id)).toBeUndefined();
		} finally {
			spy.mockRestore();
		}
	});

	it("round-trips a JSON payload (webhook verification bundle shape)", async () => {
		const { store } = makeStore();
		const payload = JSON.stringify({ algorithm: "ml-dsa-65", publicKey: "abc123" });
		const { id } = await store.put(payload);
		expect(JSON.parse((await store.consume(id)) ?? "")).toEqual({
			algorithm: "ml-dsa-65",
			publicKey: "abc123",
		});
	});
});
