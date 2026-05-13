import { describe, expect, it } from "vitest";
import { createAstropressProjectScaffold } from "../src/project-scaffold.js";

describe("project scaffold — additional provider/host combinations", () => {
	it("pocketbase scaffold produces correct env example keys", () => {
		const scaffold = createAstropressProjectScaffold({
			appHost: "render-web",
			dataServices: "pocketbase",
		});
		expect(scaffold.dataServices).toBe("pocketbase");
		expect(scaffold.appHost).toBe("render-web");
		expect(scaffold.envExample.POCKETBASE_URL).toBeDefined();
		expect(scaffold.envExample.POCKETBASE_EMAIL).toBeDefined();
	});

	it("nhost scaffold produces correct env example keys", () => {
		const scaffold = createAstropressProjectScaffold({
			appHost: "render-web",
			dataServices: "nhost",
		});
		expect(scaffold.dataServices).toBe("nhost");
		expect(scaffold.envExample.NHOST_SUBDOMAIN).toBeDefined();
		expect(scaffold.envExample.NHOST_REGION).toBeDefined();
	});

	it("neon scaffold produces correct env example keys", () => {
		const scaffold = createAstropressProjectScaffold({
			appHost: "render-web",
			dataServices: "neon",
		});
		expect(scaffold.dataServices).toBe("neon");
		expect(scaffold.envExample.NEON_DATABASE_URL).toBeDefined();
	});

	it("custom scaffold produces ASTROPRESS_SERVICE_ORIGIN in env example", () => {
		const scaffold = createAstropressProjectScaffold({
			appHost: "custom",
			dataServices: "custom",
		});
		expect(scaffold.dataServices).toBe("custom");
		expect(scaffold.envExample.ASTROPRESS_SERVICE_ORIGIN).toBeDefined();
	});

	it("appwrite scaffold produces correct env example keys", () => {
		const scaffold = createAstropressProjectScaffold({
			appHost: "render-web",
			dataServices: "appwrite",
		});
		expect(scaffold.dataServices).toBe("appwrite");
		expect(scaffold.envExample.APPWRITE_ENDPOINT).toBeDefined();
		expect(scaffold.envExample.APPWRITE_PROJECT_ID).toBeDefined();
	});

	it("render-static appHost produces render-static deploy script", () => {
		const scaffold = createAstropressProjectScaffold({
			appHost: "render-static",
			dataServices: "none",
		});
		expect(scaffold.packageScripts["deploy:render-static"]).toContain("astro build");
	});

	it("gitlab-pages appHost produces .gitlab-ci.yml CI file (not GitHub Actions)", () => {
		const scaffold = createAstropressProjectScaffold({
			appHost: "gitlab-pages",
			dataServices: "none",
		});
		expect(scaffold.packageScripts["deploy:gitlab-pages"]).toContain("astro build");
		expect(scaffold.ciFiles[".gitlab-ci.yml"]).toContain("pages");
		expect(scaffold.ciFiles[".github/workflows/deploy-astropress.yml"]).toBeUndefined();
	});

	it("netlify appHost produces netlify deploy script and CI workflow", () => {
		const scaffold = createAstropressProjectScaffold({
			appHost: "netlify",
			dataServices: "none",
		});
		expect(scaffold.packageScripts["deploy:netlify"]).toContain("netlify deploy");
		expect(scaffold.ciFiles[".github/workflows/deploy-astropress.yml"]).toContain(
			"NETLIFY_AUTH_TOKEN",
		);
	});

	it("server-output hosts emit a second public-site astro config and build:public script", () => {
		const scaffold = createAstropressProjectScaffold({
			appHost: "vercel",
			dataServices: "supabase",
		});
		expect(scaffold.ciFiles["astro.config.public.mjs"]).toBeDefined();
		expect(scaffold.ciFiles["astro.config.public.mjs"]).toContain(
			"createAstropressPublicSiteIntegration",
		);
		expect(scaffold.ciFiles["astro.config.public.mjs"]).toContain('output: "static"');
		expect(scaffold.ciFiles["astro.config.public.mjs"]).not.toContain("AdminApp");
		expect(scaffold.packageScripts["build:public"]).toBe(
			"astro build --config astro.config.public.mjs",
		);
		expect(scaffold.deployDoc).toContain("Two-site deployment");
	});

	it("static-only hosts do not emit a duplicate public-site config (they are already static)", () => {
		const scaffold = createAstropressProjectScaffold({
			appHost: "github-pages",
			dataServices: "none",
		});
		expect(scaffold.ciFiles["astro.config.public.mjs"]).toBeUndefined();
		expect(scaffold.packageScripts["build:public"]).toBeUndefined();
	});

	it("render-web appHost produces render-web CI workflow with RENDER_DEPLOY_HOOK_URL", () => {
		const scaffold = createAstropressProjectScaffold({
			appHost: "render-web",
			dataServices: "appwrite",
		});
		expect(scaffold.packageScripts["deploy:render-web"]).toContain("astro build");
		expect(scaffold.ciFiles[".github/workflows/deploy-astropress.yml"]).toContain(
			"RENDER_DEPLOY_HOOK_URL",
		);
	});

	it("fly-io appHost produces fly-io deploy script and flyctl CI step", () => {
		const scaffold = createAstropressProjectScaffold({
			appHost: "fly-io",
			dataServices: "supabase",
		});
		expect(scaffold.packageScripts["deploy:fly-io"]).toContain("flyctl deploy");
		expect(scaffold.ciFiles[".github/workflows/deploy-astropress.yml"]).toContain("FLY_API_TOKEN");
		expect(scaffold.ciFiles[".github/workflows/deploy-astropress.yml"]).toContain("flyctl");
	});

	it("coolify appHost produces coolify deploy script and webhook CI step", () => {
		const scaffold = createAstropressProjectScaffold({
			appHost: "coolify",
			dataServices: "supabase",
		});
		expect(scaffold.packageScripts["deploy:coolify"]).toContain("astro build");
		expect(scaffold.ciFiles[".github/workflows/deploy-astropress.yml"]).toContain(
			"COOLIFY_WEBHOOK_URL",
		);
	});

	it("digitalocean appHost produces digitalocean deploy script and doctl CI step", () => {
		const scaffold = createAstropressProjectScaffold({
			appHost: "digitalocean",
			dataServices: "supabase",
		});
		expect(scaffold.packageScripts["deploy:digitalocean"]).toContain("doctl");
		expect(scaffold.ciFiles[".github/workflows/deploy-astropress.yml"]).toContain(
			"DIGITALOCEAN_ACCESS_TOKEN",
		);
	});

	it("railway appHost produces railway deploy script with RAILWAY_TOKEN CI step", () => {
		const scaffold = createAstropressProjectScaffold({
			appHost: "railway",
			dataServices: "supabase",
		});
		expect(scaffold.packageScripts["deploy:railway"]).toContain("railway up");
		expect(scaffold.ciFiles[".github/workflows/deploy-astropress.yml"]).toContain("RAILWAY_TOKEN");
		expect(scaffold.ciFiles[".github/workflows/deploy-astropress.yml"]).toContain("@railway/cli");
	});

	it("turso dataServices produces TURSO env example keys", () => {
		const scaffold = createAstropressProjectScaffold({
			appHost: "vercel",
			dataServices: "turso",
		});
		expect(scaffold.envExample.TURSO_DATABASE_URL).toContain("libsql://");
		expect(scaffold.envExample.TURSO_AUTH_TOKEN).toBeDefined();
	});

	it("null-like dataServices defaults to github-pages appHost", () => {
		const scaffold = createAstropressProjectScaffold({
			appHost: "github-pages",
			dataServices: "none",
		});
		expect(scaffold.appHost).toBe("github-pages");
		expect(scaffold.recommendedDeployTarget).toBe("github-pages");
	});

	it("infers appHost=cloudflare-pages from dataServices=cloudflare when appHost omitted", () => {
		const scaffold = createAstropressProjectScaffold({
			dataServices: "cloudflare",
		} as Parameters<typeof createAstropressProjectScaffold>[0]);
		expect(scaffold.appHost).toBe("cloudflare-pages");
		expect(scaffold.dataServices).toBe("cloudflare");
	});

	it("infers appHost=vercel from dataServices=supabase when appHost omitted", () => {
		// Also hits deriveLegacyProvider("supabase") → "supabase" (line 20-21)
		const scaffold = createAstropressProjectScaffold({
			dataServices: "supabase",
		} as Parameters<typeof createAstropressProjectScaffold>[0]);
		expect(scaffold.appHost).toBe("vercel");
		expect(scaffold.dataServices).toBe("supabase");
		expect(scaffold.provider).toBe("supabase");
	});

	it("infers appHost=render-web from dataServices=pocketbase when appHost omitted", () => {
		const scaffold = createAstropressProjectScaffold({
			dataServices: "pocketbase",
		} as Parameters<typeof createAstropressProjectScaffold>[0]);
		expect(scaffold.appHost).toBe("render-web");
		expect(scaffold.dataServices).toBe("pocketbase");
	});

	it("derives dataServices from legacyProvider=supabase when dataServices omitted", () => {
		const scaffold = createAstropressProjectScaffold({
			legacyProvider: "supabase",
		} as Parameters<typeof createAstropressProjectScaffold>[0]);
		expect(scaffold.dataServices).toBe("supabase");
	});

	it("defaults dataServices to none when no dataServices or legacyProvider set", () => {
		// input.dataServices is undefined AND input.legacyProvider is undefined → falls to "none"
		const scaffold = createAstropressProjectScaffold({
			appHost: "netlify",
		} as Parameters<typeof createAstropressProjectScaffold>[0]);
		expect(scaffold.dataServices).toBe("none");
	});

	it("defaults appHost to github-pages when dataServices is none and appHost omitted", () => {
		// dataServices = "none" → none of the ternary arms match → "github-pages"
		const scaffold = createAstropressProjectScaffold({
			dataServices: "none",
		} as Parameters<typeof createAstropressProjectScaffold>[0]);
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
		expect(scaffold.envExample.ADMIN_PASSWORD).toBe(
			"replace-with-a-generated-local-admin-password",
		);
		expect(scaffold.envExample.SESSION_SECRET).toBe("replace-with-a-long-random-session-secret");
	});

	it("does not include analytics keys when analytics is not set", () => {
		const scaffold = createAstropressProjectScaffold();
		expect(scaffold.envExample.PUBLIC_UMAMI_WEBSITE_ID).toBeUndefined();
		expect(scaffold.envExample.PUBLIC_PLAUSIBLE_DOMAIN).toBeUndefined();
		expect(scaffold.envExample.PUBLIC_MATOMO_URL).toBeUndefined();
		expect(scaffold.envExample.PUBLIC_POSTHOG_KEY).toBeUndefined();
		expect(scaffold.envExample.ASTROPRESS_API_ENABLED).toBeUndefined();
	});

	it("umami analytics produces correct env example keys", () => {
		const scaffold = createAstropressProjectScaffold({
			analytics: "umami",
		} as Parameters<typeof createAstropressProjectScaffold>[0]);
		expect(scaffold.envExample.PUBLIC_UMAMI_WEBSITE_ID).toBeDefined();
		expect(scaffold.envExample.PUBLIC_UMAMI_SCRIPT_URL).toBeDefined();
		expect(scaffold.envExample.PUBLIC_PLAUSIBLE_DOMAIN).toBeUndefined();
	});

	it("plausible analytics produces correct env example keys", () => {
		const scaffold = createAstropressProjectScaffold({
			analytics: "plausible",
		} as Parameters<typeof createAstropressProjectScaffold>[0]);
		expect(scaffold.envExample.PUBLIC_PLAUSIBLE_DOMAIN).toBeDefined();
		expect(scaffold.envExample.PUBLIC_PLAUSIBLE_SCRIPT_URL).toBeDefined();
	});

	it("matomo analytics produces correct env example keys", () => {
		const scaffold = createAstropressProjectScaffold({
			analytics: "matomo",
		} as Parameters<typeof createAstropressProjectScaffold>[0]);
		expect(scaffold.envExample.PUBLIC_MATOMO_URL).toBeDefined();
		expect(scaffold.envExample.PUBLIC_MATOMO_SITE_ID).toBeDefined();
	});

	it("posthog analytics produces correct env example keys", () => {
		const scaffold = createAstropressProjectScaffold({
			analytics: "posthog",
		} as Parameters<typeof createAstropressProjectScaffold>[0]);
		expect(scaffold.envExample.PUBLIC_POSTHOG_KEY).toBeDefined();
		expect(scaffold.envExample.PUBLIC_POSTHOG_HOST).toBeDefined();
	});

	it("growthbook ab-testing produces correct env example keys", () => {
		const scaffold = createAstropressProjectScaffold({
			abTesting: "growthbook",
		} as Parameters<typeof createAstropressProjectScaffold>[0]);
		expect(scaffold.envExample.GROWTHBOOK_API_HOST).toBeDefined();
		expect(scaffold.envExample.GROWTHBOOK_CLIENT_KEY).toBeDefined();
	});

	it("unleash ab-testing produces correct env example keys", () => {
		const scaffold = createAstropressProjectScaffold({
			abTesting: "unleash",
		} as Parameters<typeof createAstropressProjectScaffold>[0]);
		expect(scaffold.envExample.UNLEASH_URL).toBeDefined();
		expect(scaffold.envExample.UNLEASH_CLIENT_KEY).toBeDefined();
	});

	it("flagsmith ab-testing produces correct env example keys", () => {
		const scaffold = createAstropressProjectScaffold({
			abTesting: "flagsmith",
		} as Parameters<typeof createAstropressProjectScaffold>[0]);
		expect(scaffold.envExample.FLAGSMITH_API_URL).toBeDefined();
		expect(scaffold.envExample.FLAGSMITH_ENVIRONMENT_KEY).toBeDefined();
	});

	it("openreplay heatmap produces correct env example keys", () => {
		const scaffold = createAstropressProjectScaffold({
			heatmap: "openreplay",
		} as Parameters<typeof createAstropressProjectScaffold>[0]);
		expect(scaffold.envExample.PUBLIC_OPENREPLAY_PROJECT_KEY).toBeDefined();
	});

	it("enableApi produces ASTROPRESS_API_ENABLED in env example", () => {
		const scaffold = createAstropressProjectScaffold({
			enableApi: true,
		} as Parameters<typeof createAstropressProjectScaffold>[0]);
		expect(scaffold.envExample.ASTROPRESS_API_ENABLED).toBe("true");
		expect(scaffold.envExample.ASTROPRESS_API_RATE_LIMIT).toBe("60");
	});

	it("enableApi also sets ASTROPRESS_API_ENABLED in localEnv", () => {
		const scaffold = createAstropressProjectScaffold({
			enableApi: true,
		} as Parameters<typeof createAstropressProjectScaffold>[0]);
		expect(scaffold.localEnv.ASTROPRESS_API_ENABLED).toBe("true");
	});

	it("returns service-specific remote examples", () => {
		const supabase = createAstropressProjectScaffold("supabase");

		expect(supabase.appHost).toBe("vercel");
		expect(supabase.dataServices).toBe("supabase");
		expect(supabase.contentServices).toBe("supabase");
		expect(supabase.envExample.SUPABASE_URL).toBe("https://your-project.supabase.co");
		expect(supabase.envExample.ASTROPRESS_CONTENT_SERVICES).toBe("supabase");
		expect(supabase.envExample.ASTROPRESS_SERVICE_ORIGIN).toContain("functions/v1/astropress");
		expect(supabase.envExample.ASTROPRESS_DATA_SERVICES).toBeUndefined();
		expect(supabase.localEnv.ASTROPRESS_DEPLOY_TARGET).toBeUndefined();
		expect(supabase.packageScripts["deploy:vercel"]).toContain("vercel deploy");
	});
});

