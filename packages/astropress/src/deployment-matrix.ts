import type { AstropressAppHost } from "./app-host-targets";
import type { AstropressDataServices } from "./data-service-targets";

export type AstropressDeploymentSupportLevel = "supported" | "preview" | "unsupported";

export interface AstropressDeploymentProfile {
  appHost: AstropressAppHost;
  dataServices: AstropressDataServices;
}

export interface AstropressDeploymentMatrixEntry extends AstropressDeploymentProfile {
  supportLevel: AstropressDeploymentSupportLevel;
  notes: string;
  requiredEnvKeys: string[];
}

const deploymentMatrixEntries: AstropressDeploymentMatrixEntry[] = [
  {
    appHost: "github-pages",
    dataServices: "none",
    supportLevel: "supported",
    notes: "Reference static path with no hosted Astropress admin backend.",
    requiredEnvKeys: [],
  },
  {
    appHost: "cloudflare-pages",
    dataServices: "cloudflare",
    supportLevel: "supported",
    notes: "Cloudflare-native path using Pages, Workers, D1, and R2.",
    requiredEnvKeys: ["ASTROPRESS_SERVICE_ORIGIN", "CLOUDFLARE_ACCOUNT_ID", "CLOUDFLARE_API_TOKEN"],
  },
  {
    appHost: "vercel",
    dataServices: "supabase",
    supportLevel: "supported",
    notes: "Astro app on Vercel with Supabase handling database, storage, and auth services.",
    requiredEnvKeys: ["ASTROPRESS_SERVICE_ORIGIN", "SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY"],
  },
  {
    appHost: "netlify",
    dataServices: "supabase",
    supportLevel: "supported",
    notes: "Astro app on Netlify with Supabase for data, media, and auth services.",
    requiredEnvKeys: ["ASTROPRESS_SERVICE_ORIGIN", "SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY"],
  },
  {
    appHost: "render-web",
    dataServices: "supabase",
    supportLevel: "supported",
    notes: "Node-hosted Astro app on Render backed by Supabase services.",
    requiredEnvKeys: ["ASTROPRESS_SERVICE_ORIGIN", "SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY"],
  },
  {
    appHost: "render-web",
    dataServices: "appwrite",
    supportLevel: "preview",
    notes: "Astro app on Render with Appwrite handling data, media, and auth.",
    requiredEnvKeys: ["ASTROPRESS_SERVICE_ORIGIN", "APPWRITE_ENDPOINT", "APPWRITE_PROJECT_ID", "APPWRITE_API_KEY"],
  },
  {
    appHost: "runway",
    dataServices: "runway",
    supportLevel: "supported",
    notes: "Bundled Runway path for Astro app hosting and managed services.",
    requiredEnvKeys: ["ASTROPRESS_SERVICE_ORIGIN", "RUNWAY_API_TOKEN", "RUNWAY_PROJECT_ID"],
  },
  {
    appHost: "github-pages",
    dataServices: "supabase",
    supportLevel: "preview",
    notes: "Static public site with Supabase-hosted admin/services handled separately.",
    requiredEnvKeys: ["ASTROPRESS_SERVICE_ORIGIN", "SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY"],
  },
  {
    appHost: "gitlab-pages",
    dataServices: "supabase",
    supportLevel: "preview",
    notes: "Static public site on GitLab Pages with separate Supabase-hosted services.",
    requiredEnvKeys: ["ASTROPRESS_SERVICE_ORIGIN", "SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY"],
  },
  {
    appHost: "vercel",
    dataServices: "appwrite",
    supportLevel: "preview",
    notes: "Astro app on Vercel with Appwrite as the service layer.",
    requiredEnvKeys: ["ASTROPRESS_SERVICE_ORIGIN", "APPWRITE_ENDPOINT", "APPWRITE_PROJECT_ID", "APPWRITE_API_KEY"],
  },
  {
    appHost: "netlify",
    dataServices: "appwrite",
    supportLevel: "preview",
    notes: "Astro app on Netlify with Appwrite as the service layer.",
    requiredEnvKeys: ["ASTROPRESS_SERVICE_ORIGIN", "APPWRITE_ENDPOINT", "APPWRITE_PROJECT_ID", "APPWRITE_API_KEY"],
  },
  {
    appHost: "cloudflare-pages",
    dataServices: "supabase",
    supportLevel: "preview",
    notes: "Cloudflare-hosted Astro app with Supabase-hosted data and auth services.",
    requiredEnvKeys: ["ASTROPRESS_SERVICE_ORIGIN", "SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY"],
  },
  // ── Fly.io ──────────────────────────────────────────────────────────────────
  {
    appHost: "fly-io",
    dataServices: "none",
    supportLevel: "preview",
    notes: "Fly.io web service (Docker/Node) with no hosted content services.",
    requiredEnvKeys: [],
  },
  {
    appHost: "fly-io",
    dataServices: "supabase",
    supportLevel: "preview",
    notes: "Fly.io Node app with Supabase for data, media, and auth.",
    requiredEnvKeys: ["ASTROPRESS_SERVICE_ORIGIN", "SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY"],
  },
  {
    appHost: "fly-io",
    dataServices: "appwrite",
    supportLevel: "preview",
    notes: "Fly.io Node app with Appwrite for data, media, and auth.",
    requiredEnvKeys: ["ASTROPRESS_SERVICE_ORIGIN", "APPWRITE_ENDPOINT", "APPWRITE_PROJECT_ID", "APPWRITE_API_KEY"],
  },
  {
    appHost: "fly-io",
    dataServices: "turso",
    supportLevel: "preview",
    notes: "Fly.io Node app with Turso (LibSQL) for distributed SQLite data.",
    requiredEnvKeys: ["TURSO_DATABASE_URL", "TURSO_AUTH_TOKEN"],
  },
  // ── Coolify ─────────────────────────────────────────────────────────────────
  {
    appHost: "coolify",
    dataServices: "none",
    supportLevel: "preview",
    notes: "Self-hosted Coolify PaaS with no hosted content services.",
    requiredEnvKeys: [],
  },
  {
    appHost: "coolify",
    dataServices: "supabase",
    supportLevel: "preview",
    notes: "Coolify-hosted Node app with Supabase for data and auth.",
    requiredEnvKeys: ["ASTROPRESS_SERVICE_ORIGIN", "SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY"],
  },
  {
    appHost: "coolify",
    dataServices: "turso",
    supportLevel: "preview",
    notes: "Coolify-hosted Node app with Turso (LibSQL) for distributed SQLite data.",
    requiredEnvKeys: ["TURSO_DATABASE_URL", "TURSO_AUTH_TOKEN"],
  },
  // ── DigitalOcean ────────────────────────────────────────────────────────────
  {
    appHost: "digitalocean",
    dataServices: "supabase",
    supportLevel: "preview",
    notes: "DigitalOcean App Platform with Supabase for data, media, and auth.",
    requiredEnvKeys: ["ASTROPRESS_SERVICE_ORIGIN", "SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY"],
  },
  {
    appHost: "digitalocean",
    dataServices: "appwrite",
    supportLevel: "preview",
    notes: "DigitalOcean App Platform with Appwrite as the service layer.",
    requiredEnvKeys: ["ASTROPRESS_SERVICE_ORIGIN", "APPWRITE_ENDPOINT", "APPWRITE_PROJECT_ID", "APPWRITE_API_KEY"],
  },
  {
    appHost: "digitalocean",
    dataServices: "turso",
    supportLevel: "preview",
    notes: "DigitalOcean App Platform with Turso (LibSQL) for distributed SQLite data.",
    requiredEnvKeys: ["TURSO_DATABASE_URL", "TURSO_AUTH_TOKEN"],
  },
  // ── Turso with other hosts ───────────────────────────────────────────────────
  {
    appHost: "vercel",
    dataServices: "turso",
    supportLevel: "preview",
    notes: "Vercel serverless with Turso (LibSQL) for distributed SQLite data.",
    requiredEnvKeys: ["TURSO_DATABASE_URL", "TURSO_AUTH_TOKEN"],
  },
  {
    appHost: "netlify",
    dataServices: "turso",
    supportLevel: "preview",
    notes: "Netlify serverless with Turso (LibSQL) for distributed SQLite data.",
    requiredEnvKeys: ["TURSO_DATABASE_URL", "TURSO_AUTH_TOKEN"],
  },
  {
    appHost: "render-web",
    dataServices: "turso",
    supportLevel: "preview",
    notes: "Render web service with Turso (LibSQL) for distributed SQLite data.",
    requiredEnvKeys: ["TURSO_DATABASE_URL", "TURSO_AUTH_TOKEN"],
  },
  {
    appHost: "cloudflare-pages",
    dataServices: "turso",
    supportLevel: "preview",
    notes: "Cloudflare Pages + Workers with Turso (LibSQL) for SQLite-compatible edge data.",
    requiredEnvKeys: ["TURSO_DATABASE_URL", "TURSO_AUTH_TOKEN"],
  },
  // ── Railway ─────────────────────────────────────────────────────────────────
  // Railway is a paid platform — usage-based billing, no free tier.
  {
    appHost: "railway",
    dataServices: "none",
    supportLevel: "preview",
    notes: "Railway container service with no hosted content services. Paid — usage-based billing.",
    requiredEnvKeys: [],
  },
  {
    appHost: "railway",
    dataServices: "supabase",
    supportLevel: "preview",
    notes: "Railway Node app with Supabase for data, media, and auth. Paid — usage-based billing.",
    requiredEnvKeys: ["ASTROPRESS_SERVICE_ORIGIN", "SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY"],
  },
  {
    appHost: "railway",
    dataServices: "appwrite",
    supportLevel: "preview",
    notes: "Railway container with Appwrite as the service layer. Paid — usage-based billing.",
    requiredEnvKeys: ["ASTROPRESS_SERVICE_ORIGIN", "APPWRITE_ENDPOINT", "APPWRITE_PROJECT_ID", "APPWRITE_API_KEY"],
  },
  {
    appHost: "railway",
    dataServices: "turso",
    supportLevel: "preview",
    notes: "Railway deployment with Turso (LibSQL) for distributed SQLite data. Paid — usage-based billing.",
    requiredEnvKeys: ["TURSO_DATABASE_URL", "TURSO_AUTH_TOKEN"],
  },
];

export function listAstropressDeploymentMatrixEntries(): AstropressDeploymentMatrixEntry[] {
  return deploymentMatrixEntries.slice();
}

export function getAstropressDeploymentMatrixEntry(
  profile: AstropressDeploymentProfile,
): AstropressDeploymentMatrixEntry | null {
  return (
    deploymentMatrixEntries.find(
      (entry) => entry.appHost === profile.appHost && entry.dataServices === profile.dataServices,
    ) ?? null
  );
}

export function resolveAstropressDeploymentSupportLevel(
  profile: AstropressDeploymentProfile,
): AstropressDeploymentSupportLevel {
  return getAstropressDeploymentMatrixEntry(profile)?.supportLevel ?? "unsupported";
}
