import type { DeployTarget } from "../platform-contracts";
import { prepareAstropressDeployment } from "./shared.js";

export interface AstropressVercelDeployTargetOptions {
  outputDir?: string;
  baseUrl?: string;
}

export function createAstropressVercelDeployTarget(
  options: AstropressVercelDeployTargetOptions = {},
): DeployTarget {
  return {
    provider: "custom",
    async deploy(input) {
      return prepareAstropressDeployment(input, {
        provider: "vercel",
        outputDir: options.outputDir,
        baseUrl: options.baseUrl ?? "https://vercel.app",
      });
    },
  };
}
