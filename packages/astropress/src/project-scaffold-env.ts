import type { AstropressAppHost } from "./app-host-targets";
import type { AstropressDataServices } from "./data-service-targets";
import type {
  AstropressAnalyticsProvider,
  AstropressAbTestingProvider,
  AstropressHeatmapProvider,
  AstropressScaffoldProvider,
} from "./project-scaffold";
import { createLocalBootstrapSecrets } from "./project-scaffold-passphrase";

export function deriveLegacyProvider(dataServices: AstropressDataServices): AstropressScaffoldProvider {
  if (dataServices === "supabase") return "supabase";
  if (dataServices === "runway") return "runway";
  return "sqlite";
}

export function defaultAdminDbPath(provider: AstropressScaffoldProvider) {
  if (provider === "supabase") return ".data/supabase-admin.sqlite";
  if (provider === "runway") return ".data/runway-admin.sqlite";
  return ".data/admin.sqlite";
}

export function appHostToDeployTarget(appHost: AstropressAppHost) {
  return appHost === "cloudflare-pages" ? "cloudflare" : appHost;
}

export function defaultServiceOrigin(dataServices: AstropressDataServices) {
  switch (dataServices) {
    case "supabase": return "https://your-project.supabase.co/functions/v1/astropress";
    case "appwrite": return "https://cloud.appwrite.io/v1/functions/astropress";
    case "cloudflare": return "https://your-project.pages.dev/api/astropress";
    case "runway": return "https://runway.example/your-project/astropress-api";
    case "pocketbase": return "https://your-pocketbase.example.com/api/astropress";
    case "nhost": return "https://your-subdomain.nhost.run/v1/functions/astropress";
    case "neon": return "https://your-service.example.com/astropress";
    case "custom": return "https://your-service.example.com/astropress";
    default: return "";
  }
}

export function baseLocalEnv(
  provider: AstropressScaffoldProvider,
  appHost: AstropressAppHost,
  dataServices: AstropressDataServices,
) {
  return {
    ASTROPRESS_APP_HOST: appHost,
    ASTROPRESS_CONTENT_SERVICES: dataServices,
    ADMIN_DB_PATH: defaultAdminDbPath(provider),
    ADMIN_BOOTSTRAP_DISABLED: "0",
    ...createLocalBootstrapSecrets(),
  };
}

export function baseEnvExample(
  provider: AstropressScaffoldProvider,
  appHost: AstropressAppHost,
  dataServices: AstropressDataServices,
) {
  return {
    ASTROPRESS_APP_HOST: appHost,
    ASTROPRESS_CONTENT_SERVICES: dataServices,
    ADMIN_DB_PATH: defaultAdminDbPath(provider),
    ADMIN_PASSWORD: "replace-with-a-generated-local-admin-password",
    EDITOR_PASSWORD: "replace-with-a-generated-local-editor-password",
    SESSION_SECRET: "replace-with-a-long-random-session-secret",
  };
}

export function buildDataServiceExample(dataServices: AstropressDataServices): Record<string, string> {
  const serviceOrigin = defaultServiceOrigin(dataServices);
  switch (dataServices) {
    case "supabase":
      return { ASTROPRESS_SERVICE_ORIGIN: serviceOrigin, SUPABASE_URL: "https://your-project.supabase.co", SUPABASE_ANON_KEY: "replace-me", SUPABASE_SERVICE_ROLE_KEY: "replace-me" };
    case "appwrite":
      return { ASTROPRESS_SERVICE_ORIGIN: serviceOrigin, APPWRITE_ENDPOINT: "https://cloud.appwrite.io/v1", APPWRITE_PROJECT_ID: "replace-me", APPWRITE_API_KEY: "replace-me" };
    case "cloudflare":
      return { ASTROPRESS_SERVICE_ORIGIN: serviceOrigin, CLOUDFLARE_ACCOUNT_ID: "replace-me", CLOUDFLARE_API_TOKEN: "replace-me" };
    case "runway":
      return { ASTROPRESS_SERVICE_ORIGIN: serviceOrigin, RUNWAY_API_TOKEN: "replace-me", RUNWAY_PROJECT_ID: "replace-me" };
    case "pocketbase":
      return { ASTROPRESS_SERVICE_ORIGIN: serviceOrigin, POCKETBASE_URL: "https://your-pocketbase.example.com", POCKETBASE_EMAIL: "replace-me", POCKETBASE_PASSWORD: "replace-me" };
    case "nhost":
      return { ASTROPRESS_SERVICE_ORIGIN: serviceOrigin, NHOST_SUBDOMAIN: "replace-me", NHOST_REGION: "replace-me", NHOST_ADMIN_SECRET: "replace-me" };
    case "neon":
      return { ASTROPRESS_SERVICE_ORIGIN: serviceOrigin, NEON_DATABASE_URL: "postgres://replace-me" };
    case "custom":
      return { ASTROPRESS_SERVICE_ORIGIN: serviceOrigin };
    default:
      return {};
  }
}

export function buildAnalyticsEnvExample(analytics: AstropressAnalyticsProvider | undefined): Record<string, string> {
  switch (analytics) {
    case "umami": return { PUBLIC_UMAMI_WEBSITE_ID: "replace-with-your-umami-website-id", PUBLIC_UMAMI_SCRIPT_URL: "https://analytics.umami.is/script.js" };
    case "plausible": return { PUBLIC_PLAUSIBLE_DOMAIN: "replace-with-your-domain.com", PUBLIC_PLAUSIBLE_SCRIPT_URL: "https://plausible.io/js/script.js" };
    case "matomo": return { PUBLIC_MATOMO_URL: "https://your-matomo-instance.example.com", PUBLIC_MATOMO_SITE_ID: "1" };
    case "posthog": return { PUBLIC_POSTHOG_KEY: "replace-with-your-posthog-api-key", PUBLIC_POSTHOG_HOST: "https://app.posthog.com" };
    case "custom": return { PUBLIC_ANALYTICS_SCRIPT_URL: "replace-with-your-analytics-script-url" };
    default: return {};
  }
}

export function buildAbTestingEnvExample(abTesting: AstropressAbTestingProvider | undefined): Record<string, string> {
  switch (abTesting) {
    case "growthbook": return { GROWTHBOOK_API_HOST: "https://cdn.growthbook.io", GROWTHBOOK_CLIENT_KEY: "replace-with-your-growthbook-client-key" };
    case "unleash": return { UNLEASH_URL: "https://your-unleash-instance.example.com/api", UNLEASH_CLIENT_KEY: "replace-with-your-unleash-client-key" };
    case "custom": return { AB_TESTING_API_URL: "replace-with-your-ab-testing-api-url", AB_TESTING_CLIENT_KEY: "replace-with-your-ab-testing-client-key" };
    default: return {};
  }
}

export function buildHeatmapEnvExample(heatmap: AstropressHeatmapProvider | undefined): Record<string, string> {
  switch (heatmap) {
    case "openreplay": return { PUBLIC_OPENREPLAY_PROJECT_KEY: "replace-with-your-openreplay-project-key" };
    case "posthog":
      // PostHog handles both analytics and heatmaps with the same keys.
      return { PUBLIC_POSTHOG_KEY: "replace-with-your-posthog-api-key", PUBLIC_POSTHOG_HOST: "https://app.posthog.com" };
    case "custom": return { PUBLIC_HEATMAP_SCRIPT_URL: "replace-with-your-heatmap-script-url" };
    default: return {};
  }
}

export function buildApiEnvExample(): Record<string, string> {
  return { ASTROPRESS_API_ENABLED: "true", ASTROPRESS_API_RATE_LIMIT: "60" };
}
