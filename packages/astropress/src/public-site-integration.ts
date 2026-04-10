import type { AstroIntegration } from "astro";
import { fileURLToPath } from "node:url";

export interface AstropressPublicSiteOptions {
  /**
   * Optional secret token used to verify webhook-triggered rebuild requests.
   * When set, an incoming POST to /_astropress/rebuild is authenticated against
   * this value before triggering a new static build.
   */
  buildHookSecret?: string;
}

/**
 * Astro integration for the public production site.
 *
 * Unlike `createAstropressAdminAppIntegration`, this integration does NOT inject
 * any `/ap-admin/*` routes or admin middleware. It is designed for use in a
 * purely static Astro build so that the production domain has zero admin surface.
 *
 * @example
 * ```ts
 * // astro.config.mjs (public site project)
 * import { createAstropressPublicSiteIntegration } from "astropress";
 *
 * export default defineConfig({
 *   integrations: [createAstropressPublicSiteIntegration()],
 * });
 * ```
 */
export function createAstropressPublicSiteIntegration(
  options: AstropressPublicSiteOptions = {},
): AstroIntegration {
  return {
    name: "astropress-public-site",
    hooks: {
      // No admin routes are injected.
      // No admin middleware is registered.
      // The host site registers its own content loaders and public routes.
      "astro:config:setup": ({ injectRoute }) => {
        // buildHookSecret is reserved for future webhook rebuild support.
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
      },
    },
  };
}
