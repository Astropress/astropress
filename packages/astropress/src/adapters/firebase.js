import { createAstropressHostedApiAdapter } from "../hosted-api-adapter.js";
import { createAstropressHostedPlatformAdapter } from "../hosted-platform-adapter.js";

export function createAstropressFirebaseAdapter(options = {}) {
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
      gitSync: true
    }
  });
}

export function readAstropressFirebaseHostedConfig(env = process.env) {
  const projectId = env.FIREBASE_PROJECT_ID?.trim();
  const clientEmail = env.FIREBASE_CLIENT_EMAIL?.trim();
  const privateKey = env.FIREBASE_PRIVATE_KEY?.trim();
  if (!projectId || !clientEmail || !privateKey) {
    throw new Error("Firebase hosted config requires FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, and FIREBASE_PRIVATE_KEY.");
  }
  return {
    projectId,
    clientEmail,
    privateKey,
    apiBaseUrl: `https://${projectId}.firebaseapp.com/astropress-api`,
    previewBaseUrl: `https://${projectId}.web.app`
  };
}

export function createAstropressFirebaseHostedAdapter(options = {}) {
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
        gitSync: true
      }
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
