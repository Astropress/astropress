/**
 * Fill missing boolean flags in a partial capabilities object with `false` defaults,
 * producing a complete `ProviderCapabilities` value.
 *
 * @example
 * ```ts
 * import { normalizeProviderCapabilities } from "astropress";
 *
 * const caps = normalizeProviderCapabilities({ name: "sqlite", database: true });
 * // { name: "sqlite", database: true, staticPublishing: false, hostedAdmin: false, ... }
 * ```
 */
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
    hostPanel: partial.hostPanel,
    deployHook: partial.deployHook,
  };
}

/**
 * Validate that a provider adapter implements the required contract.
 * Throws a descriptive error if `capabilities.name` is missing or any of
 * `content`, `media`, `revisions`, `auth` stores are absent.
 *
 * @example
 * ```ts
 * import { assertProviderContract, createAstropressSqliteAdapter } from "astropress";
 *
 * const adapter = createAstropressSqliteAdapter({ db });
 * assertProviderContract(adapter); // throws if adapter is incomplete
 * ```
 */
export function assertProviderContract(adapter) {
  if (!adapter.capabilities.name) {
    throw new Error("Provider adapter must declare a name.");
  }

  if (!adapter.content || !adapter.media || !adapter.revisions || !adapter.auth) {
    throw new Error("Provider adapter is missing one or more required stores.");
  }

  return adapter;
}
