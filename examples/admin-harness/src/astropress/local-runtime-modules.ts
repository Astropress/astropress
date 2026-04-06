import type { LocalAdminAuthModule, LocalAdminStoreModule, LocalCmsRegistryModule } from "astropress";
import { defineAstropressHostRuntimeModules } from "astropress/integration";

export const hostRuntimeModules = defineAstropressHostRuntimeModules({
  async loadLocalAdminStore() {
    return (await import("./admin-store.ts")).hostRuntimeAdminStore as LocalAdminStoreModule;
  },
  async loadLocalAdminAuth() {
    return (await import("./admin-auth.ts")).hostRuntimeAdminAuth as LocalAdminAuthModule;
  },
  async loadLocalCmsRegistry() {
    return (await import("./admin-persistence.ts")).hostRuntimeCmsRegistry as LocalCmsRegistryModule;
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
