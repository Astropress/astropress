import { fileURLToPath } from "node:url";
import { peekCmsConfig } from "./config.js";

/**
 * Astro integration for the public production site.
 *
 * Unlike createAstropressAdminAppIntegration, this integration does NOT inject
 * any /ap-admin/* routes or admin middleware.
 */
export function createAstropressPublicSiteIntegration(options = {}) {
  return {
    name: "astropress-public-site",
    hooks: {
      "astro:config:setup": ({ injectRoute }) => {
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

/**
 * createAstropressSitemapIntegration
 *
 * Injects the framework's sitemap route and OG image endpoint with canonical URL config.
 */
export function createAstropressSitemapIntegration(options = {}) {
  return {
    name: "astropress-sitemap",
    hooks: {
      "astro:config:setup": ({ injectRoute, updateConfig }) => {
        const siteUrl = options.siteUrl ?? peekCmsConfig()?.siteUrl ?? "";

        injectRoute({
          pattern: "/sitemap.xml",
          entrypoint: fileURLToPath(new URL("../pages/sitemap.xml.js", import.meta.url)),
        });

        injectRoute({
          pattern: "/ap-api/v1/og-image/[slug].png",
          entrypoint: fileURLToPath(
            new URL("../pages/ap-api/v1/og-image/[slug].png.js", import.meta.url),
          ),
        });

        if (siteUrl) {
          updateConfig({
            vite: {
              define: {
                "import.meta.env.ASTROPRESS_SITE_URL": JSON.stringify(siteUrl),
              },
            },
          });
        }
      },
    },
  };
}
