import { describe, expect, it } from "vitest";

import { recommendAstropressProvider } from "../src/provider-choice.js";
import { createAstropressProjectScaffold } from "../src/project-scaffold.js";

describe("provider choice", () => {
  it("recommends Cloudflare by default", () => {
    const recommendation = recommendAstropressProvider();

    expect(recommendation.canonicalProvider).toBe("cloudflare");
    expect(recommendation.publicDeployTarget).toBe("cloudflare");
    expect(recommendation.requiredEnvKeys).toContain("CLOUDFLARE_API_TOKEN");
  });

  it("keeps GitHub Pages as a static mirror target rather than the canonical runtime", () => {
    const recommendation = recommendAstropressProvider({
      wantsHostedAdmin: false,
      wantsStaticMirror: true,
    });

    expect(recommendation.canonicalProvider).toBe("cloudflare");
    expect(recommendation.publicDeployTarget).toBe("github-pages");
  });

  it("recommends the existing hosted platform when Supabase or Runway is already chosen", () => {
    expect(
      recommendAstropressProvider({ existingPlatform: "supabase" }).canonicalProvider,
    ).toBe("supabase");
    expect(
      recommendAstropressProvider({ existingPlatform: "runway" }).canonicalProvider,
    ).toBe("runway");
  });

  it("feeds the default scaffold recommendation", () => {
    const scaffold = createAstropressProjectScaffold();

    expect(scaffold.recommendedDeployTarget).toBe("cloudflare");
    expect(scaffold.recommendationRationale).toMatch(/Cloudflare/i);
  });
});
