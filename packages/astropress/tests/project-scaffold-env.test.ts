import { describe, expect, it } from "vitest";
import {
	appHostToDeployTarget,
	baseEnvExample,
	baseLocalEnv,
	buildAbTestingEnvExample,
	buildAnalyticsEnvExample,
	buildApiEnvExample,
	buildDataServiceExample,
	buildDonationsEnvExample,
	buildHeatmapEnvExample,
	defaultAdminDbPath,
	defaultServiceOrigin,
	deriveLegacyProvider,
} from "../src/project-scaffold-env";

// ---------------------------------------------------------------------------
// Single-line mappers
// ---------------------------------------------------------------------------

describe("deriveLegacyProvider", () => {
	it("maps 'supabase' to 'supabase'", () => {
		expect(deriveLegacyProvider("supabase")).toBe("supabase");
	});
	it("maps every other dataServices value to 'sqlite'", () => {
		for (const ds of [
			"appwrite",
			"cloudflare",
			"pocketbase",
			"nhost",
			"neon",
			"turso",
			"custom",
		] as const) {
			expect(deriveLegacyProvider(ds)).toBe("sqlite");
		}
	});
});

describe("defaultAdminDbPath", () => {
	it("returns '.data/supabase-admin.sqlite' for the supabase provider", () => {
		expect(defaultAdminDbPath("supabase")).toBe(".data/supabase-admin.sqlite");
	});
	it("returns '.data/admin.sqlite' for the sqlite provider", () => {
		expect(defaultAdminDbPath("sqlite")).toBe(".data/admin.sqlite");
	});
});

describe("appHostToDeployTarget", () => {
	it("maps 'cloudflare-pages' to 'cloudflare'", () => {
		expect(appHostToDeployTarget("cloudflare-pages")).toBe("cloudflare");
	});
	it("passes any other appHost through unchanged", () => {
		expect(appHostToDeployTarget("vercel")).toBe("vercel");
		expect(appHostToDeployTarget("netlify")).toBe("netlify");
		expect(appHostToDeployTarget("github-pages")).toBe("github-pages");
	});
});

// ---------------------------------------------------------------------------
// defaultServiceOrigin — switch arms
// ---------------------------------------------------------------------------

describe("defaultServiceOrigin", () => {
	const cases: [Parameters<typeof defaultServiceOrigin>[0], string][] = [
		["supabase", "https://your-project.supabase.co/functions/v1/astropress"],
		["appwrite", "https://cloud.appwrite.io/v1/functions/astropress"],
		["cloudflare", "https://your-project.pages.dev/api/astropress"],
		["pocketbase", "https://your-pocketbase.example.com/api/astropress"],
		["nhost", "https://your-subdomain.nhost.run/v1/functions/astropress"],
		["neon", "https://your-service.example.com/astropress"],
		["turso", "https://your-service.example.com/astropress"],
		["custom", "https://your-service.example.com/astropress"],
	];
	for (const [ds, expected] of cases) {
		it(`returns the documented origin for ${ds}`, () => {
			expect(defaultServiceOrigin(ds)).toBe(expected);
		});
	}
	it("returns '' for the default arm (an unrecognised dataServices value)", () => {
		expect(defaultServiceOrigin("unrecognised" as never)).toBe("");
	});
});

// ---------------------------------------------------------------------------
// baseLocalEnv / baseEnvExample
// ---------------------------------------------------------------------------

