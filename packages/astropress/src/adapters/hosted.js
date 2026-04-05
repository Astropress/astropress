import { resolveAstropressHostedProviderFromEnv } from "../project-env.js";
import { createAstropressRunwayHostedAdapter } from "./runway.js";
import { createAstropressSupabaseHostedAdapter } from "./supabase.js";

export function resolveAstropressHostedProvider(provider) {
  return resolveAstropressHostedProviderFromEnv({
    ASTROPRESS_HOSTED_PROVIDER: provider ?? undefined
  });
}

export function createAstropressHostedAdapter(options = {}) {
  const provider = resolveAstropressHostedProvider(
    options.provider ?? resolveAstropressHostedProviderFromEnv(options.env ?? process.env)
  );
  if (provider === "runway") {
    return createAstropressRunwayHostedAdapter(options);
  }
  return createAstropressSupabaseHostedAdapter(options);
}
