import { createAstropressHostedApiAdapter } from "../hosted-api-adapter.js";
import { createAstropressHostedPlatformAdapter } from "../hosted-platform-adapter.js";

export function createAstropressPocketbaseAdapter(options = {}) {
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

export function readAstropressPocketbaseHostedConfig(env = process.env) {
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

export function createAstropressPocketbaseHostedAdapter(options = {}) {
  const config = options.config ?? readAstropressPocketbaseHostedConfig(options.env);
  if (!options.backingAdapter && !options.content && !options.media && !options.revisions && !options.auth) {
    return createAstropressHostedApiAdapter({
      providerName: "custom",
      apiBaseUrl: config.apiBaseUrl,
      accessToken: `${config.email}:${config.password}`,
      previewBaseUrl: `${config.previewBaseUrl}/preview`,
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
    preview: options.preview ?? {
      async create() {
        return {
          url: `${config.previewBaseUrl}/preview`,
        };
      },
    },
  });
}
