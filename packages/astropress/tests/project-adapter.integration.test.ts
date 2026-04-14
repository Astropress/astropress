import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { describe, expect, it } from "vitest";
import { createAstropressProjectAdapter, resolveAstropressProjectAdapterMode } from "../src/adapters/project.js";

describe("project adapter integration", () => {
  it("selects project adapters from runtime mode and project env", async () => {
    expect(resolveAstropressProjectAdapterMode({})).toBe("local");
    expect(resolveAstropressProjectAdapterMode({ ASTROPRESS_RUNTIME_MODE: "hosted" })).toBe("hosted");

    const workspace = await mkdtemp(join(tmpdir(), "astropress-project-adapter-"));
    const localAdapter = createAstropressProjectAdapter({
      env: {
        ASTROPRESS_RUNTIME_MODE: "local",
        ASTROPRESS_LOCAL_PROVIDER: "supabase",
      },
      local: {
        workspaceRoot: workspace,
        dbPath: join(workspace, "project-adapter.sqlite"),
      },
    });

    expect(localAdapter.capabilities.name).toBe("supabase");

    await rm(workspace, { recursive: true, force: true });
  });
});
