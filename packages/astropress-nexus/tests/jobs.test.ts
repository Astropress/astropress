import { beforeEach, describe, expect, it, vi } from "vitest";
import { createNexusApp } from "../src/app.js";
import { _clearJobsForTest } from "../src/jobs.js";
import type { NexusConfig } from "../src/types.js";

// ─── Test config ──────────────────────────────────────────────────────────────

const testConfig: NexusConfig = {
	sites: [
		{
			id: "site-a",
			name: "Site A",
			baseUrl: "https://site-a.example.com",
			token: "token-a",
		},
	],
};

const ORG_TOKEN = "org-secret-token";

// ─── Fetch mock helpers ───────────────────────────────────────────────────────

function makeFetchMock(
	handler: (
		url: string,
		init?: RequestInit,
	) => { ok: boolean; status: number; body: unknown },
) {
	return vi.fn(async (url: RequestInfo | URL, init?: RequestInit) => {
		const urlStr = url.toString();
		const result = handler(urlStr, init);
		return {
			ok: result.ok,
			status: result.status,
			json: async () => result.body,
		} as Response;
	});
}

// ─── Helper: call Hono app directly ──────────────────────────────────────────

async function callApp(
	app: ReturnType<typeof createNexusApp>,
	path: string,
	options: { token?: string; method?: string; body?: unknown } = {},
): Promise<{ status: number; body: unknown }> {
	const headers: Record<string, string> = {};
	if (options.token) headers.Authorization = `Bearer ${options.token}`;
	if (options.body !== undefined) headers["Content-Type"] = "application/json";

	const req = new Request(`http://localhost${path}`, {
		method: options.method ?? "GET",
		headers,
		body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
	});
	const res = await app.fetch(req);
	let body: unknown;
	try {
		body = await res.json();
	} catch {
		body = null;
	}
	return { status: res.status, body };
}

// ─── Job endpoint tests ───────────────────────────────────────────────────────

describe("POST /jobs/import/wordpress", () => {
	beforeEach(() => {
		_clearJobsForTest();
		vi.restoreAllMocks();
	});

	it("returns 401 without org token", async () => {
		const app = createNexusApp({ config: testConfig, authToken: ORG_TOKEN });
		const { status } = await callApp(app, "/jobs/import/wordpress", {
			method: "POST",
			body: { siteId: "site-a", exportFile: "/tmp/export.xml" },
		});
		expect(status).toBe(401);
	});

	it("returns 422 when siteId is missing", async () => {
		const app = createNexusApp({ config: testConfig, authToken: ORG_TOKEN });
		const { status, body } = await callApp(app, "/jobs/import/wordpress", {
			method: "POST",
			token: ORG_TOKEN,
			body: { exportFile: "/tmp/export.xml" },
		});
		expect(status).toBe(422);
		expect((body as Record<string, unknown>).error).toMatch(/siteId/);
	});

	it("returns 422 when exportFile is missing", async () => {
		const app = createNexusApp({ config: testConfig, authToken: ORG_TOKEN });
		const { status, body } = await callApp(app, "/jobs/import/wordpress", {
			method: "POST",
			token: ORG_TOKEN,
			body: { siteId: "site-a" },
		});
		expect(status).toBe(422);
		expect((body as Record<string, unknown>).error).toMatch(/exportFile/);
	});

	it("returns 404 when siteId is unknown", async () => {
		const app = createNexusApp({ config: testConfig, authToken: ORG_TOKEN });
		const { status } = await callApp(app, "/jobs/import/wordpress", {
			method: "POST",
			token: ORG_TOKEN,
			body: { siteId: "unknown-site", exportFile: "/tmp/export.xml" },
		});
		expect(status).toBe(404);
	});

	it("returns 202 with jobId and queued status for known site", async () => {
		vi.stubGlobal(
			"fetch",
			makeFetchMock(() => ({
				ok: true,
				status: 200,
				body: { status: "completed" },
			})),
		);
		const app = createNexusApp({ config: testConfig, authToken: ORG_TOKEN });
		const { status, body } = await callApp(app, "/jobs/import/wordpress", {
			method: "POST",
			token: ORG_TOKEN,
			body: { siteId: "site-a", exportFile: "/tmp/export.xml" },
		});
		expect(status).toBe(202);
		expect(typeof (body as Record<string, unknown>).jobId).toBe("string");
		expect((body as Record<string, unknown>).status).toBe("queued");
	});
});

