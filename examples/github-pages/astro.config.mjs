import { defineConfig } from "astro/config";
import { fileURLToPath } from "node:url";
import { createAstropressViteIntegration } from "astropress/integration";

const viteIntegration = createAstropressViteIntegration({
  localRuntimeModulesPath: fileURLToPath(
    new URL("./src/astropress/local-runtime-modules.ts", import.meta.url),
  ),
});

export default defineConfig({
  output: "static",
  vite: {
    plugins: viteIntegration.plugins,
    resolve: { alias: viteIntegration.aliases },
  },
});
