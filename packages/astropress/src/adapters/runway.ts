import {
  type AstropressPlatformAdapter,
} from "../platform-contracts";
import { type AstropressInMemoryPlatformAdapterOptions } from "../in-memory-platform-adapter";
import { createAstropressHostedPlatformAdapter } from "../hosted-platform-adapter";

export interface AstropressRunwayHostedConfig {
  apiToken: string;
  projectId: string;
}

export type AstropressRunwayAdapterOptions = Omit<AstropressInMemoryPlatformAdapterOptions, "capabilities"> & {
  backingAdapter?: AstropressPlatformAdapter;
};

export function createAstropressRunwayAdapter(options: AstropressRunwayAdapterOptions = {}) {
  return createAstropressHostedPlatformAdapter({
    ...options,
    providerName: "runway",
  });
}

export interface AstropressRunwayHostedAdapterOptions extends AstropressRunwayAdapterOptions {
  config?: AstropressRunwayHostedConfig;
  env?: Record<string, string | undefined>;
}

export function readAstropressRunwayHostedConfig(
  env: Record<string, string | undefined> = process.env,
): AstropressRunwayHostedConfig {
  const apiToken = env.RUNWAY_API_TOKEN?.trim();
  const projectId = env.RUNWAY_PROJECT_ID?.trim();

  if (!apiToken || !projectId) {
    throw new Error("Runway hosted config requires RUNWAY_API_TOKEN and RUNWAY_PROJECT_ID.");
  }

  return {
    apiToken,
    projectId,
  };
}

export function createAstropressRunwayHostedAdapter(
  options: AstropressRunwayHostedAdapterOptions = {},
) {
  const config = options.config ?? readAstropressRunwayHostedConfig(options.env);
  return createAstropressHostedPlatformAdapter({
    ...options,
    providerName: "runway",
    defaultCapabilities: {
      ...options.defaultCapabilities,
      hostedAdmin: true,
      previewEnvironments: true,
      serverRuntime: true,
      database: true,
      objectStorage: true,
      gitSync: true,
    },
    preview:
      options.preview ??
      {
        async create() {
          return {
            url: `https://runway.example/${config.projectId}/preview`,
          };
        },
      },
  });
}
