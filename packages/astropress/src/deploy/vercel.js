import { prepareAstropressDeployment } from "./shared.js";

export function createAstropressVercelDeployTarget(options = {}) {
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
