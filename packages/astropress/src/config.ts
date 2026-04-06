/**
 * CmsConfig — the single seam between astropress and the host site.
 *
 * Call registerCms() once at startup (e.g. in src/site/cms-registration.ts imported by
 * middleware or the admin layout) before any astropress function is invoked.
 */

export interface CmsConfig {
  /** Template keys that are valid for structured page routes (e.g. "home", "impact"). */
  templateKeys: readonly string[];

  /** Canonical base URL of the site, e.g. "https://fleetfarming.org". Used for sitemap, canonical tags, etc. */
  siteUrl: string;

  /**
   * Seeded content records loaded from the host site's pages.json.
   * Typed loosely so the framework does not need to know the host's full page schema.
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

  /**
   * Optional admin-shell customization. Hosts can rename labels and swap simple
   * brand assets without forking Astropress admin templates.
   */
  admin?: {
    branding?: {
      appName?: string;
      productName?: string;
      shellName?: string;
      logoSrc?: string;
      logoHref?: string;
      logoAlt?: string;
      faviconHref?: string;
      stylesheetHref?: string;
    };
    labels?: {
      sidebarTitle?: string;
      signedInAsPrefix?: string;
      signOut?: string;
      themeToggleDark?: string;
      themeToggleLight?: string;
      languageToggle?: string;
      languageToggleTitle?: string;
      loginHeading?: string;
      loginDescription?: string;
      loginSubmit?: string;
      loginEmailLabel?: string;
      loginPasswordLabel?: string;
      forgotPassword?: string;
      invalidCredentials?: string;
      rateLimited?: string;
      challengeRequired?: string;
      passwordResetSuccess?: string;
      invitationAcceptedSuccess?: string;
      acceptInvitationHeading?: string;
      acceptInvitationDescription?: string;
      acceptInvitationSubmit?: string;
      resetPasswordRequestHeading?: string;
      resetPasswordRequestDescription?: string;
      resetPasswordTokenHeading?: string;
      resetPasswordTokenDescription?: string;
      resetPasswordRequestSubmit?: string;
      resetPasswordTokenSubmit?: string;
      backToLogin?: string;
    };
    navigation?: Partial<Record<
      | "dashboard"
      | "contentGroup"
      | "pages"
      | "posts"
      | "authors"
      | "taxonomies"
      | "routePages"
      | "archives"
      | "users"
      | "media"
      | "comments"
      | "redirects"
      | "translations"
      | "seo"
      | "system"
      | "settings",
      string
    >>;
  };
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
    throw new Error("Astropress not initialized — call registerCms() before using astropress.");
  }
  return config;
}

export function peekCmsConfig(): CmsConfig | null {
  return getConfigStore()[CMS_CONFIG_KEY] ?? null;
}
