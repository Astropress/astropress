import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { createAstropressProjectLaunchPlan } from "../src/project-launch.js";

describe("project launch", () => {
  it("builds a local launch plan with static hosting and no hosted data-services by default", async () => {
    const workspace = await mkdtemp(join(tmpdir(), "astropress-project-launch-local-"));
    const plan = createAstropressProjectLaunchPlan({
      env: {
        ASTROPRESS_RUNTIME_MODE: "local",
        ASTROPRESS_APP_HOST: "github-pages",
        ASTROPRESS_DATA_SERVICES: "none",
      },
      local: {
        workspaceRoot: workspace,
        dbPath: join(workspace, "admin.sqlite"),
      },
    });

    expect(plan.runtime.mode).toBe("local");
    expect(plan.provider).toBe("sqlite");
    expect(plan.appHost).toBe("github-pages");
    expect(plan.dataServices).toBe("none");
    expect(plan.requiresLocalSeed).toBe(true);
    expect(plan.recommendation.appHost).toBe("github-pages");
    expect(plan.recommendation.dataServices).toBe("none");

    await rm(workspace, { recursive: true, force: true });
  });

  it("builds a hosted launch plan that separates the app host from the service layer", () => {
    const plan = createAstropressProjectLaunchPlan({
      env: {
        ASTROPRESS_RUNTIME_MODE: "hosted",
        ASTROPRESS_APP_HOST: "vercel",
        ASTROPRESS_DATA_SERVICES: "supabase",
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

    expect(plan.runtime.mode).toBe("hosted");
    expect(plan.provider).toBe("supabase");
    expect(plan.appHost).toBe("vercel");
    expect(plan.dataServices).toBe("supabase");
    expect(plan.requiresLocalSeed).toBe(false);
    expect(plan.recommendation.appHost).toBe("vercel");
    expect(plan.recommendation.dataServices).toBe("supabase");
    expect(plan.deployTarget).toBe("vercel");
  });
});
