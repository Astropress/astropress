import { afterAll, afterEach, describe, expect, it, vi } from "vitest";

async function importRuntimeEnv() {
	vi.resetModules();
	return import("../src/runtime-env.js");
}

afterAll(() => {
	vi.resetModules();
});

describe("runtime env login security config", () => {
	afterEach(() => {
		vi.unstubAllEnvs();
	});

	it("keeps production login attempts strict", async () => {
		vi.stubEnv("PROD", true);
		const runtimeEnv = await importRuntimeEnv();

		expect(runtimeEnv.getLoginSecurityConfig().maxLoginAttempts).toBe(5);
		expect(runtimeEnv.getLoginSecurityConfig().secureCookies).toBe(true);
	});

	it("uses a higher login-attempt ceiling outside production for repeated test logins", async () => {
		vi.stubEnv("PROD", false);
		const runtimeEnv = await importRuntimeEnv();

		expect(runtimeEnv.getLoginSecurityConfig().maxLoginAttempts).toBe(250);
		expect(runtimeEnv.getLoginSecurityConfig().secureCookies).toBe(false);
	});

	it("keeps the login-attempt ceiling strict during playwright runs", async () => {
		vi.stubEnv("PROD", false);
		vi.stubEnv("PLAYWRIGHT_E2E_MODE", "admin");
		const runtimeEnv = await importRuntimeEnv();

		expect(runtimeEnv.getLoginSecurityConfig().maxLoginAttempts).toBe(5);
	});

	it("allows an explicit login-attempt override", async () => {
		vi.stubEnv("PROD", false);
		vi.stubEnv("LOGIN_MAX_ATTEMPTS", "12");
		const runtimeEnv = await importRuntimeEnv();

		expect(runtimeEnv.getLoginSecurityConfig().maxLoginAttempts).toBe(12);
	});

	it("accepts legacy ASTROPRESS_* bootstrap env aliases", async () => {
		vi.stubEnv("PROD", false);
		vi.stubEnv("ASTROPRESS_SESSION_SECRET", "legacy-session-secret");
		vi.stubEnv("ASTROPRESS_ADMIN_PASSWORD", "legacy-admin-password");
		vi.stubEnv("ASTROPRESS_EDITOR_PASSWORD", "legacy-editor-password");
		const runtimeEnv = await importRuntimeEnv();

		expect(runtimeEnv.getAstropressRootSecret()).toBe("legacy-session-secret");
		expect(runtimeEnv.getAdminBootstrapConfig()).toMatchObject({
			adminPassword: "legacy-admin-password",
			editorPassword: "legacy-editor-password",
			sessionSecret: "legacy-session-secret",
		});
	});

	it("exposes current and previous bootstrap secrets during rotation", async () => {
		vi.stubEnv("PROD", false);
		vi.stubEnv("SESSION_SECRET", "current-session-secret");
		vi.stubEnv("SESSION_SECRET_PREV", "previous-session-secret");
		const runtimeEnv = await importRuntimeEnv();

		expect(runtimeEnv.getAstropressRootSecretCandidates()).toEqual([
			"current-session-secret",
			"previous-session-secret",
		]);
		expect(runtimeEnv.getAdminBootstrapConfig()).toMatchObject({
			rootSecret: "current-session-secret",
			rootSecretPrevious: "previous-session-secret",
			sessionSecret: "current-session-secret",
			sessionSecretPrevious: "previous-session-secret",
		});
	});
});

describe("isProductionRuntime", () => {
	afterEach(() => {
		vi.unstubAllEnvs();
		Reflect.deleteProperty(process.env, "PROD");
	});

	it('treats process.env PROD="true" as production', async () => {
		process.env.PROD = "true";
		const runtimeEnv = await importRuntimeEnv();
		expect(runtimeEnv.isProductionRuntime()).toBe(true);
	});

	it('treats process.env PROD="1" as production', async () => {
		process.env.PROD = "1";
		const runtimeEnv = await importRuntimeEnv();
		expect(runtimeEnv.isProductionRuntime()).toBe(true);
	});

	it("treats other PROD values as non-production", async () => {
		process.env.PROD = "yes";
		const runtimeEnv = await importRuntimeEnv();
		expect(runtimeEnv.isProductionRuntime()).toBe(false);
	});

	it("is non-production when PROD is unset", async () => {
		Reflect.deleteProperty(process.env, "PROD");
		const runtimeEnv = await importRuntimeEnv();
		expect(runtimeEnv.isProductionRuntime()).toBe(false);
	});
});

