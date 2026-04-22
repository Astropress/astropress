import type { DeployTarget } from "../platform-contracts";
import { prepareAstropressDeployment } from "./shared.js";

export interface AstropressNetlifyDeployTargetOptions {
	outputDir?: string;
	baseUrl?: string;
}

export function createAstropressNetlifyDeployTarget(
	options: AstropressNetlifyDeployTargetOptions = {},
): DeployTarget {
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
