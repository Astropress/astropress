import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { triggerPublish, resolveDeployHookFromEnv, type DeployHookConfig } from "../src/admin-action-publish";

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
    const env = { NETLIFY_BUILD_HOOK_URL: "https://api.netlify.com/build_hooks/abc" };
    const config = resolveDeployHookFromEnv(env);
    expect(config?.type).toBe("netlify");
  });

  it("returns render when RENDER_DEPLOY_HOOK_URL is set", () => {
    const env = { RENDER_DEPLOY_HOOK_URL: "https://api.render.com/deploy/srv-abc" };
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
      env: { NETLIFY_BUILD_HOOK_URL: "https://api.netlify.com/build_hooks/abc" },
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
  it("returns ok:false for an unknown hook type", async () => {
    const config = {
      type: "unknown-provider" as never,
      env: {},
    };

    const result = await triggerPublish(config);
    expect(result.ok).toBe(false);
  });
});