describe("project scaffold — resolveProfile string-input branch pins", () => {
	it("string 'supabase' → provider/appHost/dataServices verbatim", () => {
		const s = createAstropressProjectScaffold("supabase");
		expect(s.provider).toBe("supabase");
		expect(s.appHost).toBe("vercel");
		expect(s.dataServices).toBe("supabase");
	});

	it("string 'sqlite' → provider=sqlite, appHost=github-pages, dataServices=none", () => {
		const s = createAstropressProjectScaffold("sqlite");
		expect(s.provider).toBe("sqlite");
		expect(s.appHost).toBe("github-pages");
		expect(s.dataServices).toBe("none");
	});

	it("calling without args defaults to 'sqlite' (parameter default)", () => {
		const s = createAstropressProjectScaffold();
		expect(s.provider).toBe("sqlite");
		expect(s.appHost).toBe("github-pages");
		expect(s.dataServices).toBe("none");
	});
});

describe("project scaffold — resolveProfile object-input dataServices→appHost map", () => {
	it("dataServices=appwrite (omitted appHost) infers render-web", () => {
		const s = createAstropressProjectScaffold({ dataServices: "appwrite" });
		expect(s.appHost).toBe("render-web");
	});
	it("dataServices=pocketbase (omitted appHost) infers render-web", () => {
		const s = createAstropressProjectScaffold({ dataServices: "pocketbase" });
		expect(s.appHost).toBe("render-web");
	});
	it("dataServices=nhost (omitted appHost) infers render-web", () => {
		const s = createAstropressProjectScaffold({ dataServices: "nhost" });
		expect(s.appHost).toBe("render-web");
	});
	it("dataServices=neon (omitted appHost) infers render-web", () => {
		const s = createAstropressProjectScaffold({ dataServices: "neon" });
		expect(s.appHost).toBe("render-web");
	});
	it("dataServices=turso (omitted appHost) infers render-web", () => {
		const s = createAstropressProjectScaffold({ dataServices: "turso" });
		expect(s.appHost).toBe("render-web");
	});
	it("dataServices=supabase (omitted appHost) infers vercel", () => {
		const s = createAstropressProjectScaffold({ dataServices: "supabase" });
		expect(s.appHost).toBe("vercel");
	});
	it("dataServices=cloudflare (omitted appHost) infers cloudflare-pages", () => {
		const s = createAstropressProjectScaffold({ dataServices: "cloudflare" });
		expect(s.appHost).toBe("cloudflare-pages");
	});
	it("dataServices=none (omitted appHost) infers github-pages", () => {
		const s = createAstropressProjectScaffold({ dataServices: "none" });
		expect(s.appHost).toBe("github-pages");
	});
	it("explicit appHost wins over inference", () => {
		const s = createAstropressProjectScaffold({
			dataServices: "supabase",
			appHost: "netlify",
		});
		expect(s.appHost).toBe("netlify");
	});
	it("legacyProvider=supabase + omitted dataServices → dataServices=supabase", () => {
		const s = createAstropressProjectScaffold({ legacyProvider: "supabase" });
		expect(s.dataServices).toBe("supabase");
		expect(s.provider).toBe("supabase");
	});
});