describe("baseLocalEnv", () => {
	it("returns the documented base shape for sqlite + cloudflare-pages + supabase data services and adds bootstrap-secret keys", () => {
		const env = baseLocalEnv("sqlite", "cloudflare-pages", "supabase");
		expect(env.ASTROPRESS_APP_HOST).toBe("cloudflare-pages");
		expect(env.ASTROPRESS_CONTENT_SERVICES).toBe("supabase");
		expect(env.ADMIN_DB_PATH).toBe(".data/admin.sqlite");
		expect(env.ADMIN_BOOTSTRAP_DISABLED).toBe("0");
		// createLocalBootstrapSecrets adds at least an ADMIN_PASSWORD/EDITOR_PASSWORD/SESSION_SECRET trio.
		expect(typeof env.ADMIN_PASSWORD).toBe("string");
		expect(typeof env.EDITOR_PASSWORD).toBe("string");
		expect(typeof env.SESSION_SECRET).toBe("string");
	});

	it("uses '.data/supabase-admin.sqlite' as ADMIN_DB_PATH when the provider is supabase", () => {
		const env = baseLocalEnv("supabase", "vercel", "supabase");
		expect(env.ADMIN_DB_PATH).toBe(".data/supabase-admin.sqlite");
	});
});

describe("baseEnvExample", () => {
	it("returns the documented six-key shape with the placeholder secret values", () => {
		const env = baseEnvExample("sqlite", "vercel", "supabase");
		expect(env).toEqual({
			ASTROPRESS_APP_HOST: "vercel",
			ASTROPRESS_CONTENT_SERVICES: "supabase",
			ADMIN_DB_PATH: ".data/admin.sqlite",
			ADMIN_PASSWORD: "replace-with-a-generated-local-admin-password",
			EDITOR_PASSWORD: "replace-with-a-generated-local-editor-password",
			SESSION_SECRET: "replace-with-a-long-random-session-secret",
		});
	});
});

// ---------------------------------------------------------------------------
// buildDataServiceExample — switch arms
// ---------------------------------------------------------------------------

describe("buildDataServiceExample", () => {
	it("returns supabase keys (URL + service role + service-origin)", () => {
		expect(buildDataServiceExample("supabase")).toEqual({
			ASTROPRESS_SERVICE_ORIGIN: "https://your-project.supabase.co/functions/v1/astropress",
			SUPABASE_URL: "https://your-project.supabase.co",
			SUPABASE_SERVICE_ROLE_KEY: "replace-me",
		});
	});
	it("returns appwrite keys (endpoint + project + api key + service-origin)", () => {
		expect(buildDataServiceExample("appwrite")).toEqual({
			ASTROPRESS_SERVICE_ORIGIN: "https://cloud.appwrite.io/v1/functions/astropress",
			APPWRITE_ENDPOINT: "https://cloud.appwrite.io/v1",
			APPWRITE_PROJECT_ID: "replace-me",
			APPWRITE_API_KEY: "replace-me",
		});
	});
	it("returns cloudflare keys (account id + api token + service-origin)", () => {
		expect(buildDataServiceExample("cloudflare")).toEqual({
			ASTROPRESS_SERVICE_ORIGIN: "https://your-project.pages.dev/api/astropress",
			CLOUDFLARE_ACCOUNT_ID: "replace-me",
			CLOUDFLARE_API_TOKEN: "replace-me",
		});
	});
	it("returns pocketbase keys (URL + email + password + service-origin)", () => {
		expect(buildDataServiceExample("pocketbase")).toEqual({
			ASTROPRESS_SERVICE_ORIGIN: "https://your-pocketbase.example.com/api/astropress",
			POCKETBASE_URL: "https://your-pocketbase.example.com",
			POCKETBASE_EMAIL: "replace-me",
			POCKETBASE_PASSWORD: "replace-me",
		});
	});
	it("returns nhost keys (subdomain + region + admin secret + service-origin)", () => {
		expect(buildDataServiceExample("nhost")).toEqual({
			ASTROPRESS_SERVICE_ORIGIN: "https://your-subdomain.nhost.run/v1/functions/astropress",
			NHOST_SUBDOMAIN: "replace-me",
			NHOST_REGION: "replace-me",
			NHOST_ADMIN_SECRET: "replace-me",
		});
	});
	it("returns neon keys (database url + service-origin)", () => {
		expect(buildDataServiceExample("neon")).toEqual({
			ASTROPRESS_SERVICE_ORIGIN: "https://your-service.example.com/astropress",
			NEON_DATABASE_URL: "postgres://replace-me",
		});
	});
	it("returns turso keys (database url + auth token; NO service-origin)", () => {
		expect(buildDataServiceExample("turso")).toEqual({
			TURSO_DATABASE_URL: "libsql://your-database-org.turso.io",
			TURSO_AUTH_TOKEN: "replace-me",
		});
	});
	it("returns custom keys (only service-origin)", () => {
		expect(buildDataServiceExample("custom")).toEqual({
			ASTROPRESS_SERVICE_ORIGIN: "https://your-service.example.com/astropress",
		});
	});
	it("returns {} for an unrecognised dataServices value (default arm)", () => {
		expect(buildDataServiceExample("unrecognised" as never)).toEqual({});
	});
});

