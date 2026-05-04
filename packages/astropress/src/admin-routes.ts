import { adminRouteDefinitions } from "./admin-routes-definitions";

export type AstropressAdminRouteKind = "page" | "action" | "endpoint";

export type AstropressAdminRouteDefinition = {
	pattern: string;
	entrypoint: string;
	kind: AstropressAdminRouteKind;
};

export type AstropressAdminRouteInjector = (
	route: AstropressAdminRouteDefinition,
) => void;

/**
 * The base URL path for all Astropress admin routes.
 *
 * @example
 * ```ts
 * import { ASTROPRESS_ADMIN_BASE_PATH } from "@astropress-diy/astropress";
 *
 * const adminUrl = `${siteUrl}${ASTROPRESS_ADMIN_BASE_PATH}`; // "https://example.com/ap-admin"
 * ```
 */
export const ASTROPRESS_ADMIN_BASE_PATH = "/ap-admin";

export function listAstropressAdminRoutes(): AstropressAdminRouteDefinition[] {
	return adminRouteDefinitions.map((route) => ({ ...route }));
}

export function resolveAstropressAdminRouteEntrypoints(basePath: string) {
	let end = basePath.length;
	while (end > 0 && basePath[end - 1] === "/") end--;
	const normalizedBasePath = basePath.slice(0, end);
	return listAstropressAdminRoutes().map((route) => ({
		...route,
		entrypoint: `${normalizedBasePath}/${route.entrypoint}`,
	}));
}

/**
 * Generate the list of admin route definitions with resolved entrypoints for
 * a given pages directory. Pass the result to your framework's route injector.
 *
 * @example
 * ```ts
 * import { createAstropressAdminRouteInjectionPlan } from "@astropress-diy/astropress";
 *
 * const routes = createAstropressAdminRouteInjectionPlan("src/pages");
 * for (const route of routes) {
 *   console.log(route.pattern, route.entrypoint);
 *   // e.g. "/ap-admin/posts" "src/pages/ap-admin/posts/index.astro"
 * }
 * ```
 */
export function createAstropressAdminRouteInjectionPlan(
	pagesDirectory: string,
) {
	return resolveAstropressAdminRouteEntrypoints(pagesDirectory);
}

export function injectAstropressAdminRoutes(
	pagesDirectory: string,
	injectRoute: AstropressAdminRouteInjector,
) {
	const plan = createAstropressAdminRouteInjectionPlan(pagesDirectory);
	for (const route of plan) {
		injectRoute(route);
	}
	return plan;
}
