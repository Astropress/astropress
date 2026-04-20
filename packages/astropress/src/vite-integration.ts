import {
	type AstropressViteAlias,
	type AstropressVitePlugin,
	type AstropressViteRuntimeAliasOptions,
	createAstropressLocalRuntimeModulePlugin,
	createAstropressPackageResolverPlugin,
	createAstropressViteAliases,
} from "./vite-runtime-alias";

export type AstropressViteIntegration = {
	plugins: AstropressVitePlugin[];
	aliases: AstropressViteAlias[];
};

export function createAstropressViteIntegration(
	options: AstropressViteRuntimeAliasOptions,
): AstropressViteIntegration {
	const plugins: AstropressVitePlugin[] = [
		createAstropressLocalRuntimeModulePlugin(options.localRuntimeModulesPath),
	];
	if (options.astropressPackageRoot) {
		plugins.push(
			createAstropressPackageResolverPlugin(options.astropressPackageRoot),
		);
	}
	return {
		plugins,
		aliases: createAstropressViteAliases(options),
	};
}