describe("project scaffold — input-derived option threading", () => {
	it("string input → enableApi=false: ASTROPRESS_API_ENABLED not set in localEnv", () => {
		const s = createAstropressProjectScaffold("sqlite");
		expect(s.localEnv.ASTROPRESS_API_ENABLED).toBeUndefined();
	});

	it("object input enableApi=true → localEnv.ASTROPRESS_API_ENABLED='true' and API env example included", () => {
		const s = createAstropressProjectScaffold({ enableApi: true });
		expect(s.localEnv.ASTROPRESS_API_ENABLED).toBe("true");
		expect(Object.keys(s.envExample).some((k) => k.startsWith("ASTROPRESS_API"))).toBe(true);
	});

	it("object input enableApi omitted defaults to false", () => {
		const s = createAstropressProjectScaffold({ dataServices: "none" });
		expect(s.localEnv.ASTROPRESS_API_ENABLED).toBeUndefined();
	});

	it("object input enableApi=false explicitly is treated as false", () => {
		const s = createAstropressProjectScaffold({ enableApi: false });
		expect(s.localEnv.ASTROPRESS_API_ENABLED).toBeUndefined();
	});

	it("string input → analytics/abTesting/heatmap/donations all undefined (no provider env keys)", () => {
		const s = createAstropressProjectScaffold("sqlite");
		// none of these provider blocks should be present
		expect(Object.keys(s.envExample).some((k) => k.startsWith("UMAMI"))).toBe(false);
		expect(Object.keys(s.envExample).some((k) => k.startsWith("GROWTHBOOK"))).toBe(false);
		expect(Object.keys(s.envExample).some((k) => k.startsWith("OPENREPLAY"))).toBe(false);
	});

	it("object input threads analytics=umami into envExample", () => {
		const s = createAstropressProjectScaffold({ analytics: "umami" });
		expect(s.envExample.PUBLIC_UMAMI_WEBSITE_ID).toBeDefined();
	});

	it("object input threads abTesting=growthbook into envExample", () => {
		const s = createAstropressProjectScaffold({ abTesting: "growthbook" });
		expect(Object.keys(s.envExample).some((k) => k.toLowerCase().includes("growthbook"))).toBe(
			true,
		);
	});

	it("object input threads heatmap=openreplay into envExample", () => {
		const s = createAstropressProjectScaffold({ heatmap: "openreplay" });
		expect(s.envExample.PUBLIC_OPENREPLAY_PROJECT_KEY).toBeDefined();
	});

	it("object input threads donations into envExample", () => {
		const s = createAstropressProjectScaffold({
			donations: { giveLively: true },
		});
		expect(s.envExample.GIVELIVELY_ORG_SLUG).toBeDefined();
	});
});