describe("GET /jobs/:id", () => {
	beforeEach(() => {
		_clearJobsForTest();
		vi.restoreAllMocks();
	});

	it("returns 404 for unknown job ID", async () => {
		const app = createNexusApp({ config: testConfig, authToken: ORG_TOKEN });
		const { status } = await callApp(app, "/jobs/nonexistent-id", {
			token: ORG_TOKEN,
		});
		expect(status).toBe(404);
	});

	it("returns the job entry after it is queued", async () => {
		vi.stubGlobal(
			"fetch",
			makeFetchMock(() => ({
				ok: true,
				status: 200,
				body: { status: "completed" },
			})),
		);
		const app = createNexusApp({ config: testConfig, authToken: ORG_TOKEN });

		const { body: createBody } = await callApp(app, "/jobs/import/wordpress", {
			method: "POST",
			token: ORG_TOKEN,
			body: { siteId: "site-a", exportFile: "/tmp/export.xml" },
		});
		const jobId = (createBody as Record<string, unknown>).jobId as string;

		const { status, body } = await callApp(app, `/jobs/${jobId}`, {
			token: ORG_TOKEN,
		});
		expect(status).toBe(200);
		const job = body as Record<string, unknown>;
		expect(job.id).toBe(jobId);
		expect(job.siteId).toBe("site-a");
		expect(job.kind).toBe("import:wordpress");
		expect(["queued", "running", "completed", "failed"]).toContain(job.status);
	});
});

describe("GET /jobs", () => {
	beforeEach(() => {
		_clearJobsForTest();
		vi.restoreAllMocks();
	});

	it("returns empty list when no jobs exist", async () => {
		const app = createNexusApp({ config: testConfig, authToken: ORG_TOKEN });
		const { status, body } = await callApp(app, "/jobs", { token: ORG_TOKEN });
		expect(status).toBe(200);
		const result = body as { jobs: unknown[]; total: number };
		expect(Array.isArray(result.jobs)).toBe(true);
		expect(result.total).toBe(0);
	});

	it("returns paginated job list with total", async () => {
		vi.stubGlobal(
			"fetch",
			makeFetchMock(() => ({
				ok: true,
				status: 200,
				body: { status: "completed" },
			})),
		);
		const app = createNexusApp({ config: testConfig, authToken: ORG_TOKEN });

		// Queue two jobs
		await callApp(app, "/jobs/import/wordpress", {
			method: "POST",
			token: ORG_TOKEN,
			body: { siteId: "site-a", exportFile: "/tmp/a.xml" },
		});
		await callApp(app, "/jobs/import/wordpress", {
			method: "POST",
			token: ORG_TOKEN,
			body: { siteId: "site-a", exportFile: "/tmp/b.xml" },
		});

		const { status, body } = await callApp(app, "/jobs", { token: ORG_TOKEN });
		expect(status).toBe(200);
		const result = body as { jobs: unknown[]; total: number };
		expect(result.total).toBe(2);
		expect(result.jobs).toHaveLength(2);
	});

	it("respects limit and offset parameters", async () => {
		vi.stubGlobal(
			"fetch",
			makeFetchMock(() => ({
				ok: true,
				status: 200,
				body: { status: "completed" },
			})),
		);
		const app = createNexusApp({ config: testConfig, authToken: ORG_TOKEN });

		for (let i = 0; i < 3; i++) {
			await callApp(app, "/jobs/import/wordpress", {
				method: "POST",
				token: ORG_TOKEN,
				body: { siteId: "site-a", exportFile: `/tmp/export-${i}.xml` },
			});
		}

		const { body } = await callApp(app, "/jobs?limit=2&offset=0", {
			token: ORG_TOKEN,
		});
		const result = body as { jobs: unknown[]; total: number };
		expect(result.total).toBe(3);
		expect(result.jobs).toHaveLength(2);
	});

	it("returns 401 without org token", async () => {
		const app = createNexusApp({ config: testConfig, authToken: ORG_TOKEN });
		const { status } = await callApp(app, "/jobs");
		expect(status).toBe(401);
	});
});
