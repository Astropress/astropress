import { normalizePath } from "./admin-normalizers";
import { recordD1Audit } from "./d1-audit";
import type { D1DatabaseLike } from "./d1-database";
import { getCloudflareBindings } from "./runtime-env";
import {
	type RuntimeArchiveRouteRecord,
	loadSafeLocalCmsRegistry,
	withSafeRouteRegistryFallback,
} from "./runtime-route-registry-dispatch";

interface Actor {
	email: string;
	role: "admin" | "editor";
	name: string;
}

export async function getRuntimeArchiveRoute(
	pathname: string,
	locals?: App.Locals | null,
) {
	const normalizedPath = normalizePath(pathname);
	const db = getCloudflareBindings(locals).DB;
	if (!db) {
		const local = await loadSafeLocalCmsRegistry();
		return local ? local.getArchiveRoute(normalizedPath) : null;
	}

	return withSafeRouteRegistryFallback(
		(local) => local.getArchiveRoute(normalizedPath),
		null,
		async () => {
			const row = await db
				.prepare(
					`
            SELECT v.path, v.title, v.summary, v.seo_title, v.meta_description, v.canonical_url_override, v.robots_directive, v.updated_at
            FROM cms_route_variants v
            INNER JOIN cms_route_groups g ON g.id = v.group_id
            WHERE g.kind = 'archive' AND v.path = ?
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
					updated_at: string;
				}>();

			if (!row) {
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
				updatedAt: row.updated_at,
			} satisfies RuntimeArchiveRouteRecord;
		},
	);
}

function validateArchiveRouteInput(input: {
	title: string;
	summary?: string;
	seoTitle?: string;
	metaDescription?: string;
	canonicalUrlOverride?: string;
	robotsDirective?: string;
}) {
	const title = input.title.trim();
	if (!title) {
		return { ok: false as const, error: "A title is required." } as const;
	}

	const summary = input.summary?.trim() || null;
	const seoTitle = input.seoTitle?.trim() || title;
	const metaDescription = input.metaDescription?.trim() || summary || "";
	const canonicalUrlOverride = input.canonicalUrlOverride?.trim() || null;
	const robotsDirective = input.robotsDirective?.trim() || null;

	return {
		ok: true as const,
		title,
		summary,
		seoTitle,
		metaDescription,
		canonicalUrlOverride,
		robotsDirective,
	};
}

async function persistArchiveRouteChanges(
	db: D1DatabaseLike,
	routeId: string,
	normalizedPath: string,
	validated: {
		title: string;
		summary: string | null;
		seoTitle: string;
		metaDescription: string;
		canonicalUrlOverride: string | null;
		robotsDirective: string | null;
	},
	revisionNote: string | undefined,
	actor: Actor,
	locals: App.Locals | null | undefined,
) {
	await db
		.prepare(
			`
        UPDATE cms_route_variants
        SET title = ?, summary = ?, seo_title = ?, meta_description = ?, canonical_url_override = ?, robots_directive = ?,
            updated_at = CURRENT_TIMESTAMP, updated_by = ?
        WHERE id = ?
      `,
		)
		.bind(
			validated.title,
			validated.summary,
			validated.seoTitle,
			validated.metaDescription,
			validated.canonicalUrlOverride,
			validated.robotsDirective,
			actor.email,
			routeId,
		)
		.run();

	await db
		.prepare(
			`
        INSERT INTO cms_route_revisions (id, variant_id, route_path, locale, snapshot_json, revision_note, created_by)
        VALUES (?, ?, ?, 'en', ?, ?, ?)
      `,
		)
		.bind(
			`revision:${routeId}:${crypto.randomUUID()}`,
			routeId,
			normalizedPath,
			JSON.stringify({
				path: normalizedPath,
				title: validated.title,
				summary: validated.summary,
				seoTitle: validated.seoTitle,
				metaDescription: validated.metaDescription,
				canonicalUrlOverride: validated.canonicalUrlOverride,
				robotsDirective: validated.robotsDirective,
			}),
			revisionNote?.trim() || null,
			actor.email,
		)
		.run();

	await recordD1Audit(
		locals,
		actor,
		"archive.update",
		"content",
		normalizedPath,
		`Updated archive route ${normalizedPath}.`,
	);

	return {
		ok: true as const,
		route: {
			path: normalizedPath,
			title: validated.title,
			summary: validated.summary ?? undefined,
			seoTitle: validated.seoTitle,
			metaDescription: validated.metaDescription,
			canonicalUrlOverride: validated.canonicalUrlOverride ?? undefined,
			robotsDirective: validated.robotsDirective ?? undefined,
		} satisfies RuntimeArchiveRouteRecord,
	};
}

export async function saveRuntimeArchiveRoute(
	pathname: string,
	input: {
		title: string;
		summary?: string;
		seoTitle?: string;
		metaDescription?: string;
		canonicalUrlOverride?: string;
		robotsDirective?: string;
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
		return local.saveArchiveRoute(normalizedPath, input, actor);
	}

	const route = await db
		.prepare(
			`
        SELECT v.id
        FROM cms_route_variants v
        INNER JOIN cms_route_groups g ON g.id = v.group_id
        WHERE g.kind = 'archive' AND v.path = ?
        LIMIT 1
      `,
		)
		.bind(normalizedPath)
		.first<{ id: string }>();

	if (!route) {
		return {
			ok: false as const,
			error: "The selected archive route could not be found.",
		};
	}

	const validated = validateArchiveRouteInput(input);
	if (!validated.ok) {
		return validated;
	}

	return persistArchiveRouteChanges(
		db,
		route.id,
		normalizedPath,
		validated,
		input.revisionNote,
		actor,
		locals,
	);
}
