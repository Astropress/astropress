import {
  defineAstropressHostRuntimeModules,
  type LocalAdminAuthModule,
  type LocalAdminStoreModule,
  type LocalCmsRegistryModule,
} from "@astropress-diy/astropress";

export const hostRuntimeModules = defineAstropressHostRuntimeModules({
  async loadLocalAdminStore() {
    return (await import("./admin-store")) as unknown as LocalAdminStoreModule;
  },
  async loadLocalAdminAuth() {
    return (await import("./admin-auth")) as unknown as LocalAdminAuthModule;
  },
  async loadLocalCmsRegistry() {
    return (await import("./admin-persistence")) as unknown as LocalCmsRegistryModule;
  },
  async loadLocalMediaStorage() {
    return import("astropress/local-media-storage");
  },
  async loadLocalImageStorage() {
    return import("astropress/local-image-storage");
  },
});

export const {
  loadLocalAdminStore,
  loadLocalAdminAuth,
  loadLocalCmsRegistry,
  loadLocalMediaStorage,
  loadLocalImageStorage,
} = hostRuntimeModules;
