import type { DeployTarget } from "../platform-contracts";
import { prepareAstropressDeployment } from "./shared.js";

export interface AstropressGitLabPagesDeployTargetOptions {
	outputDir?: string;
	baseUrl?: string;
}

export function createAstropressGitLabPagesDeployTarget(
	options: AstropressGitLabPagesDeployTargetOptions = {},
): DeployTarget {
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
