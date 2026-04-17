import { createAstropressCmsRouteRegistry } from "../cms-route-registry-factory";
import { createAstropressCmsRegistryModule } from "../host-runtime-factories";
import {
  localeFromPath, normalizeStructuredTemplateKey, normalizeSystemRoutePath,
  parseSystemSettings, type AstropressSqliteDatabaseLike,
} from "./utils";
import { recordAudit } from "./audit-log";
import type { SessionUser, Actor } from "../persistence-types";

interface SystemRouteRecord {
  path: string; title: string; summary?: string; bodyHtml?: string;
  renderStrategy: "structured_sections" | "generated_text" | "generated_xml";
  settings: Record<string, unknown> | null; updatedAt?: string;
}
interface ArchiveRouteRecord {
  path: string; title: string; summary?: string; seoTitle?: string; metaDescription?: string;
  canonicalUrlOverride?: string; robotsDirective?: string; updatedAt?: string;
}
interface StructuredPageRouteRecord {
  path: string; title: string; summary?: string; seoTitle?: string; metaDescription?: string;
  canonicalUrlOverride?: string; robotsDirective?: string; ogImage?: string; templateKey: string;
  alternateLinks: Array<{ hreflang: string; href: string }>; sections: Record<string, unknown> | null; updatedAt?: string;
}

type SystemRouteRow = { path: string; title: string; summary: string | null; body_html: string | null; settings_json: string | null; updated_at: string | null; render_strategy: SystemRouteRecord["renderStrategy"] };
type ArchiveRouteRow = { path: string; title: string; summary: string | null; seo_title: string | null; meta_description: string | null; canonical_url_override: string | null; robots_directive: string | null; updated_at: string | null };
type StructuredPageRow = { path: string; title: string; summary: string | null; seo_title: string | null; meta_description: string | null; canonical_url_override: string | null; robots_directive: string | null; og_image: string | null; sections_json: string | null; settings_json: string | null; updated_at: string | null };

