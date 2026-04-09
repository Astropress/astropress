/**
 * Astro integration for the public production site.
 *
 * Unlike createAstropressAdminAppIntegration, this integration does NOT inject
 * any /ap-admin/* routes or admin middleware. It is designed for use in a
 * purely static Astro build so that the production domain has zero admin surface.
 */
export function createAstropressPublicSiteIntegration(options = {}) {
  return {
    name: "astropress-public-site",
    hooks: {
      // No admin routes are injected.
      // No admin middleware is registered.
      // The host site registers its own content loaders and public routes.
      "astro:config:setup": () => {
        // buildHookSecret is reserved for future webhook rebuild support.
      },
    },
  };
}
