import { createAstropressHostedApiAdapter } from "../hosted-api-adapter.js";
import { createAstropressHostedPlatformAdapter } from "../hosted-platform-adapter.js";

export function createAstropressRunwayAdapter(options = {}) {
  return createAstropressHostedPlatformAdapter({
    ...options,
    providerName: "runway"
  });
}

export function readAstropressRunwayHostedConfig(env = process.env) {
  const apiToken = env.RUNWAY_API_TOKEN?.trim();
  const projectId = env.RUNWAY_PROJECT_ID?.trim();
  if (!apiToken || !projectId) {
    throw new Error("Runway hosted config requires RUNWAY_API_TOKEN and RUNWAY_PROJECT_ID.");
  }
  return {
    apiToken,
    projectId,
    apiBaseUrl: `https://runway.example/${projectId}/astropress-api`,
    previewBaseUrl: `https://runway.example/${projectId}`
  };
}

export function createAstropressRunwayHostedAdapter(options = {}) {
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
        hostedAdmin: true,
        previewEnvironments: true,
        serverRuntime: true,
        database: true,
        objectStorage: true,
        gitSync: true
      }
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
      gitSync: true
    },
    preview: options.preview ?? {
      async create() {
        return {
          url: `${config.previewBaseUrl.replace(/\/$/, "")}/preview`
        };
      }
    }
  });
}
