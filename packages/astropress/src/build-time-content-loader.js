/**
 * Create build-time content collection loaders for a given provider adapter.
 *
 * Each loader calls ContentStore.list with status "published" so that draft
 * content is never included in the static production build.
 */
export function createAstropressBuildTimeLoader(provider, options = {}) {
  function makeLoader(kind) {
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
