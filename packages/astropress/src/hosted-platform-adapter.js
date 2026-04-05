import {
  assertProviderContract,
  normalizeProviderCapabilities,
} from "./platform-contracts.js";
import { createAstropressInMemoryPlatformAdapter } from "./in-memory-platform-adapter.js";

export function createAstropressHostedPlatformAdapter(options) {
  const capabilities = {
    name: options.providerName,
    hostedAdmin: true,
    previewEnvironments: true,
    serverRuntime: true,
    database: true,
    objectStorage: true,
    gitSync: true,
    ...options.defaultCapabilities,
  };
  const baseAdapter =
    options.backingAdapter ??
    createAstropressInMemoryPlatformAdapter({
      ...options,
      capabilities,
    });
  return assertProviderContract({
    ...baseAdapter,
    capabilities: normalizeProviderCapabilities({
      ...baseAdapter.capabilities,
      ...capabilities,
    }),
  });
}
