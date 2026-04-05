import { assertProviderContract, normalizeProviderCapabilities } from "./platform-contracts.js";

function joinApiUrl(baseUrl, path) {
  return `${baseUrl.replace(/\/$/, "")}/${path.replace(/^\//, "")}`;
}

async function readJson(response) {
  if (!response.ok) {
    throw new Error(`Astropress hosted API request failed with ${response.status}.`);
  }
  return await response.json();
}

function createHeaders(accessToken, extra) {
  return {
    "content-type": "application/json",
    ...accessToken ? { authorization: `Bearer ${accessToken}` } : {},
    ...extra
  };
}

export function createAstropressHostedApiAdapter(options) {
  const fetchImpl = options.fetchImpl ?? fetch;
  const capabilities = normalizeProviderCapabilities({
    name: options.providerName,
    hostedAdmin: true,
    previewEnvironments: true,
    serverRuntime: true,
    database: true,
    objectStorage: true,
    gitSync: true,
    ...options.defaultCapabilities
  });
  const requestJson = async (path, init = {}) => {
    const response = await fetchImpl(joinApiUrl(options.apiBaseUrl, path), {
      ...init,
      headers: createHeaders(options.accessToken, init.headers)
    });
    return readJson(response);
  };
  return assertProviderContract({
    capabilities,
    content: {
      async list(kind) {
        const query = kind ? `?kind=${encodeURIComponent(kind)}` : "";
        return requestJson(`content${query}`);
      },
      async get(id) {
        return requestJson(`content/${encodeURIComponent(id)}`);
      },
      async save(record) {
        return requestJson("content", {
          method: "POST",
          body: JSON.stringify(record)
        });
      },
      async delete(id) {
        await requestJson(`content/${encodeURIComponent(id)}`, {
          method: "DELETE"
        });
      }
    },
    media: {
      async put(asset) {
        return requestJson("media", {
          method: "POST",
          body: JSON.stringify(asset)
        });
      },
      async get(id) {
        return requestJson(`media/${encodeURIComponent(id)}`);
      },
      async delete(id) {
        await requestJson(`media/${encodeURIComponent(id)}`, {
          method: "DELETE"
        });
      }
    },
    revisions: {
      async list(recordId) {
        return requestJson(`revisions?recordId=${encodeURIComponent(recordId)}`);
      },
      async append(revision) {
        return requestJson("revisions", {
          method: "POST",
          body: JSON.stringify(revision)
        });
      }
    },
    auth: {
      async signIn(email, password) {
        return requestJson("auth/sign-in", {
          method: "POST",
          body: JSON.stringify({ email, password })
        });
      },
      async signOut(sessionId) {
        await requestJson("auth/sign-out", {
          method: "POST",
          body: JSON.stringify({ sessionId })
        });
      },
      async getSession(sessionId) {
        return requestJson(`auth/session/${encodeURIComponent(sessionId)}`);
      }
    },
    preview: options.previewBaseUrl ? {
      async create(input) {
        return {
          url: joinApiUrl(options.previewBaseUrl, `preview/${encodeURIComponent(input.recordId)}`),
          expiresAt: input.expiresAt
        };
      }
    } : void 0
  });
}
