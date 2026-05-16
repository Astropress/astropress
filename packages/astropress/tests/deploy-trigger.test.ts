import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
	type DeployHookConfig,
	resolveDeployHookFromEnv,
	triggerPublish,
} from "../src/admin-action-publish";

// Capture fetch calls without hitting real endpoints
function mockFetch(status: number, body: unknown = {}) {
	return vi.fn().mockResolvedValue({
		ok: status >= 200 && status < 300,
		status,
		json: async () => body,
	});
}

describe("resolveDeployHookFromEnv", () => {
	it("returns cloudflare-pages when CF_PAGES_DEPLOY_HOOK_URL is set", () => {
		const env = { CF_PAGES_DEPLOY_HOOK_URL: "https://api.cloudflare.com/hook" };
		const config = resolveDeployHookFromEnv(env);
		expect(config?.type).toBe("cloudflare-pages");
	});

	it("returns vercel when VERCEL_DEPLOY_HOOK_URL is set", () => {
		const env = { VERCEL_DEPLOY_HOOK_URL: "https://api.vercel.com/hook" };
		const config = resolveDeployHookFromEnv(env);
		expect(config?.type).toBe("vercel");
	});

	it("returns netlify when NETLIFY_BUILD_HOOK_URL is set", () => {
		const env = {
			NETLIFY_BUILD_HOOK_URL: "https://api.netlify.com/build_hooks/abc",
		};
		const config = resolveDeployHookFromEnv(env);
		expect(config?.type).toBe("netlify");
	});

	it("returns render when RENDER_DEPLOY_HOOK_URL is set", () => {
		const env = {
			RENDER_DEPLOY_HOOK_URL: "https://api.render.com/deploy/srv-abc",
		};
		const config = resolveDeployHookFromEnv(env);
		expect(config?.type).toBe("render");
	});

	it("returns github-actions when GH_TOKEN and GH_REPO are set", () => {
		const env = { GH_TOKEN: "ghp_abc123", GH_REPO: "owner/repo" };
		const config = resolveDeployHookFromEnv(env);
		expect(config?.type).toBe("github-actions");
	});

	it("returns null when no deploy hook env vars are set", () => {
		const config = resolveDeployHookFromEnv({});
		expect(config).toBeNull();
	});

	it("prefers cloudflare-pages over vercel when both are set", () => {
		const env = {
			CF_PAGES_DEPLOY_HOOK_URL: "https://api.cloudflare.com/hook",
			VERCEL_DEPLOY_HOOK_URL: "https://api.vercel.com/hook",
		};
		const config = resolveDeployHookFromEnv(env);
		expect(config?.type).toBe("cloudflare-pages");
	});
});

describe("triggerPublish — cloudflare-pages", () => {
	let originalFetch: typeof fetch;

	beforeEach(() => {
		originalFetch = globalThis.fetch;
	});

	afterEach(() => {
		globalThis.fetch = originalFetch;
	});

	it("returns ok:true when deploy hook responds 200", async () => {
		globalThis.fetch = mockFetch(200, { id: "build-123" });

		const config: DeployHookConfig = {
			type: "cloudflare-pages",
			env: { CF_PAGES_DEPLOY_HOOK_URL: "https://api.cloudflare.com/mock-hook" },
		};

		const result = await triggerPublish(config);
		expect(result.ok).toBe(true);
	});

	it("returns ok:false when CF_PAGES_DEPLOY_HOOK_URL is missing", async () => {
		const config: DeployHookConfig = {
			type: "cloudflare-pages",
			env: {},
		};

		const result = await triggerPublish(config);
		expect(result.ok).toBe(false);
		expect(result.error).toContain("CF_PAGES_DEPLOY_HOOK_URL");
	});

	it("sends a POST to the deploy hook URL", async () => {
		const fetchSpy = mockFetch(200, {});
		globalThis.fetch = fetchSpy;

		const hookUrl = "https://api.cloudflare.com/mock-hook";
		const config: DeployHookConfig = {
			type: "cloudflare-pages",
			env: { CF_PAGES_DEPLOY_HOOK_URL: hookUrl },
		};

		await triggerPublish(config);

		expect(fetchSpy).toHaveBeenCalledWith(hookUrl, expect.objectContaining({ method: "POST" }));
	});
});

