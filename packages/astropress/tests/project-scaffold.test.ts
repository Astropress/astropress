import { describe, expect, it } from "vitest";
import { createAstropressProjectScaffold } from "../src/project-scaffold.js";

describe("project scaffold", () => {
  it("returns sqlite defaults by default", () => {
    const scaffold = createAstropressProjectScaffold();
    expect(scaffold.provider).toBe("sqlite");
    expect(scaffold.recommendedDeployTarget).toBe("github-pages");
    expect(scaffold.localEnv.ADMIN_DB_PATH).toBe(".data/admin.sqlite");
    expect(scaffold.localEnv.ASTROPRESS_DEPLOY_TARGET).toBe("github-pages");
  });

  it("returns provider-specific remote examples", () => {
    const supabase = createAstropressProjectScaffold("supabase");
    const runway = createAstropressProjectScaffold("runway");

    expect(supabase.envExample.SUPABASE_URL).toBe("https://your-project.supabase.co");
    expect(supabase.envExample.ASTROPRESS_HOSTED_PROVIDER).toBe("supabase");
    expect(supabase.localEnv.ASTROPRESS_DEPLOY_TARGET).toBe("supabase");
    expect(supabase.recommendedDeployTarget).toBe("supabase");
    expect(runway.envExample.RUNWAY_API_TOKEN).toBe("replace-me");
    expect(runway.envExample.ASTROPRESS_HOSTED_PROVIDER).toBe("runway");
    expect(runway.localEnv.ASTROPRESS_DEPLOY_TARGET).toBe("runway");
    expect(runway.recommendedDeployTarget).toBe("runway");
  });
});