// ---------------------------------------------------------------------------
// buildAnalyticsEnvExample
// ---------------------------------------------------------------------------

describe("buildAnalyticsEnvExample", () => {
	it("returns the umami pair", () => {
		expect(buildAnalyticsEnvExample("umami")).toEqual({
			PUBLIC_UMAMI_WEBSITE_ID: "replace-with-your-umami-website-id",
			PUBLIC_UMAMI_SCRIPT_URL: "https://analytics.umami.is/script.js",
		});
	});
	it("returns the plausible pair", () => {
		expect(buildAnalyticsEnvExample("plausible")).toEqual({
			PUBLIC_PLAUSIBLE_DOMAIN: "replace-with-your-domain.com",
			PUBLIC_PLAUSIBLE_SCRIPT_URL: "https://plausible.io/js/script.js",
		});
	});
	it("returns the matomo pair", () => {
		expect(buildAnalyticsEnvExample("matomo")).toEqual({
			PUBLIC_MATOMO_URL: "https://your-matomo-instance.example.com",
			PUBLIC_MATOMO_SITE_ID: "1",
		});
	});
	it("returns the posthog pair", () => {
		expect(buildAnalyticsEnvExample("posthog")).toEqual({
			PUBLIC_POSTHOG_KEY: "replace-with-your-posthog-api-key",
			PUBLIC_POSTHOG_HOST: "https://app.posthog.com",
		});
	});
	it("returns the custom pair", () => {
		expect(buildAnalyticsEnvExample("custom")).toEqual({
			PUBLIC_ANALYTICS_SCRIPT_URL: "replace-with-your-analytics-script-url",
		});
	});
	it("returns {} for undefined and for unrecognised values", () => {
		expect(buildAnalyticsEnvExample(undefined)).toEqual({});
		expect(buildAnalyticsEnvExample("nope" as never)).toEqual({});
	});
});

// ---------------------------------------------------------------------------
// buildAbTestingEnvExample
// ---------------------------------------------------------------------------

describe("buildAbTestingEnvExample", () => {
	it("returns the growthbook pair", () => {
		expect(buildAbTestingEnvExample("growthbook")).toEqual({
			GROWTHBOOK_API_HOST: "https://cdn.growthbook.io",
			GROWTHBOOK_CLIENT_KEY: "replace-with-your-growthbook-client-key",
		});
	});
	it("returns the unleash pair", () => {
		expect(buildAbTestingEnvExample("unleash")).toEqual({
			UNLEASH_URL: "https://your-unleash-instance.example.com/api",
			UNLEASH_CLIENT_KEY: "replace-with-your-unleash-client-key",
		});
	});
	it("returns the flagsmith pair", () => {
		expect(buildAbTestingEnvExample("flagsmith")).toEqual({
			FLAGSMITH_API_URL: "https://flags.yourdomain.com/api/v1/",
			FLAGSMITH_ENVIRONMENT_KEY: "replace-with-your-flagsmith-environment-key",
		});
	});
	it("returns the custom pair", () => {
		expect(buildAbTestingEnvExample("custom")).toEqual({
			AB_TESTING_API_URL: "replace-with-your-ab-testing-api-url",
			AB_TESTING_CLIENT_KEY: "replace-with-your-ab-testing-client-key",
		});
	});
	it("returns {} for undefined and unrecognised values", () => {
		expect(buildAbTestingEnvExample(undefined)).toEqual({});
		expect(buildAbTestingEnvExample("nope" as never)).toEqual({});
	});
});

