import type { DeployTarget } from "../platform-contracts";
import { prepareAstropressDeployment } from "./shared.js";

export interface AstropressRenderDeployTargetOptions {
  outputDir?: string;
  baseUrl?: string;
  kind?: "render-static" | "render-web";
}

export function createAstropressRenderDeployTarget(
  options: AstropressRenderDeployTargetOptions = {},
): DeployTarget {
  const provider = options.kind ?? "render-web";
  return {
    provider: "custom",
    async deploy(input) {
      return prepareAstropressDeployment(input, {
        provider,
        outputDir: options.outputDir,
        baseUrl: options.baseUrl ?? "https://onrender.com",
      });
    },
  };
}
