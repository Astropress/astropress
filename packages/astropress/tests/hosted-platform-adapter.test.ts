import { describe, expect, it } from "vitest";
import type {
  AuthStore,
  ContentStore,
  MediaStore,
  RevisionStore,
} from "../src/platform-contracts";
import { createAstropressHostedPlatformAdapter } from "../src/hosted-platform-adapter.js";
import { createAstropressHostedAdapter } from "../src/adapters/hosted.js";

describe("hosted platform adapter", () => {
  it("assembles a hosted provider from explicit store modules", async () => {
    const records = new Map<string, string>();
    const content: ContentStore = {
      async list() {
        return [...records.entries()].map(([id, title]) => ({
          id,
          kind: "post" as const,
          slug: id,
          status: "published" as const,
          title,
        }));
      },
      async get(id) {
        const title = records.get(id);
        return title
          ? {
              id,
              kind: "post",
              slug: id,
              status: "published",
              title,
            }
          : null;
      },
      async save(record) {
        records.set(record.id, String(record.title ?? record.id));
        return record;
      },
      async delete(id) {
        records.delete(id);
      },
    };

    const media: MediaStore = {
      async put(asset) {
        return asset;
      },
      async get() {
        return null;
      },
      async delete() {},
    };

    const revisions: RevisionStore = {
      async list() {
        return [];
      },
      async append(revision) {
        return revision;
      },
    };

    const auth: AuthStore = {
      async signIn(email) {
        return { id: "supabase-session-1", email, role: "admin" };
      },
      async signOut() {},
      async getSession(sessionId) {
        return { id: sessionId, email: "admin@example.com", role: "admin" };
      },
    };

    const adapter = createAstropressHostedPlatformAdapter({
      providerName: "supabase",
      content,
      media,
      revisions,
      auth,
      defaultCapabilities: {
        staticPublishing: false,
      },
    });

    expect(adapter.capabilities.name).toBe("supabase");
    expect(adapter.capabilities.hostedAdmin).toBe(true);

    await adapter.content.save({
      id: "remote-post",
      kind: "post",
      slug: "remote-post",
      status: "published",
      title: "Remote post",
    });

    expect(await adapter.content.get("remote-post")).toMatchObject({
      slug: "remote-post",
      title: "Remote post",
    });
    expect(await adapter.auth.signIn("admin@example.com", "password")).toMatchObject({
      email: "admin@example.com",
      role: "admin",
    });
  });
});

