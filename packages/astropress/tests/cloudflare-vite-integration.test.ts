import { describe, expect, it } from "vitest";
import { createAstropressCloudflareViteIntegration } from "../src/cloudflare-vite-integration";

describe("cloudflare vite integration helper", () => {
  it("creates stub aliases and a pre-resolution plugin", () => {
    const integration = createAstropressCloudflareViteIntegration(
      "/tmp/site/src/astropress/local-runtime-modules.ts",
    );

    expect(integration.aliases).toHaveLength(3);
    expect(integration.aliases[0]?.replacement).toBe("astropress/cloudflare-local-runtime-stubs");
    expect(integration.plugin.name).toBe("astropress-cloudflare-local-runtime-stubs");
    expect(integration.plugin.resolveId("./local-runtime-modules")).toBe(
      "astropress/cloudflare-local-runtime-stubs",
    );
  });
});
