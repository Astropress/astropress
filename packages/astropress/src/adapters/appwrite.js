import { createAstropressHostedApiAdapter } from "../hosted-api-adapter.js";
import { createAstropressHostedPlatformAdapter } from "../hosted-platform-adapter.js";

export function createAstropressAppwriteAdapter(options = {}) {
  return createAstropressHostedPlatformAdapter({
    ...options,
    providerName: "appwrite",
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
        url: "https://cloud.appwrite.io",
        label: "Appwrite Console",
      },
    }
  });
}

export function readAstropressAppwriteHostedConfig(env = process.env) {
  const endpoint = env.APPWRITE_ENDPOINT?.trim();
  const projectId = env.APPWRITE_PROJECT_ID?.trim();
  const apiKey = env.APPWRITE_API_KEY?.trim();
  if (!endpoint || !projectId || !apiKey) {
    throw new Error("Appwrite hosted config requires APPWRITE_ENDPOINT, APPWRITE_PROJECT_ID, and APPWRITE_API_KEY.");
  }
  const base = endpoint.replace(/\/$/, "");
  const databaseId = env.APPWRITE_DATABASE_ID?.trim();
  const bucketId = env.APPWRITE_BUCKET_ID?.trim();
  return {
    endpoint,
    projectId,
    apiKey,
    ...(databaseId && { databaseId }),
    ...(bucketId && { bucketId }),
    apiBaseUrl: `${base}/functions/astropress`,
    previewBaseUrl: `${base}/console/project-${projectId}`
  };
}

export function createAstropressAppwriteHostedAdapter(options = {}) {
  const config = options.config ?? readAstropressAppwriteHostedConfig(options.env);
  const hostPanel = options.defaultCapabilities?.hostPanel ?? {
    mode: "link",
    url: `https://cloud.appwrite.io/console/project-${config.projectId}`,
    label: "Appwrite Console",
  };

  if (!options.backingAdapter && !options.content && !options.media && !options.revisions && !options.auth) {
    return createAstropressHostedApiAdapter({
      providerName: "appwrite",
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
        hostPanel,
      }
    });
  }
  return createAstropressHostedPlatformAdapter({
    ...options,
    providerName: "appwrite",
    defaultCapabilities: {
      ...options.defaultCapabilities,
      hostedAdmin: true,
      previewEnvironments: true,
      serverRuntime: true,
      database: true,
      objectStorage: true,
      gitSync: true,
      hostPanel,
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
