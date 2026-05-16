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
		expect(
			resolveAstropressAppHostFromEnv({
				ASTROPRESS_DEPLOY_TARGET: "cloudflare",
			}),
		).toBe("cloudflare-pages");
	});

	it("resolves data-services defaults and explicit values", () => {
		expect(resolveAstropressDataServicesFromEnv({})).toBe("none");
		expect(
			resolveAstropressDataServicesFromEnv({
				ASTROPRESS_CONTENT_SERVICES: "appwrite",
			}),
		).toBe("appwrite");
		expect(
			resolveAstropressDataServicesFromEnv({
				ASTROPRESS_LOCAL_PROVIDER: "supabase",
			}),
		).toBe("supabase");
	});

	it("resolves local provider defaults from the data-services choice", () => {
		expect(resolveAstropressLocalProviderFromEnv({})).toBe("sqlite");
		expect(
			resolveAstropressLocalProviderFromEnv({
				ASTROPRESS_LOCAL_PROVIDER: "supabase",
			}),
		).toBe("supabase");
	});

	it("resolves hosted provider defaults", () => {
		expect(resolveAstropressHostedProviderFromEnv({})).toBe("supabase");
		expect(
			resolveAstropressHostedProviderFromEnv({
				ASTROPRESS_HOSTED_PROVIDER: "nhost",
			}),
		).toBe("nhost");
		expect(
			resolveAstropressHostedProviderFromEnv({
				ASTROPRESS_HOSTED_PROVIDER: "neon",
			}),
		).toBe("neon");
		expect(
			resolveAstropressHostedProviderFromEnv({
				ASTROPRESS_HOSTED_PROVIDER: "turso",
			}),
		).toBe("turso");
	});

	it("resolves deploy targets from explicit values or the app-host selection", () => {
		expect(resolveAstropressDeployTarget({})).toBe("github-pages");
		expect(
			resolveAstropressDeployTarget({
				ASTROPRESS_APP_HOST: "cloudflare-pages",
			}),
		).toBe("cloudflare");
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
	});
});

describe("resolveAstropressAppHostFromEnv — additional branches", () => {
	it("returns each explicit ASTROPRESS_APP_HOST value verbatim", () => {
		const hosts = ["render-web", "gitlab-pages", "render-static", "netlify", "custom"] as const;
		for (const host of hosts) {
			expect(resolveAstropressAppHostFromEnv({ ASTROPRESS_APP_HOST: host })).toBe(host);
		}
	});

	it("falls back to ASTROPRESS_WEB_HOST when ASTROPRESS_APP_HOST is absent", () => {
		expect(resolveAstropressAppHostFromEnv({ ASTROPRESS_WEB_HOST: "netlify" })).toBe("netlify");
	});

	it("maps legacy ASTROPRESS_LOCAL_PROVIDER=supabase → vercel via data-services chain", () => {
		expect(
			resolveAstropressAppHostFromEnv({
				ASTROPRESS_LOCAL_PROVIDER: "supabase",
			}),
		).toBe("vercel");
	});

	it("maps legacy ASTROPRESS_HOSTED_PROVIDER=appwrite → render-web via data-services chain", () => {
		expect(
			resolveAstropressAppHostFromEnv({
				ASTROPRESS_HOSTED_PROVIDER: "appwrite",
			}),
		).toBe("render-web");
	});

	it("maps ASTROPRESS_HOSTED_PROVIDER=nhost|neon|turso → render-web via data-services chain", () => {
		expect(resolveAstropressAppHostFromEnv({ ASTROPRESS_HOSTED_PROVIDER: "nhost" })).toBe(
			"render-web",
		);
		expect(resolveAstropressAppHostFromEnv({ ASTROPRESS_HOSTED_PROVIDER: "neon" })).toBe(
			"render-web",
		);
		expect(resolveAstropressAppHostFromEnv({ ASTROPRESS_HOSTED_PROVIDER: "turso" })).toBe(
			"render-web",
		);
	});

	it("maps ASTROPRESS_DEPLOY_TARGET=github-pages → github-pages via legacy deploy target mapper", () => {
		expect(
			resolveAstropressAppHostFromEnv({
				ASTROPRESS_DEPLOY_TARGET: "github-pages",
			}),
		).toBe("github-pages");
	});

	it("maps ASTROPRESS_DEPLOY_TARGET=vercel → vercel via legacy deploy target mapper", () => {
		expect(resolveAstropressAppHostFromEnv({ ASTROPRESS_DEPLOY_TARGET: "vercel" })).toBe("vercel");
	});

	it("maps ASTROPRESS_DEPLOY_TARGET=netlify → netlify via legacy deploy target mapper", () => {
		expect(resolveAstropressAppHostFromEnv({ ASTROPRESS_DEPLOY_TARGET: "netlify" })).toBe(
			"netlify",
		);
	});

	it("maps ASTROPRESS_DEPLOY_TARGET=render-static → render-static via legacy deploy target mapper", () => {
		expect(
			resolveAstropressAppHostFromEnv({
				ASTROPRESS_DEPLOY_TARGET: "render-static",
			}),
		).toBe("render-static");
	});

	it("maps ASTROPRESS_DEPLOY_TARGET=render-web → render-web via legacy deploy target mapper", () => {
		expect(
			resolveAstropressAppHostFromEnv({
				ASTROPRESS_DEPLOY_TARGET: "render-web",
			}),
		).toBe("render-web");
	});

	it("maps ASTROPRESS_DEPLOY_TARGET=cloudflare → cloudflare-pages via data-services chain", () => {
		// non-cloudflare deploy target does NOT produce a legacyDeployTarget early-return,
		// so cloudflare data-services branch is hit instead
		expect(
			resolveAstropressAppHostFromEnv({
				ASTROPRESS_DEPLOY_TARGET: "cloudflare",
			}),
		).toBe("cloudflare-pages");
	});

	it("maps ASTROPRESS_DEPLOY_TARGET=gitlab-pages → gitlab-pages via legacy deploy target mapper", () => {
		expect(
			resolveAstropressAppHostFromEnv({
				ASTROPRESS_DEPLOY_TARGET: "gitlab-pages",
			}),
		).toBe("gitlab-pages");
	});
});

