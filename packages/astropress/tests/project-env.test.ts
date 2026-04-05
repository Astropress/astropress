import { describe, expect, it } from "vitest";
import {
  resolveAstropressDeployTarget,
  resolveAstropressHostedProviderFromEnv,
  resolveAstropressLocalProviderFromEnv,
} from "../src/project-env.js";

describe("project env", () => {
  it("resolves local provider defaults", () => {
    expect(resolveAstropressLocalProviderFromEnv({})).toBe("sqlite");
    expect(resolveAstropressLocalProviderFromEnv({ ASTROPRESS_LOCAL_PROVIDER: "supabase" })).toBe(
      "supabase",
    );
    expect(resolveAstropressLocalProviderFromEnv({ ASTROPRESS_LOCAL_PROVIDER: "runway" })).toBe(
      "runway",
    );
    expect(resolveAstropressLocalProviderFromEnv({ ASTROPRESS_LOCAL_PROVIDER: "unexpected" })).toBe(
      "sqlite",
    );
  });

  it("resolves hosted provider defaults", () => {
    expect(resolveAstropressHostedProviderFromEnv({})).toBe("supabase");
    expect(resolveAstropressHostedProviderFromEnv({ ASTROPRESS_HOSTED_PROVIDER: "runway" })).toBe(
      "runway",
    );
  });

  it("resolves deploy targets from explicit values or provider defaults", () => {
    expect(resolveAstropressDeployTarget({})).toBe("github-pages");
    expect(resolveAstropressDeployTarget({ ASTROPRESS_DEPLOY_TARGET: "cloudflare" })).toBe(
      "cloudflare",
    );
    expect(resolveAstropressDeployTarget({ ASTROPRESS_LOCAL_PROVIDER: "supabase" })).toBe(
      "supabase",
    );
    expect(resolveAstropressDeployTarget({ ASTROPRESS_LOCAL_PROVIDER: "runway" })).toBe("runway");
  });
});