describe("project scaffold — recommendationRationale and requiredEnvKeys defaults", () => {
	it("known matrix entry surfaces matrixEntry.notes verbatim", () => {
		// vercel+supabase is a first-class pair → matrix entry has notes
		const s = createAstropressProjectScaffold({
			appHost: "vercel",
			dataServices: "supabase",
		});
		// Notes are non-empty and don't contain the fallback phrasing
		expect(s.recommendationRationale.length).toBeGreaterThan(0);
		expect(s.recommendationRationale).not.toContain("does not yet mark");
	});

	it("unknown matrix entry falls back to a template-literal rationale containing both names", () => {
		// Pick an unusual combination not in the matrix
		const s = createAstropressProjectScaffold({
			appHost: "gitlab-pages",
			dataServices: "cloudflare",
		});
		expect(s.recommendationRationale).toContain("gitlab-pages");
		expect(s.recommendationRationale).toContain("cloudflare");
		expect(s.recommendationRationale).toContain("does not yet mark");
	});

	it("known matrix entry surfaces requiredEnvKeys from the matrix entry", () => {
		const s = createAstropressProjectScaffold({
			appHost: "vercel",
			dataServices: "supabase",
		});
		expect(Array.isArray(s.requiredEnvKeys)).toBe(true);
		// Supabase entry requires SUPABASE_* keys
		expect(s.requiredEnvKeys.length).toBeGreaterThan(0);
	});

	it("unknown matrix entry → requiredEnvKeys defaults to empty array (not 'Stryker was here')", () => {
		const s = createAstropressProjectScaffold({
			appHost: "gitlab-pages",
			dataServices: "cloudflare",
		});
		expect(s.requiredEnvKeys).toEqual([]);
	});

	it("supportLevel is computed from (appHost, dataServices) — not blank", () => {
		const s = createAstropressProjectScaffold({
			appHost: "vercel",
			dataServices: "supabase",
		});
		expect(typeof s.supportLevel).toBe("string");
		expect(s.supportLevel.length).toBeGreaterThan(0);
	});
});
