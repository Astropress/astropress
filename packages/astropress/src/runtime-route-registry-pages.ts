import { normalizePath } from "./admin-normalizers";
import { getCmsConfig } from "./config";
import { getCloudflareBindings } from "./runtime-env";
import {
	type RuntimeStructuredPageRouteRecord,
	loadSafeLocalCmsRegistry,
	parseSettings,
	withSafeRouteRegistryFallback,
} from "./runtime-route-registry-dispatch";

// ─── Mutations — extracted to runtime-route-registry-pages-mutations.ts ──────
export {
	saveRuntimeStructuredPageRoute,
	createRuntimeStructuredPageRoute,
} from "./runtime-route-registry-pages-mutations";

function normalizeStructuredTemplateKey(value: unknown): string | null {
	if (typeof value !== "string" || !value) {
		return null;
	}
	return getCmsConfig().templateKeys.includes(value) ? value : null;
}

function mapStructuredPageRow(
	row:
		| {
				path: string;
				title: string;
				summary: string | null;
				seo_title: string | null;
				meta_description: string | null;
				canonical_url_override: string | null;
				robots_directive: string | null;
				og_image: string | null;
				sections_json: string | null;
				settings_json: string | null;
				updated_at: string;
		  }
		| null
		| undefined,
) {
	if (!row) {
		return null;
	}

	const settings = parseSettings(row.settings_json) ?? {};
	const templateKey = normalizeStructuredTemplateKey(settings.templateKey);
	if (!templateKey) {
		return null;
	}
	return {
		path: row.path,
		title: row.title,
		summary: row.summary ?? undefined,
		seoTitle: row.seo_title ?? undefined,
		metaDescription: row.meta_description ?? undefined,
		canonicalUrlOverride: row.canonical_url_override ?? undefined,
		robotsDirective: row.robots_directive ?? undefined,
		ogImage: row.og_image ?? undefined,
		templateKey,
		alternateLinks: Array.isArray(settings.alternateLinks)
			? (settings.alternateLinks as Array<{ hreflang: string; href: string }>)
			: [],
		sections: parseSettings(row.sections_json),
		updatedAt: row.updated_at,
	} satisfies RuntimeStructuredPageRouteRecord;
}

export async function listRuntimeStructuredPageRoutes(
	locals?: App.Locals | null,
) {
	const db = getCloudflareBindings(locals).DB;
	if (!db) {
		const local = await loadSafeLocalCmsRegistry();
		/* v8 ignore next 2 */
		return local ? local.listStructuredPageRoutes() : [];
	}

	return withSafeRouteRegistryFallback(
		(local) => local.listStructuredPageRoutes(),
		[],
		async () => {
			const rows = (
				await db
					.prepare(
						`
              SELECT v.path, v.title, v.summary, v.seo_title, v.meta_description, v.canonical_url_override, v.robots_directive,
                     v.og_image, v.sections_json, v.settings_json, v.updated_at
              FROM cms_route_variants v
              INNER JOIN cms_route_groups g ON g.id = v.group_id
              WHERE g.kind = 'page' AND g.render_strategy = 'structured_sections'
              ORDER BY v.path ASC
            `,
					)
					.all<{
						path: string;
						title: string;
						summary: string | null;
						seo_title: string | null;
						meta_description: string | null;
						canonical_url_override: string | null;
						robots_directive: string | null;
						og_image: string | null;
						sections_json: string | null;
						settings_json: string | null;
						updated_at: string;
					}>()
			).results;

			return rows.map((row) => mapStructuredPageRow(row)).filter(Boolean);
		},
	);
}

export async function getRuntimeStructuredPageRoute(
	pathname: string,
	locals?: App.Locals | null,
) {
	const normalizedPath = normalizePath(pathname);
	const db = getCloudflareBindings(locals).DB;
	/* v8 ignore start */
	if (!db) {
		const local = await loadSafeLocalCmsRegistry();
		return local ? local.getStructuredPageRoute(normalizedPath) : null;
	}
	/* v8 ignore stop */

	return withSafeRouteRegistryFallback(
		(local) => local.getStructuredPageRoute(normalizedPath),
		null,
		async () => {
			const row = await db
				.prepare(
					`
            SELECT v.path, v.title, v.summary, v.seo_title, v.meta_description, v.canonical_url_override, v.robots_directive,
                   v.og_image, v.sections_json, v.settings_json, v.updated_at
            FROM cms_route_variants v
            INNER JOIN cms_route_groups g ON g.id = v.group_id
            WHERE g.kind = 'page' AND g.render_strategy = 'structured_sections' AND v.path = ?
            LIMIT 1
          `,
				)
				.bind(normalizedPath)
				.first<{
					path: string;
					title: string;
					summary: string | null;
					seo_title: string | null;
					meta_description: string | null;
					canonical_url_override: string | null;
					robots_directive: string | null;
					og_image: string | null;
					sections_json: string | null;
					settings_json: string | null;
					updated_at: string;
				}>();

			return mapStructuredPageRow(row);
		},
	);
}
