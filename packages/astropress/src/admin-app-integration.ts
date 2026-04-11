import type { AstroIntegration } from "astro";
import { fileURLToPath } from "node:url";

import { injectAstropressAdminRoutes } from "./admin-routes";
import { peekCmsConfig } from "./config";

export function createAstropressAdminAppIntegration(): AstroIntegration {
  return {
    name: "astropress-admin-app",
    hooks: {
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
