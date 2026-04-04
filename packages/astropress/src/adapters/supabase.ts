import { createAstropressInMemoryPlatformAdapter, type AstropressInMemoryPlatformAdapterOptions } from "../in-memory-platform-adapter";

export type AstropressSupabaseAdapterOptions = Omit<AstropressInMemoryPlatformAdapterOptions, "capabilities">;

export function createAstropressSupabaseAdapter(options: AstropressSupabaseAdapterOptions = {}) {
  return createAstropressInMemoryPlatformAdapter({
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
}
