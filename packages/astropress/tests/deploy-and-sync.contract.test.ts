import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { describe, expect, it } from "vitest";
import { createAstropressCloudflarePagesDeployTarget } from "../src/deploy/cloudflare-pages.js";
import { createAstropressGitHubPagesDeployTarget } from "../src/deploy/github-pages.js";
import { createAstropressGitLabPagesDeployTarget } from "../src/deploy/gitlab-pages.js";
import { createAstropressNetlifyDeployTarget } from "../src/deploy/netlify.js";
import { createAstropressRenderDeployTarget } from "../src/deploy/render.js";
import { createAstropressVercelDeployTarget } from "../src/deploy/vercel.js";
import { createAstropressGitSyncAdapter } from "../src/sync/git.js";

describe("deploy and sync contracts", () => {
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
    expect(await readFile(join(outputDir, "demo-site", ".astropress-deploy.json"), "utf8")).toContain(
      "\"provider\": \"github-pages\"",
    );

    await rm(workspace, { recursive: true, force: true });
  });

  it("prepares build directories for the other app-host deploy targets", async () => {
    const workspace = await mkdtemp(join(tmpdir(), "astropress-host-deploys-"));
    const buildDir = join(workspace, "dist");
    await mkdir(buildDir, { recursive: true });
    await writeFile(join(buildDir, "index.html"), "<h1>Astropress</h1>");

    for (const [factory, provider] of [
      [createAstropressCloudflarePagesDeployTarget, "cloudflare-pages"],
      [createAstropressVercelDeployTarget, "vercel"],
      [createAstropressNetlifyDeployTarget, "netlify"],
      [createAstropressRenderDeployTarget, "render-web"],
      [createAstropressGitLabPagesDeployTarget, "gitlab-pages"],
    ] as const) {
      const outputDir = join(workspace, provider);
      const target = factory({ outputDir } as never);
      const result = await target.deploy({
        buildDir,
        projectName: "demo-site",
      });

      expect(result.deploymentId).toContain("demo-site");
      expect(await readFile(join(outputDir, "demo-site", ".astropress-deploy.json"), "utf8")).toContain(
        provider,
      );
    }

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
});
