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
      "astro:config:setup": ({ _config }) => {
        void options.buildHookSecret;
      },
    },
  };
}
