import { describe, expect, it } from "vitest";
import {
  assertProviderContract,
  normalizeProviderCapabilities,
  type AstropressPlatformAdapter,
  type ContentStoreRecord,
  type MediaAssetRecord,
  type RevisionRecord,
  type AuthUser,
} from "astropress";

function createInMemoryAdapter(): AstropressPlatformAdapter {
  const records = new Map<string, ContentStoreRecord>();
  const media = new Map<string, MediaAssetRecord>();
  const revisions = new Map<string, RevisionRecord[]>();
  const sessions = new Map<string, AuthUser>();

  return {
    capabilities: normalizeProviderCapabilities({
      name: "custom",
      hostedAdmin: true,
      database: true,
      gitSync: true,
    }),
    content: {
      async list(kind) {
        return [...records.values()].filter((record) => !kind || record.kind === kind);
      },
      async get(id) {
        return records.get(id) ?? null;
      },
      async save(record) {
        records.set(record.id, record);
        return record;
      },
      async delete(id) {
        records.delete(id);
      },
    },
    media: {
      async put(asset) {
        media.set(asset.id, asset);
        return asset;
      },
      async get(id) {
        return media.get(id) ?? null;
      },
      async delete(id) {
        media.delete(id);
      },
    },
    revisions: {
      async list(recordId) {
        return revisions.get(recordId) ?? [];
      },
      async append(revision) {
        const existing = revisions.get(revision.recordId) ?? [];
        existing.push(revision);
        revisions.set(revision.recordId, existing);
        return revision;
      },
    },
    auth: {
      async signIn(email) {
        const user = { id: "u1", email, role: "admin" as const };
        sessions.set("session-1", user);
        return user;
      },
      async signOut(sessionId) {
        sessions.delete(sessionId);
      },
      async getSession(sessionId) {
        return sessions.get(sessionId) ?? null;
      },
    },
    gitSync: {
      async exportSnapshot(targetDir) {
        return { targetDir, fileCount: 4 };
      },
      async importSnapshot(sourceDir) {
        return { sourceDir, fileCount: 4 };
      },
    },
  };
}

describe("platform contracts", () => {
  it("fills omitted capability flags with false and preserves explicitly set flags", () => {
    const result = normalizeProviderCapabilities({ name: "supabase", database: true });
    expect(result.name).toBe("supabase");
    expect(result.database).toBe(true);
    const defaultFalseFlags = ["staticPublishing", "hostedAdmin", "previewEnvironments", "serverRuntime", "objectStorage", "gitSync"] as const;
    for (const flag of defaultFalseFlags) {
      expect(result[flag]).toBe(false);
    }
  });

  it("preserves unknown provider names as-is", () => {
    const result = normalizeProviderCapabilities({ name: "my-custom-provider" });
    expect(result.name).toBe("my-custom-provider");
  });

  it("accepts an adapter that satisfies the required contracts", async () => {
    const adapter = assertProviderContract(createInMemoryAdapter());
    const saved = await adapter.content.save({
      id: "page-1",
      kind: "page",
      slug: "home",
      status: "draft",
      title: "Home",
    });

    expect(saved.slug).toBe("home");
    expect((await adapter.content.list("page")).length).toBe(1);
  });

  it("rejects adapters that omit required stores", () => {
    expect(() =>
      assertProviderContract({
        capabilities: normalizeProviderCapabilities({ name: "custom" }),
      } as unknown as AstropressPlatformAdapter),
    ).toThrow(/missing one or more required stores/i);
  });

  it("rejects adapters with no capabilities name", () => {
    expect(() =>
      assertProviderContract({
        ...createInMemoryAdapter(),
        capabilities: { ...normalizeProviderCapabilities({ name: "" }) },
      }),
    ).toThrow(/must declare a name/i);
  });

  it("supports full content CRUD lifecycle", async () => {
    const adapter = assertProviderContract(createInMemoryAdapter());

    const record = await adapter.content.save({ id: "post-1", kind: "post", slug: "hello", status: "draft", title: "Hello" });
    expect(record.id).toBe("post-1");

    const fetched = await adapter.content.get("post-1");
    expect(fetched?.slug).toBe("hello");

    const all = await adapter.content.list("post");
    expect(all).toHaveLength(1);

    await adapter.content.delete("post-1");
    expect(await adapter.content.get("post-1")).toBeNull();
    expect(await adapter.content.list("post")).toHaveLength(0);
  });
});
