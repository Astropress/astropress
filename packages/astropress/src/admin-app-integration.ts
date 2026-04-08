import type { AstroIntegration } from "astro";
import { fileURLToPath } from "node:url";

import { injectAstropressAdminRoutes } from "./admin-routes";

export function createAstropressAdminAppIntegration(): AstroIntegration {
  return {
    name: "astropress-admin-app",
    hooks: {
      "astro:config:setup": ({ injectRoute, addMiddleware }) => {
        const pagesDirectory = fileURLToPath(new URL("../pages/ap-admin", import.meta.url));
        injectAstropressAdminRoutes(pagesDirectory, injectRoute);
        addMiddleware({
          order: "pre",
          entrypoint: new URL("./security-middleware-entrypoint.js", import.meta.url),
        });
      },
    },
  };
}
