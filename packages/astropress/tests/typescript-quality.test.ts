/**
 * Tests for TypeScript quality features:
 * - Branded ID types (ContentId, MediaAssetId, AdminUserId, ApiTokenId, AuditEventId)
 * - ActionResult discriminated union
 */

import { describe, expect, it } from "vitest";
import type {
  ContentId,
  MediaAssetId,
  AdminUserId,
  ApiTokenId,
  AuditEventId,
  ActionResult,
} from "../src/platform-contracts";

describe("Branded ID types", () => {
  it("ContentId is exported from platform-contracts", () => {
    // Type-level test: if this compiles, the type is exported and assignable
    const id = "record-123" as ContentId;
    expect(id).toBe("record-123");
  });

  it("MediaAssetId is exported from platform-contracts", () => {
    const id = "asset-456" as MediaAssetId;
    expect(id).toBe("asset-456");
  });

  it("AdminUserId is exported from platform-contracts", () => {
    const id = "user-789" as AdminUserId;
    expect(id).toBe("user-789");
  });

  it("ApiTokenId is exported from platform-contracts", () => {
    const id = "token-abc" as ApiTokenId;
    expect(id).toBe("token-abc");
  });

  it("AuditEventId is exported from platform-contracts", () => {
    const id = "event-def" as AuditEventId;
    expect(id).toBe("event-def");
  });

  it("branded string is still a string at runtime", () => {
    const id = "record-123" as ContentId;
    expect(typeof id).toBe("string");
    expect(String(id)).toBe("record-123");
  });
});

describe("ActionResult discriminated union", () => {
  it("ok result carries data", () => {
    const result: ActionResult<{ title: string }> = { ok: true, data: { title: "Hello" } };
    if (result.ok) {
      expect(result.data.title).toBe("Hello");
    }
    expect(result.ok).toBe(true);
  });

  it("error result carries error string", () => {
    const result: ActionResult<never> = { ok: false, error: "Not found", code: "not_found" };
    if (!result.ok) {
      expect(result.error).toBe("Not found");
      expect(result.code).toBe("not_found");
    }
    expect(result.ok).toBe(false);
  });

  it("error result code is optional", () => {
    const result: ActionResult<string> = { ok: false, error: "Validation failed" };
    if (!result.ok) {
      expect(result.code).toBeUndefined();
    }
  });

  it("discriminant narrows type correctly", () => {
    function getResult(succeed: boolean): ActionResult<number> {
      if (succeed) return { ok: true, data: 42 };
      return { ok: false, error: "Failed" };
    }

    const ok = getResult(true);
    const fail = getResult(false);

    expect(ok.ok).toBe(true);
    if (ok.ok) expect(ok.data).toBe(42);

    expect(fail.ok).toBe(false);
    if (!fail.ok) expect(fail.error).toBe("Failed");
  });
});
