/**
 * createSitemapPlugin
 *
 * A reference Astropress plugin that rebuilds the sitemap on each content publish event.
 */
export function createSitemapPlugin(options = {}) {
  return {
    name: "astropress-sitemap",

    async onContentPublish(event) {
      const { slug } = event;

      if (options.onPublish) {
        await options.onPublish(slug);
      }

      if (options.purgeUrl) {
        await fetch(options.purgeUrl, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ slug, purgedAt: new Date().toISOString(), event: "content.publish" }),
        }).catch((err) => {
          console.warn(`[astropress-sitemap] Purge webhook failed for slug "${slug}":`, err);
        });
      }
    },
  };
}
