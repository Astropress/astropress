/**
 * Monitoring tests — verifies the unauthenticated Prometheus metrics endpoint behavior.
 *
 * Tests use mocked store/content to avoid requiring a full SQLite runtime.
 */

import { afterEach, describe, expect, it, vi } from "vitest";

const CMS_CONFIG_KEY = Symbol.for("astropress.cms-config");

function setCmsConfig(monitoring?: { prometheusEnabled?: boolean }) {
	(globalThis as typeof globalThis & { [key: symbol]: unknown })[CMS_CONFIG_KEY] = {
		siteName: "Test Site",
		siteUrl: "https://example.com",
		templateKeys: [],
		seedPages: [],
		archives: [],
		translationStatus: [],
		monitoring,
	};
}

function clearCmsConfig() {
	(globalThis as typeof globalThis & { [key: symbol]: unknown })[CMS_CONFIG_KEY] = null;
}

// Mock the runtime store so the endpoint doesn't need real SQLite. Both content
// and media are now read through this one host-agnostic seam (getReadStore
// dispatches D1 vs local), so the test mocks both here — no admin-store mock.
vi.mock("../src/runtime-page-store.js", () => ({
	listRuntimeContentStates: vi.fn().mockResolvedValue([
		{
			slug: "post-1",
			kind: "post",
			status: "published",
			title: "Post 1",
			updatedAt: "2026-01-01",
		},
		{
			slug: "post-2",
			kind: "post",
			status: "published",
			title: "Post 2",
			updatedAt: "2026-01-01",
		},
		{
			slug: "page-1",
			kind: "page",
			status: "published",
			title: "Page 1",
			updatedAt: "2026-01-01",
		},
	]),
	searchRuntimeContentStates: vi.fn().mockResolvedValue([]),
	getRuntimeMediaAssets: vi
		.fn()
		.mockResolvedValue([{ id: "media-1" }, { id: "media-2" }, { id: "media-3" }]),
}));

import { getRuntimeMediaAssets } from "../src/runtime-page-store.js";

const mockGetRuntimeMediaAssets = getRuntimeMediaAssets as unknown as ReturnType<typeof vi.fn>;

afterEach(() => {
	clearCmsConfig();
	vi.clearAllMocks();
});

async function callMetricsEndpoint(locals: Record<string, unknown> = {}) {
	// Dynamic import to pick up mocks
	const { GET } = await import("../pages/ap/metrics.js");
	const request = new Request("http://localhost/ap/metrics");
	return GET({ request, locals } as Parameters<typeof GET>[0]);
}

describe("GET /ap/metrics — disabled by default", () => {
	it("returns 404 when monitoring.prometheusEnabled is absent", async () => {
		setCmsConfig(undefined);
		const response = await callMetricsEndpoint();
		expect(response.status).toBe(404);
	});

	it("returns 404 when monitoring.prometheusEnabled is false", async () => {
		setCmsConfig({ prometheusEnabled: false });
		const response = await callMetricsEndpoint();
		expect(response.status).toBe(404);
	});
});

describe("GET /ap/metrics — enabled", () => {
	it("returns 200 with correct Content-Type when prometheusEnabled is true", async () => {
		setCmsConfig({ prometheusEnabled: true });
		const response = await callMetricsEndpoint();
		expect(response.status).toBe(200);
		expect(response.headers.get("Content-Type")).toBe("text/plain; version=0.0.4");
	});

	it("sets Cache-Control: no-store", async () => {
		setCmsConfig({ prometheusEnabled: true });
		const response = await callMetricsEndpoint();
		expect(response.headers.get("Cache-Control")).toBe("no-store");
	});

	it("body contains HELP and TYPE lines for ap_content_total", async () => {
		setCmsConfig({ prometheusEnabled: true });
		const response = await callMetricsEndpoint();
		const body = await response.text();
		expect(body).toContain("# HELP ap_content_total");
		expect(body).toContain("# TYPE ap_content_total gauge");
		expect(body).toContain('ap_content_total{kind="post"}');
	});

	it("body contains ap_uptime_seconds with a non-negative value", async () => {
		setCmsConfig({ prometheusEnabled: true });
		const response = await callMetricsEndpoint();
		const body = await response.text();
		const match = body.match(/ap_uptime_seconds (\d+)/);
		expect(match).not.toBeNull();
		expect(Number(match?.[1])).toBeGreaterThanOrEqual(0);
	});

	it("body contains ap_media_total metric", async () => {
		setCmsConfig({ prometheusEnabled: true });
		const response = await callMetricsEndpoint();
		const body = await response.text();
		expect(body).toContain("# HELP ap_media_total");
		expect(body).toContain("ap_media_total 3");
	});

	it("does not require Authorization header", async () => {
		setCmsConfig({ prometheusEnabled: true });
		// No auth headers in the request — should still return 200
		const response = await callMetricsEndpoint();
		expect(response.status).toBe(200);
	});
});

// Issue #140: media must be counted through the host-agnostic runtime seam,
// not the local-only admin store — otherwise a D1/hosted deployment (which
// has no local runtime alias) reports a misleading ap_media_total 0.
describe("GET /ap/metrics — host-agnostic media count (issue #140)", () => {
	it("reads media through the runtime seam, passing the request locals through", async () => {
		setCmsConfig({ prometheusEnabled: true });
		const d1Locals = { runtime: { env: { DB: {} } } };
		await callMetricsEndpoint(d1Locals);
		expect(mockGetRuntimeMediaAssets).toHaveBeenCalledWith(d1Locals);
	});

	it("reports the real media count on a D1-backed host (not a silent zero)", async () => {
		setCmsConfig({ prometheusEnabled: true });
		// A host with no local runtime alias but real D1 media: the seam returns
		// the records. The pre-fix code read safeLoadLocalAdminStore() -> null
		// here and published ap_media_total 0.
		mockGetRuntimeMediaAssets.mockResolvedValueOnce([
			{ id: "d1-1" },
			{ id: "d1-2" },
			{ id: "d1-3" },
			{ id: "d1-4" },
			{ id: "d1-5" },
		]);
		const response = await callMetricsEndpoint({ runtime: { env: { DB: {} } } });
		const body = await response.text();
		expect(body).toContain("ap_media_total 5");
	});

	it("reports zero only when there is genuinely no media", async () => {
		setCmsConfig({ prometheusEnabled: true });
		mockGetRuntimeMediaAssets.mockResolvedValueOnce([]);
		const response = await callMetricsEndpoint();
		const body = await response.text();
		expect(body).toContain("ap_media_total 0");
	});

	it("stays 200 and reports zero media if the media read throws", async () => {
		setCmsConfig({ prometheusEnabled: true });
		mockGetRuntimeMediaAssets.mockRejectedValueOnce(new Error("store unavailable"));
		const response = await callMetricsEndpoint();
		expect(response.status).toBe(200);
		const body = await response.text();
		expect(body).toContain("ap_media_total 0");
	});
});
