import { createAstropressProjectAdapter, resolveAstropressProjectAdapterMode } from "./adapters/project.js";
import { resolveAstropressProjectEnvContract } from "./project-env.js";

export function createAstropressProjectRuntimePlan(options = {}) {
  const env = options.env ?? process.env;
  return {
    mode: options.mode ?? resolveAstropressProjectAdapterMode(env),
    env: resolveAstropressProjectEnvContract(env),
    adapter: createAstropressProjectAdapter(options)
  };
}
