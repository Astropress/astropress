import path from "node:path";
import { fileURLToPath } from "node:url";

function isLocalRuntimeModuleRequest(id, localRuntimeModulesPath) {
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
  localRuntimeModulesPath,
  cloudflareLocalRuntimeStubsPath = "astropress/cloudflare-local-runtime-stubs",
) {
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
