import type { Actor } from "./persistence-types";
import type {
	RuntimeArchiveRouteRecord,
	RuntimeStructuredPageRouteRecord,
	RuntimeSystemRouteRecord,
} from "./runtime-route-registry";

interface RouteActor extends Actor {}

export interface AstropressCmsRouteRegistryFactoryInput {
	normalizePath(pathname: string): string;
	localeFromPath(pathname: string): string;
	listSystemRoutes(): RuntimeSystemRouteRecord[];
	getSystemRoute(pathname: string): RuntimeSystemRouteRecord | null;
	listStructuredPageRoutes(): RuntimeStructuredPageRouteRecord[];
	getStructuredPageRoute(
		pathname: string,
	): RuntimeStructuredPageRouteRecord | null;
	getArchiveRoute(pathname: string): RuntimeArchiveRouteRecord | null;
	listArchiveRoutes(): RuntimeArchiveRouteRecord[];
	findSystemRouteForUpdate(
		pathname: string,
	):
		| { id: string; renderStrategy: RuntimeSystemRouteRecord["renderStrategy"] }
		| null
		| undefined;
	persistSystemRoute(input: {
		routeId: string;
		title: string;
		summary: string | null;
		bodyHtml: string | null;
		settingsJson: string | null;
		actor: RouteActor;
	}): void;
	appendSystemRouteRevision(input: {
		routeId: string;
		pathname: string;
		locale: string;
		title: string;
		summary: string | null;
		bodyHtml: string | null;
		settings: Record<string, unknown> | null | undefined;
		renderStrategy: RuntimeSystemRouteRecord["renderStrategy"];
		revisionNote: string | null;
		actor: RouteActor;
	}): void;
	isRoutePathTaken(pathname: string): boolean;
	findStructuredRouteForUpdate(
		pathname: string,
	): { id: string } | null | undefined;
	insertStructuredRoute(input: {
		pathname: string;
		locale: string;
		title: string;
		summary: string | null;
		seoTitle: string;
		metaDescription: string;
		canonicalUrlOverride: string | null;
		robotsDirective: string | null;
		ogImage: string | null;
		templateKey: string;
		alternateLinks: Array<{ hreflang: string; href: string }>;
		sections: Record<string, unknown> | null | undefined;
		actor: RouteActor;
	}): void;
	persistStructuredRoute(input: {
		routeId: string;
		pathname: string;
		title: string;
		summary: string | null;
		seoTitle: string;
		metaDescription: string;
		canonicalUrlOverride: string | null;
		robotsDirective: string | null;
		ogImage: string | null;
		templateKey: string;
		alternateLinks: Array<{ hreflang: string; href: string }>;
		sections: Record<string, unknown> | null | undefined;
		actor: RouteActor;
	}): void;
	appendStructuredRouteRevision(input: {
		routeId: string;
		pathname: string;
		locale: string;
		title: string;
		summary: string | null;
		seoTitle: string;
		metaDescription: string;
		canonicalUrlOverride: string | null;
		robotsDirective: string | null;
		ogImage: string | null;
		templateKey: string;
		alternateLinks: Array<{ hreflang: string; href: string }>;
		sections: Record<string, unknown> | null | undefined;
		revisionNote: string | null;
		actor: RouteActor;
	}): void;
	findArchiveRouteForUpdate(
		pathname: string,
	): { id: string } | null | undefined;
	persistArchiveRoute(input: {
		routeId: string;
		pathname: string;
		title: string;
		summary: string | null;
		seoTitle: string;
		metaDescription: string;
		canonicalUrlOverride: string | null;
		robotsDirective: string | null;
		actor: RouteActor;
	}): void;
	appendArchiveRouteRevision(input: {
		routeId: string;
		pathname: string;
		title: string;
		summary: string | null;
		seoTitle: string;
		metaDescription: string;
		canonicalUrlOverride: string | null;
		robotsDirective: string | null;
		revisionNote: string | null;
		actor: RouteActor;
	}): void;
	recordRouteAudit(input: {
		actor: RouteActor;
		action:
			| "system.update"
			| "route_page.create"
			| "route_page.update"
			| "archive.update";
		summary: string;
		targetId: string;
	}): void;
}
