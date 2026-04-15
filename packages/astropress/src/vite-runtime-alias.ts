export type AstropressViteRuntimeAliasOptions = {
  localRuntimeModulesPath: string;
  cloudflareWorkersStubPath?: string;
  /**
   * Absolute path to the @astropress-diy/astropress package root.
   * Required when using the npm package outside the monorepo so that bare
   * `astropress/components/...` imports inside published .astro pages resolve
   * to the installed package files. Omit in the monorepo — workspace aliases
   * pointing to TypeScript source take precedence.
   */
  astropressPackageRoot?: string;
};

export type AstropressVitePlugin = {
  name: string;
  enforce?: "pre" | "post";
  resolveId: (id: string) => string | null;
};

export type AstropressViteAlias = {
  find: string | RegExp;
  replacement: string;
};

function normalizeRuntimeRequest(id: string): string {
  let normalized = id.replaceAll("\\", "/");
  if (normalized.startsWith("file://")) {
    normalized = decodeURIComponent(normalized.replace(/^file:\/\/\/?/, "/"));
  }

  if (/^\/[a-zA-Z]:\//.test(normalized)) {
    return normalized.slice(1);
  }

  return normalized;
}

export function isAstropressLocalRuntimeModuleRequest(id: string, localRuntimeModulesPath: string): boolean {
  if (id === "./local-runtime-modules" || id === "./local-runtime-modules.ts") {
    return true;
  }

  const normalized = normalizeRuntimeRequest(id);
  const normalizedLocalRuntimeModulesPath = normalizeRuntimeRequest(localRuntimeModulesPath);
  return (
    normalized === normalizedLocalRuntimeModulesPath ||
    normalized.endsWith("/local-runtime-modules") ||
    normalized.endsWith("/local-runtime-modules.ts")
  );
}

export function createAstropressLocalRuntimeModulePlugin(
  localRuntimeModulesPath: string,
): AstropressVitePlugin {
  if (!localRuntimeModulesPath) {
    throw new Error(
      "[astropress] Missing Vite alias: 'local-runtime-modules'. " +
        "Add astropressIntegration() to your astro.config.mjs — " +
        "see https://astropress.diy/docs/quick-start#step-2-add-the-integration",
    );
  }
  return {
    name: "astropress-local-runtime-modules",
    enforce: "pre",
    resolveId(id) {
      if (isAstropressLocalRuntimeModuleRequest(id, localRuntimeModulesPath)) {
        return localRuntimeModulesPath;
      }

      return null;
    },
  };
}

/**
 * Vite plugin that resolves bare `astropress/X` imports to the installed npm
 * package root. Required outside the monorepo: published .astro pages contain
 * bare `astropress/components/...` specifiers that don't resolve without this.
 * `resolve.alias` regex replacements don't apply to imports inside node_modules
 * in Vite's SSR pipeline, so a `resolveId` plugin is needed instead.
 */
export function createAstropressPackageResolverPlugin(
  astropressPackageRoot: string,
): AstropressVitePlugin {
  return {
    name: "astropress-package-resolver",
    enforce: "pre",
    resolveId(id) {
      if (id === "astropress") {
        return astropressPackageRoot + "/dist/index.js";
      }
      if (id.startsWith("astropress/")) {
        const subpath = id.slice("astropress/".length);
        // Components are .astro files shipped directly; JS subpaths go through dist.
        if (subpath.startsWith("components/")) {
          return astropressPackageRoot + "/" + subpath;
        }
        return astropressPackageRoot + "/dist/src/" + subpath + ".js";
      }
      return null;
    },
  };
}

export function createAstropressViteAliases(
  options: AstropressViteRuntimeAliasOptions,
): AstropressViteAlias[] {
  const aliases: AstropressViteAlias[] = [
    {
      find: /\/local-runtime-modules(?:\.ts)?$/,
      replacement: options.localRuntimeModulesPath,
    },
    {
      find: /^\.\/local-runtime-modules(?:\.ts)?$/,
      replacement: options.localRuntimeModulesPath,
    },
  ];

  if (options.astropressPackageRoot) {
    // Map bare `astropress/X` imports (used inside published .astro pages) to
    // absolute paths inside the installed package. Vite needs a file system
    // path here — a package name string doesn't resolve correctly for aliases.
    const root = options.astropressPackageRoot;
    aliases.push(
      { find: /^astropress\/(.+)$/, replacement: `${root}/$1` },
      { find: /^astropress$/, replacement: root },
    );
  }

  if (options.cloudflareWorkersStubPath) {
    aliases.unshift({
      find: "cloudflare:workers",
      replacement: options.cloudflareWorkersStubPath,
    });
  }

  return aliases;
}
