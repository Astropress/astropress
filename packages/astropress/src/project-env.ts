import type { AstropressAppHost } from "./app-host-targets";
import type { AstropressDataServices } from "./data-service-targets";

export type AstropressLocalProviderEnv = "sqlite" | "supabase" | "runway";
export type AstropressHostedProviderEnv = "supabase" | "runway" | "firebase" | "appwrite" | "pocketbase";
export type AstropressDeployTargetEnv =
  | "github-pages"
  | "cloudflare"
  | "vercel"
  | "netlify"
  | "render-static"
  | "render-web"
  | "gitlab-pages"
  | "firebase-hosting"
  | "runway"
  | "custom";
export type AstropressAppHostEnv = AstropressAppHost;
export type AstropressDataServicesEnv = AstropressDataServices;
export type AstropressContentServicesEnv = AstropressDataServicesEnv;

export interface AstropressProjectEnvContract {
  localProvider: AstropressLocalProviderEnv;
  hostedProvider: AstropressHostedProviderEnv;
  deployTarget: AstropressDeployTargetEnv;
  appHost: AstropressAppHostEnv;
  dataServices: AstropressDataServicesEnv;
  contentServices: AstropressContentServicesEnv;
  serviceOrigin: string | null;
  adminDbPath: string;
}

function mapLegacyDeployTargetToAppHost(target?: string | null): AstropressAppHostEnv | null {
  switch (target?.trim()) {
    case "github-pages":
      return "github-pages";
    case "cloudflare":
      return "cloudflare-pages";
    case "vercel":
      return "vercel";
    case "netlify":
      return "netlify";
    case "render-static":
      return "render-static";
    case "render-web":
      return "render-web";
    case "gitlab-pages":
      return "gitlab-pages";
    case "firebase-hosting":
      return "firebase-hosting";
    case "runway":
      return "runway";
    case "custom":
      return "custom";
    default:
      return null;
  }
}

function mapAppHostToDeployTarget(appHost: AstropressAppHostEnv): AstropressDeployTargetEnv {
  return appHost === "cloudflare-pages" ? "cloudflare" : appHost;
}

function resolveDataServicesFromLegacyEnv(
  env: Record<string, string | undefined>,
): AstropressDataServicesEnv {
  const hostedProvider = env.ASTROPRESS_HOSTED_PROVIDER?.trim();
  if (hostedProvider === "runway") {
    return "runway";
  }
  if (hostedProvider === "firebase") {
    return "firebase";
  }
  if (hostedProvider === "appwrite") {
    return "appwrite";
  }
  if (hostedProvider === "supabase") {
    return "supabase";
  }

  const localProvider = env.ASTROPRESS_LOCAL_PROVIDER?.trim();
  if (localProvider === "supabase") {
    return "supabase";
  }
  if (localProvider === "runway") {
    return "runway";
  }
  if (env.ASTROPRESS_DEPLOY_TARGET?.trim() === "cloudflare") {
    return "cloudflare";
  }
  return "none";
}

export function resolveAstropressAppHostFromEnv(
  env: Record<string, string | undefined> = process.env,
): AstropressAppHostEnv {
  const explicitHost = env.ASTROPRESS_APP_HOST?.trim() ?? env.ASTROPRESS_WEB_HOST?.trim();
  if (
    explicitHost === "github-pages" ||
    explicitHost === "cloudflare-pages" ||
    explicitHost === "vercel" ||
    explicitHost === "netlify" ||
    explicitHost === "render-static" ||
    explicitHost === "render-web" ||
    explicitHost === "gitlab-pages" ||
    explicitHost === "firebase-hosting" ||
    explicitHost === "runway" ||
    explicitHost === "custom"
  ) {
    return explicitHost;
  }

  const legacyDeployTarget = mapLegacyDeployTargetToAppHost(env.ASTROPRESS_DEPLOY_TARGET);
  if (legacyDeployTarget) {
    return legacyDeployTarget;
  }

  const dataServices = resolveDataServicesFromLegacyEnv(env);
  if (dataServices === "cloudflare") {
    return "cloudflare-pages";
  }
  if (dataServices === "supabase") {
    return "vercel";
  }
  if (dataServices === "firebase" || dataServices === "appwrite" || dataServices === "pocketbase" || dataServices === "nhost" || dataServices === "neon" || dataServices === "custom") {
    return "render-web";
  }
  if (dataServices === "runway") {
    return "runway";
  }
  return "github-pages";
}

