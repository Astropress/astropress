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

describe("resolveAstropressAppHostFromEnv — additional branches", () => {
  it("returns each explicit ASTROPRESS_APP_HOST value verbatim", () => {
    const hosts = ["render-web", "firebase-hosting", "gitlab-pages", "render-static", "runway", "netlify", "custom"] as const;
    for (const host of hosts) {
      expect(resolveAstropressAppHostFromEnv({ ASTROPRESS_APP_HOST: host })).toBe(host);
    }
  });

  it("falls back to ASTROPRESS_WEB_HOST when ASTROPRESS_APP_HOST is absent", () => {
    expect(resolveAstropressAppHostFromEnv({ ASTROPRESS_WEB_HOST: "netlify" })).toBe("netlify");
  });

  it("maps legacy ASTROPRESS_LOCAL_PROVIDER=supabase → vercel via data-services chain", () => {
    expect(resolveAstropressAppHostFromEnv({ ASTROPRESS_LOCAL_PROVIDER: "supabase" })).toBe("vercel");
  });

  it("maps legacy ASTROPRESS_HOSTED_PROVIDER=firebase → render-web via data-services chain", () => {
    expect(resolveAstropressAppHostFromEnv({ ASTROPRESS_HOSTED_PROVIDER: "firebase" })).toBe("render-web");
  });

  it("maps legacy ASTROPRESS_HOSTED_PROVIDER=appwrite → render-web via data-services chain", () => {
    expect(resolveAstropressAppHostFromEnv({ ASTROPRESS_HOSTED_PROVIDER: "appwrite" })).toBe("render-web");
  });

  it("maps legacy ASTROPRESS_HOSTED_PROVIDER=runway → runway via data-services chain", () => {
    expect(resolveAstropressAppHostFromEnv({ ASTROPRESS_HOSTED_PROVIDER: "runway" })).toBe("runway");
  });

  it("maps ASTROPRESS_DEPLOY_TARGET=github-pages → github-pages via legacy deploy target mapper", () => {
    expect(resolveAstropressAppHostFromEnv({ ASTROPRESS_DEPLOY_TARGET: "github-pages" })).toBe("github-pages");
  });

  it("maps ASTROPRESS_DEPLOY_TARGET=vercel → vercel via legacy deploy target mapper", () => {
    expect(resolveAstropressAppHostFromEnv({ ASTROPRESS_DEPLOY_TARGET: "vercel" })).toBe("vercel");
  });

  it("maps ASTROPRESS_DEPLOY_TARGET=netlify → netlify via legacy deploy target mapper", () => {
    expect(resolveAstropressAppHostFromEnv({ ASTROPRESS_DEPLOY_TARGET: "netlify" })).toBe("netlify");
  });

  it("maps ASTROPRESS_DEPLOY_TARGET=render-static → render-static via legacy deploy target mapper", () => {
    expect(resolveAstropressAppHostFromEnv({ ASTROPRESS_DEPLOY_TARGET: "render-static" })).toBe("render-static");
  });

  it("maps ASTROPRESS_DEPLOY_TARGET=render-web → render-web via legacy deploy target mapper", () => {
    expect(resolveAstropressAppHostFromEnv({ ASTROPRESS_DEPLOY_TARGET: "render-web" })).toBe("render-web");
  });

  it("maps ASTROPRESS_DEPLOY_TARGET=cloudflare → cloudflare-pages via data-services chain", () => {
    // non-cloudflare deploy target does NOT produce a legacyDeployTarget early-return,
    // so cloudflare data-services branch is hit instead
    expect(resolveAstropressAppHostFromEnv({ ASTROPRESS_DEPLOY_TARGET: "cloudflare" })).toBe("cloudflare-pages");
  });

  it("maps ASTROPRESS_DEPLOY_TARGET=gitlab-pages → gitlab-pages via legacy deploy target mapper", () => {
    expect(resolveAstropressAppHostFromEnv({ ASTROPRESS_DEPLOY_TARGET: "gitlab-pages" })).toBe("gitlab-pages");
  });

  it("maps ASTROPRESS_DEPLOY_TARGET=firebase-hosting → firebase-hosting via legacy deploy target mapper", () => {
    expect(resolveAstropressAppHostFromEnv({ ASTROPRESS_DEPLOY_TARGET: "firebase-hosting" })).toBe("firebase-hosting");
  });

  it("maps ASTROPRESS_DEPLOY_TARGET=runway → runway via legacy deploy target mapper", () => {
    expect(resolveAstropressAppHostFromEnv({ ASTROPRESS_DEPLOY_TARGET: "runway" })).toBe("runway");
  });
});

describe("resolveAstropressHostedProviderFromEnv — additional branches", () => {
  it("returns pocketbase when ASTROPRESS_HOSTED_PROVIDER=pocketbase", () => {
    expect(resolveAstropressHostedProviderFromEnv({ ASTROPRESS_HOSTED_PROVIDER: "pocketbase" })).toBe("pocketbase");
  });

  it("returns appwrite when ASTROPRESS_HOSTED_PROVIDER=appwrite", () => {
    expect(resolveAstropressHostedProviderFromEnv({ ASTROPRESS_HOSTED_PROVIDER: "appwrite" })).toBe("appwrite");
  });

  it("returns firebase when ASTROPRESS_HOSTED_PROVIDER=firebase", () => {
    expect(resolveAstropressHostedProviderFromEnv({ ASTROPRESS_HOSTED_PROVIDER: "firebase" })).toBe("firebase");
  });

  it("returns pocketbase when ASTROPRESS_DATA_SERVICES=pocketbase (fallback from dataServices)", () => {
    expect(resolveAstropressHostedProviderFromEnv({ ASTROPRESS_DATA_SERVICES: "pocketbase" })).toBe("pocketbase");
  });

  it("returns firebase when ASTROPRESS_DATA_SERVICES=firebase (fallback from dataServices)", () => {
    expect(resolveAstropressHostedProviderFromEnv({ ASTROPRESS_DATA_SERVICES: "firebase" })).toBe("firebase");
  });

  it("returns appwrite when ASTROPRESS_DATA_SERVICES=appwrite (fallback from dataServices)", () => {
    expect(resolveAstropressHostedProviderFromEnv({ ASTROPRESS_DATA_SERVICES: "appwrite" })).toBe("appwrite");
  });
});

