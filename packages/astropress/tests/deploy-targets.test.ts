import {
	existsSync,
	mkdirSync,
	mkdtempSync,
	rmSync,
	writeFileSync,
} from "node:fs";
import { readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { createAstropressCloudflarePagesDeployTarget } from "../src/deploy/cloudflare-pages";
import { createAstropressCustomDeployTarget } from "../src/deploy/custom";
import { createAstropressGitLabPagesDeployTarget } from "../src/deploy/gitlab-pages";
import { createAstropressNetlifyDeployTarget } from "../src/deploy/netlify";
import { createAstropressRenderDeployTarget } from "../src/deploy/render";
import { prepareAstropressDeployment } from "../src/deploy/shared";
import { createAstropressVercelDeployTarget } from "../src/deploy/vercel";

// ---------------------------------------------------------------------------
// Helpers — each test gets its own temp directory to avoid cleanup races
// ---------------------------------------------------------------------------

let testRoot: string;

function makeBuildDir(name: string): string {
	const dir = join(testRoot, name);
	mkdirSync(dir, { recursive: true });
	writeFileSync(join(dir, "index.html"), "<html><body>Hello</body></html>");
	writeFileSync(join(dir, "style.css"), "body{}");
	return dir;
}

beforeEach(() => {
	testRoot = mkdtempSync(join(tmpdir(), "astropress-deploy-test-"));
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

		await prepareAstropressDeployment(
			{ buildDir, projectName: "my-site" },
			{ provider: "test-provider", outputDir },
		);

		const targetDir = join(outputDir, "my-site");
		expect(existsSync(join(targetDir, "index.html"))).toBe(true);
		expect(existsSync(join(targetDir, ".astropress-deploy.json"))).toBe(true);

		const meta = JSON.parse(
			await readFile(join(targetDir, ".astropress-deploy.json"), "utf8"),
		);
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
			await readFile(
				join(outputDir, "site", ".astropress-deploy.json"),
				"utf8",
			),
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

		// Default path is `<buildDir>/../.astropress/deployments/<provider>/<projectName>`.
		const expectedTarget = join(
			buildDir,
			"..",
			".astropress",
			"deployments",
			"test-auto",
			"auto-path",
		);
		expect(existsSync(join(expectedTarget, "index.html"))).toBe(true);
		expect(existsSync(join(expectedTarget, ".astropress-deploy.json"))).toBe(
			true,
		);
	});

	it("metadata file is named exactly '.astropress-deploy.json'", async () => {
		const buildDir = makeBuildDir("build-metaname");
		const outputDir = join(testRoot, "out-metaname");
		await prepareAstropressDeployment(
			{ buildDir, projectName: "p" },
			{ provider: "x", outputDir },
		);
		// readFile of the exact filename must succeed.
		const meta = JSON.parse(
			await readFile(join(outputDir, "p", ".astropress-deploy.json"), "utf8"),
		);
		expect(meta.preparedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
	});

	it("trims trailing slashes from baseUrl before joining the project path", async () => {
		const buildDir = makeBuildDir("build-trim");
		const outputDir = join(testRoot, "out-trim");
		const result = await prepareAstropressDeployment(
			{ buildDir, projectName: "p" },
			{ provider: "x", outputDir, baseUrl: "https://h.example///" },
		);
		expect(result.url).toBe("https://h.example/p/");
	});

	it("leaves a baseUrl without trailing slashes unchanged", async () => {
		const buildDir = makeBuildDir("build-notrim");
		const outputDir = join(testRoot, "out-notrim");
		const result = await prepareAstropressDeployment(
			{ buildDir, projectName: "p" },
			{ provider: "x", outputDir, baseUrl: "https://h.example" },
		);
		expect(result.url).toBe("https://h.example/p/");
	});

	it("handles a baseUrl that is ONLY trailing slashes (full trim → empty origin)", async () => {
		const buildDir = makeBuildDir("build-allslash");
		const outputDir = join(testRoot, "out-allslash");
		const result = await prepareAstropressDeployment(
			{ buildDir, projectName: "p" },
			{ provider: "x", outputDir, baseUrl: "//" },
		);
		// All slashes trimmed -> "" prefix; project segment still appended.
		expect(result.url).toBe("/p/");
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
		const target = createAstropressNetlifyDeployTarget({
			outputDir,
			baseUrl: "https://my-app.netlify.app",
		});
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
		const target = createAstropressRenderDeployTarget({
			outputDir,
			kind: "render-static",
		});
		const result = await target.deploy({ buildDir, projectName: "rs-site" });
		expect(result.deploymentId).toContain("render-static:");
	});

	it("default baseUrl is the onrender.com host", async () => {
		const buildDir = makeBuildDir("build-render-baseurl-default");
		const outputDir = join(testRoot, "out-render-baseurl-default");
		const target = createAstropressRenderDeployTarget({ outputDir });
		const result = await target.deploy({ buildDir, projectName: "r-site" });
		expect(result.url).toBe("https://onrender.com/r-site/");
	});

	it("explicit baseUrl override is honored", async () => {
		const buildDir = makeBuildDir("build-render-baseurl-override");
		const outputDir = join(testRoot, "out-render-baseurl-override");
		const target = createAstropressRenderDeployTarget({
			outputDir,
			baseUrl: "https://custom.example",
		});
		const result = await target.deploy({ buildDir, projectName: "r-site" });
		expect(result.url).toBe("https://custom.example/r-site/");
	});

	it("works when no options are passed at all (uses render-web default)", async () => {
		const buildDir = makeBuildDir("build-render-no-opts");
		const target = createAstropressRenderDeployTarget();
		const result = await target.deploy({
			buildDir,
			projectName: "r-noopts-site",
		});
		expect(result.deploymentId).toContain("render-web:");
		expect(result.url).toBe("https://onrender.com/r-noopts-site/");
	});

	it("provider field on the target is the literal string 'custom'", () => {
		const target = createAstropressRenderDeployTarget();
		expect(target.provider).toBe("custom");
	});

	it("kind=render-static uses the static deploymentId prefix exactly", async () => {
		const buildDir = makeBuildDir("build-render-static-prefix");
		const outputDir = join(testRoot, "out-render-static-prefix");
		const target = createAstropressRenderDeployTarget({
			outputDir,
			kind: "render-static",
		});
		const result = await target.deploy({ buildDir, projectName: "p" });
		expect(result.deploymentId.startsWith("render-static:")).toBe(true);
		expect(result.deploymentId.startsWith("render-web:")).toBe(false);
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
		const target = createAstropressCustomDeployTarget({
			outputDir,
			provider: "my-host",
			baseUrl: "https://my-host.com",
		});
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
