import { resolveAstropressHostedProviderFromEnv } from "../project-env.js";
import { createAstropressAppwriteHostedAdapter } from "./appwrite.js";
import { createAstropressPocketbaseHostedAdapter } from "./pocketbase.js";
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
  if (provider === "appwrite") {
    return createAstropressAppwriteHostedAdapter(options);
  }
  if (provider === "pocketbase") {
    return createAstropressPocketbaseHostedAdapter(options);
  }
  return createAstropressSupabaseHostedAdapter(options);
}
