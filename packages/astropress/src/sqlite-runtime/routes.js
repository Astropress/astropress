import { createAstropressCmsRouteRegistry } from "../cms-route-registry-factory.js";
import { createAstropressCmsRegistryModule } from "../host-runtime-factories.js";
import {
  localeFromPath,
  normalizeStructuredTemplateKey,
  normalizeSystemRoutePath,
  parseSystemSettings,
} from "./utils.js";

function createSqliteRoutesStore(getDb, randomId) {
  function recordAudit(actor, action, summary, resourceType, resourceId) {
    getDb().prepare(`
          INSERT INTO audit_events (user_email, action, resource_type, resource_id, summary)
          VALUES (?, ?, ?, ?, ?)
        `).run(actor.email, action, resourceType, resourceId, summary);
  }

  function listSystemRoutes() {
    const rows = getDb().prepare(`
          SELECT v.path, v.title, v.summary, v.body_html, v.settings_json, v.updated_at, g.render_strategy
          FROM cms_route_variants v
          INNER JOIN cms_route_groups g ON g.id = v.group_id
          WHERE g.kind = 'system'
          ORDER BY v.path ASC
        `).all();
    return rows.map((row) => ({
      path: row.path,
      title: row.title,
      summary: row.summary ?? undefined,
      bodyHtml: row.body_html ?? undefined,
      settings: parseSystemSettings(row.settings_json),
      /* v8 ignore next 1 */
      updatedAt: row.updated_at ?? undefined,
      renderStrategy: row.render_strategy,
    }));
  }

  function getSystemRoute(pathname) {
    const normalizedPath = normalizeSystemRoutePath(pathname);
    return listSystemRoutes().find((route) => route.path === normalizedPath) ?? null;
  }

  function listStructuredPageRoutes() {
    const rows = getDb().prepare(`
          SELECT v.path, v.title, v.summary, v.seo_title, v.meta_description, v.canonical_url_override, v.robots_directive,
                 v.og_image, v.sections_json, v.settings_json, v.updated_at
          FROM cms_route_variants v
          INNER JOIN cms_route_groups g ON g.id = v.group_id
          WHERE g.kind = 'page' AND g.render_strategy = 'structured_sections'
          ORDER BY v.path ASC
        `).all();
    return rows.map((row) => {
      /* v8 ignore next 1 */
      const settings = parseSystemSettings(row.settings_json) ?? {};
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
        /* v8 ignore next 3 */
        alternateLinks: Array.isArray(settings.alternateLinks) ? settings.alternateLinks : [],
        sections: parseSystemSettings(row.sections_json),
        updatedAt: row.updated_at ?? undefined,
      };
    }).filter(Boolean);
  }

  function getStructuredPageRoute(pathname) {
    const normalizedPath = normalizeSystemRoutePath(pathname);
    return listStructuredPageRoutes().find((route) => route.path === normalizedPath) ?? null;
  }

  function getArchiveRoute(pathname) {
    const normalizedPath = normalizeSystemRoutePath(pathname);
    const row = getDb().prepare(`
          SELECT v.path, v.title, v.summary, v.seo_title, v.meta_description, v.canonical_url_override, v.robots_directive, v.updated_at
          FROM cms_route_variants v
          INNER JOIN cms_route_groups g ON g.id = v.group_id
          WHERE g.kind = 'archive' AND v.path = ?
          LIMIT 1
        `).get(normalizedPath);
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
      /* v8 ignore next 1 */
      updatedAt: row.updated_at ?? undefined,
    };
  }

  function listArchiveRoutes() {
    const rows = getDb().prepare(`
          SELECT v.path, v.title, v.summary, v.seo_title, v.meta_description, v.canonical_url_override, v.robots_directive, v.updated_at
          FROM cms_route_variants v
          INNER JOIN cms_route_groups g ON g.id = v.group_id
          WHERE g.kind = 'archive'
          ORDER BY v.path ASC
        `).all();
    return rows.map((row) => ({
      path: row.path,
      title: row.title,
      summary: row.summary ?? undefined,
      seoTitle: row.seo_title ?? undefined,
      metaDescription: row.meta_description ?? undefined,
      canonicalUrlOverride: row.canonical_url_override ?? undefined,
      robotsDirective: row.robots_directive ?? undefined,
      /* v8 ignore next 1 */
      updatedAt: row.updated_at ?? undefined,
    }));
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
      const row = getDb().prepare(`
            SELECT v.id, g.render_strategy
            FROM cms_route_variants v
            INNER JOIN cms_route_groups g ON g.id = v.group_id
            WHERE g.kind = 'system' AND v.path = ?
            LIMIT 1
          `).get(pathname);
      return row ? { id: row.id, renderStrategy: row.render_strategy } : null;
    },
    persistSystemRoute({ routeId, title, summary, bodyHtml, settingsJson, actor }) {
      getDb().prepare(`
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
          `).run(title, summary, bodyHtml, settingsJson, title, summary ?? title, actor.email, routeId);
    },
    appendSystemRouteRevision({ routeId, pathname, locale, title, summary, bodyHtml, settings, renderStrategy, revisionNote, actor }) {
      getDb().prepare(`
            INSERT INTO cms_route_revisions (id, variant_id, route_path, locale, snapshot_json, revision_note, created_by)
            VALUES (?, ?, ?, ?, ?, ?, ?)
          `).run(`revision:${routeId}:${randomId()}`, routeId, pathname, locale, JSON.stringify({ path: pathname, title, summary, bodyHtml, settings: settings ?? null, renderStrategy }), revisionNote, actor.email);
    },
    isRoutePathTaken(pathname) {
      return Boolean(getDb().prepare(`
              SELECT v.id
              FROM cms_route_variants v
              INNER JOIN cms_route_groups g ON g.id = v.group_id
              WHERE v.path = ?
              LIMIT 1
            `).get(pathname));
    },
    findStructuredRouteForUpdate(pathname) {
      return getDb().prepare(`
              SELECT v.id
              FROM cms_route_variants v
              INNER JOIN cms_route_groups g ON g.id = v.group_id
              WHERE g.kind = 'page' AND g.render_strategy = 'structured_sections' AND v.path = ?
              LIMIT 1
            `).get(pathname) ?? null;
    },
    insertStructuredRoute({ pathname, locale, title, summary, seoTitle, metaDescription, canonicalUrlOverride, robotsDirective, ogImage, templateKey, alternateLinks, sections, actor }) {
      const groupId = `route-group:${randomId()}`;
      const variantId = `route-variant:${randomId()}`;
      getDb().prepare(`
            INSERT INTO cms_route_groups (id, kind, render_strategy, canonical_locale, canonical_path)
            VALUES (?, 'page', 'structured_sections', ?, ?)
          `).run(groupId, locale, pathname);
      getDb().prepare(`
            INSERT INTO cms_route_variants (
              id, group_id, locale, path, status, title, summary, sections_json, settings_json,
              seo_title, meta_description, og_image, canonical_url_override, robots_directive, updated_by
            ) VALUES (?, ?, ?, ?, 'published', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          `).run(variantId, groupId, locale, pathname, title, summary, sections ? JSON.stringify(sections) : null, JSON.stringify({ templateKey, alternateLinks }), seoTitle, metaDescription, ogImage, canonicalUrlOverride, robotsDirective, actor.email);
    },
    persistStructuredRoute({ routeId, title, summary, seoTitle, metaDescription, canonicalUrlOverride, robotsDirective, ogImage, templateKey, alternateLinks, sections, actor }) {
      getDb().prepare(`
            UPDATE cms_route_variants
            SET title = ?, summary = ?, seo_title = ?, meta_description = ?, canonical_url_override = ?, robots_directive = ?,
                og_image = ?, sections_json = ?, settings_json = ?, updated_at = CURRENT_TIMESTAMP, updated_by = ?
            WHERE id = ?
          `).run(title, summary, seoTitle, metaDescription, canonicalUrlOverride, robotsDirective, ogImage, sections ? JSON.stringify(sections) : null, JSON.stringify({ templateKey, alternateLinks }), actor.email, routeId);
    },
    appendStructuredRouteRevision({ routeId, pathname, locale, title, summary, seoTitle, metaDescription, canonicalUrlOverride, robotsDirective, ogImage, templateKey, alternateLinks, sections, revisionNote, actor }) {
      getDb().prepare(`
            INSERT INTO cms_route_revisions (id, variant_id, route_path, locale, snapshot_json, revision_note, created_by)
            VALUES (?, ?, ?, ?, ?, ?, ?)
          `).run(`revision:${routeId}:${randomId()}`, routeId, pathname, locale, JSON.stringify({
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
      }), revisionNote, actor.email);
    },
    findArchiveRouteForUpdate(pathname) {
      return getDb().prepare(`
              SELECT v.id
              FROM cms_route_variants v
              INNER JOIN cms_route_groups g ON g.id = v.group_id
              WHERE g.kind = 'archive' AND v.path = ?
              LIMIT 1
            `).get(pathname) ?? null;
    },
    persistArchiveRoute({ routeId, title, summary, seoTitle, metaDescription, canonicalUrlOverride, robotsDirective, actor }) {
      getDb().prepare(`
            UPDATE cms_route_variants
            SET title = ?, summary = ?, seo_title = ?, meta_description = ?, canonical_url_override = ?, robots_directive = ?,
                updated_at = CURRENT_TIMESTAMP, updated_by = ?
            WHERE id = ?
          `).run(title, summary, seoTitle, metaDescription, canonicalUrlOverride, robotsDirective, actor.email, routeId);
    },
    appendArchiveRouteRevision({ routeId, pathname, title, summary, seoTitle, metaDescription, canonicalUrlOverride, robotsDirective, revisionNote, actor }) {
      getDb().prepare(`
            INSERT INTO cms_route_revisions (id, variant_id, route_path, locale, snapshot_json, revision_note, created_by)
            VALUES (?, ?, ?, 'en', ?, ?, ?)
          `).run(`revision:${routeId}:${randomId()}`, routeId, pathname, JSON.stringify({ path: pathname, title, summary, seoTitle, metaDescription, canonicalUrlOverride, robotsDirective }), revisionNote, actor.email);
    },
    recordRouteAudit({ actor, action, summary, targetId }) {
      recordAudit(actor, action, summary, "content", targetId);
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

export { createSqliteRoutesStore };
