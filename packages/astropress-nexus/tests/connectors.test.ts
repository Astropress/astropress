import { beforeEach, describe, expect, it, vi } from "vitest";
import { createNexusApp } from "../src/app.js";
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

type MockResponse = { ok: boolean; status: number; body: unknown };

function makeSequentialFetchMock(responses: MockResponse[]) {
	let callCount = 0;
	return vi.fn(async () => {
		const response = responses[callCount] ?? responses[responses.length - 1];
		callCount++;
		return {
			ok: response.ok,
			status: response.status,
			json: async () => response.body,
			text: async () => JSON.stringify(response.body),
		} as unknown as Response;
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
		method: options.method ?? "POST",
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

// ─── Cloudways connector tests ────────────────────────────────────────────────

describe("POST /connectors/cloudways/discover", () => {
	beforeEach(() => {
		vi.restoreAllMocks();
	});

	it("returns 401 without org token", async () => {
		const app = createNexusApp({ config: testConfig, authToken: ORG_TOKEN });
		const { status } = await callApp(app, "/connectors/cloudways/discover", {
			body: { email: "user@example.com", apiKey: "key123" },
		});
		expect(status).toBe(401);
	});

	it("returns 422 when email is missing", async () => {
		const app = createNexusApp({ config: testConfig, authToken: ORG_TOKEN });
		const { status, body } = await callApp(
			app,
			"/connectors/cloudways/discover",
			{
				token: ORG_TOKEN,
				body: { apiKey: "key123" },
			},
		);
		expect(status).toBe(422);
		expect((body as Record<string, unknown>).error).toMatch(/email/);
	});

	it("returns 422 when apiKey is missing", async () => {
		const app = createNexusApp({ config: testConfig, authToken: ORG_TOKEN });
		const { status, body } = await callApp(
			app,
			"/connectors/cloudways/discover",
			{
				token: ORG_TOKEN,
				body: { email: "user@example.com" },
			},
		);
		expect(status).toBe(422);
		expect((body as Record<string, unknown>).error).toMatch(/apiKey/);
	});

	it("returns empty sites array when API returns no WordPress apps", async () => {
		vi.stubGlobal(
			"fetch",
			makeSequentialFetchMock([
				{ ok: true, status: 200, body: { access_token: "bearer-token-123" } },
				{
					ok: true,
					status: 200,
					body: {
						apps: [
							{
								id: "1",
								label: "Node App",
								app_fqdn: "node.example.com",
								application: { type: "nodejs" },
							},
						],
					},
				},
			]),
		);

		const app = createNexusApp({ config: testConfig, authToken: ORG_TOKEN });
		const { status, body } = await callApp(
			app,
			"/connectors/cloudways/discover",
			{
				token: ORG_TOKEN,
				body: { email: "user@example.com", apiKey: "key123" },
			},
		);
		expect(status).toBe(200);
		expect((body as { sites: unknown[] }).sites).toHaveLength(0);
	});

	it("returns correct siteUrl for WordPress apps", async () => {
		vi.stubGlobal(
			"fetch",
			makeSequentialFetchMock([
				{ ok: true, status: 200, body: { access_token: "bearer-token-123" } },
				{
					ok: true,
					status: 200,
					body: {
						apps: [
							{
								id: "1",
								label: "Blog",
								app_fqdn: "blog.example.com",
								application: { type: "wordpress" },
							},
							{
								id: "2",
								label: "Shop",
								app_fqdn: "shop.example.com",
								application: { type: "woocommerce" },
							},
							{
								id: "3",
								label: "Node",
								app_fqdn: "node.example.com",
								application: { type: "nodejs" },
							},
						],
					},
				},
			]),
		);

		const app = createNexusApp({ config: testConfig, authToken: ORG_TOKEN });
		const { status, body } = await callApp(
			app,
			"/connectors/cloudways/discover",
			{
				token: ORG_TOKEN,
				body: { email: "user@example.com", apiKey: "key123" },
			},
		);
		expect(status).toBe(200);
		const sites = (body as { sites: Array<{ siteUrl: string; name: string }> })
			.sites;
		// wordpress and woocommerce are both WordPress-based
		expect(sites).toHaveLength(2);
		expect(sites[0].siteUrl).toBe("https://blog.example.com");
		expect(sites[0].name).toBe("Blog");
	});

	it("returns 502 when Cloudways auth endpoint is unreachable", async () => {
		vi.stubGlobal(
			"fetch",
			vi.fn(async () => {
				throw new Error("network error");
			}),
		);
		const app = createNexusApp({ config: testConfig, authToken: ORG_TOKEN });
		const { status } = await callApp(app, "/connectors/cloudways/discover", {
			token: ORG_TOKEN,
			body: { email: "user@example.com", apiKey: "key123" },
		});
		expect(status).toBe(502);
	});

	it("returns 502 when Cloudways returns 401", async () => {
		vi.stubGlobal(
			"fetch",
			makeSequentialFetchMock([
				{ ok: false, status: 401, body: { error: "Invalid credentials" } },
			]),
		);
		const app = createNexusApp({ config: testConfig, authToken: ORG_TOKEN });
		const { status } = await callApp(app, "/connectors/cloudways/discover", {
			token: ORG_TOKEN,
			body: { email: "user@example.com", apiKey: "wrong-key" },
		});
		expect(status).toBe(502);
	});
});

// ─── cPanel/Softaculous connector tests ───────────────────────────────────────

describe("POST /connectors/cpanel/discover", () => {
	beforeEach(() => {
		vi.restoreAllMocks();
	});

	it("returns 401 without org token", async () => {
		const app = createNexusApp({ config: testConfig, authToken: ORG_TOKEN });
		const { status } = await callApp(app, "/connectors/cpanel/discover", {
			body: { host: "cpanel.example.com", username: "user", password: "pass" },
		});
		expect(status).toBe(401);
	});

	it("returns 422 when host is missing", async () => {
		const app = createNexusApp({ config: testConfig, authToken: ORG_TOKEN });
		const { status, body } = await callApp(app, "/connectors/cpanel/discover", {
			token: ORG_TOKEN,
			body: { username: "user", password: "pass" },
		});
		expect(status).toBe(422);
		expect((body as Record<string, unknown>).error).toMatch(/host/);
	});

	it("returns 422 when username is missing", async () => {
		const app = createNexusApp({ config: testConfig, authToken: ORG_TOKEN });
		const { status, body } = await callApp(app, "/connectors/cpanel/discover", {
			token: ORG_TOKEN,
			body: { host: "cpanel.example.com", password: "pass" },
		});
		expect(status).toBe(422);
		expect((body as Record<string, unknown>).error).toMatch(/username/);
	});

	it("returns 422 when password is missing", async () => {
		const app = createNexusApp({ config: testConfig, authToken: ORG_TOKEN });
		const { status, body } = await callApp(app, "/connectors/cpanel/discover", {
			token: ORG_TOKEN,
			body: { host: "cpanel.example.com", username: "user" },
		});
		expect(status).toBe(422);
		expect((body as Record<string, unknown>).error).toMatch(/password/);
	});

	it("returns empty sites array for 0 WordPress installations", async () => {
		vi.stubGlobal(
			"fetch",
			makeSequentialFetchMock([{ ok: true, status: 200, body: [] }]),
		);
		const app = createNexusApp({ config: testConfig, authToken: ORG_TOKEN });
		const { status, body } = await callApp(app, "/connectors/cpanel/discover", {
			token: ORG_TOKEN,
			body: { host: "cpanel.example.com", username: "user", password: "pass" },
		});
		expect(status).toBe(200);
		expect((body as { sites: unknown[] }).sites).toHaveLength(0);
	});

	it("maps Softaculous installation JSON to DiscoveredSite array", async () => {
		vi.stubGlobal(
			"fetch",
			makeSequentialFetchMock([
				{
					ok: true,
					status: 200,
					body: [
						{
							stype: "wordpress",
							softurl: "https://blog.example.com",
							admin_username: "wpadmin",
						},
						{
							stype: "joomla",
							softurl: "https://joomla.example.com",
							admin_username: "jadmin",
						},
						{
							stype: "wordpress",
							softurl: "https://shop.example.com",
							admin_username: "shopadmin",
						},
					],
				},
			]),
		);

		const app = createNexusApp({ config: testConfig, authToken: ORG_TOKEN });
		const { status, body } = await callApp(app, "/connectors/cpanel/discover", {
			token: ORG_TOKEN,
			body: { host: "cpanel.example.com", username: "user", password: "pass" },
		});
		expect(status).toBe(200);
		const sites = (
			body as {
				sites: Array<{ siteUrl: string; metadata: Record<string, unknown> }>;
			}
		).sites;
		expect(sites).toHaveLength(2);
		expect(sites[0].siteUrl).toBe("https://blog.example.com");
		expect(sites[0].metadata.adminUsername).toBe("wpadmin");
		// Password must NOT be in metadata
		expect(sites[0].metadata.adminPassword).toBeUndefined();
	});

	it("returns 502 when Softaculous API is unreachable", async () => {
		vi.stubGlobal(
			"fetch",
			vi.fn(async () => {
				throw new Error("network error");
			}),
		);
		const app = createNexusApp({ config: testConfig, authToken: ORG_TOKEN });
		const { status } = await callApp(app, "/connectors/cpanel/discover", {
			token: ORG_TOKEN,
			body: { host: "cpanel.example.com", username: "user", password: "pass" },
		});
		expect(status).toBe(502);
	});
});

// ─── hPanel connector tests ───────────────────────────────────────────────────

describe("POST /connectors/hpanel/discover", () => {
	beforeEach(() => {
		vi.restoreAllMocks();
	});

	it("returns 401 without org token", async () => {
		const app = createNexusApp({ config: testConfig, authToken: ORG_TOKEN });
		const { status } = await callApp(app, "/connectors/hpanel/discover", {
			body: { accessToken: "hpanel-token" },
		});
		expect(status).toBe(401);
	});

	it("returns 422 when accessToken is missing", async () => {
		const app = createNexusApp({ config: testConfig, authToken: ORG_TOKEN });
		const { status, body } = await callApp(app, "/connectors/hpanel/discover", {
			token: ORG_TOKEN,
			body: {},
		});
		expect(status).toBe(422);
		expect((body as Record<string, unknown>).error).toMatch(/accessToken/);
	});

	it("returns correct site URLs from hPanel response", async () => {
		vi.stubGlobal(
			"fetch",
			makeSequentialFetchMock([
				{
					ok: true,
					status: 200,
					body: {
						data: [
							{ domain: "myblog.example.com", plan: "premium" },
							{ domain: "myshop.example.com", plan: "business" },
						],
					},
				},
			]),
		);

		const app = createNexusApp({ config: testConfig, authToken: ORG_TOKEN });
		const { status, body } = await callApp(app, "/connectors/hpanel/discover", {
			token: ORG_TOKEN,
			body: { accessToken: "hpanel-oauth-token" },
		});
		expect(status).toBe(200);
		const sites = (body as { sites: Array<{ siteUrl: string; name: string }> })
			.sites;
		expect(sites).toHaveLength(2);
		expect(sites[0].siteUrl).toBe("https://myblog.example.com");
		expect(sites[1].siteUrl).toBe("https://myshop.example.com");
	});

	it("returns empty sites when hPanel returns no plans", async () => {
		vi.stubGlobal(
			"fetch",
			makeSequentialFetchMock([{ ok: true, status: 200, body: { data: [] } }]),
		);

		const app = createNexusApp({ config: testConfig, authToken: ORG_TOKEN });
		const { status, body } = await callApp(app, "/connectors/hpanel/discover", {
			token: ORG_TOKEN,
			body: { accessToken: "hpanel-oauth-token" },
		});
		expect(status).toBe(200);
		expect((body as { sites: unknown[] }).sites).toHaveLength(0);
	});

	it("returns 502 when hPanel API is unreachable", async () => {
		vi.stubGlobal(
			"fetch",
			vi.fn(async () => {
				throw new Error("network error");
			}),
		);
		const app = createNexusApp({ config: testConfig, authToken: ORG_TOKEN });
		const { status } = await callApp(app, "/connectors/hpanel/discover", {
			token: ORG_TOKEN,
			body: { accessToken: "hpanel-oauth-token" },
		});
		expect(status).toBe(502);
	});

	it("returns 502 when hPanel returns 401 (expired token)", async () => {
		vi.stubGlobal(
			"fetch",
			makeSequentialFetchMock([
				{ ok: false, status: 401, body: { message: "Unauthorized" } },
			]),
		);
		const app = createNexusApp({ config: testConfig, authToken: ORG_TOKEN });
		const { status } = await callApp(app, "/connectors/hpanel/discover", {
			token: ORG_TOKEN,
			body: { accessToken: "expired-token" },
		});
		expect(status).toBe(502);
	});
});
