import { existsSync } from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { describe, expect, it } from "vitest";
import {
  ASTROPRESS_ADMIN_BASE_PATH,
  createAstropressAdminRouteInjectionPlan,
  injectAstropressAdminRoutes,
  listAstropressAdminRoutes,
} from "../src/admin-routes";
import { createAstropressAdminAppIntegration } from "../src/admin-app-integration";
import { defineAstropressHostRuntimeModules } from "../src/host-runtime-modules";
import { createAstropressViteIntegration } from "../src/vite-integration";
import { createAstropressVitestLocalRuntimePlugins } from "../src/vitest-runtime-alias";
import { createAstropressLocalRuntimeModulePlugin } from "../src/vite-runtime-alias";

const pagesDirectory = path.resolve(import.meta.dirname, "../pages/wp-admin");

describe("tooling integration", () => {
  it("ships page files for the canonical admin route inventory and injects them through the Astro integration", () => {
    const routeEntrypoints = createAstropressAdminRouteInjectionPlan(pagesDirectory);
    const injectedRoutes: Array<{ pattern: string; entrypoint: string }> = [];
    const integration = createAstropressAdminAppIntegration();

    for (const route of routeEntrypoints) {
      expect(existsSync(route.entrypoint), `missing file for ${route.pattern}: ${route.entrypoint}`).toBe(true);
    }

    integration.hooks["astro:config:setup"]({
      injectRoute(route) {
        injectedRoutes.push(route);
      },
    } as never);
    const callbackInjectedRoutes: Array<{ pattern: string; entrypoint: string }> = [];

    expect(ASTROPRESS_ADMIN_BASE_PATH).toBe("/wp-admin");
    expect(listAstropressAdminRoutes()).toHaveLength(routeEntrypoints.length);
    expect(injectedRoutes).toEqual(routeEntrypoints);
    expect(injectAstropressAdminRoutes(pagesDirectory, (route) => callbackInjectedRoutes.push(route))).toEqual(routeEntrypoints);
    expect(callbackInjectedRoutes).toEqual(routeEntrypoints);
  });

  it("exposes Vite, Vitest, and host runtime helpers from one coherent boundary", async () => {
    const localRuntimeModulesPath = "/tmp/site/src/astropress/local-runtime-modules.ts";
    const vite = createAstropressViteIntegration({
      localRuntimeModulesPath,
      cloudflareWorkersStubPath: "/tmp/site/src/astropress/cloudflare-workers-stub.ts",
    });
    const [replacePlugin, rewritePlugin] = createAstropressVitestLocalRuntimePlugins(localRuntimeModulesPath);
    const runtimePlugin = createAstropressLocalRuntimeModulePlugin(localRuntimeModulesPath);
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

    expect(vite.plugins[0]?.name).toBe("astropress-local-runtime-modules");
    expect(vite.aliases).toHaveLength(3);
    expect(replacePlugin.name).toBe("astropress-local-runtime-modules-replacer");
    expect(rewritePlugin.name).toBe("astropress-external-source-rewriter");
    expect(runtimePlugin.resolveId("./local-runtime-modules")).toBe(localRuntimeModulesPath);
    await expect(hostRuntimeModules.loadLocalAdminAuth()).resolves.toEqual({});
  });

  it("loads the emitted runtime js entrypoints cleanly", async () => {
    const runtimeEntryPoints = [
      "../src/platform-contracts.js",
      "../src/project-env.js",
      "../src/project-runtime.js",
      "../src/project-launch.js",
      "../src/provider-choice.js",
      "../src/admin-routes.js",
      "../src/admin-ui.js",
      "../src/config.js",
      "../src/hosted-api-adapter.js",
      "../src/d1-admin-store.js",
      "../src/hosted-platform-adapter.js",
      "../src/sqlite-bootstrap.js",
      "../src/sqlite-admin-runtime.js",
      "../src/adapters/sqlite.js",
      "../src/adapters/hosted.js",
      "../src/adapters/cloudflare.js",
      "../src/adapters/supabase.js",
      "../src/adapters/runway.js",
      "../src/adapters/supabase-sqlite.js",
      "../src/adapters/runway-sqlite.js",
      "../src/adapters/local.js",
      "../src/adapters/project.js",
      "../src/admin-app-integration.js",
      "../src/integration.js",
      "../src/cloudflare-vite-integration.js",
      "../src/deploy/github-pages.js",
      "../src/deploy/cloudflare-pages.js",
      "../src/deploy/vercel.js",
      "../src/deploy/netlify.js",
      "../src/deploy/render.js",
      "../src/deploy/gitlab-pages.js",
      "../src/deploy/firebase-hosting.js",
      "../src/deploy/custom.js",
      "../src/content-services-ops.js",
      "../src/import/wordpress.js",
      "../src/sync/git.js",
    ] as const;

    for (const entryPoint of runtimeEntryPoints) {
      const module = await import(pathToFileURL(new URL(entryPoint, import.meta.url).pathname).href);
      expect(module).toBeTruthy();
    }
  });
});
