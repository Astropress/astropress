import { normalizePath } from "./admin-normalizers";
import { recordD1Audit } from "./d1-audit";
import type { D1DatabaseLike } from "./d1-database";
import { getCloudflareBindings } from "./runtime-env";
import {
	type RuntimeSystemRouteRecord,
	loadSafeLocalCmsRegistry,
	localeFromPath,
	parseSettings,
	withSafeRouteRegistryFallback,
} from "./runtime-route-registry-dispatch";

interface Actor {
	email: string;
	role: "admin" | "editor";
	name: string;
}

function mapSystemRow(
	row:
		| {
				path: string;
				title: string;
				summary: string | null;
				body_html: string | null;
				settings_json: string | null;
				updated_at: string;
				render_strategy: RuntimeSystemRouteRecord["renderStrategy"];
		  }
		| null
		| undefined,
): RuntimeSystemRouteRecord | null {
	if (!row) {
		return null;
	}

	return {
		path: row.path,
		title: row.title,
		summary: row.summary ?? undefined,
		bodyHtml: row.body_html ?? undefined,
		settings: parseSettings(row.settings_json),
		updatedAt: row.updated_at,
		renderStrategy: row.render_strategy,
	};
}

export async function listRuntimeSystemRoutes(locals?: App.Locals | null) {
	const db = getCloudflareBindings(locals).DB;
	if (!db) {
		const local = await loadSafeLocalCmsRegistry();
		/* v8 ignore next 2 */
		return local ? local.listSystemRoutes() : [];
	}

	return withSafeRouteRegistryFallback(
		(local) => local.listSystemRoutes(),
		[],
		async () => {
			const rows = (
				await db
					.prepare(
						`
              SELECT v.path, v.title, v.summary, v.body_html, v.settings_json, v.updated_at, g.render_strategy
              FROM cms_route_variants v
              INNER JOIN cms_route_groups g ON g.id = v.group_id
              WHERE g.kind = 'system'
              ORDER BY v.path ASC
            `,
					)
					.all<{
						path: string;
						title: string;
						summary: string | null;
						body_html: string | null;
						settings_json: string | null;
						updated_at: string;
						render_strategy: RuntimeSystemRouteRecord["renderStrategy"];
					}>()
			).results;

			return rows.map((row) => mapSystemRow(row)).filter(Boolean);
		},
	);
}

export async function getRuntimeSystemRoute(
	pathname: string,
	locals?: App.Locals | null,
) {
	const normalizedPath = normalizePath(pathname);
	const db = getCloudflareBindings(locals).DB;
	if (!db) {
		const local = await loadSafeLocalCmsRegistry();
		/* v8 ignore next 2 */
		return local ? local.getSystemRoute(normalizedPath) : null;
	}

	return withSafeRouteRegistryFallback(
		(local) => local.getSystemRoute(normalizedPath),
		null,
		async () => {
			const row = await db
				.prepare(
					`
            SELECT v.path, v.title, v.summary, v.body_html, v.settings_json, v.updated_at, g.render_strategy
            FROM cms_route_variants v
            INNER JOIN cms_route_groups g ON g.id = v.group_id
            WHERE g.kind = 'system' AND v.path = ?
            LIMIT 1
          `,
				)
				.bind(normalizedPath)
				.first<{
					path: string;
					title: string;
					summary: string | null;
					body_html: string | null;
					settings_json: string | null;
					updated_at: string;
					render_strategy: RuntimeSystemRouteRecord["renderStrategy"];
				}>();

			return mapSystemRow(row);
		},
	);
}

function validateSystemRouteInput(input: {
	title: string;
	summary?: string;
	bodyHtml?: string;
	settings?: Record<string, unknown> | null;
}) {
	const title = input.title.trim();
	if (!title) {
		return { ok: false as const, error: "A title is required." } as const;
	}

	const summary = input.summary?.trim() || null;
	const bodyHtml = input.bodyHtml?.trim() || null;
	const settingsJson = input.settings ? JSON.stringify(input.settings) : null;

	return { ok: true as const, title, summary, bodyHtml, settingsJson };
}

function buildSystemRouteSnapshot(
	normalizedPath: string,
	validated: { title: string; summary: string | null; bodyHtml: string | null },
	settings: Record<string, unknown> | null | undefined,
	renderStrategy: RuntimeSystemRouteRecord["renderStrategy"],
) {
	return JSON.stringify({
		path: normalizedPath,
		title: validated.title,
		summary: validated.summary,
		bodyHtml: validated.bodyHtml,
		settings: settings ?? null,
		renderStrategy,
	});
}