describe("resolveAstropressServiceOriginFromEnv — additional branches", () => {
  it("returns firebase service origin from FIREBASE_PROJECT_ID", () => {
    expect(
      resolveAstropressServiceOriginFromEnv({
        ASTROPRESS_DATA_SERVICES: "firebase",
        FIREBASE_PROJECT_ID: "my-project",
      }),
    ).toBe("https://my-project.firebaseapp.com/astropress-api");
  });

  it("returns null when firebase is selected but FIREBASE_PROJECT_ID is absent", () => {
    expect(
      resolveAstropressServiceOriginFromEnv({ ASTROPRESS_DATA_SERVICES: "firebase" }),
    ).toBeNull();
  });

  it("returns appwrite service origin from APPWRITE_ENDPOINT", () => {
    expect(
      resolveAstropressServiceOriginFromEnv({
        ASTROPRESS_DATA_SERVICES: "appwrite",
        APPWRITE_ENDPOINT: "https://cloud.appwrite.io/v1",
      }),
    ).toBe("https://cloud.appwrite.io/v1/functions/astropress");
  });

  it("returns null when appwrite is selected but APPWRITE_ENDPOINT is absent", () => {
    expect(
      resolveAstropressServiceOriginFromEnv({ ASTROPRESS_DATA_SERVICES: "appwrite" }),
    ).toBeNull();
  });

  it("returns runway service origin from RUNWAY_PROJECT_ID", () => {
    expect(
      resolveAstropressServiceOriginFromEnv({
        ASTROPRESS_DATA_SERVICES: "runway",
        RUNWAY_PROJECT_ID: "my-runway-proj",
      }),
    ).toBe("https://runway.example/my-runway-proj/astropress-api");
  });

  it("returns null when runway is selected but RUNWAY_PROJECT_ID is absent", () => {
    expect(
      resolveAstropressServiceOriginFromEnv({ ASTROPRESS_DATA_SERVICES: "runway" }),
    ).toBeNull();
  });

  it("returns null when supabase is selected but SUPABASE_URL is absent", () => {
    expect(
      resolveAstropressServiceOriginFromEnv({ ASTROPRESS_DATA_SERVICES: "supabase" }),
    ).toBeNull();
  });
});

describe("resolveAstropressServiceOriginFromEnv — fallthrough branch", () => {
  it("returns null for cloudflare (no ASTROPRESS_SERVICE_ORIGIN and no specific env key for cloudflare)", () => {
    // cloudflare doesn't have a dedicated origin-building path → falls through to null
    expect(
      resolveAstropressServiceOriginFromEnv({ ASTROPRESS_DATA_SERVICES: "cloudflare" }),
    ).toBeNull();
  });
});

describe("mapLegacyDeployTargetToAppHost — custom arm (line 22)", () => {
  it("maps ASTROPRESS_DEPLOY_TARGET=custom → custom appHost", () => {
    expect(resolveAstropressAppHostFromEnv({ ASTROPRESS_DEPLOY_TARGET: "custom" })).toBe("custom");
  });
});

describe("resolveDataServicesFromLegacyEnv — cloudflare via DEPLOY_TARGET (lines 54-55)", () => {
  it("returns cloudflare from ASTROPRESS_DEPLOY_TARGET=cloudflare when no explicit data-services set", () => {
    // resolveAstropressDataServicesFromEnv falls through to resolveDataServicesFromLegacyEnv
    // which checks ASTROPRESS_DEPLOY_TARGET === "cloudflare"
    expect(resolveAstropressDataServicesFromEnv({ ASTROPRESS_DEPLOY_TARGET: "cloudflare" })).toBe("cloudflare");
  });
});

describe("resolveAstropressDeployTarget — explicit target values", () => {
  it("returns each explicit ASTROPRESS_DEPLOY_TARGET value verbatim", () => {
    const targets = ["render-static", "render-web", "gitlab-pages", "netlify", "firebase-hosting", "runway", "custom"] as const;
    for (const target of targets) {
      expect(resolveAstropressDeployTarget({ ASTROPRESS_DEPLOY_TARGET: target })).toBe(target);
    }
  });
});

describe("project-env — uncovered branch targets", () => {
  it("resolveAstropressDataServicesFromEnv falls back to BACKEND_PLATFORM when CONTENT/DATA_SERVICES are absent", () => {
    // CONTENT_SERVICES and DATA_SERVICES are both undefined → chain reaches BACKEND_PLATFORM
    // BACKEND_PLATFORM is undefined → ?? arm 0 (null short-circuit) taken
    expect(resolveAstropressDataServicesFromEnv({ ASTROPRESS_BACKEND_PLATFORM: undefined })).toBe("none");
    // BACKEND_PLATFORM is set to a valid value → arm 1 (trim() called)
    expect(resolveAstropressDataServicesFromEnv({ ASTROPRESS_BACKEND_PLATFORM: "supabase" })).toBe("supabase");
  });
});
