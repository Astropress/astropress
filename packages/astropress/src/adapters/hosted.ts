import type { AstropressPlatformAdapter } from "../platform-contracts";
import {
  createAstropressRunwayHostedAdapter,
  type AstropressRunwayHostedAdapterOptions,
} from "./runway";
import {
  createAstropressSupabaseHostedAdapter,
  type AstropressSupabaseHostedAdapterOptions,
} from "./supabase";

export type AstropressHostedProviderKind = "supabase" | "runway";

export type AstropressHostedAdapterOptions =
  | ({ provider?: "supabase" } & AstropressSupabaseHostedAdapterOptions)
  | ({ provider: "runway" } & AstropressRunwayHostedAdapterOptions);

function normalizeHostedProvider(provider?: string | null): AstropressHostedProviderKind {
  if (provider === "runway") {
    return "runway";
  }
  return "supabase";
}

export function createAstropressHostedAdapter(
  options: AstropressHostedAdapterOptions = {},
): AstropressPlatformAdapter {
  const provider = normalizeHostedProvider(
    options.provider ?? process.env.ASTROPRESS_HOSTED_PROVIDER ?? null,
  );

  if (provider === "runway") {
    return createAstropressRunwayHostedAdapter(
      options as Extract<AstropressHostedAdapterOptions, { provider: "runway" }>,
    );
  }

  return createAstropressSupabaseHostedAdapter(
    options as Extract<AstropressHostedAdapterOptions, { provider?: "supabase" }>,
  );
}
