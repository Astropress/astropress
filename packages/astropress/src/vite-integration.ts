import {
  createAstropressLocalRuntimeModulePlugin,
  createAstropressViteAliases,
  type AstropressViteAlias,
  type AstropressVitePlugin,
  type AstropressViteRuntimeAliasOptions,
} from "./vite-runtime-alias";

export type AstropressViteIntegration = {
  plugins: AstropressVitePlugin[];
  aliases: AstropressViteAlias[];
};

export function createAstropressViteIntegration(
  options: AstropressViteRuntimeAliasOptions,
): AstropressViteIntegration {
  return {
    plugins: [createAstropressLocalRuntimeModulePlugin(options.localRuntimeModulesPath)],
    aliases: createAstropressViteAliases(options),
  };
}
