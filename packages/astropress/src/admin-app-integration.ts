import type { AstroIntegration } from "astro";
import { fileURLToPath } from "node:url";

import { injectAstropressAdminRoutes } from "./admin-routes";

export function createAstropressAdminAppIntegration(): AstroIntegration {
  return {
    name: "astropress-admin-app",
    hooks: {
      "astro:config:setup": ({ injectRoute }) => {
        const pagesDirectory = fileURLToPath(new URL("../pages/wp-admin", import.meta.url));
        injectAstropressAdminRoutes(pagesDirectory, injectRoute);
      },
    },
  };
}
