export type AstropressVitestPlugin = {
  name: string;
  enforce?: "pre" | "post";
  resolveId: (id: string, importer?: string) => string | undefined;
};

export function createAstropressVitestLocalRuntimePlugins(localRuntimeModulesPath: string): AstropressVitestPlugin[] {
  return [
    {
      name: "astropress-local-runtime-modules-replacer",
      enforce: "pre",
      resolveId(id) {
        if (/local-runtime-modules(?:\.ts)?$/.test(id)) {
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
          /(?:astropress[\\/]packages[\\/]astropress|node_modules[\\/](?:\.bun[\\/].*?[\\/]node_modules[\\/])?astropress)[\\/]src/.test(
            importer,
          ) &&
          /local-runtime-modules(?:\.ts)?$/.test(id)
        ) {
          return localRuntimeModulesPath;
        }
      },
    },
  ];
}
