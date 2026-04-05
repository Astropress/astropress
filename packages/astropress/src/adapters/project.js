import { resolveAstropressProjectEnvContract } from "../project-env.js";
import { createAstropressHostedAdapter } from "./hosted.js";
import { createAstropressLocalAdapter } from "./local.js";

export function resolveAstropressProjectAdapterMode(env = process.env) {
  return env.ASTROPRESS_RUNTIME_MODE?.trim() === "hosted" ? "hosted" : "local";
}

export function createAstropressProjectAdapter(options = {}) {
  const env = options.env ?? process.env;
  const mode = options.mode ?? resolveAstropressProjectAdapterMode(env);
  const projectEnv = resolveAstropressProjectEnvContract(env);
  if (mode === "hosted") {
    return createAstropressHostedAdapter({
      env,
      provider: options.hosted?.provider ?? projectEnv.hostedProvider,
      ...options.hosted
    });
  }
  return createAstropressLocalAdapter({
    env,
    provider: options.local?.provider ?? projectEnv.localProvider,
    ...options.local
  });
}
