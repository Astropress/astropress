import path from "node:path";
import { fileURLToPath } from "node:url";

export type AstropressCloudflareViteIntegration = {
  aliases: Array<{ find: string | RegExp; replacement: string }>;
  plugin: {
    name: string;
    enforce: "pre";
    resolveId: (id: string) => string | null;
  };
};

function isLocalRuntimeModuleRequest(id: string, localRuntimeModulesPath: string): boolean {
  if (
    id === "./local-runtime-modules" ||
    id === "./local-runtime-modules.ts" ||
    id === "local-runtime-modules" ||
    id === "local-runtime-modules.ts"
  ) {
    return true;
  }

  return (
    id === localRuntimeModulesPath ||
    id.endsWith("/local-runtime-modules") ||
    id.endsWith("/local-runtime-modules.ts")
  );
}

export function createAstropressCloudflareViteIntegration(
  localRuntimeModulesPath: string,
  cloudflareLocalRuntimeStubsPath = "astropress/cloudflare-local-runtime-stubs",
): AstropressCloudflareViteIntegration {
  return {
    aliases: [
      {
        find: /^\.\/local-runtime-modules(?:\.ts)?$/,
        replacement: cloudflareLocalRuntimeStubsPath,
      },
      {
        find: /^.*\/local-runtime-modules(?:\.ts)?$/,
        replacement: cloudflareLocalRuntimeStubsPath,
      },
      {
        find: localRuntimeModulesPath,
        replacement: cloudflareLocalRuntimeStubsPath,
      },
    ],
    plugin: {
      name: "astropress-cloudflare-local-runtime-stubs",
      enforce: "pre",
      resolveId(id) {
        const normalizedId = id.startsWith("file://") ? fileURLToPath(id) : path.normalize(id);

        if (isLocalRuntimeModuleRequest(normalizedId, localRuntimeModulesPath)) {
          return cloudflareLocalRuntimeStubsPath;
        }

        return null;
      },
    },
  };
}
