import { createHmac } from "node:crypto";
import { DatabaseSync } from "node:sqlite";
import { describe, expect, it, vi } from "vitest";

import { createWebhookStore } from "../src/sqlite-runtime/webhooks.js";
import type { WebhookEvent, WebhookRecord, WebhookStore } from "../src/platform-contracts";
import { makeDb } from "./helpers/make-db.js";

describe("WebhookRecord shape", () => {
  it("has all required fields", () => {
    const record: WebhookRecord = {
      id: "wh_01",
      url: "https://example.com/hook",
      events: ["content.published"],
      active: true,
      createdAt: new Date().toISOString(),
    };

    expect(record.id).toBe("wh_01");
    expect(record.url).toBe("https://example.com/hook");
    expect(record.active).toBe(true);
    expect(record.lastFiredAt).toBeUndefined();
  });

  it("supports all defined webhook events", () => {
    const allEvents: WebhookEvent[] = [
      "content.published",
      "content.updated",
      "content.deleted",
      "media.uploaded",
      "media.deleted",
    ];
    const record: WebhookRecord = {
      id: "wh_02",
      url: "https://example.com/hook",
      events: allEvents,
      active: true,
      createdAt: new Date().toISOString(),
    };
    expect(record.events).toHaveLength(5);
  });
});

describe("WebhookStore SQLite implementation", () => {
  it("create: returns signing secret (stored for outbound HMAC signing)", async () => {
    const db = makeDb();
    const store = createWebhookStore(db, fetch);

    const { record, signingSecret } = await store.create({
      url: "https://example.com/hook",
      events: ["content.published"],
    });

    expect(signingSecret.length).toBeGreaterThanOrEqual(32);
    expect(record.url).toBe("https://example.com/hook");
    expect(record.events).toEqual(["content.published"]);
    expect(record.active).toBe(true);

    // Secret is stored (needed for HMAC signing of outbound requests)
    const row = db.prepare("SELECT secret_hash FROM webhooks WHERE id = ?").get(record.id) as { secret_hash: string };
    expect(row.secret_hash).toBe(signingSecret);
  });

  it("list: returns only active (non-deleted) webhooks", async () => {
    const db = makeDb();
    const store = createWebhookStore(db, fetch);

    const { record: r1 } = await store.create({ url: "https://a.com/hook", events: ["content.published"] });
    const { record: r2 } = await store.create({ url: "https://b.com/hook", events: ["media.uploaded"] });
    await store.delete(r1.id);

    const active = await store.list();
    expect(active.some((w) => w.id === r2.id)).toBe(true);
    expect(active.some((w) => w.id === r1.id)).toBe(false);
  });

  it("delete: soft-deletes so the webhook is gone from list", async () => {
    const db = makeDb();
    const store = createWebhookStore(db, fetch);
    const { record } = await store.create({ url: "https://c.com/hook", events: ["content.deleted"] });

    await store.delete(record.id);

    const row = db.prepare("SELECT deleted_at FROM webhooks WHERE id = ?").get(record.id) as { deleted_at: string | null };
    expect(row.deleted_at).not.toBeNull();
  });

  it("dispatch: sends POST with HMAC-SHA256 signature header", async () => {
    const db = makeDb();
    let capturedRequest: Request | undefined;
    const mockFetch = async (req: Request) => {
      capturedRequest = req;
      return new Response("ok", { status: 200 });
    };

    const store = createWebhookStore(db, mockFetch as typeof fetch);
    const { signingSecret } = await store.create({
      url: "https://hooks.example.com/receive",
      events: ["content.published"],
    });

    const payload = { id: "post-1", status: "published" };
    await store.dispatch("content.published", payload);

    expect(capturedRequest).toBeDefined();
    expect(capturedRequest!.method).toBe("POST");

    const sig = capturedRequest!.headers.get("x-astropress-signature");
    expect(sig).toMatch(/^sha256=/);

    // Verify HMAC
    const body = await capturedRequest!.clone().text();
    const expectedHmac = createHmac("sha256", signingSecret).update(body).digest("hex");
    expect(sig).toBe(`sha256=${expectedHmac}`);
  });

  it("dispatch: partial failure does not throw", async () => {
    const db = makeDb();
    let callCount = 0;
    const mockFetch = async () => {
      callCount++;
      if (callCount === 1) throw new Error("Network error");
      return new Response("ok", { status: 200 });
    };

    const store = createWebhookStore(db, mockFetch as typeof fetch);
    await store.create({ url: "https://fail.example.com/hook", events: ["content.updated"] });
    await store.create({ url: "https://ok.example.com/hook", events: ["content.updated"] });

    await expect(store.dispatch("content.updated", { test: true })).resolves.not.toThrow();
    expect(callCount).toBe(2);
  });

  it("dispatch: skips webhooks not subscribed to the event", async () => {
    const db = makeDb();
    let callCount = 0;
    const mockFetch = async () => {
      callCount++;
      return new Response("ok", { status: 200 });
    };

    const store = createWebhookStore(db, mockFetch as typeof fetch);
    await store.create({ url: "https://media.example.com/hook", events: ["media.uploaded"] });

    await store.dispatch("content.published", { id: "x" });
    expect(callCount).toBe(0);
  });
});

// Type-level smoke test
function assertWebhookStoreShape(store: WebhookStore) {
  const _list = store.list;
  const _create = store.create;
  const _delete = store.delete;
  const _dispatch = store.dispatch;
  return { _list, _create, _delete, _dispatch };
}

void assertWebhookStoreShape;
