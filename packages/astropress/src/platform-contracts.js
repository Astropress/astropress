export function normalizeProviderCapabilities(partial) {
  return {
    name: partial.name,
    staticPublishing: partial.staticPublishing ?? false,
    hostedAdmin: partial.hostedAdmin ?? false,
    previewEnvironments: partial.previewEnvironments ?? false,
    serverRuntime: partial.serverRuntime ?? false,
    database: partial.database ?? false,
    objectStorage: partial.objectStorage ?? false,
    gitSync: partial.gitSync ?? false,
  };
}

export function assertProviderContract(adapter) {
  if (!adapter.capabilities.name) {
    throw new Error("Provider adapter must declare a name.");
  }

  if (!adapter.content || !adapter.media || !adapter.revisions || !adapter.auth) {
    throw new Error("Provider adapter is missing one or more required stores.");
  }

  return adapter;
}
