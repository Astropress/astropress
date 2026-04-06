import {
  type AstropressPlatformAdapter,
} from "../platform-contracts";
import { type AstropressInMemoryPlatformAdapterOptions } from "../in-memory-platform-adapter";
import { createAstropressHostedApiAdapter, type AstropressHostedApiAdapterOptions } from "../hosted-api-adapter";
import { createAstropressHostedPlatformAdapter } from "../hosted-platform-adapter";

export interface AstropressAppwriteHostedConfig {
  endpoint: string;
  projectId: string;
  apiKey: string;
  apiBaseUrl: string;
  previewBaseUrl: string;
}

export type AstropressAppwriteAdapterOptions = Omit<AstropressInMemoryPlatformAdapterOptions, "capabilities"> & {
  backingAdapter?: AstropressPlatformAdapter;
};

export function createAstropressAppwriteAdapter(options: AstropressAppwriteAdapterOptions = {}) {
  return createAstropressHostedPlatformAdapter({
    ...options,
    providerName: "custom",
    defaultCapabilities: {
      ...options.defaultCapabilities,
      hostedAdmin: true,
      previewEnvironments: true,
      serverRuntime: true,
      database: true,
      objectStorage: true,
      gitSync: true,
    },
  });
}

export interface AstropressAppwriteHostedAdapterOptions extends AstropressAppwriteAdapterOptions {
  config?: AstropressAppwriteHostedConfig;
  env?: Record<string, string | undefined>;
  fetchImpl?: AstropressHostedApiAdapterOptions["fetchImpl"];
}

export function readAstropressAppwriteHostedConfig(
  env: Record<string, string | undefined> = process.env,
): AstropressAppwriteHostedConfig {
  const endpoint = env.APPWRITE_ENDPOINT?.trim();
  const projectId = env.APPWRITE_PROJECT_ID?.trim();
  const apiKey = env.APPWRITE_API_KEY?.trim();

  if (!endpoint || !projectId || !apiKey) {
    throw new Error(
      "Appwrite hosted config requires APPWRITE_ENDPOINT, APPWRITE_PROJECT_ID, and APPWRITE_API_KEY.",
    );
  }

  return {
    endpoint,
    projectId,
    apiKey,
    apiBaseUrl: `${endpoint.replace(/\/$/, "")}/functions/astropress`,
    previewBaseUrl: `${endpoint.replace(/\/$/, "")}/console/project-${projectId}`,
  };
}

export function createAstropressAppwriteHostedAdapter(
  options: AstropressAppwriteHostedAdapterOptions = {},
) {
  const config = options.config ?? readAstropressAppwriteHostedConfig(options.env);
  if (!options.backingAdapter && !options.content && !options.media && !options.revisions && !options.auth) {
    return createAstropressHostedApiAdapter({
      providerName: "custom",
      apiBaseUrl: config.apiBaseUrl,
      accessToken: config.apiKey,
      previewBaseUrl: `${config.previewBaseUrl.replace(/\/$/, "")}/preview`,
      fetchImpl: options.fetchImpl,
      defaultCapabilities: {
        ...options.defaultCapabilities,
        hostedAdmin: true,
        previewEnvironments: true,
        serverRuntime: true,
        database: true,
        objectStorage: true,
        gitSync: true,
      },
    });
  }

  return createAstropressHostedPlatformAdapter({
    ...options,
    providerName: "custom",
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
