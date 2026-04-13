import { resolveAstropressHostedProviderFromEnv } from "../project-env";
import type { AstropressPlatformAdapter } from "../platform-contracts";
import {
  createAstropressAppwriteHostedAdapter,
  type AstropressAppwriteHostedAdapterOptions,
} from "./appwrite";
import {
  createAstropressNeonHostedAdapter,
  type AstropressNeonHostedAdapterOptions,
} from "./neon";
import {
  createAstropressNhostHostedAdapter,
  type AstropressNhostHostedAdapterOptions,
} from "./nhost";
import {
  createAstropressPocketbaseHostedAdapter,
  type AstropressPocketbaseHostedAdapterOptions,
} from "./pocketbase";
import {
  createAstropressRunwayHostedAdapter,
  type AstropressRunwayHostedAdapterOptions,
} from "./runway";
import {
  createAstropressSupabaseHostedAdapter,
  type AstropressSupabaseHostedAdapterOptions,
} from "./supabase";
import {
  createAstropressTursoHostedAdapter,
  type AstropressTursoHostedAdapterOptions,
} from "./turso";

export type AstropressHostedProviderKind =
  | "supabase"
  | "runway"
  | "appwrite"
  | "pocketbase"
  | "nhost"
  | "neon"
  | "turso";

export type AstropressHostedAdapterOptions =
  | ({ provider?: "supabase"; env?: Record<string, string | undefined> } & AstropressSupabaseHostedAdapterOptions)
  | ({ provider: "appwrite"; env?: Record<string, string | undefined> } & AstropressAppwriteHostedAdapterOptions)
  | ({ provider: "pocketbase"; env?: Record<string, string | undefined> } & AstropressPocketbaseHostedAdapterOptions)
  | ({ provider: "runway"; env?: Record<string, string | undefined> } & AstropressRunwayHostedAdapterOptions)
  | ({ provider: "nhost"; env?: Record<string, string | undefined> } & AstropressNhostHostedAdapterOptions)
  | ({ provider: "neon"; env?: Record<string, string | undefined> } & AstropressNeonHostedAdapterOptions)
  | ({ provider: "turso"; env?: Record<string, string | undefined> } & AstropressTursoHostedAdapterOptions);

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
    options.provider ?? resolveAstropressHostedProviderFromEnv(options.env ?? process.env),
  );

  if (provider === "runway") {
    return createAstropressRunwayHostedAdapter(
      options as Extract<AstropressHostedAdapterOptions, { provider: "runway" }>,
    );
  }

  if (provider === "appwrite") {
    return createAstropressAppwriteHostedAdapter(
      options as Extract<AstropressHostedAdapterOptions, { provider: "appwrite" }>,
    );
  }

  if (provider === "pocketbase") {
    return createAstropressPocketbaseHostedAdapter(
      options as Extract<AstropressHostedAdapterOptions, { provider: "pocketbase" }>,
    );
  }

  if (provider === "nhost") {
    return createAstropressNhostHostedAdapter(
      options as Extract<AstropressHostedAdapterOptions, { provider: "nhost" }>,
    );
  }

  if (provider === "neon") {
    return createAstropressNeonHostedAdapter(
      options as Extract<AstropressHostedAdapterOptions, { provider: "neon" }>,
    );
  }

  if (provider === "turso") {
    return createAstropressTursoHostedAdapter(
      options as Extract<AstropressHostedAdapterOptions, { provider: "turso" }>,
    );
  }

  return createAstropressSupabaseHostedAdapter(
    options as Extract<AstropressHostedAdapterOptions, { provider?: "supabase" }>,
  );
}
