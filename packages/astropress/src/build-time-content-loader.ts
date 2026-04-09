import type { AstropressPlatformAdapter } from "./platform-contracts";
import type { ContentStoreRecord, ReadableContentKind } from "./platform-contracts";

export interface AstropressBuildTimeLoaderOptions {
  /** Locale to filter content by. Defaults to all locales. */
  locale?: string;
}

/**
 * A lazy loader that fetches a collection of records from the provider at
 * build time and returns them for use in Astro content collections.
 */
export interface AstropressContentLoader {
  /**
   * Fetch all records of this kind from the provider.
   * By default, only "published" records are returned.
   */
  load(): Promise<ContentStoreRecord[]>;
  /** The content kind this loader targets. */
  readonly kind: ReadableContentKind;
}

/**
 * Create build-time content collection loaders for a given provider adapter.
 *
 * Each loader calls ContentStore.list with status "published" so that draft
 * content is never included in the static production build.
 *
 * @example
 * ```ts
 * // astro.config.mjs (public site project)
 * import { defineCollection } from "astro:content";
 * import { createAstropressBuildTimeLoader } from "astropress";
 * import { adapter } from "./src/astropress/local-runtime-modules";
 *
 * const loader = createAstropressBuildTimeLoader(adapter);
 *
 * export const collections = {
 *   posts: defineCollection({ loader: loader.posts() }),
 *   pages: defineCollection({ loader: loader.pages() }),
 * };
 * ```
 */
export function createAstropressBuildTimeLoader(
  provider: AstropressPlatformAdapter,
  options: AstropressBuildTimeLoaderOptions = {},
): {
  posts(): AstropressContentLoader;
  pages(): AstropressContentLoader;
} {
  function makeLoader(kind: "post" | "page"): AstropressContentLoader {
    return {
      kind,
      async load() {
        const records = await provider.content.list(kind, {
          status: "published",
          locale: options.locale,
        });
        return records;
      },
    };
  }

  return {
    posts: () => makeLoader("post"),
    pages: () => makeLoader("page"),
  };
}
