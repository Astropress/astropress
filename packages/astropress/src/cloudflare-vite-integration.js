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

function isPackageStorageModuleRequest(id, moduleName) {
  return (
    id === `astropress/${moduleName}` ||
    id.endsWith(`/${moduleName}`) ||
    id.endsWith(`/${moduleName}.ts`) ||
    id.endsWith(`/${moduleName}.js`)
  );
}

function normalizeImportId(id) {
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
  localRuntimeModulesPath,
  options = {},
) {
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
        find: /^.*\/local-image-storage(?:\.[cm]?[jt]s)?$/,
        replacement: cloudflareLocalImageStorageStubPath,
      },
      {
        find: "astropress/local-media-storage",
        replacement: cloudflareLocalMediaStorageStubPath,
      },
      {
        find: /^.*\/local-media-storage(?:\.[cm]?[jt]s)?$/,
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

        if (isPackageStorageModuleRequest(normalizedId, "local-image-storage")) {
          return cloudflareLocalImageStorageStubPath;
        }

        if (isPackageStorageModuleRequest(normalizedId, "local-media-storage")) {
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
