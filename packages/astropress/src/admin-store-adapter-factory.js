export function createAstropressAdminStoreAdapter(backend, modules) {
  return {
    backend,
    ...modules,
  };
}
