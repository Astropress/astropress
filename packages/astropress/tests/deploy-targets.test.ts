import { existsSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { createAstropressCloudflarePagesDeployTarget } from "../src/deploy/cloudflare-pages";
import { createAstropressCustomDeployTarget } from "../src/deploy/custom";
import { createAstropressFirebaseHostingDeployTarget } from "../src/deploy/firebase-hosting";
import { createAstropressGitLabPagesDeployTarget } from "../src/deploy/gitlab-pages";
import { createAstropressNetlifyDeployTarget } from "../src/deploy/netlify";
import { createAstropressRenderDeployTarget } from "../src/deploy/render";
import { prepareAstropressDeployment } from "../src/deploy/shared";
import { createAstropressVercelDeployTarget } from "../src/deploy/vercel";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const testRoot = join(tmpdir(), "astropress-deploy-test");

function makeBuildDir(name: string): string {
  const dir = join(testRoot, name);
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, "index.html"), "<html><body>Hello</body></html>");
  writeFileSync(join(dir, "style.css"), "body{}");
  return dir;
}

beforeEach(() => {
  mkdirSync(testRoot, { recursive: true });
});

afterEach(() => {
  rmSync(testRoot, { recursive: true, force: true });
});

// ---------------------------------------------------------------------------
// prepareAstropressDeployment (shared)
// ---------------------------------------------------------------------------

describe("prepareAstropressDeployment", () => {
  it("copies build dir to output location and writes metadata file", async () => {
    const buildDir = makeBuildDir("build-shared");
    const outputDir = join(testRoot, "output-shared");

    const result = await prepareAstropressDeployment(
      { buildDir, projectName: "my-site" },
      { provider: "test-provider", outputDir },
    );

    const targetDir = join(outputDir, "my-site");
    expect(existsSync(join(targetDir, "index.html"))).toBe(true);
    expect(existsSync(join(targetDir, ".astropress-deploy.json"))).toBe(true);

    const meta = JSON.parse(await readFile(join(targetDir, ".astropress-deploy.json"), "utf8"));
    expect(meta.provider).toBe("test-provider");
    expect(meta.projectName).toBe("my-site");
    expect(meta.environment).toBe("production");
  });

  it("uses custom environment when provided", async () => {
    const buildDir = makeBuildDir("build-env");
    const outputDir = join(testRoot, "output-env");

    await prepareAstropressDeployment(
      { buildDir, projectName: "site", environment: "staging" },
      { provider: "x", outputDir },
    );

    const meta = JSON.parse(
      await readFile(join(outputDir, "site", ".astropress-deploy.json"), "utf8"),
    );
    expect(meta.environment).toBe("staging");
  });

  it("returns deploymentId and url when baseUrl provided", async () => {
    const buildDir = makeBuildDir("build-url");
    const outputDir = join(testRoot, "output-url");

    const result = await prepareAstropressDeployment(
      { buildDir, projectName: "my-proj" },
      { provider: "netlify", outputDir, baseUrl: "https://netlify.app" },
    );

    expect(result.deploymentId).toContain("netlify:my-proj:");
    expect(result.url).toBe("https://netlify.app/my-proj/");
  });

  it("returns undefined url when no baseUrl", async () => {
    const buildDir = makeBuildDir("build-nourl");
    const outputDir = join(testRoot, "output-nourl");

    const result = await prepareAstropressDeployment(
      { buildDir, projectName: "p" },
      { provider: "custom", outputDir },
    );

    expect(result.url).toBeUndefined();
  });

  it("uses default output dir path when no outputDir provided", async () => {
    const buildDir = makeBuildDir("build-default-dir");

    // Don't pass outputDir — triggers the ?? right-hand side (default deployment path)
    const result = await prepareAstropressDeployment(
      { buildDir, projectName: "auto-path" },
      { provider: "test-auto" },
    );

    // Should still produce a valid deploymentId
    expect(result.deploymentId).toContain("test-auto:auto-path:");
  });

  it("overwrites an existing deployment (idempotent)", async () => {
    const buildDir = makeBuildDir("build-idempotent");
    const outputDir = join(testRoot, "output-idempotent");

    await prepareAstropressDeployment(
      { buildDir, projectName: "site" },
      { provider: "x", outputDir },
    );

    // Run a second time — should not throw
    await expect(
      prepareAstropressDeployment(
        { buildDir, projectName: "site" },
        { provider: "x", outputDir },
      ),
    ).resolves.toBeDefined();
  });
});

// ---------------------------------------------------------------------------
// Provider deploy targets
// ---------------------------------------------------------------------------

