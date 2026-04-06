import { prepareAstropressDeployment } from "./shared.js";

export function createAstropressRenderDeployTarget(options = {}) {
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
