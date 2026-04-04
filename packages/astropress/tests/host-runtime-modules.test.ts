import { describe, expect, it } from "vitest";
import { defineAstropressHostRuntimeModules, type AstropressHostRuntimeModules } from "astropress";

describe("host runtime modules", () => {
  it("preserves the host-provided runtime loader contract", async () => {
    const modules = defineAstropressHostRuntimeModules({
      async loadLocalAdminStore() {
        return {} as Awaited<ReturnType<AstropressHostRuntimeModules["loadLocalAdminStore"]>>;
      },
      async loadLocalAdminAuth() {
        return {} as Awaited<ReturnType<AstropressHostRuntimeModules["loadLocalAdminAuth"]>>;
      },
      async loadLocalCmsRegistry() {
        return {} as Awaited<ReturnType<AstropressHostRuntimeModules["loadLocalCmsRegistry"]>>;
      },
      async loadLocalMediaStorage() {
        return {} as Awaited<ReturnType<AstropressHostRuntimeModules["loadLocalMediaStorage"]>>;
      },
      async loadLocalImageStorage() {
        return {} as Awaited<ReturnType<AstropressHostRuntimeModules["loadLocalImageStorage"]>>;
      },
    });

    expect(modules).toHaveProperty("loadLocalAdminStore");
    await expect(modules.loadLocalAdminAuth()).resolves.toEqual({});
  });
});
