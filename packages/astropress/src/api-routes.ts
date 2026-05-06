import { type AstropressApiRouteDefinition, apiRouteDefinitions } from "./api-routes-data";

export {
	type AstropressApiRouteDefinition,
	apiRouteDefinitions,
} from "./api-routes-data";

export type AstropressApiRouteInjector = (route: AstropressApiRouteDefinition) => void;

export function injectApiRoutes(injector: AstropressApiRouteInjector) {
	for (const route of apiRouteDefinitions) {
		injector(route);
	}
}
