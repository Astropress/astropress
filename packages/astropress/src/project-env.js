export function resolveAstropressLocalProviderFromEnv(env = process.env) {
  const provider = env.ASTROPRESS_LOCAL_PROVIDER?.trim();
  if (provider === "supabase" || provider === "runway") {
    return provider;
  }
  return "sqlite";
}

export function resolveAstropressHostedProviderFromEnv(env = process.env) {
  return env.ASTROPRESS_HOSTED_PROVIDER?.trim() === "runway" ? "runway" : "supabase";
}

export function resolveAstropressDeployTarget(env = process.env) {
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
