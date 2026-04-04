import path from "node:path";
import { fileURLToPath } from "node:url";

export type AstropressViteRuntimeAliasOptions = {
  localRuntimeModulesPath: string;
  cloudflareWorkersStubPath?: string;
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

export function isAstropressLocalRuntimeModuleRequest(id: string, localRuntimeModulesPath: string): boolean {
  if (id === "./local-runtime-modules" || id === "./local-runtime-modules.ts") {
    return true;
  }

  const normalized = id.startsWith("file://") ? fileURLToPath(id) : path.normalize(id);
  return (
    normalized === localRuntimeModulesPath ||
    normalized.endsWith(`${path.sep}local-runtime-modules`) ||
    normalized.endsWith(`${path.sep}local-runtime-modules.ts`)
  );
}

export function createAstropressLocalRuntimeModulePlugin(
  localRuntimeModulesPath: string,
): AstropressVitePlugin {
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

  if (options.cloudflareWorkersStubPath) {
    aliases.unshift({
      find: "cloudflare:workers",
      replacement: options.cloudflareWorkersStubPath,
    });
  }

  return aliases;
}