describe("triggerPublish — github-actions", () => {
	let originalFetch: typeof fetch;

	beforeEach(() => {
		originalFetch = globalThis.fetch;
	});

	afterEach(() => {
		globalThis.fetch = originalFetch;
	});

	it("sends repository_dispatch to the correct GitHub API endpoint", async () => {
		const fetchSpy = mockFetch(204);
		globalThis.fetch = fetchSpy;

		const config: DeployHookConfig = {
			type: "github-actions",
			env: { GH_TOKEN: "ghp_test", GH_REPO: "myorg/mysite" },
		};

		const result = await triggerPublish(config);

		expect(result.ok).toBe(true);
		expect(fetchSpy).toHaveBeenCalledWith(
			"https://api.github.com/repos/myorg/mysite/dispatches",
			expect.objectContaining({ method: "POST" }),
		);

		// Verify the event_type is correct
		const callArgs = fetchSpy.mock.calls[0];
		const body = JSON.parse(callArgs[1].body as string);
		expect(body.event_type).toBe("astropress-publish");
	});

	it("returns ok:false when GH_TOKEN is missing", async () => {
		const config: DeployHookConfig = {
			type: "github-actions",
			env: { GH_REPO: "myorg/mysite" },
		};

		const result = await triggerPublish(config);
		expect(result.ok).toBe(false);
		expect(result.error).toContain("GH_TOKEN");
	});

	it("returns ok:false when GH_REPO has invalid format", async () => {
		const config: DeployHookConfig = {
			type: "github-actions",
			env: { GH_TOKEN: "ghp_test", GH_REPO: "invalid-no-slash" },
		};

		const result = await triggerPublish(config);
		expect(result.ok).toBe(false);
	});
});

describe("triggerPublish — vercel", () => {
	let originalFetch: typeof fetch;

	beforeEach(() => {
		originalFetch = globalThis.fetch;
	});

	afterEach(() => {
		globalThis.fetch = originalFetch;
	});

	it("returns ok:true when hook responds 200", async () => {
		globalThis.fetch = mockFetch(200, { job: { id: "job-456" } });

		const config: DeployHookConfig = {
			type: "vercel",
			env: { VERCEL_DEPLOY_HOOK_URL: "https://api.vercel.com/hook" },
		};

		const result = await triggerPublish(config);
		expect(result.ok).toBe(true);
		expect(result.buildId).toBe("job-456");
	});
});

describe("triggerPublish — netlify", () => {
	let originalFetch: typeof fetch;

	beforeEach(() => {
		originalFetch = globalThis.fetch;
	});

	afterEach(() => {
		globalThis.fetch = originalFetch;
	});

	it("returns ok:true when hook responds 200", async () => {
		globalThis.fetch = mockFetch(200);

		const config: DeployHookConfig = {
			type: "netlify",
			env: {
				NETLIFY_BUILD_HOOK_URL: "https://api.netlify.com/build_hooks/abc",
			},
		};

		const result = await triggerPublish(config);
		expect(result.ok).toBe(true);
	});
});

describe("triggerPublish — render", () => {
	let originalFetch: typeof fetch;

	beforeEach(() => {
		originalFetch = globalThis.fetch;
	});

	afterEach(() => {
		globalThis.fetch = originalFetch;
	});

	it("returns ok:true when hook responds 200", async () => {
		globalThis.fetch = mockFetch(200);

		const config: DeployHookConfig = {
			type: "render",
			env: { RENDER_DEPLOY_HOOK_URL: "https://api.render.com/deploy/srv-abc" },
		};

		const result = await triggerPublish(config);
		expect(result.ok).toBe(true);
	});
});

describe("triggerPublish — unknown type", () => {
	it("returns ok:false for an unknown hook type with the type echoed in the error", async () => {
		const config = {
			type: "unknown-provider" as never,
			env: {},
		};

		const result = await triggerPublish(config);
		expect(result.ok).toBe(false);
		expect(result.error).toBe("Unknown deploy hook type: unknown-provider");
	});
});

