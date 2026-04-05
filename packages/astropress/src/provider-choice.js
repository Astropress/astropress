export function recommendAstropressProvider(input = {}) {
  const existingPlatform = input.existingPlatform ?? "none";
  const wantsHostedAdmin = input.wantsHostedAdmin ?? true;
  const wantsStaticMirror = input.wantsStaticMirror ?? false;
  const opsComfort = input.opsComfort ?? "minimal";

  if (existingPlatform === "supabase") {
    return {
      canonicalProvider: "supabase",
      publicDeployTarget: wantsStaticMirror ? "github-pages" : "supabase",
      rationale: "Supabase is the best fit when the project already expects the Supabase ecosystem and wants Astropress to keep using a hosted database and object storage stack.",
      requiredEnvKeys: ["SUPABASE_URL", "SUPABASE_ANON_KEY", "SUPABASE_SERVICE_ROLE_KEY"]
    };
  }

  if (existingPlatform === "runway") {
    return {
      canonicalProvider: "runway",
      publicDeployTarget: wantsStaticMirror ? "github-pages" : "runway",
      rationale: "Runway is the best fit when the project already expects an app-platform workflow and wants Astropress to stay aligned with that operational model.",
      requiredEnvKeys: ["RUNWAY_API_TOKEN", "RUNWAY_PROJECT_ID"]
    };
  }

  if (!wantsHostedAdmin && wantsStaticMirror) {
    return {
      canonicalProvider: "cloudflare",
      publicDeployTarget: "github-pages",
      rationale: "Cloudflare keeps Astropress operationally light while GitHub Pages can mirror the public site as a static deployment target.",
      requiredEnvKeys: ["CLOUDFLARE_ACCOUNT_ID", "CLOUDFLARE_API_TOKEN"]
    };
  }

  if (existingPlatform === "cloudflare" || opsComfort === "advanced") {
    return {
      canonicalProvider: "cloudflare",
      publicDeployTarget: wantsStaticMirror ? "github-pages" : "cloudflare",
      rationale: "Cloudflare is the recommended fit for teams already comfortable with its edge/runtime model and wanting the lowest-cost hosted Astropress setup.",
      requiredEnvKeys: ["CLOUDFLARE_ACCOUNT_ID", "CLOUDFLARE_API_TOKEN"]
    };
  }

  return {
    canonicalProvider: "cloudflare",
    publicDeployTarget: wantsStaticMirror ? "github-pages" : "cloudflare",
    rationale: "Cloudflare is the default recommendation for most non-technical Astropress users because it keeps the hosted admin/runtime path simple and inexpensive.",
    requiredEnvKeys: ["CLOUDFLARE_ACCOUNT_ID", "CLOUDFLARE_API_TOKEN"]
  };
}
