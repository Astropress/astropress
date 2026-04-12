import {
  type AstropressPlatformAdapter,
} from "../platform-contracts";
import { type AstropressInMemoryPlatformAdapterOptions } from "../in-memory-platform-adapter";
import { createAstropressHostedApiAdapter, type AstropressHostedApiAdapterOptions } from "../hosted-api-adapter";
import { createAstropressHostedPlatformAdapter } from "../hosted-platform-adapter";

export interface AstropressNhostHostedConfig {
  subdomain: string;
  region: string;
  adminSecret: string;
  apiBaseUrl: string;
  previewBaseUrl: string;
}

export type AstropressNhostAdapterOptions = Omit<AstropressInMemoryPlatformAdapterOptions, "capabilities"> & {
  backingAdapter?: AstropressPlatformAdapter;
};

/**
 * Creates an Nhost adapter with full-stack capabilities.
 *
 * Nhost provides Postgres, Auth, Storage, and serverless Functions — a complete
 * backend for Astropress. The hosted adapter connects to Astropress functions
 * deployed on Nhost Functions.
 */
export function createAstropressNhostAdapter(options: AstropressNhostAdapterOptions = {}) {
  return createAstropressHostedPlatformAdapter({
    ...options,
    providerName: "nhost",
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

export interface AstropressNhostHostedAdapterOptions extends AstropressNhostAdapterOptions {
  config?: AstropressNhostHostedConfig;
  env?: Record<string, string | undefined>;
  fetchImpl?: AstropressHostedApiAdapterOptions["fetchImpl"];
}

export function readAstropressNhostHostedConfig(
  env: Record<string, string | undefined> = process.env,
): AstropressNhostHostedConfig {
  const subdomain = env.NHOST_SUBDOMAIN?.trim();
  const region = env.NHOST_REGION?.trim();
  const adminSecret = env.NHOST_ADMIN_SECRET?.trim();

  if (!subdomain || !region || !adminSecret) {
    throw new Error(
      "Nhost hosted config requires NHOST_SUBDOMAIN, NHOST_REGION, and NHOST_ADMIN_SECRET.",
    );
  }

  const base = `https://${subdomain}.${region}.nhost.run`;
  return {
    subdomain,
    region,
    adminSecret,
    apiBaseUrl: `${base}/v1/functions/astropress`,
    previewBaseUrl: `${base}/console`,
  };
}

export function createAstropressNhostHostedAdapter(
  options: AstropressNhostHostedAdapterOptions = {},
) {
  const config = options.config ?? readAstropressNhostHostedConfig(options.env);

  if (!options.backingAdapter && !options.content && !options.media && !options.revisions && !options.auth) {
    return createAstropressHostedApiAdapter({
      providerName: "nhost",
      apiBaseUrl: config.apiBaseUrl,
      accessToken: config.adminSecret,
      previewBaseUrl: config.previewBaseUrl,
      fetchImpl: options.fetchImpl,
      defaultCapabilities: {
        ...options.defaultCapabilities,
        hostedAdmin: true,
        previewEnvironments: true,
        serverRuntime: true,
        database: true,
        objectStorage: true,
        gitSync: true,
        hostPanel: options.defaultCapabilities?.hostPanel ?? {
          mode: "link",
          url: config.previewBaseUrl,
          label: "Nhost Console",
        },
      },
    });
  }

  return createAstropressHostedPlatformAdapter({
    ...options,
    providerName: "nhost",
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
            url: `${config.previewBaseUrl}/preview`,
          };
        },
      },
  });
}
