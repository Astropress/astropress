// packages/astropress/src/cloudflare-vite-integration.ts
function isLocalRuntimeModuleRequest(id, localRuntimeModulesPath) {
  if (id === "./local-runtime-modules" || id === "./local-runtime-modules.ts" || id === "local-runtime-modules" || id === "local-runtime-modules.ts") {
    return true;
  }
  return id === localRuntimeModulesPath || id.endsWith("/local-runtime-modules") || id.endsWith("/local-runtime-modules.ts");
}
function isPackageStorageModuleRequest(id, moduleName) {
  return id === `astropress/${moduleName}` || id.endsWith(`/${moduleName}`) || id.endsWith(`/${moduleName}.ts`) || id.endsWith(`/${moduleName}.js`);
}
function isSqliteAdminRuntimeRequest(id) {
  return id === "astropress/sqlite-admin-runtime" || id.endsWith("/sqlite-admin-runtime") || id.endsWith("/sqlite-admin-runtime.ts") || id.endsWith("/sqlite-admin-runtime.js");
}
function isSqliteAdapterRequest(id) {
  return id === "astropress/adapters/sqlite" || id.endsWith("/adapters/sqlite") || id.endsWith("/adapters/sqlite.ts") || id.endsWith("/adapters/sqlite.js");
}
function isSqliteBootstrapRequest(id) {
  return id === "astropress/sqlite-bootstrap" || id.endsWith("/sqlite-bootstrap") || id.endsWith("/sqlite-bootstrap.ts") || id.endsWith("/sqlite-bootstrap.js");
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
function createAstropressCloudflareViteIntegration(localRuntimeModulesPath, options = {}) {
  const cloudflareLocalRuntimeStubsPath = options.cloudflareLocalRuntimeStubsPath ?? "astropress/cloudflare-local-runtime-stubs";
  const cloudflareLocalImageStorageStubPath = options.cloudflareLocalImageStorageStubPath ?? "astropress/cloudflare-local-image-storage-stub";
  const cloudflareLocalMediaStorageStubPath = options.cloudflareLocalMediaStorageStubPath ?? "astropress/cloudflare-local-media-storage-stub";
  const cloudflareSqliteAdapterStubPath = options.cloudflareSqliteAdapterStubPath ?? "astropress/cloudflare-sqlite-adapter-stub";
  const cloudflareSqliteAdminRuntimeStubPath = options.cloudflareSqliteAdminRuntimeStubPath ?? "astropress/cloudflare-sqlite-admin-runtime-stub";
  const cloudflareSqliteBootstrapStubPath = options.cloudflareSqliteBootstrapStubPath ?? "astropress/cloudflare-sqlite-bootstrap-stub";
  return {
    aliases: [
      {
        find: "astropress/local-image-storage",
        replacement: cloudflareLocalImageStorageStubPath
      },
      {
        find: /^.*\/local-image-storage(?:\.[cm]?[jt]s)?$/,
        replacement: cloudflareLocalImageStorageStubPath
      },
      {
        find: "astropress/local-media-storage",
        replacement: cloudflareLocalMediaStorageStubPath
      },
      {
        find: /^.*\/local-media-storage(?:\.[cm]?[jt]s)?$/,
        replacement: cloudflareLocalMediaStorageStubPath
      },
      {
        find: "astropress/adapters/sqlite",
        replacement: cloudflareSqliteAdapterStubPath
      },
      {
        find: /^.*\/adapters\/sqlite(?:\.[cm]?[jt]s)?$/,
        replacement: cloudflareSqliteAdapterStubPath
      },
      {
        find: "astropress/sqlite-admin-runtime",
        replacement: cloudflareSqliteAdminRuntimeStubPath
      },
      {
        find: /^.*\/sqlite-admin-runtime(?:\.[cm]?[jt]s)?$/,
        replacement: cloudflareSqliteAdminRuntimeStubPath
      },
      {
        find: "astropress/sqlite-bootstrap",
        replacement: cloudflareSqliteBootstrapStubPath
      },
      {
        find: /^.*\/sqlite-bootstrap(?:\.[cm]?[jt]s)?$/,
        replacement: cloudflareSqliteBootstrapStubPath
      },
      {
        find: /^\.\/local-runtime-modules(?:\.ts)?$/,
        replacement: cloudflareLocalRuntimeStubsPath
      },
      {
        find: /^.*\/local-runtime-modules(?:\.ts)?$/,
        replacement: cloudflareLocalRuntimeStubsPath
      },
      {
        find: localRuntimeModulesPath,
        replacement: cloudflareLocalRuntimeStubsPath
      }
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
        if (isSqliteAdapterRequest(normalizedId)) {
          return cloudflareSqliteAdapterStubPath;
        }
        if (isSqliteAdminRuntimeRequest(normalizedId)) {
          return cloudflareSqliteAdminRuntimeStubPath;
        }
        if (isSqliteBootstrapRequest(normalizedId)) {
          return cloudflareSqliteBootstrapStubPath;
        }
        if (isLocalRuntimeModuleRequest(normalizedId, localRuntimeModulesPath)) {
          return cloudflareLocalRuntimeStubsPath;
        }
        return null;
      }
    }
  };
}
export {
  createAstropressCloudflareViteIntegration
};
