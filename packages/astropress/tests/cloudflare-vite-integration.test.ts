import { describe, expect, it } from "vitest";
import { createAstropressCloudflareViteIntegration } from "../src/cloudflare-vite-integration";

describe("cloudflare vite integration helper", () => {
  it("creates stub aliases and a pre-resolution plugin", () => {
    const integration = createAstropressCloudflareViteIntegration(
      "/tmp/site/src/astropress/local-runtime-modules.ts",
    );

    expect(integration.aliases).toHaveLength(5);
    expect(integration.aliases[0]).toEqual({
      find: "astropress/local-image-storage",
      replacement: "astropress/cloudflare-local-image-storage-stub",
    });
    expect(integration.aliases[1]).toEqual({
      find: "astropress/local-media-storage",
      replacement: "astropress/cloudflare-local-media-storage-stub",
    });
    expect(integration.aliases[2]?.replacement).toBe("astropress/cloudflare-local-runtime-stubs");
    expect(integration.plugin.name).toBe("astropress-cloudflare-local-runtime-stubs");
    expect(integration.plugin.resolveId("./local-runtime-modules")).toBe(
      "astropress/cloudflare-local-runtime-stubs",
    );
    expect(integration.plugin.resolveId("astropress/local-image-storage")).toBe(
      "astropress/cloudflare-local-image-storage-stub",
    );
    expect(integration.plugin.resolveId("astropress/local-media-storage")).toBe(
      "astropress/cloudflare-local-media-storage-stub",
    );
  });
});