const SQL_LIST_SYSTEM = `SELECT v.path, v.title, v.summary, v.body_html, v.settings_json, v.updated_at, g.render_strategy FROM cms_route_variants v INNER JOIN cms_route_groups g ON g.id = v.group_id WHERE g.kind = 'system' ORDER BY v.path ASC`;
const SQL_LIST_STRUCTURED = `SELECT v.path, v.title, v.summary, v.seo_title, v.meta_description, v.canonical_url_override, v.robots_directive, v.og_image, v.sections_json, v.settings_json, v.updated_at FROM cms_route_variants v INNER JOIN cms_route_groups g ON g.id = v.group_id WHERE g.kind = 'page' AND g.render_strategy = 'structured_sections' ORDER BY v.path ASC`;
const SQL_GET_ARCHIVE = `SELECT v.path, v.title, v.summary, v.seo_title, v.meta_description, v.canonical_url_override, v.robots_directive, v.updated_at FROM cms_route_variants v INNER JOIN cms_route_groups g ON g.id = v.group_id WHERE g.kind = 'archive' AND v.path = ? LIMIT 1`;
const SQL_LIST_ARCHIVES = `SELECT v.path, v.title, v.summary, v.seo_title, v.meta_description, v.canonical_url_override, v.robots_directive, v.updated_at FROM cms_route_variants v INNER JOIN cms_route_groups g ON g.id = v.group_id WHERE g.kind = 'archive' ORDER BY v.path ASC`;
const SQL_FIND_SYSTEM_FOR_UPDATE = `SELECT v.id, g.render_strategy FROM cms_route_variants v INNER JOIN cms_route_groups g ON g.id = v.group_id WHERE g.kind = 'system' AND v.path = ? LIMIT 1`;
const SQL_PERSIST_SYSTEM = `UPDATE cms_route_variants SET title = ?, summary = ?, body_html = ?, settings_json = ?, seo_title = ?, meta_description = ?, updated_at = CURRENT_TIMESTAMP, updated_by = ? WHERE id = ?`;
const SQL_INSERT_REVISION = `INSERT INTO cms_route_revisions (id, variant_id, route_path, locale, snapshot_json, revision_note, created_by) VALUES (?, ?, ?, ?, ?, ?, ?)`;
const SQL_IS_PATH_TAKEN = `SELECT v.id FROM cms_route_variants v INNER JOIN cms_route_groups g ON g.id = v.group_id WHERE v.path = ? LIMIT 1`;
const SQL_FIND_STRUCTURED_FOR_UPDATE = `SELECT v.id FROM cms_route_variants v INNER JOIN cms_route_groups g ON g.id = v.group_id WHERE g.kind = 'page' AND g.render_strategy = 'structured_sections' AND v.path = ? LIMIT 1`;
const SQL_INSERT_ROUTE_GROUP = `INSERT INTO cms_route_groups (id, kind, render_strategy, canonical_locale, canonical_path) VALUES (?, 'page', 'structured_sections', ?, ?)`;
const SQL_INSERT_ROUTE_VARIANT = `INSERT INTO cms_route_variants (id, group_id, locale, path, status, title, summary, sections_json, settings_json, seo_title, meta_description, og_image, canonical_url_override, robots_directive, updated_by) VALUES (?, ?, ?, ?, 'published', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`;
const SQL_PERSIST_STRUCTURED = `UPDATE cms_route_variants SET title = ?, summary = ?, seo_title = ?, meta_description = ?, canonical_url_override = ?, robots_directive = ?, og_image = ?, sections_json = ?, settings_json = ?, updated_at = CURRENT_TIMESTAMP, updated_by = ? WHERE id = ?`;
const SQL_FIND_ARCHIVE_FOR_UPDATE = `SELECT v.id FROM cms_route_variants v INNER JOIN cms_route_groups g ON g.id = v.group_id WHERE g.kind = 'archive' AND v.path = ? LIMIT 1`;
const SQL_PERSIST_ARCHIVE = `UPDATE cms_route_variants SET title = ?, summary = ?, seo_title = ?, meta_description = ?, canonical_url_override = ?, robots_directive = ?, updated_at = CURRENT_TIMESTAMP, updated_by = ? WHERE id = ?`;
const SQL_INSERT_ARCHIVE_REVISION = `INSERT INTO cms_route_revisions (id, variant_id, route_path, locale, snapshot_json, revision_note, created_by) VALUES (?, ?, ?, 'en', ?, ?, ?)`;

function mapArchiveRow(row: ArchiveRouteRow): ArchiveRouteRecord {
  return { path: row.path, title: row.title, summary: row.summary ?? undefined, seoTitle: row.seo_title ?? undefined, metaDescription: row.meta_description ?? undefined, canonicalUrlOverride: row.canonical_url_override ?? undefined, robotsDirective: row.robots_directive ?? undefined, updatedAt: row.updated_at ?? undefined };
}

function querySystemRoutes(getDb: () => AstropressSqliteDatabaseLike): SystemRouteRecord[] {
  const rows = getDb().prepare(SQL_LIST_SYSTEM).all() as SystemRouteRow[];
  return rows.map((row) => ({
    path: row.path, title: row.title, summary: row.summary ?? undefined,
    bodyHtml: row.body_html ?? undefined, settings: parseSystemSettings(row.settings_json),
    updatedAt: row.updated_at ?? undefined, renderStrategy: row.render_strategy,
  }));
}

function mapStructuredPageRow(row: StructuredPageRow): StructuredPageRouteRecord | null {
  const settings = parseSystemSettings(row.settings_json) ?? {};
  const templateKey = normalizeStructuredTemplateKey(settings.templateKey);
  if (!templateKey) return null;
  return {
    path: row.path, title: row.title, summary: row.summary ?? undefined, seoTitle: row.seo_title ?? undefined,
    metaDescription: row.meta_description ?? undefined, canonicalUrlOverride: row.canonical_url_override ?? undefined,
    robotsDirective: row.robots_directive ?? undefined, ogImage: row.og_image ?? undefined, templateKey,
    alternateLinks: Array.isArray(settings.alternateLinks)
      ? (settings.alternateLinks as Array<{ hreflang: string; href: string }>) : [],
    sections: parseSystemSettings(row.sections_json), updatedAt: row.updated_at ?? undefined,
  } satisfies StructuredPageRouteRecord;
}

