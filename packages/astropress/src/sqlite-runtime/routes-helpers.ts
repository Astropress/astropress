import type { Actor } from "../persistence-types";
import { normalizeStructuredTemplateKey, parseSystemSettings } from "./utils";

export interface SystemRouteRecord {
	path: string;
	title: string;
	summary?: string;
	bodyHtml?: string;
	renderStrategy: "structured_sections" | "generated_text" | "generated_xml";
	settings: Record<string, unknown> | null;
	updatedAt?: string;
}
export interface ArchiveRouteRecord {
	path: string;
	title: string;
	summary?: string;
	seoTitle?: string;
	metaDescription?: string;
	canonicalUrlOverride?: string;
	robotsDirective?: string;
	updatedAt?: string;
}
export interface StructuredPageRouteRecord {
	path: string;
	title: string;
	summary?: string;
	seoTitle?: string;
	metaDescription?: string;
	canonicalUrlOverride?: string;
	robotsDirective?: string;
	ogImage?: string;
	templateKey: string;
	alternateLinks: Array<{ hreflang: string; href: string }>;
	sections: Record<string, unknown> | null;
	updatedAt?: string;
}

export type SystemRouteRow = {
	path: string;
	title: string;
	summary: string | null;
	body_html: string | null;
	settings_json: string | null;
	updated_at: string | null;
	render_strategy: SystemRouteRecord["renderStrategy"];
};
export type ArchiveRouteRow = {
	path: string;
	title: string;
	summary: string | null;
	seo_title: string | null;
	meta_description: string | null;
	canonical_url_override: string | null;
	robots_directive: string | null;
	updated_at: string | null;
};
export type StructuredPageRow = {
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
	updated_at: string | null;
};

export const SQL_LIST_SYSTEM = `SELECT v.path, v.title, v.summary, v.body_html, v.settings_json, v.updated_at, g.render_strategy FROM cms_route_variants v INNER JOIN cms_route_groups g ON g.id = v.group_id WHERE g.kind = 'system' ORDER BY v.path ASC`;
export const SQL_LIST_STRUCTURED = `SELECT v.path, v.title, v.summary, v.seo_title, v.meta_description, v.canonical_url_override, v.robots_directive, v.og_image, v.sections_json, v.settings_json, v.updated_at FROM cms_route_variants v INNER JOIN cms_route_groups g ON g.id = v.group_id WHERE g.kind = 'page' AND g.render_strategy = 'structured_sections' ORDER BY v.path ASC`;
export const SQL_GET_ARCHIVE = `SELECT v.path, v.title, v.summary, v.seo_title, v.meta_description, v.canonical_url_override, v.robots_directive, v.updated_at FROM cms_route_variants v INNER JOIN cms_route_groups g ON g.id = v.group_id WHERE g.kind = 'archive' AND v.path = ? LIMIT 1`;
export const SQL_LIST_ARCHIVES = `SELECT v.path, v.title, v.summary, v.seo_title, v.meta_description, v.canonical_url_override, v.robots_directive, v.updated_at FROM cms_route_variants v INNER JOIN cms_route_groups g ON g.id = v.group_id WHERE g.kind = 'archive' ORDER BY v.path ASC`;
export const SQL_FIND_SYSTEM_FOR_UPDATE = `SELECT v.id, g.render_strategy FROM cms_route_variants v INNER JOIN cms_route_groups g ON g.id = v.group_id WHERE g.kind = 'system' AND v.path = ? LIMIT 1`;
export const SQL_PERSIST_SYSTEM =
	"UPDATE cms_route_variants SET title = ?, summary = ?, body_html = ?, settings_json = ?, seo_title = ?, meta_description = ?, updated_at = CURRENT_TIMESTAMP, updated_by = ? WHERE id = ?";
export const SQL_INSERT_REVISION =
	"INSERT INTO cms_route_revisions (id, variant_id, route_path, locale, snapshot_json, revision_note, created_by) VALUES (?, ?, ?, ?, ?, ?, ?)";
export const SQL_IS_PATH_TAKEN =
	"SELECT v.id FROM cms_route_variants v INNER JOIN cms_route_groups g ON g.id = v.group_id WHERE v.path = ? LIMIT 1";
