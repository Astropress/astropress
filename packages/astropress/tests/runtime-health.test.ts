import { afterEach, describe, expect, it } from "vitest";
import {
	handleHealthRequest,
	registerHealthCheck,
} from "../src/runtime-health.js";

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
		const response = await handleHealthRequest(
			new Request("https://example.com/ap/health"),
		);
		const body = (await response.json()) as Record<string, unknown>;
		expect(response.status).toBe(200);
		expect(body.status).toBe("ok");
	});

	it("returns status degraded and 503 when health check throws", async () => {
		registerHealthCheck(async () => {
			throw new Error("DB unreachable");
		});
		const response = await handleHealthRequest(
			new Request("https://example.com/ap/health"),
		);
		const body = (await response.json()) as Record<string, unknown>;
		expect(response.status).toBe(503);
		expect(body.status).toBe("degraded");
	});
});
