import { describe, expect, it } from "vitest";
import { createAstropressProjectScaffold } from "../src/project-scaffold.js";

describe("project scaffold", () => {
  it("returns static defaults by default", () => {
    const scaffold = createAstropressProjectScaffold();
    expect(scaffold.provider).toBe("sqlite");
    expect(scaffold.appHost).toBe("github-pages");
    expect(scaffold.dataServices).toBe("none");
    expect(scaffold.recommendedDeployTarget).toBe("github-pages");
    expect(scaffold.recommendationRationale).toMatch(/static/i);
    expect(scaffold.localEnv.ADMIN_DB_PATH).toBe(".data/admin.sqlite");
    expect(scaffold.localEnv.ASTROPRESS_APP_HOST).toBe("github-pages");
    expect(scaffold.localEnv.ASTROPRESS_CONTENT_SERVICES).toBe("none");
    expect(scaffold.localEnv.ASTROPRESS_DATA_SERVICES).toBeUndefined();
    expect(scaffold.localEnv.ADMIN_PASSWORD).toMatch(/^local-admin-/);
    expect(scaffold.localEnv.EDITOR_PASSWORD).toMatch(/^local-editor-/);
    expect(scaffold.localEnv.SESSION_SECRET).toHaveLength(43);
    expect(scaffold.packageScripts["doctor:strict"]).toBe("astropress doctor --strict");
    expect(scaffold.ciFiles[".github/workflows/deploy-astropress.yml"]).toContain("deploy-pages");
    expect(scaffold.deployDoc).toContain("Content Services");
    expect(scaffold.envExample.ADMIN_PASSWORD).toBe("replace-with-a-generated-local-admin-password");
    expect(scaffold.envExample.SESSION_SECRET).toBe("replace-with-a-long-random-session-secret");
  });

  it("returns service-specific remote examples", () => {
    const supabase = createAstropressProjectScaffold("supabase");
    const runway = createAstropressProjectScaffold("runway");
    const firebase = createAstropressProjectScaffold({
      appHost: "render-web",
      dataServices: "firebase",
    });

    expect(supabase.appHost).toBe("vercel");
    expect(supabase.dataServices).toBe("supabase");
    expect(supabase.contentServices).toBe("supabase");
    expect(supabase.envExample.SUPABASE_URL).toBe("https://your-project.supabase.co");
    expect(supabase.envExample.ASTROPRESS_CONTENT_SERVICES).toBe("supabase");
    expect(supabase.envExample.ASTROPRESS_SERVICE_ORIGIN).toContain("functions/v1/astropress");
    expect(supabase.envExample.ASTROPRESS_DATA_SERVICES).toBeUndefined();
    expect(supabase.localEnv.ASTROPRESS_DEPLOY_TARGET).toBeUndefined();
    expect(supabase.packageScripts["deploy:vercel"]).toContain("vercel deploy");
    expect(runway.envExample.RUNWAY_API_TOKEN).toBe("replace-me");
    expect(runway.envExample.ASTROPRESS_DATA_SERVICES).toBeUndefined();
    expect(runway.localEnv.ASTROPRESS_DEPLOY_TARGET).toBeUndefined();
    expect(firebase.envExample.FIREBASE_PROJECT_ID).toBe("replace-me");
    expect(firebase.appHost).toBe("render-web");
    expect(firebase.dataServices).toBe("firebase");
    expect(firebase.ciFiles[".github/workflows/deploy-astropress.yml"]).toContain("RENDER_DEPLOY_HOOK_URL");
  });
});