// ---------------------------------------------------------------------------
// Failure-status + payload-shape coverage for each provider
// ---------------------------------------------------------------------------

describe("triggerPublish — failure-status branches", () => {
	let originalFetch: typeof fetch;
	beforeEach(() => {
		originalFetch = globalThis.fetch;
	});
	afterEach(() => {
		globalThis.fetch = originalFetch;
	});

	it("cloudflare-pages: returns ok:false with the status code when the hook returns 500", async () => {
		globalThis.fetch = mockFetch(500);
		const result = await triggerPublish({
			type: "cloudflare-pages",
			env: { CF_PAGES_DEPLOY_HOOK_URL: "https://example.test/h" },
		});
		expect(result.ok).toBe(false);
		expect(result.error).toBe("Cloudflare Pages deploy hook returned 500");
	});

	it("cloudflare-pages: extracts buildId from the response id field", async () => {
		globalThis.fetch = mockFetch(200, { id: "cf-build-7" });
		const result = await triggerPublish({
			type: "cloudflare-pages",
			env: { CF_PAGES_DEPLOY_HOOK_URL: "https://example.test/h" },
		});
		expect(result).toEqual({ ok: true, buildId: "cf-build-7" });
	});

	it("cloudflare-pages: tolerates a non-JSON body and leaves buildId undefined", async () => {
		globalThis.fetch = vi.fn().mockResolvedValue({
			ok: true,
			status: 200,
			json: async () => {
				throw new Error("not json");
			},
		});
		const result = await triggerPublish({
			type: "cloudflare-pages",
			env: { CF_PAGES_DEPLOY_HOOK_URL: "https://example.test/h" },
		});
		expect(result.ok).toBe(true);
		expect(result.buildId).toBeUndefined();
	});

	it("cloudflare-pages: leaves buildId undefined when response id is non-string", async () => {
		globalThis.fetch = mockFetch(200, { id: 42 });
		const result = await triggerPublish({
			type: "cloudflare-pages",
			env: { CF_PAGES_DEPLOY_HOOK_URL: "https://example.test/h" },
		});
		expect(result).toEqual({ ok: true, buildId: undefined });
	});

	it("vercel: returns ok:false with the status code when the hook returns 502", async () => {
		globalThis.fetch = mockFetch(502);
		const result = await triggerPublish({
			type: "vercel",
			env: { VERCEL_DEPLOY_HOOK_URL: "https://example.test/h" },
		});
		expect(result.ok).toBe(false);
		expect(result.error).toBe("Vercel deploy hook returned 502");
	});

	it("vercel: missing hook URL produces the env-name error", async () => {
		const result = await triggerPublish({ type: "vercel", env: {} });
		expect(result).toEqual({ ok: false, error: "VERCEL_DEPLOY_HOOK_URL is not set" });
	});

	it("vercel: leaves buildId undefined when job is absent or job.id is non-string", async () => {
		globalThis.fetch = mockFetch(200, { job: { id: 7 } });
		const r1 = await triggerPublish({
			type: "vercel",
			env: { VERCEL_DEPLOY_HOOK_URL: "https://example.test/h" },
		});
		expect(r1).toEqual({ ok: true, buildId: undefined });

		globalThis.fetch = mockFetch(200, {});
		const r2 = await triggerPublish({
			type: "vercel",
			env: { VERCEL_DEPLOY_HOOK_URL: "https://example.test/h" },
		});
		expect(r2).toEqual({ ok: true, buildId: undefined });
	});

	it("netlify: returns ok:false with the status code when the hook returns 503", async () => {
		globalThis.fetch = mockFetch(503);
		const result = await triggerPublish({
			type: "netlify",
			env: { NETLIFY_BUILD_HOOK_URL: "https://example.test/h" },
		});
		expect(result.ok).toBe(false);
		expect(result.error).toBe("Netlify build hook returned 503");
	});

	it("netlify: missing hook URL produces the env-name error", async () => {
		const result = await triggerPublish({ type: "netlify", env: {} });
		expect(result).toEqual({ ok: false, error: "NETLIFY_BUILD_HOOK_URL is not set" });
	});

	it('netlify: POSTs body "{}" (the build-hook contract)', async () => {
		const fetchSpy = mockFetch(200);
		globalThis.fetch = fetchSpy;
		await triggerPublish({
			type: "netlify",
			env: { NETLIFY_BUILD_HOOK_URL: "https://example.test/h" },
		});
		expect(fetchSpy).toHaveBeenCalledWith(
			"https://example.test/h",
			expect.objectContaining({ method: "POST", body: "{}" }),
		);
	});

	it("render: returns ok:false with the status code when the hook returns 504", async () => {
		globalThis.fetch = mockFetch(504);
		const result = await triggerPublish({
			type: "render",
			env: { RENDER_DEPLOY_HOOK_URL: "https://example.test/h" },
		});
		expect(result.ok).toBe(false);
		expect(result.error).toBe("Render deploy hook returned 504");
	});

	it("render: missing hook URL produces the env-name error", async () => {
		const result = await triggerPublish({ type: "render", env: {} });
		expect(result).toEqual({ ok: false, error: "RENDER_DEPLOY_HOOK_URL is not set" });
	});

	it("cloudflare-pages: missing hook URL produces the env-name error verbatim", async () => {
		const result = await triggerPublish({ type: "cloudflare-pages", env: {} });
		expect(result).toEqual({ ok: false, error: "CF_PAGES_DEPLOY_HOOK_URL is not set" });
	});
});

