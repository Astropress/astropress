import type { DeployTarget } from "../platform-contracts";
import { prepareAstropressDeployment } from "./shared.js";

export interface AstropressFirebaseHostingDeployTargetOptions {
  outputDir?: string;
  baseUrl?: string;
}

export function createAstropressFirebaseHostingDeployTarget(
  options: AstropressFirebaseHostingDeployTargetOptions = {},
): DeployTarget {
  return {
    provider: "custom",
    async deploy(input) {
      return prepareAstropressDeployment(input, {
        provider: "firebase-hosting",
        outputDir: options.outputDir,
        baseUrl: options.baseUrl ?? "https://web.app",
      });
    },
  };
}
