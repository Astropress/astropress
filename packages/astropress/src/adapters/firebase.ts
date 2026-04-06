import {
  type AstropressPlatformAdapter,
} from "../platform-contracts";
import { type AstropressInMemoryPlatformAdapterOptions } from "../in-memory-platform-adapter";
import { createAstropressHostedApiAdapter, type AstropressHostedApiAdapterOptions } from "../hosted-api-adapter";
import { createAstropressHostedPlatformAdapter } from "../hosted-platform-adapter";

export interface AstropressFirebaseHostedConfig {
  projectId: string;
  clientEmail: string;
  privateKey: string;
  apiBaseUrl: string;
  previewBaseUrl: string;
}

export type AstropressFirebaseAdapterOptions = Omit<AstropressInMemoryPlatformAdapterOptions, "capabilities"> & {
  backingAdapter?: AstropressPlatformAdapter;
};

export function createAstropressFirebaseAdapter(options: AstropressFirebaseAdapterOptions = {}) {
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

export interface AstropressFirebaseHostedAdapterOptions extends AstropressFirebaseAdapterOptions {
  config?: AstropressFirebaseHostedConfig;
  env?: Record<string, string | undefined>;
  fetchImpl?: AstropressHostedApiAdapterOptions["fetchImpl"];
}

export function readAstropressFirebaseHostedConfig(
  env: Record<string, string | undefined> = process.env,
): AstropressFirebaseHostedConfig {
  const projectId = env.FIREBASE_PROJECT_ID?.trim();
  const clientEmail = env.FIREBASE_CLIENT_EMAIL?.trim();
  const privateKey = env.FIREBASE_PRIVATE_KEY?.trim();

  if (!projectId || !clientEmail || !privateKey) {
    throw new Error(
      "Firebase hosted config requires FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, and FIREBASE_PRIVATE_KEY.",
    );
  }

  return {
    projectId,
    clientEmail,
    privateKey,
    apiBaseUrl: `https://${projectId}.firebaseapp.com/astropress-api`,
    previewBaseUrl: `https://${projectId}.web.app`,
  };
}

export function createAstropressFirebaseHostedAdapter(
  options: AstropressFirebaseHostedAdapterOptions = {},
) {
  const config = options.config ?? readAstropressFirebaseHostedConfig(options.env);
  if (!options.backingAdapter && !options.content && !options.media && !options.revisions && !options.auth) {
    return createAstropressHostedApiAdapter({
      providerName: "custom",
      apiBaseUrl: config.apiBaseUrl,
      accessToken: config.privateKey,
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
