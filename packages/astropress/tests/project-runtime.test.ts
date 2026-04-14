import { describe, expect, it } from "vitest";
import { createAstropressProjectRuntimePlan } from "../src/project-runtime.js";

describe("project runtime", () => {
  it("builds a hosted runtime plan from project env", async () => {
    const plan = createAstropressProjectRuntimePlan({
      env: {
        ASTROPRESS_RUNTIME_MODE: "hosted",
        ASTROPRESS_HOSTED_PROVIDER: "supabase",
        SUPABASE_URL: "https://runtime.supabase.co",
        SUPABASE_SERVICE_ROLE_KEY: "service",
      },
      hosted: {
        content: {
          async list() {
            return [];
          },
          async get() {
            return null;
          },
          async save(record) {
            return record;
          },
          async delete() {},
        },
        media: {
          async put(asset) {
            return asset;
          },
          async get() {
            return null;
          },
          async delete() {},
        },
        revisions: {
          async list() {
            return [];
          },
          async append(revision) {
            return revision;
          },
        },
        auth: {
          async signIn(email) {
            return { id: "runtime-session", email, role: "admin" as const };
          },
          async signOut() {},
          async getSession(sessionId) {
            return { id: sessionId, email: "admin@example.com", role: "admin" as const };
          },
        },
      },
    });

    expect(plan.mode).toBe("hosted");
    expect(plan.env.hostedProvider).toBe("supabase");
    expect(plan.adapter.capabilities.name).toBe("supabase");
  });

  it("falls back to process.env when no env option is provided", () => {
    // Covers the `options.env ?? process.env` right-branch
    const plan = createAstropressProjectRuntimePlan({});
    expect(plan.env).toBeDefined();
    expect(typeof plan.env.localProvider).toBe("string");
  });
});