describe("triggerPublish — github-actions request shape", () => {
	let originalFetch: typeof fetch;
	beforeEach(() => {
		originalFetch = globalThis.fetch;
	});
	afterEach(() => {
		globalThis.fetch = originalFetch;
	});

	it("sets Bearer token, Accept, Content-Type and API-Version headers", async () => {
		const fetchSpy = mockFetch(204);
		globalThis.fetch = fetchSpy;
		await triggerPublish({
			type: "github-actions",
			env: { GH_TOKEN: "ghp_abc", GH_REPO: "org/site" },
		});
		const [, init] = fetchSpy.mock.calls[0] as [string, RequestInit];
		expect(init.headers).toEqual({
			Authorization: "Bearer ghp_abc",
			Accept: "application/vnd.github.v3+json",
			"Content-Type": "application/json",
			"X-GitHub-Api-Version": "2022-11-28",
		});
	});

	it("returns ok:false with the status code when the API returns a non-204 status", async () => {
		globalThis.fetch = mockFetch(403);
		const result = await triggerPublish({
			type: "github-actions",
			env: { GH_TOKEN: "ghp_abc", GH_REPO: "org/site" },
		});
		expect(result.ok).toBe(false);
		expect(result.error).toBe("GitHub Actions dispatch returned 403");
	});

	it("returns the invalid-format error when GH_REPO has no slash (owner side missing)", async () => {
		const result = await triggerPublish({
			type: "github-actions",
			env: { GH_TOKEN: "ghp_abc", GH_REPO: "no-slash" },
		});
		expect(result).toEqual({ ok: false, error: 'GH_REPO must be in "owner/repo" format' });
	});

	it('returns the invalid-format error when GH_REPO has empty repo half ("owner/")', async () => {
		const result = await triggerPublish({
			type: "github-actions",
			env: { GH_TOKEN: "ghp_abc", GH_REPO: "owner/" },
		});
		expect(result).toEqual({ ok: false, error: 'GH_REPO must be in "owner/repo" format' });
	});

	it("returns the joint-env error message when both GH_TOKEN and GH_REPO are missing", async () => {
		const result = await triggerPublish({ type: "github-actions", env: {} });
		expect(result).toEqual({
			ok: false,
			error: "GH_TOKEN and GH_REPO must both be set for GitHub Actions deploy",
		});
	});
});

describe("resolveDeployHookFromEnv — github-actions guard requires BOTH env vars", () => {
	it("returns null when only GH_TOKEN is set (GH_REPO missing)", () => {
		expect(resolveDeployHookFromEnv({ GH_TOKEN: "x" })).toBeNull();
	});
	it("returns null when only GH_REPO is set (GH_TOKEN missing)", () => {
		expect(resolveDeployHookFromEnv({ GH_REPO: "x/y" })).toBeNull();
	});
});
