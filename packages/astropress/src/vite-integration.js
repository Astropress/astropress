import {
  createAstropressLocalRuntimeModulePlugin,
  createAstropressViteAliases,
} from "./vite-runtime-alias.js";

export function createAstropressViteIntegration(options) {
  return {
    plugins: [createAstropressLocalRuntimeModulePlugin(options.localRuntimeModulesPath)],
    aliases: createAstropressViteAliases(options),
  };
}
