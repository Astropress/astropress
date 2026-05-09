import { afterEach, describe, expect, it } from "vitest";
import { handleHealthRequest, registerHealthCheck } from "../src/runtime-health.js";

afterEach(() => {
	// Reset the module-level health check between tests
	registerHealthCheck(null as unknown as () => void);
});

describe("runtime health endpoint", () => {
	it("returns 200 with JSON body containing status, uptime, and timestamp", async () => {
		const request = new Request("https://example.com/ap/health");
		const response = await handleHealthRequest(request);

		expect(response.status).toBe(200);
		expect(response.headers.get("Content-Type")).toBe("application/json");
		expect(response.headers.get("Cache-Control")).toBe("no-store");

		const body = (await response.json()) as Record<string, unknown>;
		expect(body.status).toBe("ok");
		expect(typeof body.uptime).toBe("number");
		expect(body.uptime).toBeGreaterThanOrEqual(0);
		expect(typeof body.timestamp).toBe("string");
		expect(new Date(body.timestamp as string).getTime()).toBeGreaterThan(0);
	});

	it("includes a version field in the response", async () => {
		const request = new Request("https://example.com/ap/health");
		const response = await handleHealthRequest(request);
		const body = (await response.json()) as Record<string, unknown>;
		expect(typeof body.version).toBe("string");
	});

	it("returns status ok when health check passes", async () => {
		registerHealthCheck(async () => {
			/* no-op: DB is reachable */
		});
		const response = await handleHealthRequest(new Request("https://example.com/ap/health"));
		const body = (await response.json()) as Record<string, unknown>;
		expect(response.status).toBe(200);
		expect(body.status).toBe("ok");
	});

	it("version field falls back to 'unknown' when __ASTROPRESS_VERSION__ is unset (kills StringLiteral mutant on the fallback)", async () => {
		// Snapshot and clear the global so the catch/return path is taken.
		const g = globalThis as unknown as Record<string, unknown>;
		const prev = g.__ASTROPRESS_VERSION__;
		g.__ASTROPRESS_VERSION__ = undefined;
		try {
			const response = await handleHealthRequest(new Request("https://example.com/ap/health"));
			const body = (await response.json()) as Record<string, unknown>;
			expect(body.version).toBe("unknown");
		} finally {
			if (prev !== undefined) g.__ASTROPRESS_VERSION__ = prev;
		}
	});

	it("version field reflects __ASTROPRESS_VERSION__ when set to a string (kills typeof / try-block / conditional mutants)", async () => {
		const g = globalThis as unknown as Record<string, unknown>;
		const prev = g.__ASTROPRESS_VERSION__;
		g.__ASTROPRESS_VERSION__ = "1.2.3-test";
		try {
			const response = await handleHealthRequest(new Request("https://example.com/ap/health"));
			const body = (await response.json()) as Record<string, unknown>;
			expect(body.version).toBe("1.2.3-test");
		} finally {
			if (prev === undefined) g.__ASTROPRESS_VERSION__ = undefined;
			else g.__ASTROPRESS_VERSION__ = prev;
		}
	});

	it("version field is 'unknown' when __ASTROPRESS_VERSION__ is a non-string", async () => {
		// Kills the `typeof pkg === "string"` mutant where the literal is mutated;
		// only an actual string is accepted.
		const g = globalThis as unknown as Record<string, unknown>;
		const prev = g.__ASTROPRESS_VERSION__;
		g.__ASTROPRESS_VERSION__ = 12345 as unknown as string;
		try {
			const response = await handleHealthRequest(new Request("https://example.com/ap/health"));
			const body = (await response.json()) as Record<string, unknown>;
			expect(body.version).toBe("unknown");
		} finally {
			if (prev === undefined) g.__ASTROPRESS_VERSION__ = undefined;
			else g.__ASTROPRESS_VERSION__ = prev;
		}
	});

	it("uptime is plausibly small at process start (kills now+start arithmetic mutant)", async () => {
		const response = await handleHealthRequest(new Request("https://example.com/ap/health"));
		const body = (await response.json()) as Record<string, unknown>;
		const uptime = body.uptime as number;
		// Original: floor((now - start) / 1000) — single-digit seconds during test.
		// Mutant `now + start`: enormous (epoch ms summed), > 1e9 / 1000 = 1e6 seconds.
		expect(uptime).toBeLessThan(1_000_000);
	});

	it("returns status degraded and 503 when health check throws", async () => {
		registerHealthCheck(async () => {
			throw new Error("DB unreachable");
		});
		const response = await handleHealthRequest(new Request("https://example.com/ap/health"));
		const body = (await response.json()) as Record<string, unknown>;
		expect(response.status).toBe(503);
		expect(body.status).toBe("degraded");
	});
});