export const SQL_FIND_STRUCTURED_FOR_UPDATE = `SELECT v.id FROM cms_route_variants v INNER JOIN cms_route_groups g ON g.id = v.group_id WHERE g.kind = 'page' AND g.render_strategy = 'structured_sections' AND v.path = ? LIMIT 1`;
export const SQL_INSERT_ROUTE_GROUP = `INSERT INTO cms_route_groups (id, kind, render_strategy, canonical_locale, canonical_path) VALUES (?, 'page', 'structured_sections', ?, ?)`;
export const SQL_INSERT_ROUTE_VARIANT = `INSERT INTO cms_route_variants (id, group_id, locale, path, status, title, summary, sections_json, settings_json, seo_title, meta_description, og_image, canonical_url_override, robots_directive, updated_by) VALUES (?, ?, ?, ?, 'published', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`;
export const SQL_PERSIST_STRUCTURED =
	"UPDATE cms_route_variants SET title = ?, summary = ?, seo_title = ?, meta_description = ?, canonical_url_override = ?, robots_directive = ?, og_image = ?, sections_json = ?, settings_json = ?, updated_at = CURRENT_TIMESTAMP, updated_by = ? WHERE id = ?";
export const SQL_FIND_ARCHIVE_FOR_UPDATE = `SELECT v.id FROM cms_route_variants v INNER JOIN cms_route_groups g ON g.id = v.group_id WHERE g.kind = 'archive' AND v.path = ? LIMIT 1`;
export const SQL_PERSIST_ARCHIVE =
	"UPDATE cms_route_variants SET title = ?, summary = ?, seo_title = ?, meta_description = ?, canonical_url_override = ?, robots_directive = ?, updated_at = CURRENT_TIMESTAMP, updated_by = ? WHERE id = ?";
export const SQL_INSERT_ARCHIVE_REVISION = `INSERT INTO cms_route_revisions (id, variant_id, route_path, locale, snapshot_json, revision_note, created_by) VALUES (?, ?, ?, 'en', ?, ?, ?)`;

export interface InsertStructuredInput {
	pathname: string;
	locale: string;
	title: string;
	summary: string;
	seoTitle: string;
	metaDescription: string;
	canonicalUrlOverride?: string;
	robotsDirective?: string;
	ogImage?: string;
	templateKey: string;
	alternateLinks: Array<{ hreflang: string; href: string }>;
	sections: Record<string, unknown> | null;
	actor: Actor;
}
export interface PersistStructuredInput {
	routeId: string;
	title: string;
	summary: string;
	seoTitle: string;
	metaDescription: string;
	canonicalUrlOverride?: string;
	robotsDirective?: string;
	ogImage?: string;
	templateKey: string;
	alternateLinks: Array<{ hreflang: string; href: string }>;
	sections: Record<string, unknown> | null;
	actor: Actor;
}
export interface AppendStructuredRevisionInput extends InsertStructuredInput {
	routeId: string;
	revisionNote: string;
}
export interface PersistArchiveInput {
	routeId: string;
	title: string;
	summary?: string;
	seoTitle?: string;
	metaDescription?: string;
	canonicalUrlOverride?: string;
	robotsDirective?: string;
	actor: Actor;
}
export interface AppendArchiveRevisionInput {
	routeId: string;
	pathname: string;
	title: string;
	summary?: string;
	seoTitle?: string;
	metaDescription?: string;
	canonicalUrlOverride?: string;
	robotsDirective?: string;
	revisionNote: string;
	actor: Actor;
}

export function mapArchiveRow(row: ArchiveRouteRow): ArchiveRouteRecord {
	return {
		path: row.path,
		title: row.title,
		summary: row.summary ?? undefined,
		seoTitle: row.seo_title ?? undefined,
		metaDescription: row.meta_description ?? undefined,
		canonicalUrlOverride: row.canonical_url_override ?? undefined,
		robotsDirective: row.robots_directive ?? undefined,
		updatedAt: row.updated_at ?? undefined,
	};
}

export function mapStructuredPageRow(
	row: StructuredPageRow,
): StructuredPageRouteRecord | null {
	const settings = parseSystemSettings(row.settings_json) ?? {};
	const templateKey = normalizeStructuredTemplateKey(settings.templateKey);
	if (!templateKey) return null;
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
		sections: parseSystemSettings(row.sections_json),
		updatedAt: row.updated_at ?? undefined,
	} satisfies StructuredPageRouteRecord;
}
