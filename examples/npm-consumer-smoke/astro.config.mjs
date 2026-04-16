import { defineConfig } from "astro/config";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";
import { join } from "node:path";
import { createAstropressAdminAppIntegration, createAstropressViteIntegration } from "@astropress-diy/astropress/integration";

// Resolve the installed package root. Works for both workspace:* (symlink) and a
// real npm install (tarball). Does NOT hardcode paths into the monorepo source tree.
const require = createRequire(import.meta.url);
const packageRoot = join(require.resolve("@astropress-diy/astropress/package.json"), "..");

const localRuntimeModulesPath = fileURLToPath(new URL("./src/astropress/local-runtime-modules.ts", import.meta.url));

// cloudflare-workers-stub lives inside the published package under src/ (included in files[]).
const cloudflareWorkersStubPath = join(packageRoot, "src/cloudflare-workers-stub.ts");

// createAstropressViteIntegration with astropressPackageRoot enables
// createAstropressPackageResolverPlugin, which handles any bare astropress/ imports
// that remain in user-land code. It does NOT add aliases pointing to the monorepo
// TypeScript source — this is the key difference from examples/admin-harness.
const viteIntegration = createAstropressViteIntegration({
  localRuntimeModulesPath,
  cloudflareWorkersStubPath,
  astropressPackageRoot: packageRoot,
});

export default defineConfig({
  devToolbar: {
    enabled: false,
  },
  output: "server",
  integrations: [createAstropressAdminAppIntegration()],
  vite: {
    plugins: viteIntegration.plugins,
    resolve: {
      // Only the runtime-module and cloudflare:workers aliases from viteIntegration.
      // No aliases that redirect astropress/components/X or bare astropress to the
      // monorepo TypeScript source — everything must resolve through the package exports.
      alias: viteIntegration.aliases,
    },
    server: {
      fs: {
        allow: [packageRoot],
      },
    },
  },
});