describe("getRuntimeEnv", () => {
	const originalDev = process.env.DEV;
	afterEach(() => {
		vi.unstubAllEnvs();
		if (originalDev === undefined) {
			Reflect.deleteProperty(process.env, "DEV");
		} else {
			process.env.DEV = originalDev;
		}
	});

	it("reads a value from process.env", async () => {
		vi.stubEnv("SMTP_HOST", "smtp.example.com");
		const runtimeEnv = await importRuntimeEnv();
		expect(runtimeEnv.getRuntimeEnv("SMTP_HOST")).toBe("smtp.example.com");
	});

	it("returns undefined for an unset key", async () => {
		const runtimeEnv = await importRuntimeEnv();
		expect(runtimeEnv.getRuntimeEnv("DEFINITELY_UNSET_KEY_XYZ")).toBeUndefined();
	});

	it("falls back to import.meta.env when process.env lacks the key", async () => {
		// DEV is injected into import.meta.env (boolean true) by vite; dropping
		// the process.env copy forces getRuntimeEnvValue down the import.meta.env path.
		Reflect.deleteProperty(process.env, "DEV");
		const runtimeEnv = await importRuntimeEnv();
		expect(runtimeEnv.getRuntimeEnv("DEV")).toBe(true);
	});
});

describe("getCloudflareBindings", () => {
	afterEach(() => {
		(globalThis as { __astropressCloudflareBindings?: unknown }).__astropressCloudflareBindings =
			undefined;
	});

	it("returns the runtime env from locals when present", async () => {
		const runtimeEnv = await importRuntimeEnv();
		const env = { SMTP_HOST: "from-locals" };
		const bindings = runtimeEnv.getCloudflareBindings({
			runtime: { env },
		} as unknown as App.Locals);
		expect(bindings).toBe(env);
	});

	it("falls back to global bindings when locals has no runtime env", async () => {
		const runtimeEnv = await importRuntimeEnv();
		const globalEnv = { SMTP_HOST: "from-global" };
		(globalThis as { __astropressCloudflareBindings?: unknown }).__astropressCloudflareBindings =
			globalEnv;
		const bindings = runtimeEnv.getCloudflareBindings({
			runtime: { env: undefined },
		} as unknown as App.Locals);
		expect(bindings).toBe(globalEnv);
	});

	it("falls back to global bindings when locals is null", async () => {
		const runtimeEnv = await importRuntimeEnv();
		const globalEnv = { SMTP_HOST: "from-global-2" };
		(globalThis as { __astropressCloudflareBindings?: unknown }).__astropressCloudflareBindings =
			globalEnv;
		expect(runtimeEnv.getCloudflareBindings(null)).toBe(globalEnv);
	});

	it("returns an empty object when no bindings are configured", async () => {
		const runtimeEnv = await importRuntimeEnv();
		expect(runtimeEnv.getCloudflareBindings(null)).toEqual({});
	});

	it("ignores a non-object runtime value", async () => {
		const runtimeEnv = await importRuntimeEnv();
		expect(
			runtimeEnv.getCloudflareBindings({ runtime: "not-an-object" } as unknown as App.Locals),
		).toEqual({});
	});
});

