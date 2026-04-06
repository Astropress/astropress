import { prepareAstropressDeployment } from "./shared.js";

export function createAstropressCustomDeployTarget(options = {}) {
  const provider = options.provider ?? "custom";
  return {
    provider: "custom",
    async deploy(input) {
      return prepareAstropressDeployment(input, {
        provider,
        outputDir: options.outputDir,
        baseUrl: options.baseUrl,
      });
    },
  };
}
