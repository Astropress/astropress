import type { AstroIntegration } from "astro";
import { createReadStream } from "node:fs";
import { copyFile, mkdir } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { join } from "node:path";

import { injectAstropressAdminRoutes } from "./admin-routes";
import { peekCmsConfig } from "./config";

const adminCssSrc = fileURLToPath(new URL("../public/admin.css", import.meta.url));

export function createAstropressAdminAppIntegration(): AstroIntegration {
  return {
    name: "astropress-admin-app",
    hooks: {
      // Serve admin.css from the package public directory during development.
      "astro:server:setup": ({ server }) => {
        server.middlewares.use("/admin.css", (_req, res) => {
          res.setHeader("Content-Type", "text/css; charset=utf-8");
          res.setHeader("Cache-Control", "no-cache");
          createReadStream(adminCssSrc).pipe(res);
        });
      },
      // Copy admin.css into the build output for production deployments.
      "astro:build:done": async ({ dir }) => {
        const dest = join(fileURLToPath(dir), "admin.css");
        await mkdir(fileURLToPath(dir), { recursive: true });
        await copyFile(adminCssSrc, dest);
      },
      "astro:config:setup": ({ injectRoute, addMiddleware }) => {
        const pagesDirectory = fileURLToPath(new URL("../pages/ap-admin", import.meta.url));
        injectAstropressAdminRoutes(pagesDirectory, injectRoute);
        injectRoute({
          pattern: "/ap/health",
          entrypoint: fileURLToPath(new URL("../pages/ap/health.js", import.meta.url)),
        });
        injectRoute({
          pattern: "/sitemap.xml",
          entrypoint: fileURLToPath(new URL("../pages/sitemap.xml.js", import.meta.url)),
        });
        injectRoute({
          pattern: "/robots.txt",
          entrypoint: fileURLToPath(new URL("../pages/robots.txt.js", import.meta.url)),
        });
        injectRoute({
          pattern: "/llms.txt",
          entrypoint: fileURLToPath(new URL("../pages/llms.txt.js", import.meta.url)),
        });
        injectRoute({
          pattern: "/ap-api/v1/metrics",
          entrypoint: fileURLToPath(new URL("../pages/ap-api/v1/metrics.js", import.meta.url)),
        });
        injectRoute({
          pattern: "/ap-api/v1/og-image/[slug].png",
          entrypoint: fileURLToPath(new URL("../pages/ap-api/v1/og-image/[slug].png.js", import.meta.url)),
        });

        // Inject plugin-declared admin routes
        const config = peekCmsConfig();
        if (config?.plugins) {
          for (const plugin of config.plugins) {
            if (plugin.adminRoutes) {
              for (const route of plugin.adminRoutes) {
                injectRoute({ pattern: route.pattern, entrypoint: route.entrypoint });
              }
            }
          }
        }

        addMiddleware({
          order: "pre",
          entrypoint: new URL("./security-middleware-entrypoint.js", import.meta.url),
        });
      },
    },
  };
}