describe("getStringRuntimeValue", () => {
	afterEach(() => {
		vi.unstubAllEnvs();
		(globalThis as { __astropressCloudflareBindings?: unknown }).__astropressCloudflareBindings =
			undefined;
	});

	it("prefers a cloudflare binding over the process env", async () => {
		vi.stubEnv("SMTP_HOST", "from-env");
		const runtimeEnv = await importRuntimeEnv();
		const value = runtimeEnv.getStringRuntimeValue("SMTP_HOST", {
			runtime: { env: { SMTP_HOST: "from-binding" } },
		} as unknown as App.Locals);
		expect(value).toBe("from-binding");
	});

	it("falls back to the process env when no binding is set", async () => {
		vi.stubEnv("SMTP_HOST", "from-env-only");
		const runtimeEnv = await importRuntimeEnv();
		expect(runtimeEnv.getStringRuntimeValue("SMTP_HOST")).toBe("from-env-only");
	});

	it("falls back to a legacy alias when the primary key is unset", async () => {
		vi.stubEnv("ASTROPRESS_SESSION_SECRET", "legacy-value");
		const runtimeEnv = await importRuntimeEnv();
		expect(runtimeEnv.getStringRuntimeValue("SESSION_SECRET")).toBe("legacy-value");
	});

	it("returns undefined when no source provides the value", async () => {
		const runtimeEnv = await importRuntimeEnv();
		expect(runtimeEnv.getStringRuntimeValue("SMTP_HOST")).toBeUndefined();
	});

	it("returns undefined when a key has no alias and no value", async () => {
		const runtimeEnv = await importRuntimeEnv();
		expect(runtimeEnv.getStringRuntimeValue("LISTMONK_API_URL")).toBeUndefined();
	});
});

describe("getNewsletterConfig", () => {
	afterEach(() => {
		vi.unstubAllEnvs();
	});

	it("uses the explicit delivery mode and listmonk credentials", async () => {
		vi.stubEnv("NEWSLETTER_DELIVERY_MODE", "listmonk");
		vi.stubEnv("LISTMONK_API_URL", "https://listmonk.example.com");
		vi.stubEnv("LISTMONK_API_USERNAME", "lm-user");
		vi.stubEnv("LISTMONK_API_PASSWORD", "lm-pass");
		vi.stubEnv("LISTMONK_LIST_ID", "7");
		const runtimeEnv = await importRuntimeEnv();
		expect(runtimeEnv.getNewsletterConfig()).toEqual({
			mode: "listmonk",
			listmonkApiUrl: "https://listmonk.example.com",
			listmonkApiUsername: "lm-user",
			listmonkApiPassword: "lm-pass",
			listmonkListId: "7",
		});
	});

	it("defaults to listmonk in production when mode is unset", async () => {
		vi.stubEnv("NEWSLETTER_DELIVERY_MODE", undefined);
		vi.stubEnv("PROD", true);
		const runtimeEnv = await importRuntimeEnv();
		expect(runtimeEnv.getNewsletterConfig().mode).toBe("listmonk");
	});

	it("defaults to mock outside production when mode is unset", async () => {
		vi.stubEnv("NEWSLETTER_DELIVERY_MODE", undefined);
		vi.stubEnv("PROD", false);
		const runtimeEnv = await importRuntimeEnv();
		expect(runtimeEnv.getNewsletterConfig().mode).toBe("mock");
	});
});

describe("getTransactionalEmailConfig", () => {
	afterEach(() => {
		vi.unstubAllEnvs();
	});

	it("reads every transactional email field from the environment", async () => {
		vi.stubEnv("EMAIL_DELIVERY_MODE", "smtp");
		vi.stubEnv("RESEND_API_KEY", "resend-key");
		vi.stubEnv("RESEND_FROM_EMAIL", "resend@example.com");
		vi.stubEnv("SMTP_HOST", "smtp.example.com");
		vi.stubEnv("SMTP_PORT", "587");
		vi.stubEnv("SMTP_USERNAME", "smtp-user");
		vi.stubEnv("SMTP_PASSWORD", "smtp-pass");
		vi.stubEnv("SMTP_FROM_EMAIL", "smtp@example.com");
		vi.stubEnv("CONTACT_NOTIFICATION_TO_EMAIL", "contact@example.com");
		const runtimeEnv = await importRuntimeEnv();
		expect(runtimeEnv.getTransactionalEmailConfig()).toEqual({
			mode: "smtp",
			resendApiKey: "resend-key",
			resendFrom: "resend@example.com",
			smtpHost: "smtp.example.com",
			smtpPort: "587",
			smtpUsername: "smtp-user",
			smtpPassword: "smtp-pass",
			smtpFrom: "smtp@example.com",
			contactDestination: "contact@example.com",
		});
	});

	it("defaults the mode to mock when unset", async () => {
		vi.stubEnv("EMAIL_DELIVERY_MODE", undefined);
		const runtimeEnv = await importRuntimeEnv();
		expect(runtimeEnv.getTransactionalEmailConfig().mode).toBe("mock");
	});
});

