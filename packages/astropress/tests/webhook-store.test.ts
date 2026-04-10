import { describe, expect, it } from "vitest";

import type { WebhookEvent, WebhookRecord, WebhookStore } from "../src/platform-contracts";

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

describe("WebhookStore interface", () => {
  it.todo("create: generates a unique signing secret returned only once");
  it.todo("create: stores secret as hash — secret is not retrievable after creation");
  it.todo("list: returns only active (non-deleted) webhooks");
  it.todo("delete: soft-deletes webhook so it no longer appears in list");
  it.todo("dispatch: sends POST to all active webhooks subscribed to the event");
  it.todo("dispatch: includes X-Astropress-Signature header with valid HMAC-SHA256");
  it.todo("dispatch: partial failure (one URL errors) does not throw or block others");
  it.todo("dispatch: skips webhooks not subscribed to the fired event");
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
