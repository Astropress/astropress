import { prepareAstropressDeployment } from "./shared.js";

export function createAstropressGitLabPagesDeployTarget(options = {}) {
  return {
    provider: "github-pages",
    async deploy(input) {
      return prepareAstropressDeployment(input, {
        provider: "gitlab-pages",
        outputDir: options.outputDir,
        baseUrl: options.baseUrl ?? "https://gitlab.io",
      });
    },
  };
}
