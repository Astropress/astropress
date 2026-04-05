export type AstropressScaffoldProvider = "sqlite" | "supabase" | "runway";

export interface AstropressProjectScaffold {
  provider: AstropressScaffoldProvider;
  recommendedDeployTarget: "github-pages" | "supabase" | "runway";
  localEnv: Record<string, string>;
  envExample: Record<string, string>;
}

function baseLocalEnv(provider: AstropressScaffoldProvider) {
  return {
    ASTROPRESS_LOCAL_PROVIDER: provider,
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
  if (provider === "supabase") {
    return {
      provider,
      recommendedDeployTarget: "supabase",
      localEnv: baseLocalEnv(provider),
      envExample: {
        ...baseLocalEnv(provider),
        SUPABASE_URL: "https://your-project.supabase.co",
        SUPABASE_ANON_KEY: "replace-me",
        SUPABASE_SERVICE_ROLE_KEY: "replace-me",
      },
    };
  }

  if (provider === "runway") {
    return {
      provider,
      recommendedDeployTarget: "runway",
      localEnv: baseLocalEnv(provider),
      envExample: {
        ...baseLocalEnv(provider),
        RUNWAY_API_TOKEN: "replace-me",
        RUNWAY_PROJECT_ID: "replace-me",
      },
    };
  }

  return {
    provider: "sqlite",
    recommendedDeployTarget: "github-pages",
    localEnv: baseLocalEnv("sqlite"),
    envExample: baseLocalEnv("sqlite"),
  };
}
