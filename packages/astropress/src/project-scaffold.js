export function createAstropressProjectScaffold(provider = "sqlite") {
  const baseLocalEnv = {
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
    EDITOR_PASSWORD: "fleet-test-editor-password"
  };
  if (provider === "supabase") {
    return {
      provider,
      recommendedDeployTarget: "supabase",
      localEnv: baseLocalEnv,
      envExample: {
        ...baseLocalEnv,
        ASTROPRESS_HOSTED_PROVIDER: "supabase",
        SUPABASE_URL: "https://your-project.supabase.co",
        SUPABASE_ANON_KEY: "replace-me",
        SUPABASE_SERVICE_ROLE_KEY: "replace-me"
      }
    };
  }
  if (provider === "runway") {
    return {
      provider,
      recommendedDeployTarget: "runway",
      localEnv: baseLocalEnv,
      envExample: {
        ...baseLocalEnv,
        ASTROPRESS_HOSTED_PROVIDER: "runway",
        RUNWAY_API_TOKEN: "replace-me",
        RUNWAY_PROJECT_ID: "replace-me"
      }
    };
  }
  return {
    provider: "sqlite",
    recommendedDeployTarget: "github-pages",
    localEnv: baseLocalEnv,
    envExample: baseLocalEnv
  };
}
