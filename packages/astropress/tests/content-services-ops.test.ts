import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import {
  bootstrapAstropressContentServices,
  verifyAstropressContentServices,
} from "../src/content-services-ops.js";

describe("content services operations", () => {
  it("bootstraps a manifest for configured hosted content services", async () => {
    const workspace = await mkdtemp(join(tmpdir(), "astropress-services-"));
    const report = await bootstrapAstropressContentServices({
      workspaceRoot: workspace,
      env: {
        ASTROPRESS_CONTENT_SERVICES: "supabase",
        SUPABASE_URL: "https://demo.supabase.co",
        SUPABASE_ANON_KEY: "anon",
        SUPABASE_SERVICE_ROLE_KEY: "service",
        ASTROPRESS_SERVICE_ORIGIN: "https://demo.supabase.co/functions/v1/astropress",
      },
    });

    expect(report.supportLevel).toBe("configured");
    expect(report.manifestFile).toBeTruthy();
    expect(await readFile(join(workspace, ".astropress/services/supabase.json"), "utf8")).toContain(
      "\"status\": \"configured\"",
    );

    await rm(workspace, { recursive: true, force: true });
  });

  it("reports missing config when verify runs without required keys", async () => {
    const workspace = await mkdtemp(join(tmpdir(), "astropress-services-missing-"));
    await writeFile(join(workspace, ".env"), "ASTROPRESS_CONTENT_SERVICES=appwrite\n");

    const report = await verifyAstropressContentServices({
      workspaceRoot: workspace,
      env: {
        ASTROPRESS_CONTENT_SERVICES: "appwrite",
      },
    });

    expect(report.supportLevel).toBe("missing-config");
    expect(report.missingEnvKeys).toContain("APPWRITE_ENDPOINT");

    await rm(workspace, { recursive: true, force: true });
  });
});
