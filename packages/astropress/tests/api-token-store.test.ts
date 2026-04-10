import { describe, expect, it } from "vitest";

import type { ApiScope, ApiTokenRecord, ApiTokenStore } from "../src/platform-contracts";

// Contract-level tests — verify the ApiTokenStore interface shape and behaviour.
// SQLite implementation tests are colocated with the implementation in Commit 3.

describe("ApiTokenRecord shape", () => {
  it("has all required fields", () => {
    const record: ApiTokenRecord = {
      id: "tok_01",
      label: "AI assistant",
      scopes: ["content:read"],
      createdAt: new Date().toISOString(),
    };

    expect(record.id).toBe("tok_01");
    expect(record.label).toBe("AI assistant");
    expect(record.scopes).toContain("content:read");
    expect(record.revokedAt).toBeUndefined();
  });

  it("supports all defined scopes", () => {
    const allScopes: ApiScope[] = [
      "content:read",
      "content:write",
      "media:read",
      "media:write",
      "settings:read",
      "webhooks:manage",
    ];
    const record: ApiTokenRecord = {
      id: "tok_02",
      label: "Full access",
      scopes: allScopes,
      createdAt: new Date().toISOString(),
    };
    expect(record.scopes).toHaveLength(6);
  });

  it("optional fields are truly optional", () => {
    const minimal: ApiTokenRecord = {
      id: "tok_03",
      label: "Minimal",
      scopes: ["settings:read"],
      createdAt: "2026-01-01T00:00:00Z",
    };
    expect(minimal.expiresAt).toBeUndefined();
    expect(minimal.lastUsedAt).toBeUndefined();
    expect(minimal.revokedAt).toBeUndefined();
  });
});

describe("ApiTokenStore interface", () => {
  it.todo("create: stores hashed token and returns raw token once");
  it.todo("create: generated raw token is at least 32 characters");
  it.todo("list: returns tokens without exposing the hash");
  it.todo("verify: valid token returns { valid: true, record }");
  it.todo("verify: revoked token returns { valid: false }");
  it.todo("verify: unknown token returns { valid: false }");
  it.todo("verify: updates lastUsedAt on successful verification");
  it.todo("revoke: sets revokedAt and subsequent verify fails");
});

// Type-level smoke test: ensure the interface is structurally correct
function assertApiTokenStoreShape(store: ApiTokenStore) {
  const _create = store.create;
  const _list = store.list;
  const _verify = store.verify;
  const _revoke = store.revoke;
  return { _create, _list, _verify, _revoke };
}

// Unused reference satisfies TypeScript without needing a real implementation
void assertApiTokenStoreShape;
