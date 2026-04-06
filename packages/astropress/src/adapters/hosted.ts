import { resolveAstropressHostedProviderFromEnv } from "../project-env";
import type { AstropressPlatformAdapter } from "../platform-contracts";
import {
  createAstropressAppwriteHostedAdapter,
  type AstropressAppwriteHostedAdapterOptions,
} from "./appwrite";
import {
  createAstropressFirebaseHostedAdapter,
  type AstropressFirebaseHostedAdapterOptions,
} from "./firebase";
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

export type AstropressHostedProviderKind = "supabase" | "runway" | "firebase" | "appwrite" | "pocketbase";

export type AstropressHostedAdapterOptions =
  | ({ provider?: "supabase"; env?: Record<string, string | undefined> } & AstropressSupabaseHostedAdapterOptions)
  | ({ provider: "firebase"; env?: Record<string, string | undefined> } & AstropressFirebaseHostedAdapterOptions)
  | ({ provider: "appwrite"; env?: Record<string, string | undefined> } & AstropressAppwriteHostedAdapterOptions)
  | ({ provider: "pocketbase"; env?: Record<string, string | undefined> } & AstropressPocketbaseHostedAdapterOptions)
  | ({ provider: "runway"; env?: Record<string, string | undefined> } & AstropressRunwayHostedAdapterOptions);

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

  if (provider === "firebase") {
    return createAstropressFirebaseHostedAdapter(
      options as Extract<AstropressHostedAdapterOptions, { provider: "firebase" }>,
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

  return createAstropressSupabaseHostedAdapter(
    options as Extract<AstropressHostedAdapterOptions, { provider?: "supabase" }>,
  );
}
