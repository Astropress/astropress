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
