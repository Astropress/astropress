import { describe, expect, it } from "vitest";
import {
  resolveAstropressAppHostFromEnv,
  resolveAstropressDataServicesFromEnv,
  resolveAstropressDeployTarget,
  resolveAstropressHostedProviderFromEnv,
  resolveAstropressLocalProviderFromEnv,
  resolveAstropressProjectEnvContract,
  resolveAstropressServiceOriginFromEnv,
} from "../src/project-env.js";

describe("project env", () => {
  it("resolves app host defaults and legacy mappings", () => {
    expect(resolveAstropressAppHostFromEnv({})).toBe("github-pages");
    expect(resolveAstropressAppHostFromEnv({ ASTROPRESS_APP_HOST: "vercel" })).toBe("vercel");
    expect(resolveAstropressAppHostFromEnv({ ASTROPRESS_DEPLOY_TARGET: "cloudflare" })).toBe(
      "cloudflare-pages",
    );
  });

  it("resolves data-services defaults and explicit values", () => {
    expect(resolveAstropressDataServicesFromEnv({})).toBe("none");
    expect(resolveAstropressDataServicesFromEnv({ ASTROPRESS_CONTENT_SERVICES: "appwrite" })).toBe(
      "appwrite",
    );
    expect(resolveAstropressDataServicesFromEnv({ ASTROPRESS_DATA_SERVICES: "firebase" })).toBe(
      "firebase",
    );
    expect(
      resolveAstropressDataServicesFromEnv({ ASTROPRESS_LOCAL_PROVIDER: "supabase" }),
    ).toBe("supabase");
  });

  it("resolves local provider defaults from the data-services choice", () => {
    expect(resolveAstropressLocalProviderFromEnv({})).toBe("sqlite");
    expect(resolveAstropressLocalProviderFromEnv({ ASTROPRESS_LOCAL_PROVIDER: "supabase" })).toBe(
      "supabase",
    );
    expect(resolveAstropressLocalProviderFromEnv({ ASTROPRESS_DATA_SERVICES: "runway" })).toBe(
      "runway",
    );
    expect(resolveAstropressLocalProviderFromEnv({ ASTROPRESS_DATA_SERVICES: "firebase" })).toBe(
      "sqlite",
    );
  });

  it("resolves hosted provider defaults", () => {
    expect(resolveAstropressHostedProviderFromEnv({})).toBe("supabase");
    expect(resolveAstropressHostedProviderFromEnv({ ASTROPRESS_HOSTED_PROVIDER: "runway" })).toBe(
      "runway",
    );
  });

  it("resolves deploy targets from explicit values or the app-host selection", () => {
    expect(resolveAstropressDeployTarget({})).toBe("github-pages");
    expect(resolveAstropressDeployTarget({ ASTROPRESS_APP_HOST: "cloudflare-pages" })).toBe(
      "cloudflare",
    );
    expect(resolveAstropressDeployTarget({ ASTROPRESS_APP_HOST: "vercel" })).toBe("vercel");
  });

  it("returns a single resolved project env contract", () => {
    expect(
      resolveAstropressProjectEnvContract({
        ASTROPRESS_APP_HOST: "netlify",
        ASTROPRESS_CONTENT_SERVICES: "supabase",
        ASTROPRESS_HOSTED_PROVIDER: "supabase",
        ASTROPRESS_SERVICE_ORIGIN: "https://example.supabase.co/functions/v1/astropress",
        ADMIN_DB_PATH: ".data/custom-admin.sqlite",
      }),
    ).toEqual({
      localProvider: "supabase",
      hostedProvider: "supabase",
      deployTarget: "netlify",
      appHost: "netlify",
      dataServices: "supabase",
      contentServices: "supabase",
      serviceOrigin: "https://example.supabase.co/functions/v1/astropress",
      adminDbPath: ".data/custom-admin.sqlite",
    });
  });

  it("derives service origins from hosted env where possible", () => {
    expect(resolveAstropressServiceOriginFromEnv({})).toBeNull();
    expect(
      resolveAstropressServiceOriginFromEnv({
        ASTROPRESS_CONTENT_SERVICES: "supabase",
        SUPABASE_URL: "https://demo.supabase.co",
      }),
    ).toBe("https://demo.supabase.co/functions/v1/astropress");
  });

  it("derives the default admin db path from the resolved local provider", () => {
    expect(resolveAstropressProjectEnvContract({}).adminDbPath).toBe(".data/admin.sqlite");
    expect(
      resolveAstropressProjectEnvContract({
        ASTROPRESS_DATA_SERVICES: "supabase",
      }).adminDbPath,
    ).toBe(".data/supabase-admin.sqlite");
    expect(
      resolveAstropressProjectEnvContract({
        ASTROPRESS_DATA_SERVICES: "runway",
      }).adminDbPath,
    ).toBe(".data/runway-admin.sqlite");
  });
});
