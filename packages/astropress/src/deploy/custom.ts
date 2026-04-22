import type { DeployTarget } from "../platform-contracts";
import { prepareAstropressDeployment } from "./shared.js";

export interface AstropressCustomDeployTargetOptions {
	outputDir?: string;
	baseUrl?: string;
	provider?: string;
}

export function createAstropressCustomDeployTarget(
	options: AstropressCustomDeployTargetOptions = {},
): DeployTarget {
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