function buildSystemRouteResult(
	normalizedPath: string,
	validated: { title: string; summary: string | null; bodyHtml: string | null },
	settings: Record<string, unknown> | null | undefined,
	renderStrategy: RuntimeSystemRouteRecord["renderStrategy"],
) {
	return {
		ok: true as const,
		route: {
			path: normalizedPath,
			title: validated.title,
			summary: validated.summary ?? undefined,
			bodyHtml: validated.bodyHtml ?? undefined,
			settings: settings ?? null,
			renderStrategy,
		} satisfies RuntimeSystemRouteRecord,
	};
}

const UPDATE_SYSTEM_VARIANT_SQL = `
  UPDATE cms_route_variants
  SET
    title = ?,
    summary = ?,
    body_html = ?,
    settings_json = ?,
    seo_title = ?,
    meta_description = ?,
    updated_at = CURRENT_TIMESTAMP,
    updated_by = ?
  WHERE id = ?
`;

const INSERT_SYSTEM_REVISION_SQL = `
  INSERT INTO cms_route_revisions (id, variant_id, route_path, locale, snapshot_json, revision_note, created_by)
  VALUES (?, ?, ?, ?, ?, ?, ?)
`;

async function persistSystemRouteChanges(
	db: D1DatabaseLike,
	routeId: string,
	renderStrategy: RuntimeSystemRouteRecord["renderStrategy"],
	normalizedPath: string,
	validated: {
		title: string;
		summary: string | null;
		bodyHtml: string | null;
		settingsJson: string | null;
	},
	settings: Record<string, unknown> | null | undefined,
	revisionNote: string | undefined,
	actor: Actor,
	locals: App.Locals | null | undefined,
) {
	const metaDescription = validated.summary ?? validated.title;
	await db
		.prepare(UPDATE_SYSTEM_VARIANT_SQL)
		.bind(
			validated.title,
			validated.summary,
			validated.bodyHtml,
			validated.settingsJson,
			validated.title,
			metaDescription,
			actor.email,
			routeId,
		)
		.run();

	await db
		.prepare(INSERT_SYSTEM_REVISION_SQL)
		.bind(
			`revision:${routeId}:${crypto.randomUUID()}`,
			routeId,
			normalizedPath,
			localeFromPath(normalizedPath),
			buildSystemRouteSnapshot(
				normalizedPath,
				validated,
				settings,
				renderStrategy,
			),
			revisionNote?.trim() || null,
			actor.email,
		)
		.run();

	await recordD1Audit(
		locals,
		actor,
		"system.update",
		"content",
		normalizedPath,
		`Updated system route ${normalizedPath}.`,
	);

	return buildSystemRouteResult(
		normalizedPath,
		validated,
		settings,
		renderStrategy,
	);
}

export async function saveRuntimeSystemRoute(
	pathname: string,
	input: {
		title: string;
		summary?: string;
		bodyHtml?: string;
		settings?: Record<string, unknown> | null;
		revisionNote?: string;
	},
	actor: Actor,
	locals?: App.Locals | null,
) {
	const normalizedPath = normalizePath(pathname);
	const db = getCloudflareBindings(locals).DB;
	if (!db) {
		const local = await loadSafeLocalCmsRegistry();
		if (!local) {
			return {
				ok: false as const,
				error: "The runtime content registry is unavailable.",
			};
		}
		/* v8 ignore next 2 */
		return local.saveSystemRoute(normalizedPath, input, actor);
	}

	const route = await db
		.prepare(
			`
        SELECT v.id, g.render_strategy
        FROM cms_route_variants v
        INNER JOIN cms_route_groups g ON g.id = v.group_id
        WHERE g.kind = 'system' AND v.path = ?
        LIMIT 1
      `,
		)
		.bind(normalizedPath)
		.first<{
			id: string;
			render_strategy: RuntimeSystemRouteRecord["renderStrategy"];
		}>();

	if (!route) {
		return {
			ok: false as const,
			error: "The selected system route could not be found.",
		};
	}

	const validated = validateSystemRouteInput(input);
	if (!validated.ok) {
		return validated;
	}

	return persistSystemRouteChanges(
		db,
		route.id,
		route.render_strategy,
		normalizedPath,
		validated,
		input.settings,
		input.revisionNote,
		actor,
		locals,
	);
}