describe("getTurnstileSiteKey", () => {
	afterEach(() => {
		vi.unstubAllEnvs();
	});

	it("returns the configured turnstile site key", async () => {
		vi.stubEnv("PUBLIC_TURNSTILE_SITE_KEY", "site-key-123");
		const runtimeEnv = await importRuntimeEnv();
		expect(runtimeEnv.getTurnstileSiteKey()).toBe("site-key-123");
	});

	it("returns undefined when no turnstile site key is configured", async () => {
		const runtimeEnv = await importRuntimeEnv();
		expect(runtimeEnv.getTurnstileSiteKey()).toBeUndefined();
	});
});

describe("getAdminBootstrapConfig", () => {
	afterEach(() => {
		vi.unstubAllEnvs();
	});

	it("supplies e2e bootstrap passwords when running under PLAYWRIGHT_E2E_MODE", async () => {
		vi.stubEnv("PLAYWRIGHT_E2E_MODE", "admin");
		const runtimeEnv = await importRuntimeEnv();
		expect(runtimeEnv.getAdminBootstrapConfig()).toMatchObject({
			adminPassword: "ap-e2e-admin-password",
			editorPassword: "ap-e2e-editor-password",
		});
	});

	it("supplies e2e bootstrap passwords when running under the PLAYWRIGHT flag", async () => {
		vi.stubEnv("PLAYWRIGHT", "1");
		const runtimeEnv = await importRuntimeEnv();
		expect(runtimeEnv.getAdminBootstrapConfig()).toMatchObject({
			adminPassword: "ap-e2e-admin-password",
			editorPassword: "ap-e2e-editor-password",
		});
	});

	it("leaves bootstrap passwords undefined outside playwright runs", async () => {
		const runtimeEnv = await importRuntimeEnv();
		expect(runtimeEnv.getAdminBootstrapConfig()).toMatchObject({
			adminPassword: undefined,
			editorPassword: undefined,
		});
	});

	it('marks bootstrap disabled only when ADMIN_BOOTSTRAP_DISABLED is exactly "1"', async () => {
		vi.stubEnv("ADMIN_BOOTSTRAP_DISABLED", "1");
		let runtimeEnv = await importRuntimeEnv();
		expect(runtimeEnv.getAdminBootstrapConfig().bootstrapDisabled).toBe(true);

		vi.stubEnv("ADMIN_BOOTSTRAP_DISABLED", "true");
		runtimeEnv = await importRuntimeEnv();
		expect(runtimeEnv.getAdminBootstrapConfig().bootstrapDisabled).toBe(false);
	});

	it("leaves bootstrap enabled when ADMIN_BOOTSTRAP_DISABLED is unset", async () => {
		const runtimeEnv = await importRuntimeEnv();
		expect(runtimeEnv.getAdminBootstrapConfig().bootstrapDisabled).toBe(false);
	});

	it("exposes the configured admin database path", async () => {
		vi.stubEnv("ADMIN_DB_PATH", "/var/data/admin.db");
		const runtimeEnv = await importRuntimeEnv();
		expect(runtimeEnv.getAdminBootstrapConfig().adminDbPath).toBe("/var/data/admin.db");
	});

	it("defaults rootSecret to the dev fallback when no secrets are configured (non-production)", async () => {
		const runtimeEnv = await importRuntimeEnv();
		expect(runtimeEnv.getAdminBootstrapConfig().rootSecret).toBe(
			runtimeEnv.DEV_ROOT_SECRET_FALLBACK,
		);
	});

	it("throws in production when no rootSecret is configured (fail-closed; #132)", async () => {
		vi.stubEnv("PROD", "true");
		const runtimeEnv = await importRuntimeEnv();
		expect(() => runtimeEnv.getAdminBootstrapConfig()).toThrow(/ASTROPRESS_ROOT_SECRET/i);
	});
});

