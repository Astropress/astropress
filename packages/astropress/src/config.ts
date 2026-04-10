// ─── Analytics / observability config ────────────────────────────────────────

export interface AnalyticsConfig {
  /** Analytics provider identifier. */
  type: "umami" | "plausible" | "matomo" | "posthog" | "custom";
  /**
   * "iframe" — embed the dashboard URL in a full-screen iframe in /ap-admin/services/analytics.
   * "link"   — show a branded open-in-new-tab button.
   * "snippet-only" — inject tracker script into site <head> only; no admin panel.
   */
  mode: "iframe" | "link" | "snippet-only";
  /** Dashboard URL for iframe/link mode. */
  url?: string;
  /** Tracker script src for snippet injection (e.g. "https://analytics.example.com/script.js"). */
  snippetSrc?: string;
  /** Provider-specific site/website ID (Umami: website ID, Plausible: domain). */
  siteId?: string;
  /** Override the display label shown in the sidebar. */
  label?: string;
}

export interface AbTestingConfig {
  /** A/B testing / feature flag provider identifier. */
  type: "growthbook" | "unleash" | "custom";
  /** "iframe" — embed dashboard. "link" — open-in-new-tab button. */
  mode: "iframe" | "link";
  /** Dashboard URL for iframe/link mode. */
  url?: string;
  /** API endpoint for flag loading at runtime (e.g. GrowthBook API host). */
  apiEndpoint?: string;
  /** Override the display label shown in the sidebar. */
  label?: string;
}

export interface AstropressApiConfig {
  /** Enable /ap-api/v1/* REST endpoints. When false (default), all API routes return 404. */
  enabled: boolean;
  /** Require HTTPS for token auth in production. Default: true. */
  requireHttps?: boolean;
  /** Max requests per token per minute before rate-limiting. Default: 60. */
  rateLimit?: number;
}

// ─── Main config ─────────────────────────────────────────────────────────────

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

  /**
   * Optional analytics / heatmap integration.
   * When configured, an "Analytics" entry appears in the admin services sidebar.
   */
  analytics?: AnalyticsConfig;

  /**
   * Optional A/B testing / feature flag integration.
   * When configured, an "A/B Testing" entry appears in the admin services sidebar.
   */
  abTesting?: AbTestingConfig;

  /**
   * Optional REST API configuration.
   * When api.enabled is true, /ap-api/v1/* endpoints are active and
   * API Tokens + Webhooks appear in the admin sidebar.
   * Default: disabled (all /ap-api/* routes return 404).
   */
  api?: AstropressApiConfig;
}

const CMS_CONFIG_KEY = Symbol.for("astropress.cms-config");

type AstropressGlobalWithConfig = typeof globalThis & {
  [CMS_CONFIG_KEY]?: CmsConfig | null;
};

function getConfigStore(): AstropressGlobalWithConfig {
  return globalThis as AstropressGlobalWithConfig;
}

/**
 * Register the astropress configuration for this host application.
 *
 * Call once at startup — typically in `src/middleware.ts` or imported by the
 * admin layout — before any other astropress function is invoked.
 *
 * @example
 * ```ts
 * // src/site/cms-registration.ts
 * import { registerCms } from "astropress";
 * import seedPages from "../content/pages.json";
 *
 * registerCms({
 *   siteUrl: "https://example.com",
 *   templateKeys: ["home", "about", "content"],
 *   seedPages,
 *   archives: [],
 *   translationStatus: [],
 * });
 * ```
 */
export function registerCms(config: CmsConfig): void {
  getConfigStore()[CMS_CONFIG_KEY] = config;
}

/**
 * Retrieve the registered astropress configuration.
 *
 * Throws if `registerCms()` has not been called yet.
 *
 * @example
 * ```ts
 * import { getCmsConfig } from "astropress";
 * const { siteUrl } = getCmsConfig();
 * ```
 */
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
