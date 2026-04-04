import { createAstropressInMemoryPlatformAdapter, type AstropressInMemoryPlatformAdapterOptions } from "../in-memory-platform-adapter";

export type AstropressCloudflareAdapterOptions = Omit<AstropressInMemoryPlatformAdapterOptions, "capabilities">;

export function createAstropressCloudflareAdapter(options: AstropressCloudflareAdapterOptions = {}) {
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
