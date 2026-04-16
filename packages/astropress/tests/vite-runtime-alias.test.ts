import { describe, expect, it } from "vitest";
import {
  createAstropressLocalRuntimeModulePlugin,
  createAstropressPackageResolverPlugin,
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

describe("createAstropressPackageResolverPlugin — npm consumer bare-import redirect", () => {
  // Regression guard: Vite 7's module runner does not invoke resolveId plugins for
  // bare specifiers imported from within node_modules files when the package is
  // listed under noExternal. The correct fix is that published .astro pages must use
  // the scoped package name (@astropress-diy/astropress/…) directly. This plugin
  // remains as belt-and-suspenders for user-land imports only. Tests here verify the
  // plugin's resolution logic is correct for the cases it does handle.
  const packageRoot = "/home/site/node_modules/@astropress-diy/astropress";

  it("has the expected plugin metadata", () => {
    const plugin = createAstropressPackageResolverPlugin(packageRoot);
    expect(plugin.name).toBe("astropress-package-resolver");
    expect(plugin.enforce).toBe("pre");
  });

  it("resolves bare astropress to dist/index.js", () => {
    const plugin = createAstropressPackageResolverPlugin(packageRoot);
    expect(plugin.resolveId("astropress")).toBe(`${packageRoot}/dist/index.js`);
  });

  it("resolves astropress/components/X to the package components directory", () => {
    const plugin = createAstropressPackageResolverPlugin(packageRoot);
    expect(plugin.resolveId("astropress/components/AdminLayout.astro")).toBe(
      `${packageRoot}/components/AdminLayout.astro`,
    );
    expect(plugin.resolveId("astropress/components/CsrfInput.astro")).toBe(
      `${packageRoot}/components/CsrfInput.astro`,
    );
  });

  it("resolves astropress/X subpaths to dist/src/X.js", () => {
    const plugin = createAstropressPackageResolverPlugin(packageRoot);
    expect(plugin.resolveId("astropress/services-config")).toBe(
      `${packageRoot}/dist/src/services-config.js`,
    );
    expect(plugin.resolveId("astropress/newsletter-adapter")).toBe(
      `${packageRoot}/dist/src/newsletter-adapter.js`,
    );
    expect(plugin.resolveId("astropress/runtime-env")).toBe(
      `${packageRoot}/dist/src/runtime-env.js`,
    );
  });

  it("returns null for unrelated imports", () => {
    const plugin = createAstropressPackageResolverPlugin(packageRoot);
    expect(plugin.resolveId("./local-runtime-modules")).toBeNull();
    expect(plugin.resolveId("@astropress-diy/astropress")).toBeNull();
    expect(plugin.resolveId("astro")).toBeNull();
  });
});
