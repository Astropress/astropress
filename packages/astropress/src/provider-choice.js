import { getAstropressDeploymentMatrixEntry, resolveAstropressDeploymentSupportLevel } from "./deployment-matrix.js";

function appHostToDeployTarget(appHost) {
  return appHost === "cloudflare-pages" ? "cloudflare" : appHost;
}

function finalizeRecommendation(appHost, dataServices, rationale) {
  const entry = getAstropressDeploymentMatrixEntry({ appHost, dataServices });
  const deployTarget = appHostToDeployTarget(appHost);
  return {
    appHost,
    dataServices,
    supportLevel: resolveAstropressDeploymentSupportLevel({ appHost, dataServices }),
    rationale: entry?.notes ? `${rationale} ${entry.notes}` : rationale,
    requiredEnvKeys: entry?.requiredEnvKeys ?? [],
    deployTarget,
    canonicalProvider: dataServices === "cloudflare" || dataServices === "supabase" || dataServices === "firebase" || dataServices === "appwrite" || dataServices === "runway"
      ? dataServices
      : appHost === "runway"
        ? "runway"
        : "cloudflare",
    publicDeployTarget: deployTarget
  };
}

export function recommendAstropressProvider(input = {}) {
  const existingPlatform = input.existingPlatform ?? "none";
  const wantsHostedAdmin = input.wantsHostedAdmin ?? true;
  const wantsStaticMirror = input.wantsStaticMirror ?? false;
  const opsComfort = input.opsComfort ?? "minimal";
  if (existingPlatform === "supabase") {
    return finalizeRecommendation(wantsStaticMirror ? "github-pages" : "vercel", "supabase", "Supabase is already the content-services platform, so Astropress should keep Supabase for data, auth, storage, and the Astropress service API while using a separate Astro app host.");
  }
  if (existingPlatform === "firebase") {
    return finalizeRecommendation(wantsStaticMirror ? "github-pages" : "render-web", "firebase", "Firebase is already the content-services platform, so Astropress should keep Firebase for data, auth, storage, and the Astropress service API while choosing a separate Astro app host.");
  }
  if (existingPlatform === "appwrite") {
    return finalizeRecommendation(wantsStaticMirror ? "github-pages" : "render-web", "appwrite", "Appwrite is already the content-services platform, so Astropress should keep Appwrite for data, auth, media, and the Astropress service API while choosing a separate Astro app host.");
  }
  if (existingPlatform === "runway") {
    return finalizeRecommendation("runway", "runway", "Runway remains the best fit when the project already expects a bundled app-host and services platform workflow.");
  }
  if (existingPlatform === "cloudflare" || opsComfort === "advanced") {
    return finalizeRecommendation(wantsStaticMirror ? "github-pages" : "cloudflare-pages", "cloudflare", "Cloudflare is the best fit for teams already comfortable with its edge/runtime model and wanting one provider to cover app hosting plus content services.");
  }
  if (!wantsHostedAdmin && wantsStaticMirror) {
    return finalizeRecommendation("github-pages", "none", "GitHub Pages is the clearest low-ops choice when the project only needs static Astro output and no hosted Astropress admin backend.");
  }
  if (!wantsHostedAdmin) {
    return finalizeRecommendation("github-pages", "none", "A static Astro deployment keeps the public site simple when hosted Astropress services are not required.");
  }
  return finalizeRecommendation("cloudflare-pages", "cloudflare", "Cloudflare is still the default recommendation for most Astropress users because it keeps the app host and the content-services layer aligned under one operational model.");
}
