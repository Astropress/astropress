import type { AstropressAppHost } from "./app-host-targets";
import type { AstropressDataServices } from "./data-service-targets";
import {
  getAstropressDeploymentMatrixEntry,
  resolveAstropressDeploymentSupportLevel,
} from "./deployment-matrix";
import {
  deriveLegacyProvider,
  defaultAdminDbPath,
  appHostToDeployTarget,
  baseLocalEnv,
  baseEnvExample,
  buildDataServiceExample,
  buildAnalyticsEnvExample,
  buildAbTestingEnvExample,
  buildHeatmapEnvExample,
  buildApiEnvExample,
  buildDonationsEnvExample,
} from "./project-scaffold-env";
import { createPackageScripts, createCiFiles, createDeployDoc } from "./project-scaffold-ci";

export type AstropressScaffoldProvider = "sqlite" | "supabase" | "runway";

export type AstropressAnalyticsProvider = "umami" | "plausible" | "matomo" | "posthog" | "custom";
export type AstropressAbTestingProvider = "growthbook" | "unleash" | "custom";
export type AstropressHeatmapProvider = "openreplay" | "posthog" | "custom";

export interface AstropressDonationsProviders {
  giveLively?: boolean;
  liberapay?: boolean;
  pledgeCrypto?: boolean;
}

export interface AstropressProjectScaffoldInput {
  appHost?: AstropressAppHost;
  dataServices?: AstropressDataServices;
  legacyProvider?: AstropressScaffoldProvider;
  analytics?: AstropressAnalyticsProvider;
  abTesting?: AstropressAbTestingProvider;
  heatmap?: AstropressHeatmapProvider;
  enableApi?: boolean;
  donations?: AstropressDonationsProviders;
}

export interface AstropressProjectScaffold {
  provider: AstropressScaffoldProvider;
  appHost: AstropressAppHost;
  dataServices: AstropressDataServices;
  contentServices: AstropressDataServices;
  recommendedDeployTarget: string;
  recommendationRationale: string;
  supportLevel: string;
  localEnv: Record<string, string>;
  envExample: Record<string, string>;
  packageScripts: Record<string, string>;
  ciFiles: Record<string, string>;
  deployDoc: string;
  requiredEnvKeys: string[];
}

function resolveProfile(
  input: AstropressProjectScaffoldInput | AstropressScaffoldProvider,
): { appHost: AstropressAppHost; dataServices: AstropressDataServices; provider: AstropressScaffoldProvider } {
  if (typeof input === "string") {
    if (input === "supabase") return { appHost: "vercel", dataServices: "supabase", provider: "supabase" };
    if (input === "runway") return { appHost: "runway", dataServices: "runway", provider: "runway" };
    return { appHost: "github-pages", dataServices: "none", provider: "sqlite" };
  }

  const dataServices = input.dataServices ?? (input.legacyProvider === "supabase"
    ? "supabase"
    : input.legacyProvider === "runway"
      ? "runway"
      : "none");
  return {
    appHost:
      input.appHost ??
      (dataServices === "cloudflare"
        ? "cloudflare-pages"
        : dataServices === "supabase"
          ? "vercel"
          : dataServices === "runway"
            ? "runway"
            : dataServices === "appwrite" ||
                dataServices === "pocketbase" ||
                dataServices === "nhost" ||
                dataServices === "neon" ||
                dataServices === "turso"
              ? "render-web"
              : "github-pages"),
    dataServices,
    provider: input.legacyProvider ?? deriveLegacyProvider(dataServices),
  };
}

/**
 * Generate a complete project scaffold configuration for the given deployment
 * profile, including environment variables, package scripts, CI files, and
 * deployment documentation.
 *
 * @example
 * ```ts
 * import { createAstropressProjectScaffold } from "@astropress-diy/astropress";
 *
 * const scaffold = createAstropressProjectScaffold({ appHost: "vercel", dataServices: "supabase" });
 * // scaffold.localEnv  — object of env vars to write to .env
 * // scaffold.envExample — object of env vars to write to .env.example
 * // scaffold.packageScripts — scripts to merge into package.json
 * ```
 */
export function createAstropressProjectScaffold(
  input: AstropressProjectScaffoldInput | AstropressScaffoldProvider = "sqlite",
): AstropressProjectScaffold {
  const profile = resolveProfile(input);
  const supportLevel = resolveAstropressDeploymentSupportLevel({
    appHost: profile.appHost,
    dataServices: profile.dataServices,
  });
  const matrixEntry = getAstropressDeploymentMatrixEntry({
    appHost: profile.appHost,
    dataServices: profile.dataServices,
  });
  const recommendationRationale =
    matrixEntry?.notes ??
    `Astropress does not yet mark ${profile.appHost} + ${profile.dataServices} as a first-class pair. Keep this combination in preview until you validate the missing runtime and operational pieces yourself.`;
  const requiredEnvKeys = matrixEntry?.requiredEnvKeys ?? [];

  const analyticsOpt = typeof input === "string" ? undefined : input.analytics;
  const abTestingOpt = typeof input === "string" ? undefined : input.abTesting;
  const heatmapOpt = typeof input === "string" ? undefined : input.heatmap;
  const enableApi = typeof input === "string" ? false : (input.enableApi ?? false);
  const donationsOpt = typeof input === "string" ? undefined : input.donations;

  const localEnv = baseLocalEnv(profile.provider, profile.appHost, profile.dataServices);
  if (enableApi) localEnv.ASTROPRESS_API_ENABLED = "true";

  return {
    provider: profile.provider,
    appHost: profile.appHost,
    dataServices: profile.dataServices,
    contentServices: profile.dataServices,
    recommendedDeployTarget: appHostToDeployTarget(profile.appHost),
    recommendationRationale,
    supportLevel,
    localEnv,
    envExample: {
      ...baseEnvExample(profile.provider, profile.appHost, profile.dataServices),
      ...buildDataServiceExample(profile.dataServices),
      ...buildAnalyticsEnvExample(analyticsOpt),
      ...buildAbTestingEnvExample(abTestingOpt),
      ...buildHeatmapEnvExample(heatmapOpt),
      ...(enableApi ? buildApiEnvExample() : {}),
      ...buildDonationsEnvExample(donationsOpt),
    },
    packageScripts: createPackageScripts(profile.appHost),
    ciFiles: createCiFiles(profile.appHost, requiredEnvKeys, donationsOpt),
    deployDoc: createDeployDoc(profile.appHost, profile.dataServices, supportLevel, requiredEnvKeys),
    requiredEnvKeys,
  };
}
