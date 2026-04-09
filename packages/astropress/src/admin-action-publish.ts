/**
 * Publish action — triggers a new static production build via the configured deploy hook.
 *
 * Each platform uses a different webhook mechanism:
 * - GitHub Actions: repository_dispatch event
 * - Cloudflare Pages: POST to deploy hook URL
 * - Vercel: POST to deploy hook URL
 * - Netlify: POST to build hook URL
 * - Render: POST to deploy hook URL
 */

export interface PublishTriggerResult {
  ok: boolean;
  buildId?: string;
  statusUrl?: string;
  error?: string;
}

export type DeployHookType = "cloudflare-pages" | "vercel" | "netlify" | "render" | "github-actions";

export interface DeployHookConfig {
  type: DeployHookType;
  /** Environment variables map (from process.env or explicit) */
  env: Record<string, string | undefined>;
}

async function triggerCloudflarePages(env: Record<string, string | undefined>): Promise<PublishTriggerResult> {
  const hookUrl = env.CF_PAGES_DEPLOY_HOOK_URL;
  if (!hookUrl) {
    return { ok: false, error: "CF_PAGES_DEPLOY_HOOK_URL is not set" };
  }

  const res = await fetch(hookUrl, { method: "POST" });
  if (!res.ok) {
    return { ok: false, error: `Cloudflare Pages deploy hook returned ${res.status}` };
  }

  const data = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  return {
    ok: true,
    buildId: typeof data.id === "string" ? data.id : undefined,
  };
}

async function triggerVercel(env: Record<string, string | undefined>): Promise<PublishTriggerResult> {
  const hookUrl = env.VERCEL_DEPLOY_HOOK_URL;
  if (!hookUrl) {
    return { ok: false, error: "VERCEL_DEPLOY_HOOK_URL is not set" };
  }

  const res = await fetch(hookUrl, { method: "POST" });
  if (!res.ok) {
    return { ok: false, error: `Vercel deploy hook returned ${res.status}` };
  }

  const data = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  const job = (data.job ?? {}) as Record<string, unknown>;
  return {
    ok: true,
    buildId: typeof job.id === "string" ? job.id : undefined,
  };
}

async function triggerNetlify(env: Record<string, string | undefined>): Promise<PublishTriggerResult> {
  const hookUrl = env.NETLIFY_BUILD_HOOK_URL;
  if (!hookUrl) {
    return { ok: false, error: "NETLIFY_BUILD_HOOK_URL is not set" };
  }

  const res = await fetch(hookUrl, { method: "POST", body: "{}" });
  if (!res.ok) {
    return { ok: false, error: `Netlify build hook returned ${res.status}` };
  }

  return { ok: true };
}

async function triggerRender(env: Record<string, string | undefined>): Promise<PublishTriggerResult> {
  const hookUrl = env.RENDER_DEPLOY_HOOK_URL;
  if (!hookUrl) {
    return { ok: false, error: "RENDER_DEPLOY_HOOK_URL is not set" };
  }

  const res = await fetch(hookUrl, { method: "POST" });
  if (!res.ok) {
    return { ok: false, error: `Render deploy hook returned ${res.status}` };
  }

  return { ok: true };
}

async function triggerGitHubActions(env: Record<string, string | undefined>): Promise<PublishTriggerResult> {
  const token = env.GH_TOKEN;
  const repo = env.GH_REPO; // format: "owner/repo"

  if (!token || !repo) {
    return { ok: false, error: "GH_TOKEN and GH_REPO must both be set for GitHub Actions deploy" };
  }

  const [owner, repoName] = repo.split("/");
  if (!owner || !repoName) {
    return { ok: false, error: 'GH_REPO must be in "owner/repo" format' };
  }

  const url = `https://api.github.com/repos/${owner}/${repoName}/dispatches`;
  const res = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/vnd.github.v3+json",
      "Content-Type": "application/json",
      "X-GitHub-Api-Version": "2022-11-28",
    },
    body: JSON.stringify({ event_type: "astropress-publish" }),
  });

  if (res.status === 204) {
    return { ok: true };
  }

  return { ok: false, error: `GitHub Actions dispatch returned ${res.status}` };
}

/**
 * Trigger a static production build using the configured deploy hook.
 */
export async function triggerPublish(config: DeployHookConfig): Promise<PublishTriggerResult> {
  switch (config.type) {
    case "cloudflare-pages":
      return triggerCloudflarePages(config.env);
    case "vercel":
      return triggerVercel(config.env);
    case "netlify":
      return triggerNetlify(config.env);
    case "render":
      return triggerRender(config.env);
    case "github-actions":
      return triggerGitHubActions(config.env);
    default:
      return { ok: false, error: `Unknown deploy hook type: ${config.type}` };
  }
}

/**
 * Resolve the deploy hook config from the process environment.
 * Returns null if no deploy hook is configured.
 */
export function resolveDeployHookFromEnv(env: Record<string, string | undefined> = process.env as Record<string, string | undefined>): DeployHookConfig | null {
  if (env.CF_PAGES_DEPLOY_HOOK_URL) {
    return { type: "cloudflare-pages", env };
  }
  if (env.VERCEL_DEPLOY_HOOK_URL) {
    return { type: "vercel", env };
  }
  if (env.NETLIFY_BUILD_HOOK_URL) {
    return { type: "netlify", env };
  }
  if (env.RENDER_DEPLOY_HOOK_URL) {
    return { type: "render", env };
  }
  if (env.GH_TOKEN && env.GH_REPO) {
    return { type: "github-actions", env };
  }
  return null;
}
