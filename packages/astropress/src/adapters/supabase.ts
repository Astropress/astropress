import {
  type AstropressPlatformAdapter,
} from "../platform-contracts";
import { type AstropressInMemoryPlatformAdapterOptions } from "../in-memory-platform-adapter";
import { createAstropressHostedPlatformAdapter } from "../hosted-platform-adapter";

export interface AstropressSupabaseHostedConfig {
  url: string;
  anonKey: string;
  serviceRoleKey: string;
}

export type AstropressSupabaseAdapterOptions = Omit<AstropressInMemoryPlatformAdapterOptions, "capabilities"> & {
  backingAdapter?: AstropressPlatformAdapter;
};

export function createAstropressSupabaseAdapter(options: AstropressSupabaseAdapterOptions = {}) {
  return createAstropressHostedPlatformAdapter({
    ...options,
    providerName: "supabase",
  });
}

export interface AstropressSupabaseHostedAdapterOptions extends AstropressSupabaseAdapterOptions {
  config?: AstropressSupabaseHostedConfig;
  env?: Record<string, string | undefined>;
}

export function readAstropressSupabaseHostedConfig(
  env: Record<string, string | undefined> = process.env,
): AstropressSupabaseHostedConfig {
  const url = env.SUPABASE_URL?.trim();
  const anonKey = env.SUPABASE_ANON_KEY?.trim();
  const serviceRoleKey = env.SUPABASE_SERVICE_ROLE_KEY?.trim();

  if (!url || !anonKey || !serviceRoleKey) {
    throw new Error(
      "Supabase hosted config requires SUPABASE_URL, SUPABASE_ANON_KEY, and SUPABASE_SERVICE_ROLE_KEY.",
    );
  }

  return {
    url,
    anonKey,
    serviceRoleKey,
  };
}

export function createAstropressSupabaseHostedAdapter(
  options: AstropressSupabaseHostedAdapterOptions = {},
) {
  const config = options.config ?? readAstropressSupabaseHostedConfig(options.env);
  return createAstropressHostedPlatformAdapter({
    ...options,
    providerName: "supabase",
    defaultCapabilities: {
      ...options.defaultCapabilities,
      hostedAdmin: true,
      previewEnvironments: true,
      serverRuntime: true,
      database: true,
      objectStorage: true,
      gitSync: true,
    },
    preview:
      options.preview ??
      {
        async create() {
          return {
            url: `${config.url.replace(/\/$/, "")}/preview`,
          };
        },
      },
  });
}
