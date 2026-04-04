import { createAstropressInMemoryPlatformAdapter } from "../in-memory-platform-adapter.js";

export function createAstropressCloudflareAdapter(options = {}) {
  return createAstropressInMemoryPlatformAdapter({
    ...options,
    capabilities: {
      name: "cloudflare",
      staticPublishing: true,
      hostedAdmin: true,
      previewEnvironments: true,
      serverRuntime: true,
      database: true,
      objectStorage: true,
      gitSync: true,
    },
  });
}
