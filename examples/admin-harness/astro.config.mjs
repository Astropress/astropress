import { defineConfig } from "astro/config";
import { fileURLToPath } from "node:url";
import { createAstropressAdminAppIntegration, createAstropressViteIntegration } from "@astropress-diy/astropress/integration";

const astropressRoot = fileURLToPath(new URL("../../packages/astropress", import.meta.url));
const localRuntimeModulesPath = fileURLToPath(new URL("./src/astropress/local-runtime-modules.ts", import.meta.url));
const cloudflareWorkersStubPath = fileURLToPath(new URL("../../packages/astropress/src/cloudflare-workers-stub.ts", import.meta.url));
const viteIntegration = createAstropressViteIntegration({
  localRuntimeModulesPath,
  cloudflareWorkersStubPath,
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
    ssr: {
      // Allow Vite to process astropress source through its plugin pipeline so
      // the astropress-local-runtime-modules plugin can redirect
      // `./local-runtime-modules` imports to the host's implementation.
      // Without this, Vite SSR-externalizes the package and Node resolves
      // local-runtime-modules to the dist stub that throws `unavailable()`.
      noExternal: ["@astropress-diy/astropress"],
    },
    server: {
      fs: {
        allow: [astropressRoot],
      },
      // Optional proxy targets for embedded service admin UIs.
      // Set SERVICE_CMS_PORT / SERVICE_SHOP_PORT / SERVICE_COMMUNITY_PORT / SERVICE_EMAIL_PORT
      // in your shell to activate proxying when those services are running locally.
      proxy: {
        ...(process.env.SERVICE_CMS_PORT ? {
          "/ap-admin/services/cms": {
            target: `http://localhost:${process.env.SERVICE_CMS_PORT}`,
            rewrite: (p) => p.replace(/^\/ap-admin\/services\/cms/, ""),
            ws: true,
          },
        } : {}),
        ...(process.env.SERVICE_SHOP_PORT ? {
          "/ap-admin/services/shop": {
            target: `http://localhost:${process.env.SERVICE_SHOP_PORT}`,
            rewrite: (p) => p.replace(/^\/ap-admin\/services\/shop/, ""),
            ws: true,
          },
        } : {}),
        ...(process.env.SERVICE_COMMUNITY_PORT ? {
          "/ap-admin/services/community": {
            target: `http://localhost:${process.env.SERVICE_COMMUNITY_PORT}`,
            rewrite: (p) => p.replace(/^\/ap-admin\/services\/community/, ""),
            ws: true,
          },
        } : {}),
        ...(process.env.SERVICE_EMAIL_PORT ? {
          "/ap-admin/services/email": {
            target: `http://localhost:${process.env.SERVICE_EMAIL_PORT}`,
            rewrite: (p) => p.replace(/^\/ap-admin\/services\/email/, ""),
          },
        } : {}),
      },
    },
  },
});
