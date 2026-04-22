import {
	type AstropressProjectAdapterMode,
	type AstropressProjectAdapterOptions,
	createAstropressProjectAdapter,
	resolveAstropressProjectAdapterMode,
} from "./adapters/project";
import type { AstropressPlatformAdapter } from "./platform-contracts";
import {
	type AstropressProjectEnvContract,
	resolveAstropressProjectEnvContract,
} from "./project-env";

export interface AstropressProjectRuntimePlan {
	mode: AstropressProjectAdapterMode;
	env: AstropressProjectEnvContract;
	adapter: AstropressPlatformAdapter;
}

export interface AstropressProjectRuntimeOptions
	extends AstropressProjectAdapterOptions {}

export function createAstropressProjectRuntimePlan(
	options: AstropressProjectRuntimeOptions = {},
): AstropressProjectRuntimePlan {
	const env = options.env ?? process.env;
	return {
		mode: options.mode ?? resolveAstropressProjectAdapterMode(env),
		env: resolveAstropressProjectEnvContract(env),
		adapter: createAstropressProjectAdapter(options),
	};
}
