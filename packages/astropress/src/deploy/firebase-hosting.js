import { prepareAstropressDeployment } from "./shared.js";

export function createAstropressFirebaseHostingDeployTarget(options = {}) {
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
