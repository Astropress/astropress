// ─── Content Modeling ─────────────────────────────────────────────────────────

/**
 * A single field in a content type definition.
 *
 * @example
 * ```ts
 * const titleField: FieldDefinition = {
 *   name: "subtitle",
 *   type: "text",
 *   label: "Subtitle",
 *   required: true,
 *   validate: (value) => value.length <= 120 || "Subtitle must be 120 characters or fewer",
 * };
 * ```
 */
export interface FieldDefinition {
  /** Identifier used as the key in `metadata`. Must be a valid JS identifier. */
  name: string;
  /** Human-readable label for the admin form field. */
  label: string;
  /** Input type. Controls admin form rendering and basic type coercion. */
  type: "text" | "textarea" | "number" | "boolean" | "date" | "select" | "url" | "email";
  /** When true, `saveRuntimeContentState` rejects saves where this field is absent or empty. */
  required?: boolean;
  /** Allowed values for `type: "select"` fields. */
  options?: readonly string[];
  /**
   * Optional server-side validation hook.
   * Return `true` (or a string with no content) to pass.
   * Return a non-empty string to fail with that message.
   *
   * @example
   * ```ts
   * validate: (v) => /^[\w-]+$/.test(v) || "Only letters, numbers, and hyphens are allowed"
   * ```
   */
  validate?: (value: unknown) => true | string;
}

/**
 * A content type definition that associates a `templateKey` with a set of typed field definitions.
 *
 * Field values are stored in the `metadata` JSON column and validated at save time.
 *
 * @example
 * ```ts
 * registerCms({
 *   contentTypes: [
 *     {
 *       key: "event",
 *       label: "Event",
 *       fields: [
 *         { name: "eventDate", label: "Event Date", type: "date", required: true },
 *         { name: "venue", label: "Venue", type: "text" },
 *         {
 *           name: "capacity",
 *           label: "Max Capacity",
 *           type: "number",
 *           validate: (v) => Number(v) > 0 || "Capacity must be a positive number",
 *         },
 *       ],
 *     },
 *   ],
 *   // ...
 * });
 * ```
 */
export interface ContentTypeDefinition {
  /** Must match one of the `templateKeys` registered in `registerCms()`. */
  key: string;
  /** Human-readable name shown in the admin panel content type selector. */
  label: string;
  /** Ordered list of custom field definitions for this content type. */
  fields: readonly FieldDefinition[];
}

/**
 * Validate `metadata` values against the field definitions for a given content type.
 *
 * Returns `null` when all validations pass, or the first validation error message encountered.
 * Called internally by `saveRuntimeContentState` when `contentTypes` are configured.
 */
export function validateContentFields(
  contentType: ContentTypeDefinition,
  metadata: Record<string, unknown>,
): string | null {
  for (const field of contentType.fields) {
    const value = metadata[field.name];
    const isEmpty = value === undefined || value === null || value === "";
    if (field.required && isEmpty) {
      return `"${field.label}" is required.`;
    }
    if (!isEmpty && typeof field.validate === "function") {
      const result = field.validate(value);
      if (result !== true && result) {
        return result;
      }
    }
  }
  return null;
}

// ─── Plugin API ───────────────────────────────────────────────────────────────

/**
 * Payload passed to lifecycle event hooks.
 */
export interface AstropressContentEvent {
  /** The slug of the content record that was saved or published. */
  slug: string;
  /** The content kind (e.g. "post", "page"). */
  kind: string;
  /** The new status after the save ("draft", "published", "archived"). */
  status: string;
  /** Email of the admin user who performed the action. */
  actor: string;
}

export interface AstropressMediaEvent {
  /** The unique asset ID (UUID) assigned at upload time. */
  id: string;
  /** Original filename as provided by the uploader. */
  filename: string;
  /** MIME type of the uploaded file, e.g. "image/jpeg". */
  mimeType: string;
  /** Size of the file in bytes. */
  size: number;
  /** Email of the admin user who uploaded the file. */
  actor: string;
}

/**
 * A plugin that extends Astropress with lifecycle hooks or admin navigation items.
 *
 * Plugins are registered via `registerCms({ plugins: [myPlugin] })`.
 * Hook functions are called on the server — async is supported.
 *
 * @example
 * ```ts
 * const searchPlugin: AstropressPlugin = {
 *   name: "search-indexer",
 *   async onContentSave({ slug, status }) {
 *     if (status === "published") {
 *       await searchIndex.upsert(slug);
 *     }
 *   },
 * };
 * registerCms({ ..., plugins: [searchPlugin] });
 * ```
 */
export interface AstropressPlugin {
  /** Unique identifier for this plugin (used in error messages). */
  name: string;

  /**
   * Called after a content record is saved via the admin panel.
   * Errors thrown here are logged but do not fail the admin action.
   */
  onContentSave?: (event: AstropressContentEvent) => Promise<void> | void;

  /**
   * Called after a content record status changes to "published".
   * Runs in addition to `onContentSave` when the saved status is "published".
   */
  onContentPublish?: (event: AstropressContentEvent) => Promise<void> | void;

  /**
   * Called after a media asset is successfully uploaded via the admin panel.
   * Errors thrown here are logged but do not fail the upload action.
   *
   * @example
   * ```ts
   * const mediaIndexPlugin: AstropressPlugin = {
   *   name: "media-indexer",
   *   async onMediaUpload({ id, filename, mimeType }) {
   *     await searchIndex.addMedia({ id, filename, mimeType });
   *   },
   * };
   * ```
   */
  onMediaUpload?: (event: AstropressMediaEvent) => Promise<void> | void;

