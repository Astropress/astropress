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

  /**
   * Additional admin routes to inject into the Astro app.
   * Useful for plugin-owned admin pages (e.g. a custom search UI or store manager).
   *
   * Each route follows the same shape as Astro's `injectRoute` — `pattern` is the
   * URL pattern (e.g. `"/ap-admin/my-plugin"`) and `entrypoint` is a file path or
   * package-relative path to the Astro / TypeScript page file.
   *
   * @example
   * ```ts
   * const myPlugin: AstropressPlugin = {
   *   name: "my-plugin",
   *   adminRoutes: [
   *     { pattern: "/ap-admin/my-plugin", entrypoint: "./src/pages/my-plugin-admin.astro" },
   *   ],
   * };
   * ```
   */
  adminRoutes?: ReadonlyArray<{
    /** URL pattern for the admin route (e.g. "/ap-admin/my-plugin"). */
    pattern: string;
    /** File path or package-relative entrypoint for the page. */
    entrypoint: string;
  }>;
}
