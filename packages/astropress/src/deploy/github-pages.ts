import type { DeployTarget } from "../platform-contracts";
import { prepareAstropressDeployment } from "./shared.js";

export interface AstropressGitHubPagesDeployTargetOptions {
	outputDir?: string;
	baseUrl?: string;
}

export function createAstropressGitHubPagesDeployTarget(
	options: AstropressGitHubPagesDeployTargetOptions = {},
): DeployTarget {
	return {
		provider: "github-pages",
		async deploy(input) {
			return prepareAstropressDeployment(input, {
				provider: "github-pages",
				outputDir: options.outputDir,
				baseUrl: options.baseUrl,
			});
		},
	};
}
