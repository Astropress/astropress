import { afterAll, afterEach, describe, expect, it, vi } from "vitest";

async function importRuntimeEnv() {
	vi.resetModules();
	return import("../src/runtime-prod.js");
}

async function importUtils() {
	vi.resetModules();
	return import("../src/sqlite-runtime/utils.js");
}

afterAll(() => {
	vi.resetModules();
});

describe("devRootSecretOrThrow (#126 / #132)", () => {
	afterEach(() => vi.unstubAllEnvs());

	it("returns DEV_ROOT_SECRET_FALLBACK in non-production runtimes", async () => {
		vi.stubEnv("PROD", false);
		const env = await importRuntimeEnv();
		expect(env.devRootSecretOrThrow()).toBe(env.DEV_ROOT_SECRET_FALLBACK);
	});

	it("throws in production with a message naming ASTROPRESS_ROOT_SECRET", async () => {
		vi.stubEnv("PROD", "true");
		const env = await importRuntimeEnv();
		expect(() => env.devRootSecretOrThrow()).toThrow(/ASTROPRESS_ROOT_SECRET/);
		// Assert the full operator-facing message (all three concatenated
		// fragments) so a StringLiteral mutant blanking any fragment is caught.
		let message = "";
		try {
			env.devRootSecretOrThrow();
		} catch (err) {
			message = (err as Error).message;
		}
		expect(message).toContain("must be configured in production");
		expect(message).toContain("Refusing to fall back to the public development root secret");
		expect(message).toContain("for session/token/integration-seal protection.");
	});
});

describe("resolveTokenHashSecret (#132 token-hash path)", () => {
	afterEach(() => vi.unstubAllEnvs());

	it("returns the explicit secret unchanged when one is configured", async () => {
		vi.stubEnv("PROD", "true"); // even in prod, explicit secret flows through
		const env = await importRuntimeEnv();
		expect(env.resolveTokenHashSecret("real-secret")).toBe("real-secret");
	});

	it("preserves an explicit empty-string secret (does not collapse to fallback)", async () => {
		vi.stubEnv("PROD", false);
		const env = await importRuntimeEnv();
		expect(env.resolveTokenHashSecret("")).toBe("");
	});

	it("falls back to DEV_ROOT_SECRET_FALLBACK when secret is null/undefined (dev)", async () => {
		vi.stubEnv("PROD", false);
		const env = await importRuntimeEnv();
		expect(env.resolveTokenHashSecret(undefined)).toBe(env.DEV_ROOT_SECRET_FALLBACK);
		expect(env.resolveTokenHashSecret(null)).toBe(env.DEV_ROOT_SECRET_FALLBACK);
	});

	it("throws in production when secret is null/undefined (fail-closed)", async () => {
		vi.stubEnv("PROD", "true");
		const env = await importRuntimeEnv();
		expect(() => env.resolveTokenHashSecret(undefined)).toThrow(/ASTROPRESS_ROOT_SECRET/);
	});
});

describe("hashOpaqueToken default secret resolution (#132)", () => {
	afterEach(() => vi.unstubAllEnvs());

	it("hashes successfully in dev when no secret is threaded", async () => {
		vi.stubEnv("PROD", false);
		const { hashOpaqueToken } = await importUtils();
		expect(hashOpaqueToken("invite-token")).toMatch(/^[a-f0-9]+$/);
	});

	it("throws in production when no secret is threaded (fail-closed for D1 invite/reset/api-token paths)", async () => {
		vi.stubEnv("PROD", "true");
		const { hashOpaqueToken } = await importUtils();
		expect(() => hashOpaqueToken("invite-token")).toThrow(/ASTROPRESS_ROOT_SECRET/);
	});

	it("in production, a configured secret hashes successfully", async () => {
		vi.stubEnv("PROD", "true");
		const { hashOpaqueToken } = await importUtils();
		expect(hashOpaqueToken("invite-token", "configured-secret")).toMatch(/^[a-f0-9]+$/);
	});
});
