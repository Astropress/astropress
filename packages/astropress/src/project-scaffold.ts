import { recommendAstropressProvider } from "./provider-choice";

export type AstropressScaffoldProvider = "sqlite" | "supabase" | "runway";

export interface AstropressProjectScaffold {
  provider: AstropressScaffoldProvider;
  recommendedDeployTarget: "github-pages" | "cloudflare" | "supabase" | "runway";
  recommendationRationale: string;
  localEnv: Record<string, string>;
  envExample: Record<string, string>;
}

function baseLocalEnv(provider: AstropressScaffoldProvider) {
  return {
    ASTROPRESS_LOCAL_PROVIDER: provider,
    ASTROPRESS_DEPLOY_TARGET:
      provider === "supabase" ? "supabase" : provider === "runway" ? "runway" : "github-pages",
    ADMIN_DB_PATH:
      provider === "supabase"
        ? ".data/supabase-admin.sqlite"
        : provider === "runway"
          ? ".data/runway-admin.sqlite"
          : ".data/admin.sqlite",
    ADMIN_PASSWORD: "fleet-test-admin-password",
    EDITOR_PASSWORD: "fleet-test-editor-password",
  };
}

export function createAstropressProjectScaffold(
  provider: AstropressScaffoldProvider = "sqlite",
): AstropressProjectScaffold {
  const recommendation =
    provider === "sqlite"
      ? recommendAstropressProvider()
      : recommendAstropressProvider({ existingPlatform: provider });

  if (provider === "supabase") {
    return {
      provider,
      recommendedDeployTarget: recommendation.publicDeployTarget,
      recommendationRationale: recommendation.rationale,
      localEnv: baseLocalEnv(provider),
      envExample: {
        ...baseLocalEnv(provider),
        ASTROPRESS_HOSTED_PROVIDER: "supabase",
        SUPABASE_URL: "https://your-project.supabase.co",
        SUPABASE_ANON_KEY: "replace-me",
        SUPABASE_SERVICE_ROLE_KEY: "replace-me",
      },
    };
  }

  if (provider === "runway") {
    return {
      provider,
      recommendedDeployTarget: recommendation.publicDeployTarget,
      recommendationRationale: recommendation.rationale,
      localEnv: baseLocalEnv(provider),
      envExample: {
        ...baseLocalEnv(provider),
        ASTROPRESS_HOSTED_PROVIDER: "runway",
        RUNWAY_API_TOKEN: "replace-me",
        RUNWAY_PROJECT_ID: "replace-me",
      },
    };
  }

  return {
    provider: "sqlite",
    recommendedDeployTarget: recommendation.publicDeployTarget,
    recommendationRationale: recommendation.rationale,
    localEnv: baseLocalEnv("sqlite"),
    envExample: baseLocalEnv("sqlite"),
  };
}
