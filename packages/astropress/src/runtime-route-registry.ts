// Barrel re-export — see domain files for implementations:
//   runtime-route-registry-dispatch.ts  (shared types, loadSafeLocalCmsRegistry, withSafeRouteRegistryFallback)
//   runtime-route-registry-system.ts    (listRuntimeSystemRoutes, getRuntimeSystemRoute, saveRuntimeSystemRoute)
//   runtime-route-registry-pages.ts     (listRuntimeStructuredPageRoutes, getRuntimeStructuredPageRoute,
//                                         saveRuntimeStructuredPageRoute, createRuntimeStructuredPageRoute)
//   runtime-route-registry-archives.ts  (getRuntimeArchiveRoute, saveRuntimeArchiveRoute)
export type {
	RuntimeSystemRouteRecord,
	RuntimeArchiveRouteRecord,
	RuntimeStructuredPageRouteRecord,
} from "./runtime-route-registry-dispatch";
export * from "./runtime-route-registry-system";
export * from "./runtime-route-registry-pages";
export * from "./runtime-route-registry-archives";
