import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  createAstropressCloudflareAdapter,
  createAstropressRunwayAdapter,
  createAstropressSqliteAdapter,
  createAstropressSupabaseAdapter,
} from "astropress";
import { createAstropressGitHubPagesDeployTarget } from "../src/deploy/github-pages.js";
import { createAstropressWordPressImportSource } from "../src/import/wordpress.js";
import { createAstropressGitSyncAdapter } from "../src/sync/git.js";

describe("provider adapters", () => {
  it("creates first-party adapters with provider-specific capability defaults", async () => {
    const sqlite = createAstropressSqliteAdapter();
    const cloudflare = createAstropressCloudflareAdapter();
    const supabase = createAstropressSupabaseAdapter();
    const runway = createAstropressRunwayAdapter();

    expect(sqlite.capabilities.name).toBe("sqlite");
    expect(sqlite.capabilities.database).toBe(true);
    expect(cloudflare.capabilities.objectStorage).toBe(true);
    expect(supabase.capabilities.name).toBe("supabase");
    expect(runway.capabilities.serverRuntime).toBe(true);

    const user = await sqlite.auth.signIn("admin@example.com", "password");
    expect(user?.role).toBe("admin");
  });

  it("deploys a build directory to the github pages target", async () => {
    const workspace = await mkdtemp(join(tmpdir(), "astropress-gh-pages-"));
    const buildDir = join(workspace, "dist");
    const outputDir = join(workspace, "deployments");
    await mkdir(buildDir, { recursive: true });
    await writeFile(join(buildDir, "index.html"), "<h1>Astropress</h1>");

    const target = createAstropressGitHubPagesDeployTarget({
      outputDir,
      baseUrl: "https://example.com/docs",
    });

    const result = await target.deploy({
      buildDir,
      projectName: "demo-site",
    });

    expect(result.url).toBe("https://example.com/docs/demo-site/");
    expect(await readFile(join(outputDir, "demo-site", "index.html"), "utf8")).toContain("Astropress");

    await rm(workspace, { recursive: true, force: true });
  });

  it("round-trips a project snapshot through git sync", async () => {
    const workspace = await mkdtemp(join(tmpdir(), "astropress-sync-"));
    const projectDir = join(workspace, "project");
    const snapshotDir = join(workspace, "snapshot");
    await mkdir(join(projectDir, "src"), { recursive: true });
    await writeFile(join(projectDir, "package.json"), '{"name":"demo"}');
    await writeFile(join(projectDir, "src", "index.ts"), "export const demo = true;");

    const sync = createAstropressGitSyncAdapter({ projectDir });
    const exported = await sync.exportSnapshot(snapshotDir);
    await writeFile(join(projectDir, "src", "index.ts"), "export const demo = false;");
    const imported = await sync.importSnapshot(snapshotDir);

    expect(exported.fileCount).toBeGreaterThan(0);
    expect(imported.fileCount).toBe(exported.fileCount);
    expect(await readFile(join(projectDir, "src", "index.ts"), "utf8")).toContain("demo = true");

    await rm(workspace, { recursive: true, force: true });
  });

  it("counts wordpress records from an export file", async () => {
    const workspace = await mkdtemp(join(tmpdir(), "astropress-wordpress-"));
    const exportFile = join(workspace, "export.xml");
    await writeFile(
      exportFile,
      `
        <rss>
          <channel>
            <item><title>One</title><wp:attachment_url>https://cdn.example.com/a.jpg</wp:attachment_url></item>
            <item><title>Two</title></item>
          </channel>
        </rss>
      `,
    );

    const importer = createAstropressWordPressImportSource();
    const result = await importer.importWordPress({ exportFile });

    expect(result.importedRecords).toBe(2);
    expect(result.importedMedia).toBe(1);

    await rm(workspace, { recursive: true, force: true });
  });
});
