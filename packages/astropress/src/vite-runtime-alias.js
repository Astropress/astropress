function normalizeRuntimeRequest(id) {
  let normalized = id.replaceAll("\\", "/");
  if (normalized.startsWith("file://")) {
    normalized = decodeURIComponent(normalized.replace(/^file:\/\/\/?/, "/"));
  }

  if (/^\/[a-zA-Z]:\//.test(normalized)) {
    return normalized.slice(1);
  }

  return normalized;
}

export function isAstropressLocalRuntimeModuleRequest(id, localRuntimeModulesPath) {
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

export function createAstropressLocalRuntimeModulePlugin(localRuntimeModulesPath) {
  if (!localRuntimeModulesPath) {
    throw new Error(
      "[astropress] Missing Vite alias: 'local-runtime-modules'. " +
        "Add astropressIntegration() to your astro.config.mjs — " +
        "see https://astropress.dev/docs/quick-start#step-2-add-the-integration",
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

export function createAstropressViteAliases(options) {
  const aliases = [
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
