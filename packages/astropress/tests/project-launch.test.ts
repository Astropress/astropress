import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { createAstropressProjectLaunchPlan } from "../src/project-launch.js";

describe("project launch", () => {
  it("builds a local launch plan with sqlite bootstrap expectations", async () => {
    const workspace = await mkdtemp(join(tmpdir(), "astropress-project-launch-local-"));
    const plan = createAstropressProjectLaunchPlan({
      env: {
        ASTROPRESS_RUNTIME_MODE: "local",
        ASTROPRESS_LOCAL_PROVIDER: "sqlite",
        ASTROPRESS_DEPLOY_TARGET: "github-pages",
      },
      local: {
        workspaceRoot: workspace,
        dbPath: join(workspace, "admin.sqlite"),
      },
    });

    expect(plan.runtime.mode).toBe("local");
    expect(plan.provider).toBe("sqlite");
    expect(plan.requiresLocalSeed).toBe(true);
    expect(plan.recommendation.canonicalProvider).toBe("cloudflare");
    expect(plan.recommendation.publicDeployTarget).toBe("github-pages");

    await rm(workspace, { recursive: true, force: true });
  });

  it("builds a hosted launch plan without local seeding", () => {
    const plan = createAstropressProjectLaunchPlan({
      env: {
        ASTROPRESS_RUNTIME_MODE: "hosted",
        ASTROPRESS_HOSTED_PROVIDER: "supabase",
        ASTROPRESS_DEPLOY_TARGET: "supabase",
        SUPABASE_URL: "https://runtime.supabase.co",
        SUPABASE_ANON_KEY: "anon",
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

    expect(plan.runtime.mode).toBe("hosted");
    expect(plan.provider).toBe("supabase");
    expect(plan.requiresLocalSeed).toBe(false);
    expect(plan.recommendation.canonicalProvider).toBe("supabase");
    expect(plan.deployTarget).toBe("supabase");
  });
});
