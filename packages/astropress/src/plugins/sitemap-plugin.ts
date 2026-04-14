import type { AstropressPlugin } from "../config";

/**
 * createSitemapPlugin
 *
 * A reference Astropress plugin that rebuilds the sitemap on each content publish event.
 * In production environments that use CDN-level sitemap caching, this plugin can trigger
 * a sitemap cache purge or a deploy hook whenever a content record is published.
 *
 * Usage:
 * ```ts
 * import { createSitemapPlugin } from "@astropress-diy/astropress/plugins/sitemap";
 *
 * registerCms({
 *   plugins: [createSitemapPlugin({ purgeUrl: process.env.SITEMAP_PURGE_URL })],
 * });
 * ```
 */
export interface SitemapPluginOptions {
  /**
   * Optional webhook URL to POST to when content is published.
   * Useful for triggering CDN cache invalidation or a static site rebuild.
   */
  purgeUrl?: string;
  /**
   * Optional callback invoked on each publish event.
   * Use this for custom sitemap regeneration logic.
   */
  onPublish?: (slug: string) => Promise<void> | void;
}

export function createSitemapPlugin(options: SitemapPluginOptions = {}): AstropressPlugin {
  return {
    name: "astropress-sitemap",

    async onContentPublish(event) {
      const { slug } = event;

      // Call custom onPublish callback if provided
      if (options.onPublish) {
        await options.onPublish(slug);
      }

      // POST to purge URL if configured
      if (options.purgeUrl) {
        await fetch(options.purgeUrl, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ slug, purgedAt: new Date().toISOString(), event: "content.publish" }),
        }).catch((err: unknown) => {
          // Sitemap purge failures are non-fatal — log and continue
          console.warn(`[astropress-sitemap] Purge webhook failed for slug "${slug}":`, err);
        });
      }
    },
  };
}
