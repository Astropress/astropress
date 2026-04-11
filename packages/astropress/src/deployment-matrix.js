const deploymentMatrixEntries = [
  { appHost: "github-pages", dataServices: "none", supportLevel: "supported", notes: "Reference static path with no hosted Astropress admin backend.", requiredEnvKeys: [] },
  { appHost: "cloudflare-pages", dataServices: "cloudflare", supportLevel: "supported", notes: "Cloudflare-native path using Pages, Workers, D1, and R2.", requiredEnvKeys: ["ASTROPRESS_SERVICE_ORIGIN", "CLOUDFLARE_ACCOUNT_ID", "CLOUDFLARE_API_TOKEN"] },
  { appHost: "vercel", dataServices: "supabase", supportLevel: "supported", notes: "Astro app on Vercel with Supabase handling database, storage, and auth services.", requiredEnvKeys: ["ASTROPRESS_SERVICE_ORIGIN", "SUPABASE_URL", "SUPABASE_ANON_KEY", "SUPABASE_SERVICE_ROLE_KEY"] },
  { appHost: "netlify", dataServices: "supabase", supportLevel: "supported", notes: "Astro app on Netlify with Supabase for data, media, and auth services.", requiredEnvKeys: ["ASTROPRESS_SERVICE_ORIGIN", "SUPABASE_URL", "SUPABASE_ANON_KEY", "SUPABASE_SERVICE_ROLE_KEY"] },
  { appHost: "render-web", dataServices: "supabase", supportLevel: "supported", notes: "Node-hosted Astro app on Render backed by Supabase services.", requiredEnvKeys: ["ASTROPRESS_SERVICE_ORIGIN", "SUPABASE_URL", "SUPABASE_ANON_KEY", "SUPABASE_SERVICE_ROLE_KEY"] },
  { appHost: "render-web", dataServices: "appwrite", supportLevel: "preview", notes: "Astro app on Render with Appwrite handling data, media, and auth.", requiredEnvKeys: ["ASTROPRESS_SERVICE_ORIGIN", "APPWRITE_ENDPOINT", "APPWRITE_PROJECT_ID", "APPWRITE_API_KEY"] },
  { appHost: "runway", dataServices: "runway", supportLevel: "supported", notes: "Bundled Runway path for Astro app hosting and managed services.", requiredEnvKeys: ["ASTROPRESS_SERVICE_ORIGIN", "RUNWAY_API_TOKEN", "RUNWAY_PROJECT_ID"] },
  { appHost: "github-pages", dataServices: "supabase", supportLevel: "preview", notes: "Static public site with Supabase-hosted admin/services handled separately.", requiredEnvKeys: ["ASTROPRESS_SERVICE_ORIGIN", "SUPABASE_URL", "SUPABASE_ANON_KEY", "SUPABASE_SERVICE_ROLE_KEY"] },
  { appHost: "gitlab-pages", dataServices: "supabase", supportLevel: "preview", notes: "Static public site on GitLab Pages with separate Supabase-hosted services.", requiredEnvKeys: ["ASTROPRESS_SERVICE_ORIGIN", "SUPABASE_URL", "SUPABASE_ANON_KEY", "SUPABASE_SERVICE_ROLE_KEY"] },
  { appHost: "vercel", dataServices: "appwrite", supportLevel: "preview", notes: "Astro app on Vercel with Appwrite as the service layer.", requiredEnvKeys: ["ASTROPRESS_SERVICE_ORIGIN", "APPWRITE_ENDPOINT", "APPWRITE_PROJECT_ID", "APPWRITE_API_KEY"] },
  { appHost: "netlify", dataServices: "appwrite", supportLevel: "preview", notes: "Astro app on Netlify with Appwrite as the service layer.", requiredEnvKeys: ["ASTROPRESS_SERVICE_ORIGIN", "APPWRITE_ENDPOINT", "APPWRITE_PROJECT_ID", "APPWRITE_API_KEY"] },
  { appHost: "cloudflare-pages", dataServices: "supabase", supportLevel: "preview", notes: "Cloudflare-hosted Astro app with Supabase-hosted data and auth services.", requiredEnvKeys: ["ASTROPRESS_SERVICE_ORIGIN", "SUPABASE_URL", "SUPABASE_ANON_KEY", "SUPABASE_SERVICE_ROLE_KEY"] }
];

export function listAstropressDeploymentMatrixEntries() {
  return deploymentMatrixEntries.slice();
}

export function getAstropressDeploymentMatrixEntry(profile) {
  return deploymentMatrixEntries.find((entry) => entry.appHost === profile.appHost && entry.dataServices === profile.dataServices) ?? null;
}

export function resolveAstropressDeploymentSupportLevel(profile) {
  return getAstropressDeploymentMatrixEntry(profile)?.supportLevel ?? "unsupported";
}