describe("createAstropressNetlifyDeployTarget", () => {
  it("deploys with netlify provider and default baseUrl", async () => {
    const buildDir = makeBuildDir("build-netlify");
    const outputDir = join(testRoot, "out-netlify");
    const target = createAstropressNetlifyDeployTarget({ outputDir });
    expect(target.provider).toBe("custom");
    const result = await target.deploy({ buildDir, projectName: "my-site" });
    expect(result.deploymentId).toContain("netlify:");
    expect(result.url).toContain("netlify.app");
  });

  it("accepts custom baseUrl", async () => {
    const buildDir = makeBuildDir("build-netlify-custom");
    const outputDir = join(testRoot, "out-netlify-custom");
    const target = createAstropressNetlifyDeployTarget({ outputDir, baseUrl: "https://my-app.netlify.app" });
    const result = await target.deploy({ buildDir, projectName: "site" });
    expect(result.url).toContain("my-app.netlify.app");
  });
});

describe("createAstropressCloudflarePagesDeployTarget", () => {
  it("deploys with cloudflare provider", async () => {
    const buildDir = makeBuildDir("build-cf");
    const outputDir = join(testRoot, "out-cf");
    const target = createAstropressCloudflarePagesDeployTarget({ outputDir });
    expect(target.provider).toBe("cloudflare");
    const result = await target.deploy({ buildDir, projectName: "cf-site" });
    expect(result.deploymentId).toContain("cloudflare-pages:");
    expect(result.url).toContain("pages.dev");
  });
});

describe("createAstropressVercelDeployTarget", () => {
  it("deploys with vercel provider", async () => {
    const buildDir = makeBuildDir("build-vercel");
    const outputDir = join(testRoot, "out-vercel");
    const target = createAstropressVercelDeployTarget({ outputDir });
    const result = await target.deploy({ buildDir, projectName: "v-site" });
    expect(result.deploymentId).toContain("vercel:");
    expect(result.url).toContain("vercel.app");
  });
});

describe("createAstropressRenderDeployTarget", () => {
  it("uses render-web provider by default", async () => {
    const buildDir = makeBuildDir("build-render");
    const outputDir = join(testRoot, "out-render");
    const target = createAstropressRenderDeployTarget({ outputDir });
    const result = await target.deploy({ buildDir, projectName: "r-site" });
    expect(result.deploymentId).toContain("render-web:");
  });

  it("uses render-static provider when specified", async () => {
    const buildDir = makeBuildDir("build-render-static");
    const outputDir = join(testRoot, "out-render-static");
    const target = createAstropressRenderDeployTarget({ outputDir, kind: "render-static" });
    const result = await target.deploy({ buildDir, projectName: "rs-site" });
    expect(result.deploymentId).toContain("render-static:");
  });
});

describe("createAstropressFirebaseHostingDeployTarget", () => {
  it("deploys with firebase-hosting provider", async () => {
    const buildDir = makeBuildDir("build-firebase");
    const outputDir = join(testRoot, "out-firebase");
    const target = createAstropressFirebaseHostingDeployTarget({ outputDir });
    const result = await target.deploy({ buildDir, projectName: "fb-site" });
    expect(result.deploymentId).toContain("firebase-hosting:");
    expect(result.url).toContain("web.app");
  });
});

describe("createAstropressGitLabPagesDeployTarget", () => {
  it("deploys with gitlab-pages provider", async () => {
    const buildDir = makeBuildDir("build-gitlab");
    const outputDir = join(testRoot, "out-gitlab");
    const target = createAstropressGitLabPagesDeployTarget({ outputDir });
    const result = await target.deploy({ buildDir, projectName: "gl-site" });
    expect(result.deploymentId).toContain("gitlab-pages:");
    expect(result.url).toContain("gitlab.io");
  });
});

describe("createAstropressCustomDeployTarget", () => {
  it("uses custom provider name", async () => {
    const buildDir = makeBuildDir("build-custom");
    const outputDir = join(testRoot, "out-custom");
    const target = createAstropressCustomDeployTarget({ outputDir, provider: "my-host", baseUrl: "https://my-host.com" });
    const result = await target.deploy({ buildDir, projectName: "c-site" });
    expect(result.deploymentId).toContain("my-host:");
    expect(result.url).toContain("my-host.com");
  });

  it("defaults to custom provider when no provider specified", async () => {
    const buildDir = makeBuildDir("build-custom-default");
    const outputDir = join(testRoot, "out-custom-default");
    const target = createAstropressCustomDeployTarget({ outputDir });
    const result = await target.deploy({ buildDir, projectName: "d-site" });
    expect(result.deploymentId).toContain("custom:");
  });
});
