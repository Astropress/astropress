import { prepareAstropressDeployment } from "./shared.js";

export function createAstropressNetlifyDeployTarget(options = {}) {
  return {
    provider: "custom",
    async deploy(input) {
      return prepareAstropressDeployment(input, {
        provider: "netlify",
        outputDir: options.outputDir,
        baseUrl: options.baseUrl ?? "https://netlify.app",
      });
    },
  };
}
