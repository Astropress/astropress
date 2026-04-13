import {
  type AstropressPlatformAdapter,
} from "../platform-contracts";
import { type AstropressInMemoryPlatformAdapterOptions } from "../in-memory-platform-adapter";
import { createAstropressHostedApiAdapter, type AstropressHostedApiAdapterOptions } from "../hosted-api-adapter";
import { createAstropressHostedPlatformAdapter } from "../hosted-platform-adapter";
import { FULL_STACK_CAPABILITIES } from "./adapter-record-helpers";

export interface AstropressPocketbaseHostedConfig {
  url: string;
  email: string;
  password: string;
  apiBaseUrl: string;
  previewBaseUrl: string;
}

export type AstropressPocketbaseAdapterOptions = Omit<AstropressInMemoryPlatformAdapterOptions, "capabilities"> & {
  backingAdapter?: AstropressPlatformAdapter;
};

export function createAstropressPocketbaseAdapter(options: AstropressPocketbaseAdapterOptions = {}) {
  return createAstropressHostedPlatformAdapter({
    ...options,
    providerName: "pocketbase",
    defaultCapabilities: {
      ...options.defaultCapabilities,
      ...FULL_STACK_CAPABILITIES,
    },
  });
}

export interface AstropressPocketbaseHostedAdapterOptions extends AstropressPocketbaseAdapterOptions {
  config?: AstropressPocketbaseHostedConfig;
  env?: Record<string, string | undefined>;
  fetchImpl?: AstropressHostedApiAdapterOptions["fetchImpl"];
}

export function readAstropressPocketbaseHostedConfig(
  env: Record<string, string | undefined> = process.env,
): AstropressPocketbaseHostedConfig {
  const url = env.POCKETBASE_URL?.trim();
  const email = env.POCKETBASE_EMAIL?.trim();
  const password = env.POCKETBASE_PASSWORD?.trim();

  if (!url || !email || !password) {
    throw new Error(
      "PocketBase hosted config requires POCKETBASE_URL, POCKETBASE_EMAIL, and POCKETBASE_PASSWORD.",
    );
  }

  return {
    url,
    email,
    password,
    apiBaseUrl: `${url.replace(/\/$/, "")}/api/astropress`,
    previewBaseUrl: url.replace(/\/$/, ""),
  };
}

export function createAstropressPocketbaseHostedAdapter(
  options: AstropressPocketbaseHostedAdapterOptions = {},
) {
  const config = options.config ?? readAstropressPocketbaseHostedConfig(options.env);
  if (!options.backingAdapter && !options.content && !options.media && !options.revisions && !options.auth) {
    return createAstropressHostedApiAdapter({
      providerName: "pocketbase",
      apiBaseUrl: config.apiBaseUrl,
      accessToken: `${config.email}:${config.password}`,
      previewBaseUrl: `${config.previewBaseUrl}/preview`,
      fetchImpl: options.fetchImpl,
      defaultCapabilities: {
        ...options.defaultCapabilities,
        ...FULL_STACK_CAPABILITIES,
      },
    });
  }

  return createAstropressHostedPlatformAdapter({
    ...options,
    providerName: "pocketbase",
    defaultCapabilities: {
      ...options.defaultCapabilities,
      ...FULL_STACK_CAPABILITIES,
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
