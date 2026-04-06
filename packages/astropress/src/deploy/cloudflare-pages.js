import { prepareAstropressDeployment } from "./shared.js";

export function createAstropressCloudflarePagesDeployTarget(options = {}) {
  return {
    provider: "cloudflare",
    async deploy(input) {
      return prepareAstropressDeployment(input, {
        provider: "cloudflare-pages",
        outputDir: options.outputDir,
        baseUrl: options.baseUrl ?? "https://pages.dev",
      });
    },
  };
}
