import { describe, expect, it } from "vitest";

import type { ContentStoreRecord } from "../src/platform-contracts";

describe("ContentStoreRecord scheduledAt field", () => {
  it("scheduledAt is optional on ContentStoreRecord", () => {
    const record: ContentStoreRecord = {
      id: "rec_01",
      kind: "post",
      slug: "my-post",
      status: "draft",
    };
    expect(record.scheduledAt).toBeUndefined();
  });

  it("scheduledAt can be set to an ISO string", () => {
    const scheduled = "2026-06-01T09:00:00Z";
    const record: ContentStoreRecord = {
      id: "rec_02",
      kind: "post",
      slug: "future-post",
      status: "draft",
      scheduledAt: scheduled,
    };
    expect(record.scheduledAt).toBe(scheduled);
  });

  it("scheduledAt can be null (cleared)", () => {
    const record: ContentStoreRecord = {
      id: "rec_03",
      kind: "post",
      slug: "unscheduled-post",
      status: "draft",
      scheduledAt: null,
    };
    expect(record.scheduledAt).toBeNull();
  });
});

describe("Content scheduling store operations", () => {
  it.todo("scheduleContentPublish sets scheduled_at and keeps status as draft");
  it.todo("listScheduledContent returns only records with a future scheduled_at");
  it.todo("cancelScheduledPublish clears scheduled_at leaving status as draft");
  it.todo("scheduler run publishes records whose scheduled_at is in the past");
  it.todo("scheduling a post does not immediately make it publicly visible");
});
