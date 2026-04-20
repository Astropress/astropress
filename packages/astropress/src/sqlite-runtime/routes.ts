import { createAstropressCmsRouteRegistry } from "../cms-route-registry-factory";
import { createAstropressCmsRegistryModule } from "../host-runtime-factories";
import type { Actor } from "../persistence-types";
import { recordAudit } from "./audit-log";
import {
	type AppendArchiveRevisionInput,
	type AppendStructuredRevisionInput,
	type ArchiveRouteRow,
	type InsertStructuredInput,
	type PersistArchiveInput,
	type PersistStructuredInput,
	SQL_FIND_ARCHIVE_FOR_UPDATE,
	SQL_FIND_STRUCTURED_FOR_UPDATE,
	SQL_FIND_SYSTEM_FOR_UPDATE,
	SQL_GET_ARCHIVE,
	SQL_INSERT_ARCHIVE_REVISION,
	SQL_INSERT_REVISION,
	SQL_INSERT_ROUTE_GROUP,
	SQL_INSERT_ROUTE_VARIANT,
	SQL_IS_PATH_TAKEN,
	SQL_LIST_ARCHIVES,
	SQL_LIST_STRUCTURED,
	SQL_LIST_SYSTEM,
	SQL_PERSIST_ARCHIVE,
	SQL_PERSIST_STRUCTURED,
	SQL_PERSIST_SYSTEM,
	type StructuredPageRow,
	type SystemRouteRecord,
	type SystemRouteRow,
	mapArchiveRow,
	mapStructuredPageRow,
} from "./routes-helpers";
import {
	type AstropressSqliteDatabaseLike,
	localeFromPath,
	normalizeSystemRoutePath,
	parseSystemSettings,
} from "./utils";

function querySystemRoutes(
	getDb: () => AstropressSqliteDatabaseLike,
): SystemRouteRecord[] {
	const rows = getDb().prepare(SQL_LIST_SYSTEM).all() as SystemRouteRow[];
	return rows.map((row) => ({
		path: row.path,
		title: row.title,
		summary: row.summary ?? undefined,
		bodyHtml: row.body_html ?? undefined,
		settings: parseSystemSettings(row.settings_json),
		updatedAt: row.updated_at ?? undefined,
		renderStrategy: row.render_strategy,
	}));
}

function queryStructuredPageRoutes(getDb: () => AstropressSqliteDatabaseLike) {
	const rows = getDb()
		.prepare(SQL_LIST_STRUCTURED)
		.all() as StructuredPageRow[];
	return rows.map(mapStructuredPageRow).filter(Boolean) as ReturnType<
		typeof mapStructuredPageRow
	>[];
}

