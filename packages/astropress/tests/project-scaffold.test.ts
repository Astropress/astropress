import { describe, expect, it } from "vitest";
import { createAstropressProjectScaffold } from "../src/project-scaffold.js";

describe("project scaffold — additional provider/host combinations", () => {
  it("pocketbase scaffold produces correct env example keys", () => {
    const scaffold = createAstropressProjectScaffold({ appHost: "render-web", dataServices: "pocketbase" });
    expect(scaffold.dataServices).toBe("pocketbase");
    expect(scaffold.appHost).toBe("render-web");
    expect(scaffold.envExample.POCKETBASE_URL).toBeDefined();
    expect(scaffold.envExample.POCKETBASE_EMAIL).toBeDefined();
  });

  it("nhost scaffold produces correct env example keys", () => {
    const scaffold = createAstropressProjectScaffold({ appHost: "render-web", dataServices: "nhost" });
    expect(scaffold.dataServices).toBe("nhost");
    expect(scaffold.envExample.NHOST_SUBDOMAIN).toBeDefined();
    expect(scaffold.envExample.NHOST_REGION).toBeDefined();
  });

  it("neon scaffold produces correct env example keys", () => {
    const scaffold = createAstropressProjectScaffold({ appHost: "render-web", dataServices: "neon" });
    expect(scaffold.dataServices).toBe("neon");
    expect(scaffold.envExample.NEON_DATABASE_URL).toBeDefined();
  });

  it("custom scaffold produces ASTROPRESS_SERVICE_ORIGIN in env example", () => {
    const scaffold = createAstropressProjectScaffold({ appHost: "custom", dataServices: "custom" });
    expect(scaffold.dataServices).toBe("custom");
    expect(scaffold.envExample.ASTROPRESS_SERVICE_ORIGIN).toBeDefined();
  });

  it("appwrite scaffold produces correct env example keys", () => {
    const scaffold = createAstropressProjectScaffold({ appHost: "render-web", dataServices: "appwrite" });
    expect(scaffold.dataServices).toBe("appwrite");
    expect(scaffold.envExample.APPWRITE_ENDPOINT).toBeDefined();
    expect(scaffold.envExample.APPWRITE_PROJECT_ID).toBeDefined();
  });

  it("firebase-hosting appHost produces firebase-hosting deploy script", () => {
    const scaffold = createAstropressProjectScaffold({ appHost: "firebase-hosting", dataServices: "firebase" });
    expect(scaffold.packageScripts["deploy:firebase-hosting"]).toContain("firebase deploy");
    expect(scaffold.ciFiles[".github/workflows/deploy-astropress.yml"]).toContain("FIREBASE_TOKEN");
  });

  it("render-static appHost produces render-static deploy script", () => {
    const scaffold = createAstropressProjectScaffold({ appHost: "render-static", dataServices: "none" });
    expect(scaffold.packageScripts["deploy:render-static"]).toContain("astro build");
  });

  it("gitlab-pages appHost produces .gitlab-ci.yml CI file (not GitHub Actions)", () => {
    const scaffold = createAstropressProjectScaffold({ appHost: "gitlab-pages", dataServices: "none" });
    expect(scaffold.packageScripts["deploy:gitlab-pages"]).toContain("astro build");
    expect(scaffold.ciFiles[".gitlab-ci.yml"]).toContain("pages");
    expect(scaffold.ciFiles[".github/workflows/deploy-astropress.yml"]).toBeUndefined();
  });

  it("runway appHost produces runway deploy script and CI workflow", () => {
    const scaffold = createAstropressProjectScaffold({ appHost: "runway", dataServices: "runway" });
    expect(scaffold.packageScripts["deploy:runway"]).toContain("astro build");
    expect(scaffold.ciFiles[".github/workflows/deploy-astropress.yml"]).toContain("Runway");
  });

  it("netlify appHost produces netlify deploy script and CI workflow", () => {
    const scaffold = createAstropressProjectScaffold({ appHost: "netlify", dataServices: "none" });
    expect(scaffold.packageScripts["deploy:netlify"]).toContain("netlify deploy");
    expect(scaffold.ciFiles[".github/workflows/deploy-astropress.yml"]).toContain("NETLIFY_AUTH_TOKEN");
  });

  it("render-web appHost produces render-web CI workflow with RENDER_DEPLOY_HOOK_URL", () => {
    const scaffold = createAstropressProjectScaffold({ appHost: "render-web", dataServices: "firebase" });
    expect(scaffold.packageScripts["deploy:render-web"]).toContain("astro build");
    expect(scaffold.ciFiles[".github/workflows/deploy-astropress.yml"]).toContain("RENDER_DEPLOY_HOOK_URL");
  });

  it("null-like dataServices defaults to github-pages appHost", () => {
    const scaffold = createAstropressProjectScaffold({ appHost: "github-pages", dataServices: "none" });
    expect(scaffold.appHost).toBe("github-pages");
    expect(scaffold.recommendedDeployTarget).toBe("github-pages");
  });

  it("infers appHost=cloudflare-pages from dataServices=cloudflare when appHost omitted (line 84 branch)", () => {
    const scaffold = createAstropressProjectScaffold({ dataServices: "cloudflare" } as Parameters<typeof createAstropressProjectScaffold>[0]);
    expect(scaffold.appHost).toBe("cloudflare-pages");
    expect(scaffold.dataServices).toBe("cloudflare");
  });

  it("infers appHost=vercel from dataServices=supabase when appHost omitted (line 86 branch)", () => {
    // Also hits deriveLegacyProvider("supabase") → "supabase" (line 20-21)
    const scaffold = createAstropressProjectScaffold({ dataServices: "supabase" } as Parameters<typeof createAstropressProjectScaffold>[0]);
    expect(scaffold.appHost).toBe("vercel");
    expect(scaffold.dataServices).toBe("supabase");
    expect(scaffold.provider).toBe("supabase");
  });

  it("infers appHost=runway from dataServices=runway when appHost omitted (line 88 branch)", () => {
    const scaffold = createAstropressProjectScaffold({ dataServices: "runway" } as Parameters<typeof createAstropressProjectScaffold>[0]);
    expect(scaffold.appHost).toBe("runway");
    expect(scaffold.dataServices).toBe("runway");
  });

  it("infers appHost=render-web from dataServices=pocketbase when appHost omitted (line 90 branch)", () => {
    const scaffold = createAstropressProjectScaffold({ dataServices: "pocketbase" } as Parameters<typeof createAstropressProjectScaffold>[0]);
    expect(scaffold.appHost).toBe("render-web");
    expect(scaffold.dataServices).toBe("pocketbase");
  });

  it("derives dataServices from legacyProvider=supabase when dataServices omitted (line 78 branch)", () => {
    const scaffold = createAstropressProjectScaffold({ legacyProvider: "supabase" } as Parameters<typeof createAstropressProjectScaffold>[0]);
    expect(scaffold.dataServices).toBe("supabase");
  });

  it("derives dataServices from legacyProvider=runway when dataServices omitted (line 80 branch)", () => {
    const scaffold = createAstropressProjectScaffold({ legacyProvider: "runway" } as Parameters<typeof createAstropressProjectScaffold>[0]);
    expect(scaffold.dataServices).toBe("runway");
  });

  it("defaults dataServices to none when no dataServices or legacyProvider set (line 81 branch)", () => {
    // input.dataServices is undefined AND input.legacyProvider is undefined → falls to "none"
    const scaffold = createAstropressProjectScaffold({ appHost: "netlify" } as Parameters<typeof createAstropressProjectScaffold>[0]);
    expect(scaffold.dataServices).toBe("none");
  });

  it("defaults appHost to github-pages when dataServices is none and appHost omitted (line 91 branch)", () => {
    // dataServices = "none" → none of the ternary arms match → "github-pages"
    const scaffold = createAstropressProjectScaffold({ dataServices: "none" } as Parameters<typeof createAstropressProjectScaffold>[0]);
    expect(scaffold.appHost).toBe("github-pages");
  });
});

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
    expect(scaffold.localEnv.ADMIN_PASSWORD).toMatch(/^[^-]+-[^-]+-[^-]+-[^-]+$/);
    expect(scaffold.localEnv.EDITOR_PASSWORD).toMatch(/^[^-]+-[^-]+-[^-]+-[^-]+$/);
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
