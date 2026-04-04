import { describe, expect, it } from "vitest";
import { createAstropressViteIntegration } from "../src/vite-integration";

describe("vite integration helper", () => {
  it("composes the runtime-module plugin and alias rules into one object", () => {
    const integration = createAstropressViteIntegration({
      localRuntimeModulesPath: "/tmp/site/src/astropress/local-runtime-modules.ts",
      cloudflareWorkersStubPath: "/tmp/site/src/astropress/cloudflare-workers-stub.ts",
    });

    expect(integration.plugins).toHaveLength(1);
    expect(integration.plugins[0]?.name).toBe("astropress-local-runtime-modules");
    expect(integration.aliases).toHaveLength(3);
    expect(integration.aliases[0]?.replacement).toBe(
      "/tmp/site/src/astropress/cloudflare-workers-stub.ts",
    );
  });
});