describe("resolveAstropressHostedProviderFromEnv — additional branches", () => {
	it("returns pocketbase when ASTROPRESS_HOSTED_PROVIDER=pocketbase", () => {
		expect(
			resolveAstropressHostedProviderFromEnv({
				ASTROPRESS_HOSTED_PROVIDER: "pocketbase",
			}),
		).toBe("pocketbase");
	});

	it("returns nhost, neon, and turso when selected explicitly", () => {
		expect(
			resolveAstropressHostedProviderFromEnv({
				ASTROPRESS_HOSTED_PROVIDER: "nhost",
			}),
		).toBe("nhost");
		expect(
			resolveAstropressHostedProviderFromEnv({
				ASTROPRESS_HOSTED_PROVIDER: "neon",
			}),
		).toBe("neon");
		expect(
			resolveAstropressHostedProviderFromEnv({
				ASTROPRESS_HOSTED_PROVIDER: "turso",
			}),
		).toBe("turso");
	});

	it("returns appwrite when ASTROPRESS_HOSTED_PROVIDER=appwrite", () => {
		expect(
			resolveAstropressHostedProviderFromEnv({
				ASTROPRESS_HOSTED_PROVIDER: "appwrite",
			}),
		).toBe("appwrite");
	});

	it("returns pocketbase when ASTROPRESS_DATA_SERVICES=pocketbase (fallback from dataServices)", () => {
		expect(
			resolveAstropressHostedProviderFromEnv({
				ASTROPRESS_DATA_SERVICES: "pocketbase",
			}),
		).toBe("pocketbase");
	});

	it("returns appwrite when ASTROPRESS_DATA_SERVICES=appwrite (fallback from dataServices)", () => {
		expect(
			resolveAstropressHostedProviderFromEnv({
				ASTROPRESS_DATA_SERVICES: "appwrite",
			}),
		).toBe("appwrite");
	});

	it("returns nhost, neon, and turso from ASTROPRESS_DATA_SERVICES fallback", () => {
		expect(
			resolveAstropressHostedProviderFromEnv({
				ASTROPRESS_DATA_SERVICES: "nhost",
			}),
		).toBe("nhost");
		expect(
			resolveAstropressHostedProviderFromEnv({
				ASTROPRESS_DATA_SERVICES: "neon",
			}),
		).toBe("neon");
		expect(
			resolveAstropressHostedProviderFromEnv({
				ASTROPRESS_DATA_SERVICES: "turso",
			}),
		).toBe("turso");
	});
});

