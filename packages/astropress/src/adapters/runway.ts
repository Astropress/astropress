import {
  assertProviderContract,
  normalizeProviderCapabilities,
  type AstropressPlatformAdapter,
} from "../platform-contracts";
import { createAstropressInMemoryPlatformAdapter, type AstropressInMemoryPlatformAdapterOptions } from "../in-memory-platform-adapter";

export type AstropressRunwayAdapterOptions = Omit<AstropressInMemoryPlatformAdapterOptions, "capabilities"> & {
  backingAdapter?: AstropressPlatformAdapter;
};

export function createAstropressRunwayAdapter(options: AstropressRunwayAdapterOptions = {}) {
  const baseAdapter =
    options.backingAdapter ??
    createAstropressInMemoryPlatformAdapter({
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

  return assertProviderContract({
    ...baseAdapter,
    capabilities: normalizeProviderCapabilities({
      ...baseAdapter.capabilities,
      name: "runway",
      hostedAdmin: true,
      previewEnvironments: true,
      serverRuntime: true,
      database: true,
      objectStorage: true,
      gitSync: true,
    }),
  });
}
