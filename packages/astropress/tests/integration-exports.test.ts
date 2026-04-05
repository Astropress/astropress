import { describe, expect, it } from "vitest";
import {
  ASTROPRESS_ADMIN_BASE_PATH,
  createAstropressAdminRouteInjectionPlan,
  createAstropressLocalRuntimeModulePlugin,
  createAstropressVitestLocalRuntimePlugins,
  defineAstropressHostRuntimeModules,
  listAstropressAdminRoutes,
} from "../src/integration";

describe("integration exports", () => {
  it("exposes Vite, Vitest, host runtime, and admin route helpers from one entry point", () => {
    const plugin = createAstropressLocalRuntimeModulePlugin("/tmp/site/local-runtime-modules.ts");
    const vitestPlugins = createAstropressVitestLocalRuntimePlugins("/tmp/site/local-runtime-modules.ts");
    const hostRuntimeModules = defineAstropressHostRuntimeModules({
      async loadLocalAdminStore() {
        return {} as never;
      },
      async loadLocalAdminAuth() {
        return {} as never;
      },
      async loadLocalCmsRegistry() {
        return {} as never;
      },
      async loadLocalMediaStorage() {
        return {} as never;
      },
      async loadLocalImageStorage() {
        return {} as never;
      },
    });
    const adminRoutes = listAstropressAdminRoutes();
    const injectionPlan = createAstropressAdminRouteInjectionPlan("/tmp/site/pages/wp-admin");

    expect(plugin.name).toBe("astropress-local-runtime-modules");
    expect(vitestPlugins).toHaveLength(2);
    expect(hostRuntimeModules).toHaveProperty("loadLocalAdminStore");
    expect(ASTROPRESS_ADMIN_BASE_PATH).toBe("/wp-admin");
    expect(adminRoutes).not.toHaveLength(0);
    expect(injectionPlan[0]?.entrypoint).toBe("/tmp/site/pages/wp-admin/index.astro");
  });
});
