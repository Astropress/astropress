async function triggerCloudflarePages(env) {
  const hookUrl = env.CF_PAGES_DEPLOY_HOOK_URL;
  if (!hookUrl) {
    return { ok: false, error: "CF_PAGES_DEPLOY_HOOK_URL is not set" };
  }

  const res = await fetch(hookUrl, { method: "POST" });
  if (!res.ok) {
    return { ok: false, error: `Cloudflare Pages deploy hook returned ${res.status}` };
  }

  const data = await res.json().catch(() => ({}));
  return {
    ok: true,
    buildId: typeof data.id === "string" ? data.id : undefined,
  };
}

async function triggerVercel(env) {
  const hookUrl = env.VERCEL_DEPLOY_HOOK_URL;
  if (!hookUrl) {
    return { ok: false, error: "VERCEL_DEPLOY_HOOK_URL is not set" };
  }

  const res = await fetch(hookUrl, { method: "POST" });
  if (!res.ok) {
    return { ok: false, error: `Vercel deploy hook returned ${res.status}` };
  }

  const data = await res.json().catch(() => ({}));
  const job = data.job ?? {};
  return {
    ok: true,
    buildId: typeof job.id === "string" ? job.id : undefined,
  };
}

async function triggerNetlify(env) {
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

async function triggerRender(env) {
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

async function triggerGitHubActions(env) {
  const token = env.GH_TOKEN;
  const repo = env.GH_REPO;

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

export async function triggerPublish(config) {
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

export function resolveDeployHookFromEnv(env = process.env) {
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
