import { createAstropressRunwayHostedAdapter } from "./runway.js";
import { createAstropressSupabaseHostedAdapter } from "./supabase.js";

export function resolveAstropressHostedProvider(provider) {
  if (provider === "runway") {
    return "runway";
  }
  return "supabase";
}

export function createAstropressHostedAdapter(options = {}) {
  const provider = resolveAstropressHostedProvider(
    options.provider ?? process.env.ASTROPRESS_HOSTED_PROVIDER ?? null
  );
  if (provider === "runway") {
    return createAstropressRunwayHostedAdapter(options);
  }
  return createAstropressSupabaseHostedAdapter(options);
}
