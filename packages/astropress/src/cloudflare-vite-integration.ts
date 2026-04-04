export type AstropressCloudflareViteIntegration = {
  aliases: Array<{ find: string | RegExp; replacement: string }>;
  plugin: {
    name: string;
    enforce: "pre";
    resolveId: (id: string) => string | null;
  };
};

export type AstropressCloudflareViteIntegrationOptions = {
  cloudflareLocalRuntimeStubsPath?: string;
  cloudflareLocalImageStorageStubPath?: string;
  cloudflareLocalMediaStorageStubPath?: string;
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

function normalizeImportId(id: string): string {
  let normalized = id.replaceAll("\\", "/");
  if (normalized.startsWith("file://")) {
    normalized = decodeURIComponent(normalized.replace(/^file:\/\/\/?/, "/"));
  }

  if (/^\/[a-zA-Z]:\//.test(normalized)) {
    return normalized.slice(1);
  }

  return normalized;
}

export function createAstropressCloudflareViteIntegration(
  localRuntimeModulesPath: string,
  options: AstropressCloudflareViteIntegrationOptions = {},
): AstropressCloudflareViteIntegration {
  const cloudflareLocalRuntimeStubsPath =
    options.cloudflareLocalRuntimeStubsPath ?? "astropress/cloudflare-local-runtime-stubs";
  const cloudflareLocalImageStorageStubPath =
    options.cloudflareLocalImageStorageStubPath ?? "astropress/cloudflare-local-image-storage-stub";
  const cloudflareLocalMediaStorageStubPath =
    options.cloudflareLocalMediaStorageStubPath ?? "astropress/cloudflare-local-media-storage-stub";

  return {
    aliases: [
      {
        find: "astropress/local-image-storage",
        replacement: cloudflareLocalImageStorageStubPath,
      },
      {
        find: "astropress/local-media-storage",
        replacement: cloudflareLocalMediaStorageStubPath,
      },
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
        const normalizedId = normalizeImportId(id);

        if (normalizedId === "astropress/local-image-storage") {
          return cloudflareLocalImageStorageStubPath;
        }

        if (normalizedId === "astropress/local-media-storage") {
          return cloudflareLocalMediaStorageStubPath;
        }

        if (isLocalRuntimeModuleRequest(normalizedId, localRuntimeModulesPath)) {
          return cloudflareLocalRuntimeStubsPath;
        }

        return null;
      },
    },
  };
}