  /**
   * Extra items to add to the admin sidebar navigation.
   * Rendered after the core nav items.
   */
  navItems?: ReadonlyArray<{
    label: string;
    href: string;
    /** Optional icon name or SVG src for the nav item. */
    icon?: string;
  }>;
}

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
   * Optional list of locale prefixes used in URL paths (e.g. ["en", "es", "fr"]).
   *
   * When set, `localeFromPath("/es/my-post/")` will return `"es"` for any prefix
   * in this list, and fall back to the first entry (or `"en"`) for unmatched paths.
   *
   * When unset, the default is `["en", "es"]` (backwards-compatible behaviour).
   *
   * @example
   * ```ts
   * registerCms({
   *   locales: ["en", "es", "fr", "de"],
   *   // ...
   * });
   * ```
   */
  locales?: readonly string[];

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

  /**
   * Cache lifetime in seconds for public (non-admin, non-API) pages.
   *
   * Sets `Cache-Control: public, max-age=<publicCacheTtl>, s-maxage=<publicCacheTtl * 12>`.
   * Defaults to 300 (5 minutes) with a CDN TTL of 3600 (1 hour).
   *
   * @example
   * ```ts
   * registerCms({ publicCacheTtl: 600, ... });
   * // → Cache-Control: public, max-age=600, s-maxage=7200
   * ```
   */
  publicCacheTtl?: number;

  /**
   * Maximum number of days to retain audit log entries.
   *
   * When set, the audit log writer prunes records older than this many days on each write,
   * keeping the `audit_events` table bounded without a separate cron job.
   * Defaults to `90` when unset. Set to `0` to disable automatic pruning.
   *
   * @example
   * ```ts
   * registerCms({ auditRetentionDays: 30, ... }); // keep 30 days of audit history
   * ```
   */
  auditRetentionDays?: number;

  /**
   * Maximum allowed size of a single media upload in bytes.
   *
   * When set, the admin media-upload action rejects files larger than this value
   * before reading the full body, returning a descriptive error to the user.
   * Defaults to `10 * 1024 * 1024` (10 MiB) when unset.
   *
   * @example
   * ```ts
   * registerCms({ maxUploadBytes: 5 * 1024 * 1024, ... }); // 5 MiB
   * ```
   */
  maxUploadBytes?: number;

  /**
   * Optional content type definitions that add typed, validated custom fields to content records.
   *
   * When a content type is defined for a `templateKey`, its field values are read from and written to
   * the `metadata` JSON column, and are validated by `saveRuntimeContentState` before persisting.
   *
   * @example
   * ```ts
   * registerCms({
   *   contentTypes: [
   *     {
   *       key: "event",
   *       label: "Event",
   *       fields: [
   *         { name: "eventDate", label: "Event Date", type: "date", required: true },
   *         { name: "venue", label: "Venue", type: "text" },
   *       ],
   *     },
   *   ],
   *   // ...
   * });
   * ```
   */
  contentTypes?: readonly ContentTypeDefinition[];

  /**
   * Optional list of plugins that extend Astropress with lifecycle hooks
   * or additional admin navigation items.
   *
   * @example
   * ```ts
   * import type { AstropressPlugin } from "astropress";
   *
   * const searchPlugin: AstropressPlugin = {
   *   name: "search-indexer",
   *   async onContentSave({ slug, status }) {
   *     if (status === "published") {
   *       await searchIndex.upsert(slug);
   *     }
   *   },
   * };
   *
   * registerCms({ ..., plugins: [searchPlugin] });
   * ```
   */
  plugins?: readonly AstropressPlugin[];
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

/**
 * Dispatch a content lifecycle event to all registered plugin hooks.
 *
 * Called internally after content saves and publishes. Errors thrown by
 * individual plugin hooks are caught and logged; they never fail the action.
 */
export async function dispatchPluginContentEvent(
  hook: "onContentSave" | "onContentPublish",
  event: AstropressContentEvent,
): Promise<void> {
  const config = peekCmsConfig();
  if (!config?.plugins?.length) return;
  for (const plugin of config.plugins) {
    const fn = plugin[hook];
    if (typeof fn !== "function") continue;
    try {
      await fn(event);
    } catch (err) {
      // Plugin errors must not propagate — they would fail the admin action.
      // biome-ignore lint/suspicious/noConsole: server-side plugin error logging
      console.error(`[astropress] Plugin "${plugin.name}" threw in ${hook}:`, err);
    }
  }
}

/**
 * Dispatch a media upload event to all registered plugin hooks.
 *
 * Called internally after a media asset is successfully stored. Errors thrown by
 * individual plugin hooks are caught and logged; they never fail the upload action.
 */
export async function dispatchPluginMediaEvent(event: AstropressMediaEvent): Promise<void> {
  const config = peekCmsConfig();
  if (!config?.plugins?.length) return;
  for (const plugin of config.plugins) {
    const fn = plugin.onMediaUpload;
    if (typeof fn !== "function") continue;
    try {
      await fn(event);
    } catch (err) {
      // Plugin errors must not propagate — they would fail the upload action.
      // biome-ignore lint/suspicious/noConsole: server-side plugin error logging
      console.error(`[astropress] Plugin "${plugin.name}" threw in onMediaUpload:`, err);
    }
  }
}
