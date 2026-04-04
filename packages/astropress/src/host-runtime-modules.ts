import type {
  LocalAdminAuthModule,
  LocalAdminStoreModule,
  LocalCmsRegistryModule,
  LocalImageStorageModule,
  LocalMediaStorageModule,
} from "./local-runtime-modules";

export interface AstropressHostRuntimeModules {
  loadLocalAdminStore(): Promise<LocalAdminStoreModule>;
  loadLocalAdminAuth(): Promise<LocalAdminAuthModule>;
  loadLocalCmsRegistry(): Promise<LocalCmsRegistryModule>;
  loadLocalMediaStorage(): Promise<LocalMediaStorageModule>;
  loadLocalImageStorage(): Promise<LocalImageStorageModule>;
}

export function defineAstropressHostRuntimeModules(
  modules: AstropressHostRuntimeModules,
): AstropressHostRuntimeModules {
  return modules;
}
