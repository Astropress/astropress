import { normalizePath } from "./admin-normalizers";
import { getCloudflareBindings } from "./runtime-env";
import {
	parseSettings,
	type RuntimeStructuredPageRouteRecord,
	withSafeRouteRegistryFallback,
} from "./runtime-route-registry-dispatch";
// Shared with the local sqlite row mapper — a single fail-open definition so the
// two structured-page mappers can't drift (see sqlite-runtime/utils).
import { normalizeStructuredTemplateKey } from "./sqlite-runtime/utils";

// ─── Mutations — extracted to runtime-route-registry-pages-mutations.ts ──────
export {
	createRuntimeStructuredPageRoute,
	saveRuntimeStructuredPageRoute,
} from "./runtime-route-registry-pages-mutations";

function mapStructuredPageRow(
	row:
		| {
				path: string;
				status?: string | null;
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
): RuntimeStructuredPageRouteRecord | null {
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
		// cms_route_variants.status is TEXT NOT NULL (schema-enforced) — the
		// nullish fallback only exists to satisfy the shared row type's
		// optional `status?: string | null`, never to handle a real null.
		/* v8 ignore next */
		status: row.status ?? undefined,
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

export async function listRuntimeStructuredPageRoutes(locals?: App.Locals | null) {
	const db = getCloudflareBindings(locals).DB;
	// No `db` fast-path: withSafeRouteRegistryFallback runs the operation, and a
	// missing binding makes `db!.prepare` throw, which the wrapper catches and
	// resolves through the same local-registry fallback — an identical result.
	return withSafeRouteRegistryFallback(
		(local) => local.listStructuredPageRoutes(),
		[],
		async () => {
			const rows = (
				await db!
					.prepare(
						`
              SELECT v.path, v.status, v.title, v.summary, v.seo_title, v.meta_description, v.canonical_url_override, v.robots_directive,
                     v.og_image, v.sections_json, v.settings_json, v.updated_at
              FROM cms_route_variants v
              INNER JOIN cms_route_groups g ON g.id = v.group_id
              WHERE g.kind = 'page' AND g.render_strategy = 'structured_sections'
              ORDER BY v.path ASC
            `,
					)
					.all<{
						path: string;
						status: string | null;
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

			return rows
				.map((row) => mapStructuredPageRow(row))
				.filter((route): route is RuntimeStructuredPageRouteRecord => route !== null);
		},
	);
}

export async function getRuntimeStructuredPageRoute(pathname: string, locals?: App.Locals | null) {
	const normalizedPath = normalizePath(pathname);
	const db = getCloudflareBindings(locals).DB;
	// See listRuntimeStructuredPageRoutes: no `db` fast-path — a missing binding
	// throws inside the operation and the wrapper falls back to the local registry.
	return withSafeRouteRegistryFallback(
		(local) => local.getStructuredPageRoute(normalizedPath),
		null,
		async () => {
			const row = await db!
				.prepare(
					`
            SELECT v.path, v.status, v.title, v.summary, v.seo_title, v.meta_description, v.canonical_url_override, v.robots_directive,
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
					status: string | null;
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
