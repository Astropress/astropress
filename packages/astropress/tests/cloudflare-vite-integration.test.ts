import { describe, expect, it } from "vitest";
import { createAstropressCloudflareViteIntegration } from "../src/cloudflare-vite-integration";

describe("cloudflare vite integration helper", () => {
  it("creates stub aliases and a pre-resolution plugin", () => {
    const integration = createAstropressCloudflareViteIntegration(
      "/tmp/site/src/astropress/local-runtime-modules.ts",
    );

    expect(integration.aliases).toHaveLength(11);
    expect(integration.aliases[0]).toEqual({
      find: "astropress/local-image-storage",
      replacement: "astropress/cloudflare-local-image-storage-stub",
    });
    expect(integration.aliases[1]).toEqual({
      find: /^.*\/local-image-storage(?:\.[cm]?[jt]s)?$/,
      replacement: "astropress/cloudflare-local-image-storage-stub",
    });
    expect(integration.aliases[2]).toEqual({
      find: "astropress/local-media-storage",
      replacement: "astropress/cloudflare-local-media-storage-stub",
    });
    expect(integration.aliases[3]).toEqual({
      find: /^.*\/local-media-storage(?:\.[cm]?[jt]s)?$/,
      replacement: "astropress/cloudflare-local-media-storage-stub",
    });
    expect(integration.aliases[4]).toEqual({
      find: "astropress/sqlite-admin-runtime",
      replacement: "astropress/cloudflare-sqlite-admin-runtime-stub",
    });
    expect(integration.aliases[5]).toEqual({
      find: /^.*\/sqlite-admin-runtime(?:\.[cm]?[jt]s)?$/,
      replacement: "astropress/cloudflare-sqlite-admin-runtime-stub",
    });
    expect(integration.aliases[6]).toEqual({
      find: "astropress/sqlite-bootstrap",
      replacement: "astropress/cloudflare-sqlite-bootstrap-stub",
    });
    expect(integration.aliases[7]).toEqual({
      find: /^.*\/sqlite-bootstrap(?:\.[cm]?[jt]s)?$/,
      replacement: "astropress/cloudflare-sqlite-bootstrap-stub",
    });
    expect(integration.aliases[10]?.replacement).toBe("astropress/cloudflare-local-runtime-stubs");
    expect(integration.plugin.name).toBe("astropress-cloudflare-local-runtime-stubs");
    expect(integration.plugin.resolveId("./local-runtime-modules")).toBe(
      "astropress/cloudflare-local-runtime-stubs",
    );
    expect(integration.plugin.resolveId("astropress/local-image-storage")).toBe(
      "astropress/cloudflare-local-image-storage-stub",
    );
    expect(integration.plugin.resolveId("/workspace/packages/astropress/src/local-image-storage.ts")).toBe(
      "astropress/cloudflare-local-image-storage-stub",
    );
    expect(integration.plugin.resolveId("astropress/local-media-storage")).toBe(
      "astropress/cloudflare-local-media-storage-stub",
    );
    expect(integration.plugin.resolveId("/workspace/packages/astropress/src/local-media-storage.ts")).toBe(
      "astropress/cloudflare-local-media-storage-stub",
    );
    expect(integration.plugin.resolveId("astropress/sqlite-admin-runtime")).toBe(
      "astropress/cloudflare-sqlite-admin-runtime-stub",
    );
    expect(integration.plugin.resolveId("astropress/sqlite-bootstrap")).toBe(
      "astropress/cloudflare-sqlite-bootstrap-stub",
    );
  });
});
