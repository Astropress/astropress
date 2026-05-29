// Mutation-coverage + behavioral tests for the D1 webhook store
// (src/sqlite-runtime/webhooks-d1.ts), exercised through the SqliteBackedD1Database
// fixture. The D1 sibling #137 added must match the sqlite store's create /
// list / delete / dispatch semantics — including the ML-DSA signing headers and
// the last_fired_at bookkeeping — on every host that provides a D1 binding.
import { describe, expect, it, vi } from "vitest";

import { verifyMlDsaMessage } from "../src/crypto-primitives.js";
import { createD1WebhookStore } from "../src/sqlite-runtime/webhooks-d1.js";
import { makeDb } from "./helpers/make-db.js";
import { SqliteBackedD1Database } from "./helpers/provider-test-fixtures.js";

const { loggerErrorSpy } = vi.hoisted(() => ({ loggerErrorSpy: vi.fn() }));

vi.mock("../src/runtime-logger", () => ({
	createLogger: () => ({
		info: vi.fn(),
		warn: vi.fn(),
		error: loggerErrorSpy,
	}),
}));

function makeStore(fetchImpl: typeof fetch = fetch) {
	const db = makeDb();
	const d1 = new SqliteBackedD1Database(db);
	return { db, store: createD1WebhookStore(d1, fetchImpl) };
}

describe("createD1WebhookStore", () => {
	it("create: returns a one-time ML-DSA verification bundle and stores only the secret", async () => {
		const { db, store } = makeStore();
		const { record, verification } = await store.create({
			url: "https://example.com/hook",
			events: ["content.published"],
		});

		expect(verification.algorithm).toBe("ML-DSA-65");
		expect(verification.keyId).toBe(record.id);
		expect(verification.publicKey.length).toBeGreaterThan(100);
		expect(record.id.startsWith("wh_")).toBe(true);
		expect(record.active).toBe(true);
		expect(record.events).toEqual(["content.published"]);

		const row = db.prepare("SELECT secret_hash FROM webhooks WHERE id = ?").get(record.id) as {
			secret_hash: string;
		};
		expect(row.secret_hash).not.toBe(verification.publicKey);
	});

	it("list: returns only active, non-deleted webhooks newest-first", async () => {
		const { store } = makeStore();
		const { record: r1 } = await store.create({
			url: "https://a.com/hook",
			events: ["content.published"],
		});
		const { record: r2 } = await store.create({
			url: "https://b.com/hook",
			events: ["media.uploaded"],
		});
		await store.delete(r1.id);

		const active = await store.list();
		expect(active.some((w) => w.id === r2.id)).toBe(true);
		expect(active.some((w) => w.id === r1.id)).toBe(false);
	});

	it("list: maps the active column to a boolean", async () => {
		const { db, store } = makeStore();
		db.prepare(
			"INSERT INTO webhooks (id, url, events, secret_hash, active) VALUES (?, ?, ?, ?, ?)",
		).run("wh_on", "https://on.example.com", JSON.stringify(["content.published"]), "secret", 1);
		db.prepare(
			"INSERT INTO webhooks (id, url, events, secret_hash, active) VALUES (?, ?, ?, ?, ?)",
		).run("wh_off", "https://off.example.com", JSON.stringify(["content.published"]), "secret", 0);

		const list = await store.list();
		expect(list.find((w) => w.id === "wh_on")?.active).toBe(true);
		expect(list.find((w) => w.id === "wh_off")?.active).toBe(false);
	});

	it("delete: soft-deletes (sets deleted_at) so the webhook drops out of list", async () => {
		const { db, store } = makeStore();
		const { record } = await store.create({
			url: "https://c.com/hook",
			events: ["content.deleted"],
		});

		await store.delete(record.id);
		const row = db.prepare("SELECT deleted_at FROM webhooks WHERE id = ?").get(record.id) as {
			deleted_at: string | null;
		};
		expect(row.deleted_at).not.toBeNull();
		expect((await store.list()).some((w) => w.id === record.id)).toBe(false);
	});

	it("dispatch: POSTs an ML-DSA-65 signed body with the documented headers", async () => {
		let captured: Request | undefined;
		const mockFetch = async (req: Request) => {
			captured = req;
			return new Response("ok", { status: 200 });
		};
		const { store } = makeStore(mockFetch as typeof fetch);
		const { record, verification } = await store.create({
			url: "https://hooks.example.com/receive",
			events: ["content.published"],
		});

		await store.dispatch("content.published", { id: "post-1", status: "published" });

		expect(captured?.method).toBe("POST");
		expect(captured?.headers.get("content-type")).toBe("application/json");
		expect(captured?.headers.get("x-astropress-signature-alg")).toBe("ML-DSA-65");
		expect(captured?.headers.get("x-astropress-key-id")).toBe(record.id);

		const sig = captured?.headers.get("x-astropress-signature");
		const body = await captured?.clone().text();
		expect(verifyMlDsaMessage(body, sig as string, verification.publicKey)).toBe(true);

		const parsed = JSON.parse(body ?? "{}") as {
			event?: string;
			payload?: { id?: string; status?: string };
			timestamp?: string;
		};
		expect(parsed.event).toBe("content.published");
		expect(parsed.payload).toEqual({ id: "post-1", status: "published" });
		expect(typeof parsed.timestamp).toBe("string");
	});

	it("dispatch: skips webhooks not subscribed to the event", async () => {
		let callCount = 0;
		const mockFetch = async () => {
			callCount++;
			return new Response("ok", { status: 200 });
		};
		const { store } = makeStore(mockFetch as typeof fetch);
		await store.create({ url: "https://media.example.com/hook", events: ["media.uploaded"] });

		await store.dispatch("content.published", { id: "x" });
		expect(callCount).toBe(0);
	});

	it("dispatch: records last_fired_at on success", async () => {
		const mockFetch = async () => new Response("ok", { status: 200 });
		const { db, store } = makeStore(mockFetch as typeof fetch);
		const { record } = await store.create({
			url: "https://hooks.example.com/receive",
			events: ["content.published"],
		});

		await store.dispatch("content.published", { id: "x" });
		const row = db.prepare("SELECT last_fired_at FROM webhooks WHERE id = ?").get(record.id) as {
			last_fired_at: string | null;
		};
		expect(row.last_fired_at).not.toBeNull();

		const listed = (await store.list()).find((w) => w.id === record.id);
		expect(typeof listed?.lastFiredAt).toBe("string");
	});

	it("dispatch: a failed delivery leaves last_fired_at NULL, logs the error, and does not throw", async () => {
		loggerErrorSpy.mockClear();
		const mockFetch = async () => {
			throw new Error("Network error");
		};
		const { db, store } = makeStore(mockFetch as typeof fetch);
		const { record } = await store.create({
			url: "https://fail.example.com/hook",
			events: ["content.updated"],
		});

		await expect(store.dispatch("content.updated", { id: "x" })).resolves.not.toThrow();

		const row = db.prepare("SELECT last_fired_at FROM webhooks WHERE id = ?").get(record.id) as {
			last_fired_at: string | null;
		};
		expect(row.last_fired_at).toBeNull();

		expect(loggerErrorSpy).toHaveBeenCalledTimes(1);
		const [message, meta] = loggerErrorSpy.mock.calls[0] as [string, { error?: unknown }];
		expect(message).toContain("content.updated");
		expect(message).toContain("https://fail.example.com/hook");
		expect(meta.error).toBeInstanceOf(Error);
	});
});
