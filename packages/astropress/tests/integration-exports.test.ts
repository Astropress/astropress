import { describe, expect, it } from "vitest";
import {
  createAstropressLocalRuntimeModulePlugin,
  createAstropressVitestLocalRuntimePlugins,
  defineAstropressHostRuntimeModules,
} from "../src/integration";

describe("integration exports", () => {
  it("exposes Vite, Vitest, and host runtime helpers from one entry point", () => {
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

    expect(plugin.name).toBe("astropress-local-runtime-modules");
    expect(vitestPlugins).toHaveLength(2);
    expect(hostRuntimeModules).toHaveProperty("loadLocalAdminStore");
  });
});
