import { describe, expect, it } from "vitest";
import {
  createAstropressLocalRuntimeModulePlugin,
  createAstropressViteAliases,
  isAstropressLocalRuntimeModuleRequest,
} from "@astropress-diy/astropress";

describe("vite runtime alias helpers", () => {
  const localRuntimeModulesPath = "/tmp/site/src/astropress/local-runtime-modules.ts";

  it("matches relative and resolved local runtime module requests", () => {
    expect(isAstropressLocalRuntimeModuleRequest("./local-runtime-modules", localRuntimeModulesPath)).toBe(true);
    expect(isAstropressLocalRuntimeModuleRequest("/tmp/site/src/astropress/local-runtime-modules.ts", localRuntimeModulesPath)).toBe(true);
    expect(
      isAstropressLocalRuntimeModuleRequest(
        "file:///tmp/site/src/astropress/local-runtime-modules.ts",
        localRuntimeModulesPath,
      ),
    ).toBe(true);
    expect(isAstropressLocalRuntimeModuleRequest("./something-else", localRuntimeModulesPath)).toBe(false);
  });

  it("creates a pre-resolution plugin that rewrites runtime module imports", () => {
    const plugin = createAstropressLocalRuntimeModulePlugin(localRuntimeModulesPath);

    expect(plugin.name).toBe("astropress-local-runtime-modules");
    expect(plugin.enforce).toBe("pre");
    expect(plugin.resolveId("./local-runtime-modules")).toBe(localRuntimeModulesPath);
    expect(plugin.resolveId("./not-it")).toBeNull();
  });

  it("normalizes Windows-style file:// URLs to a drive-letter path", () => {
    // After file:// stripping, /C:/path matches ^/[a-zA-Z]:/ → slice(1) → C:/path
    const winPath = "C:/site/src/astropress/local-runtime-modules.ts";
    expect(isAstropressLocalRuntimeModuleRequest(`file:///C:/site/src/astropress/local-runtime-modules.ts`, winPath)).toBe(true);
  });

  it("intercepts the scoped package import path used by Vite when noExternal is active", () => {
    // When ssr.noExternal includes '@astropress-diy/astropress', Vite processes
    // the package through its plugin pipeline. Imports inside the dist files
    // (e.g. admin-store-dispatch.js → "./local-runtime-modules") still arrive
    // as the raw "./local-runtime-modules" string and are handled by the first
    // check. The scoped-package form is used when a consumer imports directly:
    //   import ... from "@astropress-diy/astropress/local-runtime-modules"
    // Both must be caught so the host's SQLite implementation is used, not the
    // dist stub that throws `unavailable()`.
    expect(isAstropressLocalRuntimeModuleRequest("@astropress-diy/astropress/local-runtime-modules", localRuntimeModulesPath)).toBe(true);
    expect(isAstropressLocalRuntimeModuleRequest("@astropress-diy/astropress/local-runtime-modules.ts", localRuntimeModulesPath)).toBe(true);
  });

  it("intercepts absolute dist-stub paths that Vite may resolve before calling resolveId", () => {
    // With noExternal active, Vite can resolve the relative import to an
    // absolute path (pointing into the package dist) before the plugin's
    // resolveId runs. Both Unix and Windows forms must be handled.
    expect(
      isAstropressLocalRuntimeModuleRequest(
        "/home/runner/work/astropress/packages/astropress/dist/src/local-runtime-modules.js",
        localRuntimeModulesPath,
      ),
    ).toBe(true);
    expect(
      isAstropressLocalRuntimeModuleRequest(
        "C:/work/astropress/packages/astropress/dist/src/local-runtime-modules.js",
        localRuntimeModulesPath,
      ),
    ).toBe(true);
    // Unrelated absolute paths must not match.
    expect(
      isAstropressLocalRuntimeModuleRequest(
        "/home/runner/work/astropress/packages/astropress/dist/src/admin-store-dispatch.js",
        localRuntimeModulesPath,
      ),
    ).toBe(false);
  });

  it("builds alias rules for local runtime modules and cloudflare workers stubs", () => {
    const aliases = createAstropressViteAliases({
      localRuntimeModulesPath,
      cloudflareWorkersStubPath: "/tmp/site/src/cloudflare-workers-stub.ts",
    });

    expect(aliases).toHaveLength(3);
    expect(aliases[0]).toEqual({
      find: "cloudflare:workers",
      replacement: "/tmp/site/src/cloudflare-workers-stub.ts",
    });
    expect(aliases[1].replacement).toBe(localRuntimeModulesPath);
    expect(aliases[2].replacement).toBe(localRuntimeModulesPath);
  });
});
