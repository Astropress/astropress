import { resolveAstropressHostedProviderFromEnv } from "../project-env";
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

export function resolveAstropressHostedProvider(
  provider?: string | null,
): AstropressHostedProviderKind {
  return resolveAstropressHostedProviderFromEnv({
    ASTROPRESS_HOSTED_PROVIDER: provider ?? undefined,
  });
}

export function createAstropressHostedAdapter(
  options: AstropressHostedAdapterOptions = {},
): AstropressPlatformAdapter {
  const provider = resolveAstropressHostedProvider(
    options.provider ?? resolveAstropressHostedProviderFromEnv(process.env),
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