function queryStructuredPageRoutes(getDb: () => AstropressSqliteDatabaseLike): StructuredPageRouteRecord[] {
  const rows = getDb().prepare(SQL_LIST_STRUCTURED).all() as StructuredPageRow[];
  return rows.map(mapStructuredPageRow).filter(Boolean) as StructuredPageRouteRecord[];
}

interface InsertStructuredInput {
  pathname: string; locale: string; title: string; summary: string; seoTitle: string; metaDescription: string;
  canonicalUrlOverride?: string; robotsDirective?: string; ogImage?: string; templateKey: string;
  alternateLinks: Array<{ hreflang: string; href: string }>; sections: Record<string, unknown> | null; actor: Actor;
}
interface PersistStructuredInput {
  routeId: string; title: string; summary: string; seoTitle: string; metaDescription: string;
  canonicalUrlOverride?: string; robotsDirective?: string; ogImage?: string; templateKey: string;
  alternateLinks: Array<{ hreflang: string; href: string }>; sections: Record<string, unknown> | null; actor: Actor;
}
interface AppendStructuredRevisionInput extends InsertStructuredInput {
  routeId: string; revisionNote: string;
}
interface PersistArchiveInput {
  routeId: string; title: string; summary?: string; seoTitle?: string; metaDescription?: string;
  canonicalUrlOverride?: string; robotsDirective?: string; actor: Actor;
}
interface AppendArchiveRevisionInput {
  routeId: string; pathname: string; title: string; summary?: string; seoTitle?: string; metaDescription?: string;
  canonicalUrlOverride?: string; robotsDirective?: string; revisionNote: string; actor: Actor;
}

