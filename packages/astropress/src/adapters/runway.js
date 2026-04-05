import {
  assertProviderContract,
  normalizeProviderCapabilities
} from "../platform-contracts.js";
import { createAstropressInMemoryPlatformAdapter } from "../in-memory-platform-adapter.js";

export function createAstropressRunwayAdapter(options = {}) {
  const baseAdapter = options.backingAdapter ?? createAstropressInMemoryPlatformAdapter({
    ...options,
    capabilities: {
      name: "runway",
      hostedAdmin: true,
      previewEnvironments: true,
      serverRuntime: true,
      database: true,
      objectStorage: true,
      gitSync: true
    }
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
      gitSync: true
    })
  });
}