describe("getAstropressRootSecret", () => {
	afterEach(() => {
		vi.unstubAllEnvs();
	});

	it("prefers the explicit ASTROPRESS_ROOT_SECRET", async () => {
		vi.stubEnv("ASTROPRESS_ROOT_SECRET", "explicit-root-secret");
		const runtimeEnv = await importRuntimeEnv();
		expect(runtimeEnv.getAstropressRootSecret()).toBe("explicit-root-secret");
	});

	it("falls back to the dev root secret when nothing is configured (non-production)", async () => {
		const runtimeEnv = await importRuntimeEnv();
		expect(runtimeEnv.getAstropressRootSecret()).toBe(runtimeEnv.DEV_ROOT_SECRET_FALLBACK);
	});

	it("throws in production when nothing is configured (fail-closed; #132)", async () => {
		vi.stubEnv("PROD", "true");
		const runtimeEnv = await importRuntimeEnv();
		expect(() => runtimeEnv.getAstropressRootSecret()).toThrow(/ASTROPRESS_ROOT_SECRET/i);
	});
});

describe("getAstropressRootSecretCandidates", () => {
	afterEach(() => {
		vi.unstubAllEnvs();
	});

	it("uses ASTROPRESS_ROOT_SECRET and ASTROPRESS_ROOT_SECRET_PREV directly", async () => {
		vi.stubEnv("ASTROPRESS_ROOT_SECRET", "current-root");
		vi.stubEnv("ASTROPRESS_ROOT_SECRET_PREV", "previous-root");
		const runtimeEnv = await importRuntimeEnv();
		expect(runtimeEnv.getAstropressRootSecretCandidates()).toEqual([
			"current-root",
			"previous-root",
		]);
	});

	it("trims surrounding whitespace from configured secrets", async () => {
		vi.stubEnv("ASTROPRESS_ROOT_SECRET", "  padded-root  ");
		const runtimeEnv = await importRuntimeEnv();
		expect(runtimeEnv.getAstropressRootSecretCandidates()).toEqual(["padded-root"]);
	});

	it("drops whitespace-only secrets", async () => {
		vi.stubEnv("ASTROPRESS_ROOT_SECRET", "   ");
		const runtimeEnv = await importRuntimeEnv();
		expect(runtimeEnv.getAstropressRootSecretCandidates()).toEqual([]);
	});

	it("deduplicates identical current and previous secrets", async () => {
		vi.stubEnv("ASTROPRESS_ROOT_SECRET", "same-secret");
		vi.stubEnv("ASTROPRESS_ROOT_SECRET_PREV", "same-secret");
		const runtimeEnv = await importRuntimeEnv();
		expect(runtimeEnv.getAstropressRootSecretCandidates()).toEqual(["same-secret"]);
	});
});

describe("getLoginSecurityConfig attempt ceiling", () => {
	afterEach(() => {
		vi.unstubAllEnvs();
	});

	it("ignores a non-positive configured override and uses the dev ceiling", async () => {
		vi.stubEnv("PROD", false);
		vi.stubEnv("LOGIN_MAX_ATTEMPTS", "0");
		const runtimeEnv = await importRuntimeEnv();
		expect(runtimeEnv.getLoginSecurityConfig().maxLoginAttempts).toBe(250);
	});

	it("ignores a negative configured override and uses the dev ceiling", async () => {
		vi.stubEnv("PROD", false);
		vi.stubEnv("LOGIN_MAX_ATTEMPTS", "-3");
		const runtimeEnv = await importRuntimeEnv();
		expect(runtimeEnv.getLoginSecurityConfig().maxLoginAttempts).toBe(250);
	});
});
