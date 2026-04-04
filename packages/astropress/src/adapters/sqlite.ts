import { createAstropressInMemoryPlatformAdapter, type AstropressInMemoryPlatformAdapterOptions } from "../in-memory-platform-adapter";

export type AstropressSqliteAdapterOptions = Omit<AstropressInMemoryPlatformAdapterOptions, "capabilities">;

export function createAstropressSqliteAdapter(options: AstropressSqliteAdapterOptions = {}) {
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