// ---------------------------------------------------------------------------
// buildHeatmapEnvExample
// ---------------------------------------------------------------------------

describe("buildHeatmapEnvExample", () => {
	it("returns the openreplay key", () => {
		expect(buildHeatmapEnvExample("openreplay")).toEqual({
			PUBLIC_OPENREPLAY_PROJECT_KEY: "replace-with-your-openreplay-project-key",
		});
	});
	it("returns the posthog pair (heatmaps share PostHog's analytics keys)", () => {
		expect(buildHeatmapEnvExample("posthog")).toEqual({
			PUBLIC_POSTHOG_KEY: "replace-with-your-posthog-api-key",
			PUBLIC_POSTHOG_HOST: "https://app.posthog.com",
		});
	});
	it("returns the custom heatmap key", () => {
		expect(buildHeatmapEnvExample("custom")).toEqual({
			PUBLIC_HEATMAP_SCRIPT_URL: "replace-with-your-heatmap-script-url",
		});
	});
	it("returns {} for undefined and unrecognised values", () => {
		expect(buildHeatmapEnvExample(undefined)).toEqual({});
		expect(buildHeatmapEnvExample("nope" as never)).toEqual({});
	});
});

// ---------------------------------------------------------------------------
// buildApiEnvExample / buildDonationsEnvExample
// ---------------------------------------------------------------------------

describe("buildApiEnvExample", () => {
	it("returns the documented enabled+rate-limit pair", () => {
		expect(buildApiEnvExample()).toEqual({
			ASTROPRESS_API_ENABLED: "true",
			ASTROPRESS_API_RATE_LIMIT: "60",
		});
	});
});

describe("buildDonationsEnvExample", () => {
	it("returns {} when the donations argument is undefined", () => {
		expect(buildDonationsEnvExample(undefined)).toEqual({});
	});
	it("returns {} when no provider is enabled", () => {
		expect(
			buildDonationsEnvExample({ giveLively: false, liberapay: false, pledgeCrypto: false }),
		).toEqual({});
	});
	it("adds the giveLively pair when enabled", () => {
		expect(buildDonationsEnvExample({ giveLively: true })).toEqual({
			GIVELIVELY_ORG_SLUG: "replace-with-your-org-slug",
			GIVELIVELY_CAMPAIGN_SLUG: "replace-with-your-campaign-slug-or-remove",
		});
	});
	it("adds the liberapay key when enabled", () => {
		expect(buildDonationsEnvExample({ liberapay: true })).toEqual({
			LIBERAPAY_USERNAME: "replace-with-your-liberapay-username",
		});
	});
	it("adds the pledgeCrypto key when enabled", () => {
		expect(buildDonationsEnvExample({ pledgeCrypto: true })).toEqual({
			PLEDGE_PARTNER_KEY: "[YOUR_PLEDGE_PARTNER_KEY]",
		});
	});
	it("composes all three when every provider is enabled", () => {
		expect(
			buildDonationsEnvExample({ giveLively: true, liberapay: true, pledgeCrypto: true }),
		).toEqual({
			GIVELIVELY_ORG_SLUG: "replace-with-your-org-slug",
			GIVELIVELY_CAMPAIGN_SLUG: "replace-with-your-campaign-slug-or-remove",
			LIBERAPAY_USERNAME: "replace-with-your-liberapay-username",
			PLEDGE_PARTNER_KEY: "[YOUR_PLEDGE_PARTNER_KEY]",
		});
	});
});
