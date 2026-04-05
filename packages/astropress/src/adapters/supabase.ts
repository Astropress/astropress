import {
  assertProviderContract,
  normalizeProviderCapabilities,
  type AstropressPlatformAdapter,
} from "../platform-contracts";
import { createAstropressInMemoryPlatformAdapter, type AstropressInMemoryPlatformAdapterOptions } from "../in-memory-platform-adapter";

export type AstropressSupabaseAdapterOptions = Omit<AstropressInMemoryPlatformAdapterOptions, "capabilities"> & {
  backingAdapter?: AstropressPlatformAdapter;
};

export function createAstropressSupabaseAdapter(options: AstropressSupabaseAdapterOptions = {}) {
  const baseAdapter =
    options.backingAdapter ??
    createAstropressInMemoryPlatformAdapter({
      ...options,
      capabilities: {
        name: "supabase",
        hostedAdmin: true,
        previewEnvironments: true,
        serverRuntime: true,
        database: true,
        objectStorage: true,
        gitSync: true,
      },
    });

  return assertProviderContract({
    ...baseAdapter,
    capabilities: normalizeProviderCapabilities({
      ...baseAdapter.capabilities,
      name: "supabase",
      hostedAdmin: true,
      previewEnvironments: true,
      serverRuntime: true,
      database: true,
      objectStorage: true,
      gitSync: true,
    }),
  });
}
