export type AstropressVitestPlugin = {
	name: string;
	enforce?: "pre" | "post";
	resolveId: (id: string, importer?: string) => string | undefined;
};

export function isLocalRuntimeModuleId(id: string): boolean {
	return /local-runtime-modules(?:\.[jt]s)?$/.test(id);
}

export function isAstropressSrcImporter(importer: string): boolean {
	const norm = importer.replace(/\\/g, "/");
	if (norm.includes("/astropress/packages/astropress/src/")) return true;
	if (norm.includes("/node_modules/astropress/src/")) return true;
	if (norm.includes("/node_modules/.bun/")) {
		return norm.includes("/astropress/src/");
	}
	return false;
}

export function createAstropressVitestLocalRuntimePlugins(
	localRuntimeModulesPath: string,
): AstropressVitestPlugin[] {
	return [
		{
			name: "astropress-local-runtime-modules-replacer",
			enforce: "pre",
			resolveId(id) {
				if (isLocalRuntimeModuleId(id)) {
					return localRuntimeModulesPath;
				}
			},
		},
		{
			name: "astropress-external-source-rewriter",
			enforce: "pre",
			resolveId(id, importer) {
				if (
					importer &&
					isAstropressSrcImporter(importer) &&
					isLocalRuntimeModuleId(id)
				) {
					return localRuntimeModulesPath;
				}
			},
		},
	];
}
