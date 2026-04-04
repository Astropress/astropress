import { createAstropressInMemoryPlatformAdapter } from "../in-memory-platform-adapter.js";

export function createAstropressSupabaseAdapter(options = {}) {
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