export function resolveAstropressDataServicesFromEnv(
  env: Record<string, string | undefined> = process.env,
): AstropressDataServicesEnv {
  const explicitServices =
    env.ASTROPRESS_CONTENT_SERVICES?.trim() ??
    env.ASTROPRESS_DATA_SERVICES?.trim() ??
    env.ASTROPRESS_BACKEND_PLATFORM?.trim();
  if (
    explicitServices === "none" ||
    explicitServices === "cloudflare" ||
    explicitServices === "supabase" ||
    explicitServices === "firebase" ||
    explicitServices === "appwrite" ||
    explicitServices === "pocketbase" ||
    explicitServices === "neon" ||
    explicitServices === "nhost" ||
    explicitServices === "runway" ||
    explicitServices === "custom"
  ) {
    return explicitServices;
  }

  return resolveDataServicesFromLegacyEnv(env);
}

export function resolveAstropressServiceOriginFromEnv(
  env: Record<string, string | undefined> = process.env,
): string | null {
  const explicitOrigin = env.ASTROPRESS_SERVICE_ORIGIN?.trim();
  if (explicitOrigin) {
    return explicitOrigin;
  }

  const dataServices = resolveAstropressDataServicesFromEnv(env);
  if (dataServices === "none") {
    return null;
  }

  if (dataServices === "supabase") {
    const url = env.SUPABASE_URL?.trim();
    return url ? `${url.replace(/\/$/, "")}/functions/v1/astropress` : null;
  }

  if (dataServices === "firebase") {
    const projectId = env.FIREBASE_PROJECT_ID?.trim();
    return projectId ? `https://${projectId}.firebaseapp.com/astropress-api` : null;
  }

  if (dataServices === "appwrite") {
    const endpoint = env.APPWRITE_ENDPOINT?.trim();
    return endpoint ? `${endpoint.replace(/\/$/, "")}/functions/astropress` : null;
  }

  if (dataServices === "runway") {
    const projectId = env.RUNWAY_PROJECT_ID?.trim();
    return projectId ? `https://runway.example/${projectId}/astropress-api` : null;
  }

  return null;
}

export function resolveAstropressLocalProviderFromEnv(
  env: Record<string, string | undefined> = process.env,
): AstropressLocalProviderEnv {
  const provider = env.ASTROPRESS_LOCAL_PROVIDER?.trim();
  if (provider === "supabase" || provider === "runway") {
    return provider;
  }

  const dataServices = resolveAstropressDataServicesFromEnv(env);
  if (dataServices === "supabase") {
    return "supabase";
  }
  if (dataServices === "runway") {
    return "runway";
  }
  return "sqlite";
}

export function resolveAstropressHostedProviderFromEnv(
  env: Record<string, string | undefined> = process.env,
): AstropressHostedProviderEnv {
  const provider = env.ASTROPRESS_HOSTED_PROVIDER?.trim();
  if (provider === "runway") {
    return "runway";
  }
  if (provider === "firebase") {
    return "firebase";
  }
  if (provider === "appwrite") {
    return "appwrite";
  }
  if (provider === "pocketbase") {
    return "pocketbase";
  }
  if (provider === "supabase") {
    return "supabase";
  }

  const dataServices = resolveAstropressDataServicesFromEnv(env);
  if (dataServices === "runway") {
    return "runway";
  }
  if (dataServices === "firebase") {
    return "firebase";
  }
  if (dataServices === "appwrite") {
    return "appwrite";
  }
  if (dataServices === "pocketbase") {
    return "pocketbase";
  }
  return "supabase";
}

export function resolveAstropressDeployTarget(
  env: Record<string, string | undefined> = process.env,
): AstropressDeployTargetEnv {
  const explicitTarget = env.ASTROPRESS_DEPLOY_TARGET?.trim();
  if (
    explicitTarget === "github-pages" ||
    explicitTarget === "cloudflare" ||
    explicitTarget === "vercel" ||
    explicitTarget === "netlify" ||
    explicitTarget === "render-static" ||
    explicitTarget === "render-web" ||
    explicitTarget === "gitlab-pages" ||
    explicitTarget === "firebase-hosting" ||
    explicitTarget === "runway" ||
    explicitTarget === "custom"
  ) {
    return explicitTarget;
  }

  return mapAppHostToDeployTarget(resolveAstropressAppHostFromEnv(env));
}

export function resolveAstropressProjectEnvContract(
  env: Record<string, string | undefined> = process.env,
): AstropressProjectEnvContract {
  const localProvider = resolveAstropressLocalProviderFromEnv(env);
  const adminDbPath =
    env.ADMIN_DB_PATH?.trim() ||
    (localProvider === "supabase"
      ? ".data/supabase-admin.sqlite"
      : localProvider === "runway"
        ? ".data/runway-admin.sqlite"
        : ".data/admin.sqlite");

  return {
    localProvider,
    hostedProvider: resolveAstropressHostedProviderFromEnv(env),
    deployTarget: resolveAstropressDeployTarget(env),
    appHost: resolveAstropressAppHostFromEnv(env),
    dataServices: resolveAstropressDataServicesFromEnv(env),
    contentServices: resolveAstropressDataServicesFromEnv(env),
    serviceOrigin: resolveAstropressServiceOriginFromEnv(env),
    adminDbPath,
  };
}
