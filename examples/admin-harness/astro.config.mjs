import { defineConfig } from "astro/config";
import { fileURLToPath } from "node:url";
import { createAstropressAdminAppIntegration, createAstropressViteIntegration } from "astropress/integration";

const astropressRoot = fileURLToPath(new URL("../../packages/astropress", import.meta.url));
const localRuntimeModulesPath = fileURLToPath(new URL("./src/astropress/local-runtime-modules.ts", import.meta.url));
const cloudflareWorkersStubPath = fileURLToPath(new URL("../../packages/astropress/src/cloudflare-workers-stub.ts", import.meta.url));
const viteIntegration = createAstropressViteIntegration({
  localRuntimeModulesPath,
  cloudflareWorkersStubPath,
});

export default defineConfig({
  integrations: [createAstropressAdminAppIntegration()],
  vite: {
    plugins: viteIntegration.plugins,
    resolve: {
      alias: [
        ...viteIntegration.aliases,
        {
          find: /^astropress\/components\/(.*)$/,
          replacement: `${fileURLToPath(new URL("../../packages/astropress/components/", import.meta.url))}$1`,
        },
        {
          find: /^astropress$/,
          replacement: fileURLToPath(new URL("../../packages/astropress/index.ts", import.meta.url)),
        },
      ],
    },
    server: {
      fs: {
        allow: [astropressRoot],
      },
    },
  },
});
