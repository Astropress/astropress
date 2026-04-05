import { describe, expect, it } from "vitest";
import {
  resolveAstropressDeployTarget,
  resolveAstropressHostedProviderFromEnv,
  resolveAstropressLocalProviderFromEnv,
  resolveAstropressProjectEnvContract,
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

  it("returns a single resolved project env contract", () => {
    expect(
      resolveAstropressProjectEnvContract({
        ASTROPRESS_LOCAL_PROVIDER: "supabase",
        ASTROPRESS_HOSTED_PROVIDER: "runway",
        ASTROPRESS_DEPLOY_TARGET: "cloudflare",
        ADMIN_DB_PATH: ".data/custom-admin.sqlite",
      }),
    ).toEqual({
      localProvider: "supabase",
      hostedProvider: "runway",
      deployTarget: "cloudflare",
      adminDbPath: ".data/custom-admin.sqlite",
    });
  });

  it("derives the default admin db path from the local provider", () => {
    expect(resolveAstropressProjectEnvContract({}).adminDbPath).toBe(".data/admin.sqlite");
    expect(
      resolveAstropressProjectEnvContract({
        ASTROPRESS_LOCAL_PROVIDER: "supabase",
      }).adminDbPath,
    ).toBe(".data/supabase-admin.sqlite");
    expect(
      resolveAstropressProjectEnvContract({
        ASTROPRESS_LOCAL_PROVIDER: "runway",
      }).adminDbPath,
    ).toBe(".data/runway-admin.sqlite");
  });
});
