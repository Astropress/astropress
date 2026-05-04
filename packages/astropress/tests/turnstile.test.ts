import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

import { isTurnstileEnabled, verifyTurnstileToken } from "../src/turnstile";

const originalFetch = globalThis.fetch;
const originalEnv = { ...process.env };

beforeEach(() => {
	for (const key of Object.keys(process.env)) {
		if (
			key.startsWith("TURNSTILE_") ||
			key.startsWith("PUBLIC_TURNSTILE_") ||
			key === "NODE_ENV"
		) {
			delete process.env[key];
		}
	}
});

afterEach(() => {
	globalThis.fetch = originalFetch;
	for (const k of Object.keys(process.env)) delete process.env[k];
	for (const [k, v] of Object.entries(originalEnv))
		process.env[k] = v as string;
});

describe("isTurnstileEnabled", () => {
	test("returns false when TURNSTILE_SECRET_KEY is unset", () => {
		expect(isTurnstileEnabled()).toBe(false);
	});

	test("returns true when TURNSTILE_SECRET_KEY is configured", () => {
		process.env.TURNSTILE_SECRET_KEY = "secret-1";
		expect(isTurnstileEnabled()).toBe(true);
	});
});

describe("verifyTurnstileToken", () => {
	test("returns ok when no secret is configured (dev/test mode)", async () => {
		const result = await verifyTurnstileToken({ token: "anything" });
		expect(result).toEqual({ ok: true });
	});

	test("returns error when requireConfigured + production but no secret", async () => {
		process.env.PROD = "1";
		const result = await verifyTurnstileToken({
			token: "anything",
			requireConfigured: true,
		});
		expect(result.ok).toBe(false);
		expect(result.error).toMatch(/not configured/);
	});

	test("returns error when token is missing", async () => {
		process.env.TURNSTILE_SECRET_KEY = "secret-1";
		const result = await verifyTurnstileToken({ token: null });
		expect(result.ok).toBe(false);
		expect(result.error).toMatch(/required/);
	});

	test("returns error when token is whitespace-only", async () => {
		process.env.TURNSTILE_SECRET_KEY = "secret-1";
		const result = await verifyTurnstileToken({ token: "   " });
		expect(result.ok).toBe(false);
	});

	test("returns ok when Cloudflare verifies the token", async () => {
		process.env.TURNSTILE_SECRET_KEY = "secret-1";
		globalThis.fetch = vi.fn().mockResolvedValue({
			ok: true,
			json: async () => ({ success: true }),
		}) as unknown as typeof fetch;
		const result = await verifyTurnstileToken({
			token: "valid-token",
			ipAddress: "203.0.113.5",
		});
		expect(result).toEqual({ ok: true });
		const call = (globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls[0];
		expect(call[0]).toBe(
			"https://challenges.cloudflare.com/turnstile/v0/siteverify",
		);
		const body = call[1].body as URLSearchParams;
		expect(body.get("secret")).toBe("secret-1");
		expect(body.get("response")).toBe("valid-token");
		expect(body.get("remoteip")).toBe("203.0.113.5");
	});

	test("returns error when Cloudflare rejects the token", async () => {
		process.env.TURNSTILE_SECRET_KEY = "secret-1";
		globalThis.fetch = vi.fn().mockResolvedValue({
			ok: true,
			json: async () => ({
				success: false,
				"error-codes": ["invalid-input-response"],
			}),
		}) as unknown as typeof fetch;
		const result = await verifyTurnstileToken({ token: "bad-token" });
		expect(result.ok).toBe(false);
		expect(result.error).toContain("invalid-input-response");
	});

	test("returns generic error when Cloudflare rejects with no error-codes", async () => {
		process.env.TURNSTILE_SECRET_KEY = "secret-1";
		globalThis.fetch = vi.fn().mockResolvedValue({
			ok: true,
			json: async () => ({ success: false }),
		}) as unknown as typeof fetch;
		const result = await verifyTurnstileToken({ token: "bad" });
		expect(result.ok).toBe(false);
		expect(result.error).toMatch(/failed/);
	});

	test("returns error when Cloudflare returns a non-OK response", async () => {
		process.env.TURNSTILE_SECRET_KEY = "secret-1";
		globalThis.fetch = vi.fn().mockResolvedValue({
			ok: false,
			json: async () => ({}),
		}) as unknown as typeof fetch;
		const result = await verifyTurnstileToken({ token: "any" });
		expect(result.ok).toBe(false);
		expect(result.error).toMatch(/could not be verified/);
	});

	test("returns error when fetch throws", async () => {
		process.env.TURNSTILE_SECRET_KEY = "secret-1";
		globalThis.fetch = vi
			.fn()
			.mockRejectedValue(new Error("network down")) as unknown as typeof fetch;
		const result = await verifyTurnstileToken({ token: "any" });
		expect(result.ok).toBe(false);
		expect(result.error).toMatch(/could not be verified/);
	});
});
