import { createAstropressInMemoryPlatformAdapter, type AstropressInMemoryPlatformAdapterOptions } from "../in-memory-platform-adapter";

export type AstropressRunwayAdapterOptions = Omit<AstropressInMemoryPlatformAdapterOptions, "capabilities">;

export function createAstropressRunwayAdapter(options: AstropressRunwayAdapterOptions = {}) {
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
