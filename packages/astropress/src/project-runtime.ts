import type { AstropressPlatformAdapter } from "./platform-contracts";
import {
  createAstropressProjectAdapter,
  resolveAstropressProjectAdapterMode,
  type AstropressProjectAdapterMode,
  type AstropressProjectAdapterOptions,
} from "./adapters/project";
import {
  resolveAstropressProjectEnvContract,
  type AstropressProjectEnvContract,
} from "./project-env";

export interface AstropressProjectRuntimePlan {
  mode: AstropressProjectAdapterMode;
  env: AstropressProjectEnvContract;
  adapter: AstropressPlatformAdapter;
}

export interface AstropressProjectRuntimeOptions extends AstropressProjectAdapterOptions {}

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
