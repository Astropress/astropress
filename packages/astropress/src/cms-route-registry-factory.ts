import {
	type ArchiveRouteInput,
	type AstropressCmsRouteRegistryFactoryInput,
	type StructuredPageInput,
	doCreateStructuredPageRoute,
	doSaveArchiveRoute,
	doSaveStructuredPageRoute,
	doSaveSystemRoute,
} from "./cms-route-registry-helpers";
import type { Actor } from "./persistence-types";

export type { AstropressCmsRouteRegistryFactoryInput };

interface RouteActor extends Actor {}

export function createAstropressCmsRouteRegistry(
	input: AstropressCmsRouteRegistryFactoryInput,
) {
	return {
		listSystemRoutes: (...args: []) => input.listSystemRoutes(...args),
		getSystemRoute: (pathname: string) =>
			input.getSystemRoute(input.normalizePath(pathname)),
		saveSystemRoute: (
			pathname: string,
			rawInput: Parameters<typeof doSaveSystemRoute>[2],
			actor: RouteActor,
		) => doSaveSystemRoute(input, pathname, rawInput, actor),
		listStructuredPageRoutes: (...args: []) =>
			input.listStructuredPageRoutes(...args),
		getStructuredPageRoute: (pathname: string) =>
			input.getStructuredPageRoute(input.normalizePath(pathname)),
		createStructuredPageRoute: (
			pathname: string,
			rawInput: StructuredPageInput,
			actor: RouteActor,
		) => doCreateStructuredPageRoute(input, pathname, rawInput, actor),
		saveStructuredPageRoute: (
			pathname: string,
			rawInput: StructuredPageInput,
			actor: RouteActor,
		) => doSaveStructuredPageRoute(input, pathname, rawInput, actor),
		getArchiveRoute: (pathname: string) =>
			input.getArchiveRoute(input.normalizePath(pathname)),
		listArchiveRoutes: (...args: []) => input.listArchiveRoutes(...args),
		saveArchiveRoute: (
			pathname: string,
			rawInput: ArchiveRouteInput,
			actor: RouteActor,
		) => doSaveArchiveRoute(input, pathname, rawInput, actor),
	};
}
