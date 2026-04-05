export type AstropressLocalProviderEnv = "sqlite" | "supabase" | "runway";
export type AstropressHostedProviderEnv = "supabase" | "runway";
export type AstropressDeployTargetEnv =
  | "github-pages"
  | "cloudflare"
  | "supabase"
  | "runway";

export interface AstropressProjectEnvContract {
  localProvider: AstropressLocalProviderEnv;
  hostedProvider: AstropressHostedProviderEnv;
  deployTarget: AstropressDeployTargetEnv;
  adminDbPath: string;
}

export function resolveAstropressLocalProviderFromEnv(
  env: Record<string, string | undefined> = process.env,
): AstropressLocalProviderEnv {
  const provider = env.ASTROPRESS_LOCAL_PROVIDER?.trim();
  if (provider === "supabase" || provider === "runway") {
    return provider;
  }
  return "sqlite";
}

export function resolveAstropressHostedProviderFromEnv(
  env: Record<string, string | undefined> = process.env,
): AstropressHostedProviderEnv {
  return env.ASTROPRESS_HOSTED_PROVIDER?.trim() === "runway" ? "runway" : "supabase";
}

export function resolveAstropressDeployTarget(
  env: Record<string, string | undefined> = process.env,
): AstropressDeployTargetEnv {
  const explicitTarget = env.ASTROPRESS_DEPLOY_TARGET?.trim();
  if (
    explicitTarget === "github-pages" ||
    explicitTarget === "cloudflare" ||
    explicitTarget === "supabase" ||
    explicitTarget === "runway"
  ) {
    return explicitTarget;
  }

  const localProvider = resolveAstropressLocalProviderFromEnv(env);
  if (localProvider === "supabase") {
    return "supabase";
  }
  if (localProvider === "runway") {
    return "runway";
  }
  return "github-pages";
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
    adminDbPath,
  };
}
