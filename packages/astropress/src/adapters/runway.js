import { createAstropressInMemoryPlatformAdapter } from "../in-memory-platform-adapter.js";

export function createAstropressRunwayAdapter(options = {}) {
  return createAstropressInMemoryPlatformAdapter({
    ...options,
    capabilities: {
      name: "runway",
      hostedAdmin: true,
      previewEnvironments: true,
      serverRuntime: true,
      database: true,
      objectStorage: true,
      gitSync: true,
    },
  });
}
