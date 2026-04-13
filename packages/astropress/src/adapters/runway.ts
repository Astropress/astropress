import {
  type AstropressPlatformAdapter,
} from "../platform-contracts";
import { type AstropressInMemoryPlatformAdapterOptions } from "../in-memory-platform-adapter";
import { createAstropressHostedApiAdapter, type AstropressHostedApiAdapterOptions } from "../hosted-api-adapter";
import { createAstropressHostedPlatformAdapter } from "../hosted-platform-adapter";
import { FULL_STACK_CAPABILITIES } from "./adapter-record-helpers";

export interface AstropressRunwayHostedConfig {
  apiToken: string;
  projectId: string;
  apiBaseUrl: string;
  previewBaseUrl: string;
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
  fetchImpl?: AstropressHostedApiAdapterOptions["fetchImpl"];
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
    apiBaseUrl: `https://runway.example/${projectId}/astropress-api`,
    previewBaseUrl: `https://runway.example/${projectId}`,
  };
}

export function createAstropressRunwayHostedAdapter(
  options: AstropressRunwayHostedAdapterOptions = {},
) {
  const config = options.config ?? readAstropressRunwayHostedConfig(options.env);
  if (!options.backingAdapter && !options.content && !options.media && !options.revisions && !options.auth) {
    return createAstropressHostedApiAdapter({
      providerName: "runway",
      apiBaseUrl: config.apiBaseUrl,
      accessToken: config.apiToken,
      previewBaseUrl: `${config.previewBaseUrl.replace(/\/$/, "")}/preview`,
      fetchImpl: options.fetchImpl,
      defaultCapabilities: {
        ...options.defaultCapabilities,
        ...FULL_STACK_CAPABILITIES,
      },
    });
  }
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
            url: `${config.previewBaseUrl.replace(/\/$/, "")}/preview`,
          };
        },
      },
  });
}
