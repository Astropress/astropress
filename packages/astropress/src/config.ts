/**
 * CmsConfig — the single seam between AstroPress (src/cms/) and the host site (src/site/).
 *
 * Call registerCms() once at startup (e.g. in src/site/cms-registration.ts imported by
 * middleware or the admin layout) before any CMS function is invoked.
 */

export interface CmsConfig {
  /** Template keys that are valid for structured page routes (e.g. "home", "impact"). */
  templateKeys: readonly string[];

  /** Canonical base URL of the site, e.g. "https://fleetfarming.org". Used for sitemap, canonical tags, etc. */
  siteUrl: string;

  /**
   * Seeded content records loaded from the host site's pages.json.
   * Typed loosely so the CMS does not need to know the host's full page schema.
   */
  seedPages: ReadonlyArray<Record<string, unknown>>;

  /**
   * Archive sources loaded from the host site's archives.json.
   * Used to build archive index and SEO pages in the admin.
   */
  archives: ReadonlyArray<{
    slug: string;
    title: string;
    kind: string;
    legacyUrl: string;
    listingItems?: ReadonlyArray<Record<string, unknown>>;
  }>;

  /**
   * Translation status entries from the host site's translation-status.json.
   * Used to build the translation dashboard and SEO page.
   */
  translationStatus: ReadonlyArray<{
    route: string;
    translationState: string;
    englishSourceUrl: string;
    locale: string;
  }>;
}

const CMS_CONFIG_KEY = Symbol.for("astropress.cms-config");

type AstropressGlobalWithConfig = typeof globalThis & {
  [CMS_CONFIG_KEY]?: CmsConfig | null;
};

function getConfigStore(): AstropressGlobalWithConfig {
  return globalThis as AstropressGlobalWithConfig;
}

export function registerCms(config: CmsConfig): void {
  getConfigStore()[CMS_CONFIG_KEY] = config;
}

export function getCmsConfig(): CmsConfig {
  const config = getConfigStore()[CMS_CONFIG_KEY] ?? null;
  if (!config) {
    throw new Error("CMS not initialized — call registerCms() before using the CMS.");
  }
  return config;
}
