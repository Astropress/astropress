import { createAstropressInMemoryPlatformAdapter } from "../in-memory-platform-adapter.js";

export function createAstropressSqliteAdapter(options = {}) {
  return createAstropressInMemoryPlatformAdapter({
    ...options,
    capabilities: {
      name: "sqlite",
      hostedAdmin: true,
      previewEnvironments: true,
      serverRuntime: true,
      database: true,
      objectStorage: false,
      gitSync: true,
    },
  });
}
