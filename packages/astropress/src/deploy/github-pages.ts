import { cp, mkdir, rm } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import type { DeployTarget } from "../platform-contracts";

export interface AstropressGitHubPagesDeployTargetOptions {
  outputDir?: string;
  baseUrl?: string;
}

export function createAstropressGitHubPagesDeployTarget(
  options: AstropressGitHubPagesDeployTargetOptions = {},
): DeployTarget {
  return {
    provider: "github-pages",
    async deploy(input) {
      const baseOutputDir = resolve(
        options.outputDir ?? join(input.buildDir, "..", ".astropress", "deployments"),
      );
      const targetDir = join(baseOutputDir, input.projectName);
      await rm(targetDir, { recursive: true, force: true });
      await mkdir(dirname(targetDir), { recursive: true });
      await cp(input.buildDir, targetDir, { recursive: true });

      return {
        deploymentId: `${input.projectName}-${Date.now()}`,
        url: options.baseUrl ? `${options.baseUrl.replace(/\/+$/, "")}/${input.projectName}/` : undefined,
      };
    },
  };
}