export function createSqliteRoutesStore(getDb: () => AstropressSqliteDatabaseLike, randomId: () => string) {
  function listSystemRoutes() {
    return querySystemRoutes(getDb);
  }

  function getSystemRoute(pathname: string) {
    const normalizedPath = normalizeSystemRoutePath(pathname);
    return listSystemRoutes().find((route) => route.path === normalizedPath) ?? null;
  }

  function listStructuredPageRoutes() {
    return queryStructuredPageRoutes(getDb);
  }

  function getStructuredPageRoute(pathname: string) {
    const normalizedPath = normalizeSystemRoutePath(pathname);
    return listStructuredPageRoutes().find((route) => route.path === normalizedPath) ?? null;
  }

  function getArchiveRoute(pathname: string) {
    const normalizedPath = normalizeSystemRoutePath(pathname);
    const row = getDb().prepare(SQL_GET_ARCHIVE).get(normalizedPath) as ArchiveRouteRow | undefined;
    if (!row) return null;
    return mapArchiveRow(row);
  }

  function listArchiveRoutes() {
    const rows = getDb().prepare(SQL_LIST_ARCHIVES).all() as ArchiveRouteRow[];
    return rows.map(mapArchiveRow) satisfies ArchiveRouteRecord[];
  }

  const sqliteCmsRouteRegistry = createAstropressCmsRouteRegistry({
    normalizePath: normalizeSystemRoutePath,
    localeFromPath, listSystemRoutes, getSystemRoute, listStructuredPageRoutes, getStructuredPageRoute,
    getArchiveRoute, listArchiveRoutes,
    findSystemRouteForUpdate(pathname) {
      const row = getDb().prepare(SQL_FIND_SYSTEM_FOR_UPDATE).get(pathname) as { id: string; render_strategy: SystemRouteRecord["renderStrategy"] } | undefined;
      return row ? { id: row.id, renderStrategy: row.render_strategy } : null;
    },
    persistSystemRoute({ routeId, title, summary, bodyHtml, settingsJson, actor }: { routeId: string; title: string; summary: string; bodyHtml: string; settingsJson: string; actor: Actor }) {
      getDb().prepare(SQL_PERSIST_SYSTEM).run(title, summary, bodyHtml, settingsJson, title, summary ?? title, actor.email, routeId);
    },
    appendSystemRouteRevision({ routeId, pathname, locale, title, summary, bodyHtml, settings, renderStrategy, revisionNote, actor }: { routeId: string; pathname: string; locale: string; title: string; summary: string; bodyHtml: string; settings: Record<string, unknown> | null; renderStrategy: string; revisionNote: string; actor: Actor }) {
      getDb().prepare(SQL_INSERT_REVISION).run(
        `revision:${routeId}:${randomId()}`, routeId, pathname, locale,
        JSON.stringify({ path: pathname, title, summary, bodyHtml, settings: settings ?? null, renderStrategy }),
        revisionNote, actor.email,
      );
    },
    isRoutePathTaken(pathname) {
      return Boolean(getDb().prepare(SQL_IS_PATH_TAKEN).get(pathname));
    },
    findStructuredRouteForUpdate(pathname) {
      return (getDb().prepare(SQL_FIND_STRUCTURED_FOR_UPDATE).get(pathname) as { id: string } | undefined) ?? null;
    },
    insertStructuredRoute({ pathname, locale, title, summary, seoTitle, metaDescription, canonicalUrlOverride, robotsDirective, ogImage, templateKey, alternateLinks, sections, actor }: InsertStructuredInput) {
      const groupId = `route-group:${randomId()}`;
      const variantId = `route-variant:${randomId()}`;
      getDb().prepare(SQL_INSERT_ROUTE_GROUP).run(groupId, locale, pathname);
      getDb().prepare(SQL_INSERT_ROUTE_VARIANT).run(
        variantId, groupId, locale, pathname, title, summary,
        sections ? JSON.stringify(sections) : null, JSON.stringify({ templateKey, alternateLinks }),
        seoTitle, metaDescription, ogImage, canonicalUrlOverride, robotsDirective, actor.email,
      );
    },
    persistStructuredRoute({ routeId, title, summary, seoTitle, metaDescription, canonicalUrlOverride, robotsDirective, ogImage, templateKey, alternateLinks, sections, actor }: PersistStructuredInput) {
      getDb().prepare(SQL_PERSIST_STRUCTURED).run(
        title, summary, seoTitle, metaDescription, canonicalUrlOverride, robotsDirective, ogImage,
        sections ? JSON.stringify(sections) : null, JSON.stringify({ templateKey, alternateLinks }), actor.email, routeId,
      );
    },
    appendStructuredRouteRevision({ routeId, pathname, locale, title, summary, seoTitle, metaDescription, canonicalUrlOverride, robotsDirective, ogImage, templateKey, alternateLinks, sections, revisionNote, actor }: AppendStructuredRevisionInput) {
      getDb().prepare(SQL_INSERT_REVISION).run(
        `revision:${routeId}:${randomId()}`, routeId, pathname, locale,
        JSON.stringify({ path: pathname, title, summary, seoTitle, metaDescription, canonicalUrlOverride, robotsDirective, ogImage, templateKey, alternateLinks, sections }),
        revisionNote, actor.email,
      );
    },
    findArchiveRouteForUpdate(pathname) {
      return (getDb().prepare(SQL_FIND_ARCHIVE_FOR_UPDATE).get(pathname) as { id: string } | undefined) ?? null;
    },
    persistArchiveRoute({ routeId, title, summary, seoTitle, metaDescription, canonicalUrlOverride, robotsDirective, actor }: PersistArchiveInput) {
      getDb().prepare(SQL_PERSIST_ARCHIVE).run(title, summary, seoTitle, metaDescription, canonicalUrlOverride, robotsDirective, actor.email, routeId);
    },
    appendArchiveRouteRevision({ routeId, pathname, title, summary, seoTitle, metaDescription, canonicalUrlOverride, robotsDirective, revisionNote, actor }: AppendArchiveRevisionInput) {
      getDb().prepare(SQL_INSERT_ARCHIVE_REVISION).run(
        `revision:${routeId}:${randomId()}`, routeId, pathname,
        JSON.stringify({ path: pathname, title, summary, seoTitle, metaDescription, canonicalUrlOverride, robotsDirective }),
        revisionNote, actor.email,
      );
    },
    recordRouteAudit({ actor, action, summary, targetId }: { actor: Actor; action: string; summary: string; targetId: string }) {
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