export function createSqliteRoutesStore(
	getDb: () => AstropressSqliteDatabaseLike,
	randomId: () => string,
) {
	function listSystemRoutes() {
		return querySystemRoutes(getDb);
	}

	function getSystemRoute(pathname: string) {
		const normalizedPath = normalizeSystemRoutePath(pathname);
		return (
			listSystemRoutes().find((route) => route.path === normalizedPath) ?? null
		);
	}

	function listStructuredPageRoutes() {
		return queryStructuredPageRoutes(getDb).filter(
			(r): r is NonNullable<typeof r> => r !== null,
		);
	}

	function getStructuredPageRoute(pathname: string) {
		const normalizedPath = normalizeSystemRoutePath(pathname);
		return (
			listStructuredPageRoutes().find(
				(route) => route.path === normalizedPath,
			) ?? null
		);
	}

	function getArchiveRoute(pathname: string) {
		const normalizedPath = normalizeSystemRoutePath(pathname);
		const row = getDb().prepare(SQL_GET_ARCHIVE).get(normalizedPath) as
			| ArchiveRouteRow
			| undefined;
		if (!row) return null;
		return mapArchiveRow(row);
	}

	function listArchiveRoutes() {
		const rows = getDb().prepare(SQL_LIST_ARCHIVES).all() as ArchiveRouteRow[];
		return rows.map(mapArchiveRow);
	}

	const sqliteCmsRouteRegistry = createAstropressCmsRouteRegistry({
		normalizePath: normalizeSystemRoutePath,
		localeFromPath,
		listSystemRoutes,
		getSystemRoute,
		listStructuredPageRoutes,
		getStructuredPageRoute,
		getArchiveRoute,
		listArchiveRoutes,
		findSystemRouteForUpdate(pathname) {
			const row = getDb().prepare(SQL_FIND_SYSTEM_FOR_UPDATE).get(pathname) as
				| { id: string; render_strategy: SystemRouteRecord["renderStrategy"] }
				| undefined;
			return row ? { id: row.id, renderStrategy: row.render_strategy } : null;
		},
		persistSystemRoute({
			routeId,
			title,
			summary,
			bodyHtml,
			settingsJson,
			actor,
		}: {
			routeId: string;
			title: string;
			summary: string;
			bodyHtml: string;
			settingsJson: string;
			actor: Actor;
		}) {
			getDb()
				.prepare(SQL_PERSIST_SYSTEM)
				.run(
					title,
					summary,
					bodyHtml,
					settingsJson,
					title,
					summary ?? title,
					actor.email,
					routeId,
				);
		},
		appendSystemRouteRevision({
			routeId,
			pathname,
			locale,
			title,
			summary,
			bodyHtml,
			settings,
			renderStrategy,
			revisionNote,
			actor,
		}: {
			routeId: string;
			pathname: string;
			locale: string;
			title: string;
			summary: string;
			bodyHtml: string;
			settings: Record<string, unknown> | null;
			renderStrategy: string;
			revisionNote: string;
			actor: Actor;
		}) {
			getDb()
				.prepare(SQL_INSERT_REVISION)
				.run(
					`revision:${routeId}:${randomId()}`,
					routeId,
					pathname,
					locale,
					JSON.stringify({
						path: pathname,
						title,
						summary,
						bodyHtml,
						settings: settings ?? null,
						renderStrategy,
					}),
					revisionNote,
					actor.email,
				);
		},
		isRoutePathTaken(pathname) {
			return Boolean(getDb().prepare(SQL_IS_PATH_TAKEN).get(pathname));
		},
		findStructuredRouteForUpdate(pathname) {
			return (
				(getDb().prepare(SQL_FIND_STRUCTURED_FOR_UPDATE).get(pathname) as
					| { id: string }
					| undefined) ?? null
			);
		},
		insertStructuredRoute({
			pathname,
			locale,
			title,
			summary,
			seoTitle,
			metaDescription,
			canonicalUrlOverride,
			robotsDirective,
			ogImage,
			templateKey,
			alternateLinks,
			sections,
			actor,
		}: InsertStructuredInput) {
			const groupId = `route-group:${randomId()}`;
			const variantId = `route-variant:${randomId()}`;
			getDb().prepare(SQL_INSERT_ROUTE_GROUP).run(groupId, locale, pathname);
			getDb()
				.prepare(SQL_INSERT_ROUTE_VARIANT)
				.run(
					variantId,
					groupId,
					locale,
					pathname,
					title,
					summary,
					sections ? JSON.stringify(sections) : null,
					JSON.stringify({ templateKey, alternateLinks }),
					seoTitle,
					metaDescription,
					ogImage,
					canonicalUrlOverride,
					robotsDirective,
					actor.email,
				);
		},
		persistStructuredRoute({
			routeId,
			title,
			summary,
			seoTitle,
			metaDescription,
			canonicalUrlOverride,
			robotsDirective,
			ogImage,
			templateKey,
			alternateLinks,
			sections,
			actor,
		}: PersistStructuredInput) {
			getDb()
				.prepare(SQL_PERSIST_STRUCTURED)
				.run(
					title,
					summary,
					seoTitle,
					metaDescription,
					canonicalUrlOverride,
					robotsDirective,
					ogImage,
					sections ? JSON.stringify(sections) : null,
					JSON.stringify({ templateKey, alternateLinks }),
					actor.email,
					routeId,
				);
		},
		appendStructuredRouteRevision({
			routeId,
			pathname,
			locale,
			title,
			summary,
			seoTitle,
			metaDescription,
			canonicalUrlOverride,
			robotsDirective,
			ogImage,
			templateKey,
			alternateLinks,
			sections,
			revisionNote,
			actor,
		}: AppendStructuredRevisionInput) {
			getDb()
				.prepare(SQL_INSERT_REVISION)
				.run(
					`revision:${routeId}:${randomId()}`,
					routeId,
					pathname,
					locale,
					JSON.stringify({
						path: pathname,
						title,
						summary,
						seoTitle,
						metaDescription,
						canonicalUrlOverride,
						robotsDirective,
						ogImage,
						templateKey,
						alternateLinks,
						sections,
					}),
					revisionNote,
					actor.email,
				);
		},
		findArchiveRouteForUpdate(pathname) {
			return (
				(getDb().prepare(SQL_FIND_ARCHIVE_FOR_UPDATE).get(pathname) as
					| { id: string }
					| undefined) ?? null
			);
		},
		persistArchiveRoute({
			routeId,
			title,
			summary,
			seoTitle,
			metaDescription,
			canonicalUrlOverride,
			robotsDirective,
			actor,
		}: PersistArchiveInput) {
			getDb()
				.prepare(SQL_PERSIST_ARCHIVE)
				.run(
					title,
					summary,
					seoTitle,
					metaDescription,
					canonicalUrlOverride,
					robotsDirective,
					actor.email,
					routeId,
				);
		},
		appendArchiveRouteRevision({
			routeId,
			pathname,
			title,
			summary,
			seoTitle,
			metaDescription,
			canonicalUrlOverride,
			robotsDirective,
			revisionNote,
			actor,
		}: AppendArchiveRevisionInput) {
			getDb()
				.prepare(SQL_INSERT_ARCHIVE_REVISION)
				.run(
					`revision:${routeId}:${randomId()}`,
					routeId,
					pathname,
					JSON.stringify({
						path: pathname,
						title,
						summary,
						seoTitle,
						metaDescription,
						canonicalUrlOverride,
						robotsDirective,
					}),
					revisionNote,
					actor.email,
				);
		},
		recordRouteAudit({
			actor,
			action,
			summary,
			targetId,
		}: { actor: Actor; action: string; summary: string; targetId: string }) {
			recordAudit(getDb(), actor, action, summary, "content", targetId);
		},
	});

	const sqliteCmsRegistryModule = createAstropressCmsRegistryModule({
		listSystemRoutes: sqliteCmsRouteRegistry.listSystemRoutes,
		getSystemRoute: sqliteCmsRouteRegistry.getSystemRoute,
		saveSystemRoute: sqliteCmsRouteRegistry.saveSystemRoute,
		listStructuredPageRoutes: sqliteCmsRouteRegistry.listStructuredPageRoutes,
		getStructuredPageRoute: sqliteCmsRouteRegistry.getStructuredPageRoute,
		saveStructuredPageRoute: sqliteCmsRouteRegistry.saveStructuredPageRoute,
		createStructuredPageRoute: sqliteCmsRouteRegistry.createStructuredPageRoute,
		getArchiveRoute: sqliteCmsRouteRegistry.getArchiveRoute,
		listArchiveRoutes: sqliteCmsRouteRegistry.listArchiveRoutes,
		saveArchiveRoute: sqliteCmsRouteRegistry.saveArchiveRoute,
	});

	return { sqliteCmsRouteRegistry, sqliteCmsRegistryModule };
}
