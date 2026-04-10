import { fileURLToPath } from "node:url";

import { injectAstropressAdminRoutes } from "./admin-routes.js";

export function createAstropressAdminAppIntegration() {
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
        addMiddleware({
          order: "pre",
          entrypoint: new URL("./security-middleware-entrypoint.js", import.meta.url),
        });
      },
    },
  };
}