describe("resolveAstropressServiceOriginFromEnv — additional branches", () => {
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
			resolveAstropressServiceOriginFromEnv({
				ASTROPRESS_DATA_SERVICES: "appwrite",
			}),
		).toBeNull();
	});

	it("returns null when supabase is selected but SUPABASE_URL is absent", () => {
		expect(
			resolveAstropressServiceOriginFromEnv({
				ASTROPRESS_DATA_SERVICES: "supabase",
			}),
		).toBeNull();
	});

	it("returns nhost service origin from NHOST_SUBDOMAIN and NHOST_REGION", () => {
		expect(
			resolveAstropressServiceOriginFromEnv({
				ASTROPRESS_DATA_SERVICES: "nhost",
				NHOST_SUBDOMAIN: "abcdefgh",
				NHOST_REGION: "eu-central-1",
			}),
		).toBe("https://abcdefgh.eu-central-1.nhost.run/v1/functions/astropress");
	});
});

describe("resolveAstropressServiceOriginFromEnv — fallthrough branch", () => {
	it("returns null for cloudflare (no ASTROPRESS_SERVICE_ORIGIN and no specific env key for cloudflare)", () => {
		// cloudflare doesn't have a dedicated origin-building path → falls through to null
		expect(
			resolveAstropressServiceOriginFromEnv({
				ASTROPRESS_DATA_SERVICES: "cloudflare",
			}),
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
		expect(
			resolveAstropressDataServicesFromEnv({
				ASTROPRESS_DEPLOY_TARGET: "cloudflare",
			}),
		).toBe("cloudflare");
	});
});

describe("resolveAstropressDeployTarget — explicit target values", () => {
	it("returns each explicit ASTROPRESS_DEPLOY_TARGET value verbatim", () => {
		const targets = ["render-static", "render-web", "gitlab-pages", "netlify", "custom"] as const;
		for (const target of targets) {
			expect(resolveAstropressDeployTarget({ ASTROPRESS_DEPLOY_TARGET: target })).toBe(target);
		}
	});
});

describe("project-env — mutation hardening (whitespace trimming + fast-path precedence)", () => {
	// --- mapLegacyDeployTargetToAppHost (private, via resolveAstropressAppHostFromEnv) ---
	it("trims a padded ASTROPRESS_DEPLOY_TARGET before legacy app-host mapping", () => {
		expect(resolveAstropressAppHostFromEnv({ ASTROPRESS_DEPLOY_TARGET: " vercel " })).toBe(
			"vercel",
		);
	});

	it("legacy github-pages deploy target wins over the data-services fallback", () => {
		// Without the legacy github-pages case, the appwrite hosted provider would
		// resolve the app host to render-web instead.
		expect(
			resolveAstropressAppHostFromEnv({
				ASTROPRESS_DEPLOY_TARGET: "github-pages",
				ASTROPRESS_HOSTED_PROVIDER: "appwrite",
			}),
		).toBe("github-pages");
	});

	it("trims a padded github-pages legacy deploy target", () => {
		expect(
			resolveAstropressAppHostFromEnv({
				ASTROPRESS_DEPLOY_TARGET: " github-pages ",
				ASTROPRESS_HOSTED_PROVIDER: "appwrite",
			}),
		).toBe("github-pages");
	});

	// --- resolveDataServicesFromLegacyEnv (private, via resolveAstropressDataServicesFromEnv) ---
	it("trims ASTROPRESS_HOSTED_PROVIDER in the legacy data-services resolver", () => {
		expect(resolveAstropressDataServicesFromEnv({ ASTROPRESS_HOSTED_PROVIDER: " appwrite " })).toBe(
			"appwrite",
		);
	});

	it("resolves a legacy pocketbase hosted provider to pocketbase data services", () => {
		expect(resolveAstropressDataServicesFromEnv({ ASTROPRESS_HOSTED_PROVIDER: "pocketbase" })).toBe(
			"pocketbase",
		);
	});

	it("resolves a legacy supabase hosted provider to supabase data services", () => {
		expect(resolveAstropressDataServicesFromEnv({ ASTROPRESS_HOSTED_PROVIDER: "supabase" })).toBe(
			"supabase",
		);
	});

	it("trims ASTROPRESS_LOCAL_PROVIDER in the legacy data-services resolver", () => {
		expect(resolveAstropressDataServicesFromEnv({ ASTROPRESS_LOCAL_PROVIDER: " supabase " })).toBe(
			"supabase",
		);
	});

	it("trims ASTROPRESS_DEPLOY_TARGET when checking the cloudflare legacy fallback", () => {
		expect(resolveAstropressDataServicesFromEnv({ ASTROPRESS_DEPLOY_TARGET: " cloudflare " })).toBe(
			"cloudflare",
		);
	});

	// --- resolveAstropressAppHostFromEnv ---
	it("trims a padded ASTROPRESS_APP_HOST", () => {
		expect(resolveAstropressAppHostFromEnv({ ASTROPRESS_APP_HOST: " vercel " })).toBe("vercel");
	});

	it("trims a padded ASTROPRESS_WEB_HOST fallback", () => {
		expect(resolveAstropressAppHostFromEnv({ ASTROPRESS_WEB_HOST: " netlify " })).toBe("netlify");
	});

	it("explicit github-pages app host wins over a conflicting hosted provider", () => {
		expect(
			resolveAstropressAppHostFromEnv({
				ASTROPRESS_APP_HOST: "github-pages",
				ASTROPRESS_HOSTED_PROVIDER: "appwrite",
			}),
		).toBe("github-pages");
	});

	it("maps pocketbase data services to a render-web app host", () => {
		expect(resolveAstropressAppHostFromEnv({ ASTROPRESS_HOSTED_PROVIDER: "pocketbase" })).toBe(
			"render-web",
		);
	});

	// --- resolveAstropressDataServicesFromEnv ---
	it("trims a padded ASTROPRESS_CONTENT_SERVICES", () => {
		expect(
			resolveAstropressDataServicesFromEnv({ ASTROPRESS_CONTENT_SERVICES: " supabase " }),
		).toBe("supabase");
	});

	it("trims a padded ASTROPRESS_DATA_SERVICES", () => {
		expect(resolveAstropressDataServicesFromEnv({ ASTROPRESS_DATA_SERVICES: " appwrite " })).toBe(
			"appwrite",
		);
	});

	it("trims a padded ASTROPRESS_BACKEND_PLATFORM", () => {
		expect(resolveAstropressDataServicesFromEnv({ ASTROPRESS_BACKEND_PLATFORM: " turso " })).toBe(
			"turso",
		);
	});

	it("explicit 'none' data services wins over a conflicting legacy hosted provider", () => {
		expect(
			resolveAstropressDataServicesFromEnv({
				ASTROPRESS_DATA_SERVICES: "none",
				ASTROPRESS_HOSTED_PROVIDER: "appwrite",
			}),
		).toBe("none");
	});

	it("explicit 'custom' data services is returned verbatim", () => {
		expect(resolveAstropressDataServicesFromEnv({ ASTROPRESS_DATA_SERVICES: "custom" })).toBe(
			"custom",
		);
	});

	// --- resolveAstropressServiceOriginFromEnv ---
	it("trims a padded ASTROPRESS_SERVICE_ORIGIN", () => {
		expect(
			resolveAstropressServiceOriginFromEnv({
				ASTROPRESS_SERVICE_ORIGIN: " https://origin.example ",
			}),
		).toBe("https://origin.example");
	});

	it("trims SUPABASE_URL when building a supabase service origin", () => {
		expect(
			resolveAstropressServiceOriginFromEnv({
				ASTROPRESS_DATA_SERVICES: "supabase",
				SUPABASE_URL: " https://demo.supabase.co ",
			}),
		).toBe("https://demo.supabase.co/functions/v1/astropress");
	});

	it("trims APPWRITE_ENDPOINT when building an appwrite service origin", () => {
		expect(
			resolveAstropressServiceOriginFromEnv({
				ASTROPRESS_DATA_SERVICES: "appwrite",
				APPWRITE_ENDPOINT: " https://cloud.appwrite.io/v1 ",
			}),
		).toBe("https://cloud.appwrite.io/v1/functions/astropress");
	});

	it("only builds an nhost origin when data services is nhost", () => {
		expect(
			resolveAstropressServiceOriginFromEnv({
				ASTROPRESS_DATA_SERVICES: "neon",
				NHOST_SUBDOMAIN: "sub",
				NHOST_REGION: "reg",
			}),
		).toBeNull();
	});

	it("trims NHOST_SUBDOMAIN and NHOST_REGION when building an nhost origin", () => {
		expect(
			resolveAstropressServiceOriginFromEnv({
				ASTROPRESS_DATA_SERVICES: "nhost",
				NHOST_SUBDOMAIN: " sub ",
				NHOST_REGION: " reg ",
			}),
		).toBe("https://sub.reg.nhost.run/v1/functions/astropress");
	});

	it("returns null for an nhost origin when the region is missing", () => {
		expect(
			resolveAstropressServiceOriginFromEnv({
				ASTROPRESS_DATA_SERVICES: "nhost",
				NHOST_SUBDOMAIN: "sub",
			}),
		).toBeNull();
	});

	// --- resolveAstropressLocalProviderFromEnv ---
	it("explicit supabase local provider wins over a conflicting data-services signal", () => {
		expect(
			resolveAstropressLocalProviderFromEnv({
				ASTROPRESS_LOCAL_PROVIDER: " supabase ",
				ASTROPRESS_DATA_SERVICES: "turso",
			}),
		).toBe("supabase");
	});

	// --- resolveAstropressHostedProviderFromEnv ---
	it("explicit hosted providers win over a conflicting ASTROPRESS_DATA_SERVICES", () => {
		expect(
			resolveAstropressHostedProviderFromEnv({
				ASTROPRESS_HOSTED_PROVIDER: " appwrite ",
				ASTROPRESS_DATA_SERVICES: "turso",
			}),
		).toBe("appwrite");
		expect(
			resolveAstropressHostedProviderFromEnv({
				ASTROPRESS_HOSTED_PROVIDER: "pocketbase",
				ASTROPRESS_DATA_SERVICES: "turso",
			}),
		).toBe("pocketbase");
		expect(
			resolveAstropressHostedProviderFromEnv({
				ASTROPRESS_HOSTED_PROVIDER: "nhost",
				ASTROPRESS_DATA_SERVICES: "turso",
			}),
		).toBe("nhost");
		expect(
			resolveAstropressHostedProviderFromEnv({
				ASTROPRESS_HOSTED_PROVIDER: "neon",
				ASTROPRESS_DATA_SERVICES: "turso",
			}),
		).toBe("neon");
		expect(
			resolveAstropressHostedProviderFromEnv({
				ASTROPRESS_HOSTED_PROVIDER: "turso",
				ASTROPRESS_DATA_SERVICES: "appwrite",
			}),
		).toBe("turso");
		expect(
			resolveAstropressHostedProviderFromEnv({
				ASTROPRESS_HOSTED_PROVIDER: "supabase",
				ASTROPRESS_DATA_SERVICES: "turso",
			}),
		).toBe("supabase");
	});

	// --- resolveAstropressDeployTarget ---
	it("explicit deploy targets win over a conflicting ASTROPRESS_APP_HOST", () => {
		const targets = [
			"github-pages",
			"cloudflare",
			"vercel",
			"netlify",
			"render-static",
			"render-web",
			"gitlab-pages",
			"custom",
		] as const;
		for (const target of targets) {
			expect(
				resolveAstropressDeployTarget({
					ASTROPRESS_DEPLOY_TARGET: target,
					ASTROPRESS_APP_HOST: target === "netlify" ? "vercel" : "netlify",
				}),
			).toBe(target);
		}
	});

	it("trims a padded explicit deploy target", () => {
		expect(
			resolveAstropressDeployTarget({
				ASTROPRESS_DEPLOY_TARGET: " vercel ",
				ASTROPRESS_APP_HOST: "netlify",
			}),
		).toBe("vercel");
	});

	// --- resolveAstropressProjectEnvContract ---
	it("trims a padded ADMIN_DB_PATH in the project env contract", () => {
		expect(
			resolveAstropressProjectEnvContract({ ADMIN_DB_PATH: " .data/custom.sqlite " }).adminDbPath,
		).toBe(".data/custom.sqlite");
	});
});

describe("project-env — uncovered branch targets", () => {
	it("resolveAstropressDataServicesFromEnv falls back to BACKEND_PLATFORM when CONTENT/DATA_SERVICES are absent", () => {
		// CONTENT_SERVICES and DATA_SERVICES are both undefined → chain reaches BACKEND_PLATFORM
		// BACKEND_PLATFORM is undefined → ?? arm 0 (null short-circuit) taken
		expect(
			resolveAstropressDataServicesFromEnv({
				ASTROPRESS_BACKEND_PLATFORM: undefined,
			}),
		).toBe("none");
		// BACKEND_PLATFORM is set to a valid value → arm 1 (trim() called)
		expect(
			resolveAstropressDataServicesFromEnv({
				ASTROPRESS_BACKEND_PLATFORM: "supabase",
			}),
		).toBe("supabase");
	});
});
