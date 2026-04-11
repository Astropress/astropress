import { describe, expect, it } from "vitest";
import {
  getAstropressDeploymentMatrixEntry,
  resolveAstropressDeploymentSupportLevel,
} from "../src/deployment-matrix.js";

describe("deployment matrix", () => {
  it("marks first-class pairs as supported", () => {
    expect(
      resolveAstropressDeploymentSupportLevel({
        appHost: "vercel",
        dataServices: "supabase",
      }),
    ).toBe("supported");
    expect(
      resolveAstropressDeploymentSupportLevel({
        appHost: "cloudflare-pages",
        dataServices: "cloudflare",
      }),
    ).toBe("supported");
  });

  it("marks unlisted pairs as unsupported", () => {
    expect(
      resolveAstropressDeploymentSupportLevel({
        appHost: "github-pages",
        dataServices: "appwrite",
      }),
    ).toBe("unsupported");
  });

  it("returns env requirements for listed pairs", () => {
    const entry = getAstropressDeploymentMatrixEntry({
      appHost: "render-web",
      dataServices: "appwrite",
    });
    expect(entry?.supportLevel).toBe("preview");
    expect(entry?.requiredEnvKeys).toContain("ASTROPRESS_SERVICE_ORIGIN");
    expect(entry?.requiredEnvKeys).toContain("APPWRITE_ENDPOINT");
  });
});
