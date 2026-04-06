import { describe, expect, it } from "vitest";

import { recommendAstropressProvider } from "../src/provider-choice.js";
import { createAstropressProjectScaffold } from "../src/project-scaffold.js";

describe("provider choice", () => {
  it("recommends Cloudflare Pages plus Cloudflare data services by default", () => {
    const recommendation = recommendAstropressProvider();

    expect(recommendation.appHost).toBe("cloudflare-pages");
    expect(recommendation.dataServices).toBe("cloudflare");
    expect(recommendation.publicDeployTarget).toBe("cloudflare");
    expect(recommendation.requiredEnvKeys).toContain("CLOUDFLARE_API_TOKEN");
  });

  it("keeps GitHub Pages as a static app-host choice when the project does not want hosted services", () => {
    const recommendation = recommendAstropressProvider({
      wantsHostedAdmin: false,
      wantsStaticMirror: true,
    });

    expect(recommendation.appHost).toBe("github-pages");
    expect(recommendation.dataServices).toBe("none");
    expect(recommendation.publicDeployTarget).toBe("github-pages");
  });

  it("keeps the chosen data-services platform when Supabase or Runway is already selected", () => {
    expect(recommendAstropressProvider({ existingPlatform: "supabase" }).dataServices).toBe(
      "supabase",
    );
    expect(recommendAstropressProvider({ existingPlatform: "runway" }).dataServices).toBe(
      "runway",
    );
  });

  it("feeds the default scaffold recommendation", () => {
    const scaffold = createAstropressProjectScaffold({
      appHost: "cloudflare-pages",
      dataServices: "cloudflare",
    });

    expect(scaffold.recommendedDeployTarget).toBe("cloudflare");
    expect(scaffold.recommendationRationale).toMatch(/Cloudflare/i);
  });
});
