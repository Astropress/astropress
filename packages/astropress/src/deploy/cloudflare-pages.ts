import type { DeployTarget } from "../platform-contracts";
import { prepareAstropressDeployment } from "./shared.js";

export interface AstropressCloudflarePagesDeployTargetOptions {
	outputDir?: string;
	baseUrl?: string;
}

export function createAstropressCloudflarePagesDeployTarget(
	options: AstropressCloudflarePagesDeployTargetOptions = {},
): DeployTarget {
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
