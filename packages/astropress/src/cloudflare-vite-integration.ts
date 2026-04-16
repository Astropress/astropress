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
  cloudflareSqliteAdapterStubPath?: string;
  cloudflareSqliteAdminRuntimeStubPath?: string;
  cloudflareSqliteBootstrapStubPath?: string;
};

type ResolvedStubPaths = {
  localImageStorage: string;
  localMediaStorage: string;
  sqliteAdapter: string;
  sqliteAdminRuntime: string;
  sqliteBootstrap: string;
  localRuntimeStubs: string;
};

type ResolveIdEntry = { check: (id: string, localRuntimeModulesPath: string) => boolean; stubKey: keyof ResolvedStubPaths };

const aliasPatterns: Array<{ find: string | RegExp; stubKey: keyof ResolvedStubPaths }> = [
  { find: "astropress/local-image-storage", stubKey: "localImageStorage" },
  { find: /^.*\/local-image-storage(?:\.[cm]?[jt]s)?$/, stubKey: "localImageStorage" },
  { find: "astropress/local-media-storage", stubKey: "localMediaStorage" },
  { find: /^.*\/local-media-storage(?:\.[cm]?[jt]s)?$/, stubKey: "localMediaStorage" },
  { find: "astropress/adapters/sqlite", stubKey: "sqliteAdapter" },
  { find: /^.*\/adapters\/sqlite(?:\.[cm]?[jt]s)?$/, stubKey: "sqliteAdapter" },
  { find: "astropress/sqlite-admin-runtime", stubKey: "sqliteAdminRuntime" },
  { find: /^.*\/sqlite-admin-runtime(?:\.[cm]?[jt]s)?$/, stubKey: "sqliteAdminRuntime" },
  { find: "astropress/sqlite-bootstrap", stubKey: "sqliteBootstrap" },
  { find: /^.*\/sqlite-bootstrap(?:\.[cm]?[jt]s)?$/, stubKey: "sqliteBootstrap" },
  { find: /^\.\/local-runtime-modules(?:\.ts)?$/, stubKey: "localRuntimeStubs" },
  { find: /^.*\/local-runtime-modules(?:\.ts)?$/, stubKey: "localRuntimeStubs" },
];

const resolveIdEntries: ResolveIdEntry[] = [
  { check: (id) => isPackageStorageModuleRequest(id, "local-image-storage"), stubKey: "localImageStorage" },
  { check: (id) => isPackageStorageModuleRequest(id, "local-media-storage"), stubKey: "localMediaStorage" },
  { check: (id) => isSqliteAdapterRequest(id), stubKey: "sqliteAdapter" },
  { check: (id) => isSqliteAdminRuntimeRequest(id), stubKey: "sqliteAdminRuntime" },
  { check: (id) => isSqliteBootstrapRequest(id), stubKey: "sqliteBootstrap" },
  { check: (id, lrm) => isLocalRuntimeModuleRequest(id, lrm), stubKey: "localRuntimeStubs" },
];

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

function isPackageStorageModuleRequest(id: string, moduleName: "local-image-storage" | "local-media-storage"): boolean {
  return (
    id === `astropress/${moduleName}` ||
    id.endsWith(`/${moduleName}`) ||
    id.endsWith(`/${moduleName}.ts`) ||
    id.endsWith(`/${moduleName}.js`)
  );
}

function isSqliteAdminRuntimeRequest(id: string): boolean {
  return (
    id === "astropress/sqlite-admin-runtime" ||
    id.endsWith("/sqlite-admin-runtime") ||
    id.endsWith("/sqlite-admin-runtime.ts") ||
    id.endsWith("/sqlite-admin-runtime.js")
  );
}

function isSqliteAdapterRequest(id: string): boolean {
  return (
    id === "astropress/adapters/sqlite" ||
    id.endsWith("/adapters/sqlite") ||
    id.endsWith("/adapters/sqlite.ts") ||
    id.endsWith("/adapters/sqlite.js")
  );
}

function isSqliteBootstrapRequest(id: string): boolean {
  return (
    id === "astropress/sqlite-bootstrap" ||
    id.endsWith("/sqlite-bootstrap") ||
    id.endsWith("/sqlite-bootstrap.ts") ||
    id.endsWith("/sqlite-bootstrap.js")
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

function resolveStubPaths(options: AstropressCloudflareViteIntegrationOptions): ResolvedStubPaths {
  return {
    localImageStorage: options.cloudflareLocalImageStorageStubPath ?? "astropress/cloudflare-local-image-storage-stub",
    localMediaStorage: options.cloudflareLocalMediaStorageStubPath ?? "astropress/cloudflare-local-media-storage-stub",
    sqliteAdapter: options.cloudflareSqliteAdapterStubPath ?? "astropress/cloudflare-sqlite-adapter-stub",
    sqliteAdminRuntime: options.cloudflareSqliteAdminRuntimeStubPath ?? "astropress/cloudflare-sqlite-admin-runtime-stub",
    sqliteBootstrap: options.cloudflareSqliteBootstrapStubPath ?? "astropress/cloudflare-sqlite-bootstrap-stub",
    localRuntimeStubs: options.cloudflareLocalRuntimeStubsPath ?? "astropress/cloudflare-local-runtime-stubs",
  };
}

function resolvePluginId(normalizedId: string, localRuntimeModulesPath: string, stubs: ResolvedStubPaths): string | null {
  const match = resolveIdEntries.find((entry) => entry.check(normalizedId, localRuntimeModulesPath));
  return match ? stubs[match.stubKey] : null;
}

function buildAliases(
  stubs: ResolvedStubPaths,
  localRuntimeModulesPath: string,
): Array<{ find: string | RegExp; replacement: string }> {
  const aliases = aliasPatterns.map((entry) => ({ find: entry.find, replacement: stubs[entry.stubKey] }));
  aliases.push({ find: localRuntimeModulesPath, replacement: stubs.localRuntimeStubs });
  return aliases;
}

export function createAstropressCloudflareViteIntegration(
  localRuntimeModulesPath: string,
  options: AstropressCloudflareViteIntegrationOptions = {},
): AstropressCloudflareViteIntegration {
  const stubs = resolveStubPaths(options);

  return {
    aliases: buildAliases(stubs, localRuntimeModulesPath),
    plugin: {
      name: "astropress-cloudflare-local-runtime-stubs",
      enforce: "pre",
      resolveId(id) {
        return resolvePluginId(normalizeImportId(id), localRuntimeModulesPath, stubs);
      },
    },
  };
}
