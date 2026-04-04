import { getCmsConfig } from "./config";
import { loadLocalCmsRegistry } from "./local-runtime-modules";
import { getCloudflareBindings } from "./runtime-env";

export interface RuntimeSystemRouteRecord {
  path: string;
  title: string;
  summary?: string;
  bodyHtml?: string;
  renderStrategy: "structured_sections" | "generated_text" | "generated_xml";
  settings: Record<string, unknown> | null;
  updatedAt?: string;
}

export interface RuntimeArchiveRouteRecord {
  path: string;
  title: string;
  summary?: string;
  seoTitle?: string;
  metaDescription?: string;
  canonicalUrlOverride?: string;
  robotsDirective?: string;
  updatedAt?: string;
}

export interface RuntimeStructuredPageRouteRecord {
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

function normalizeStructuredTemplateKey(value: unknown): string | null {
  if (typeof value !== "string" || !value) {
    return null;
  }
  return getCmsConfig().templateKeys.includes(value) ? value : null;
}

function localeFromPath(pathname: string) {
  return pathname.startsWith("/es/") ? "es" : "en";
}

interface Actor {
  email: string;
  role: "admin" | "editor";
  name: string;
}

function normalizePath(pathname: string) {
  const trimmed = pathname.trim();
  if (!trimmed) {
    return "";
  }
  return trimmed.startsWith("/") ? trimmed : `/${trimmed}`;
}

function parseSettings(value: string | null) {
  if (!value) {
    return null;
  }

  try {
    const parsed = JSON.parse(value) as unknown;
    return parsed && typeof parsed === "object" ? (parsed as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}

function mapSystemRow(
  row:
    | {
        path: string;
        title: string;
        summary: string | null;
        body_html: string | null;
        settings_json: string | null;
        updated_at: string | null;
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
    updatedAt: row.updated_at ?? undefined,
    renderStrategy: row.render_strategy,
  };
}

async function loadSafeLocalCmsRegistry() {
  try {
    return await loadLocalCmsRegistry();
  } catch {
    return null;
  }
}

async function withSafeRouteRegistryFallback<T>(
  fallback: (local: NonNullable<Awaited<ReturnType<typeof loadSafeLocalCmsRegistry>>>) => Promise<T> | T,
  defaultValue: T,
  operation: () => Promise<T>,
) {
  try {
    return await operation();
  } catch {
    const local = await loadSafeLocalCmsRegistry();
    if (local) {
      return await fallback(local);
    }

    return defaultValue;
  }
}

export async function listRuntimeSystemRoutes(locals?: App.Locals | null) {
  const db = getCloudflareBindings(locals).DB;
  if (!db) {
    const local = await loadSafeLocalCmsRegistry();
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
            updated_at: string | null;
            render_strategy: RuntimeSystemRouteRecord["renderStrategy"];
          }>()
      ).results;

      return rows.map((row) => mapSystemRow(row)!).filter(Boolean);
    },
  );
}

export async function getRuntimeSystemRoute(pathname: string, locals?: App.Locals | null) {
  const normalizedPath = normalizePath(pathname);
  const db = getCloudflareBindings(locals).DB;
  if (!db) {
    const local = await loadSafeLocalCmsRegistry();
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
          updated_at: string | null;
          render_strategy: RuntimeSystemRouteRecord["renderStrategy"];
        }>();

      return mapSystemRow(row);
    },
  );
}

async function recordD1Audit(locals: App.Locals | null | undefined, actor: Actor, path: string) {
  const db = getCloudflareBindings(locals).DB;
  if (!db) {
    return;
  }

  await db
    .prepare(
      `
        INSERT INTO audit_events (user_email, action, resource_type, resource_id, summary)
        VALUES (?, 'system.update', 'content', ?, ?)
      `,
    )
    .bind(actor.email, path, `Updated system route ${path}.`)
    .run();
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
      return { ok: false as const, error: "The runtime content registry is unavailable." };
    }
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
    .first<{ id: string; render_strategy: RuntimeSystemRouteRecord["renderStrategy"] }>();

  if (!route) {
    return { ok: false as const, error: "The selected system route could not be found." };
  }

  const title = input.title.trim();
  if (!title) {
    return { ok: false as const, error: "A title is required." };
  }

  const summary = input.summary?.trim() || null;
  const bodyHtml = input.bodyHtml?.trim() || null;
  const settingsJson = input.settings ? JSON.stringify(input.settings) : null;

  await db
    .prepare(
      `
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
      `,
    )
    .bind(title, summary, bodyHtml, settingsJson, title, summary ?? title, actor.email, route.id)
    .run();

  await db
    .prepare(
      `
        INSERT INTO cms_route_revisions (id, variant_id, route_path, locale, snapshot_json, revision_note, created_by)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `,
    )
    .bind(
      `revision:${route.id}:${crypto.randomUUID()}`,
      route.id,
      normalizedPath,
      localeFromPath(normalizedPath),
      JSON.stringify({
        path: normalizedPath,
        title,
        summary,
        bodyHtml,
        settings: input.settings ?? null,
        renderStrategy: route.render_strategy,
      }),
      input.revisionNote?.trim() || null,
      actor.email,
    )
    .run();

  await recordD1Audit(locals, actor, normalizedPath);

  return {
    ok: true as const,
    route: {
      path: normalizedPath,
      title,
      summary: summary ?? undefined,
      bodyHtml: bodyHtml ?? undefined,
      settings: input.settings ?? null,
      renderStrategy: route.render_strategy,
    } satisfies RuntimeSystemRouteRecord,
  };
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
        updated_at: string | null;
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
    updatedAt: row.updated_at ?? undefined,
  } satisfies RuntimeStructuredPageRouteRecord;
}

export async function listRuntimeStructuredPageRoutes(locals?: App.Locals | null) {
  const db = getCloudflareBindings(locals).DB;
  if (!db) {
    const local = await loadSafeLocalCmsRegistry();
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
            updated_at: string | null;
          }>()
      ).results;

      return rows.map((row) => mapStructuredPageRow(row)!).filter(Boolean);
    },
  );
}

export async function getRuntimeStructuredPageRoute(pathname: string, locals?: App.Locals | null) {
  const normalizedPath = normalizePath(pathname);
  const db = getCloudflareBindings(locals).DB;
  if (!db) {
    const local = await loadSafeLocalCmsRegistry();
    return local ? local.getStructuredPageRoute(normalizedPath) : null;
  }

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
          updated_at: string | null;
        }>();

      return mapStructuredPageRow(row);
    },
  );
}

export async function saveRuntimeStructuredPageRoute(
  pathname: string,
  input: {
    title: string;
    summary?: string;
    seoTitle?: string;
    metaDescription?: string;
    canonicalUrlOverride?: string;
    robotsDirective?: string;
    ogImage?: string;
    templateKey: string;
    alternateLinks?: Array<{ hreflang: string; href: string }>;
    sections?: Record<string, unknown> | null;
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
      return { ok: false as const, error: "The runtime content registry is unavailable." };
    }
    return local.saveStructuredPageRoute(normalizedPath, input, actor);
  }

  const route = await db
    .prepare(
      `
        SELECT v.id
        FROM cms_route_variants v
        INNER JOIN cms_route_groups g ON g.id = v.group_id
        WHERE g.kind = 'page' AND g.render_strategy = 'structured_sections' AND v.path = ?
        LIMIT 1
      `,
    )
    .bind(normalizedPath)
    .first<{ id: string }>();

  if (!route) {
    return { ok: false as const, error: "The selected route page could not be found." };
  }

  const title = input.title.trim();
  if (!title) {
    return { ok: false as const, error: "A title is required." };
  }

  const summary = input.summary?.trim() || null;
  const seoTitle = input.seoTitle?.trim() || title;
  const metaDescription = input.metaDescription?.trim() || summary || title;
  const canonicalUrlOverride = input.canonicalUrlOverride?.trim() || null;
  const robotsDirective = input.robotsDirective?.trim() || null;
  const ogImage = input.ogImage?.trim() || null;
  const sectionsJson = input.sections ? JSON.stringify(input.sections) : null;
  const settingsJson = JSON.stringify({
    templateKey: input.templateKey,
    alternateLinks: input.alternateLinks ?? [],
  });

  await db
    .prepare(
      `
        UPDATE cms_route_variants
        SET title = ?, summary = ?, seo_title = ?, meta_description = ?, canonical_url_override = ?, robots_directive = ?,
            og_image = ?, sections_json = ?, settings_json = ?, updated_at = CURRENT_TIMESTAMP, updated_by = ?
        WHERE id = ?
      `,
    )
    .bind(title, summary, seoTitle, metaDescription, canonicalUrlOverride, robotsDirective, ogImage, sectionsJson, settingsJson, actor.email, route.id)
    .run();

  await db
    .prepare(
      `
        INSERT INTO cms_route_revisions (id, variant_id, route_path, locale, snapshot_json, revision_note, created_by)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `,
    )
    .bind(
      `revision:${route.id}:${crypto.randomUUID()}`,
      route.id,
      normalizedPath,
      localeFromPath(normalizedPath),
      JSON.stringify({
        path: normalizedPath,
        title,
        summary,
        seoTitle,
        metaDescription,
        canonicalUrlOverride,
        robotsDirective,
        ogImage,
        templateKey: input.templateKey,
        alternateLinks: input.alternateLinks ?? [],
        sections: input.sections ?? null,
      }),
      input.revisionNote?.trim() || null,
      actor.email,
    )
    .run();

  await recordD1Audit(locals, actor, normalizedPath);

  return {
    ok: true as const,
    route: {
      path: normalizedPath,
      title,
      summary: summary ?? undefined,
      seoTitle,
      metaDescription,
      canonicalUrlOverride: canonicalUrlOverride ?? undefined,
      robotsDirective: robotsDirective ?? undefined,
      ogImage: ogImage ?? undefined,
      templateKey: input.templateKey,
      alternateLinks: input.alternateLinks ?? [],
      sections: input.sections ?? null,
    } satisfies RuntimeStructuredPageRouteRecord,
  };
}

export async function createRuntimeStructuredPageRoute(
  pathname: string,
  input: {
    title: string;
    summary?: string;
    seoTitle?: string;
    metaDescription?: string;
    canonicalUrlOverride?: string;
    robotsDirective?: string;
    ogImage?: string;
    templateKey: string;
    alternateLinks?: Array<{ hreflang: string; href: string }>;
    sections?: Record<string, unknown> | null;
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
      return { ok: false as const, error: "The runtime content registry is unavailable." };
    }
    return local.createStructuredPageRoute(normalizedPath, input, actor);
  }

  const existing = await db
    .prepare(
      `
        SELECT v.id
        FROM cms_route_variants v
        WHERE v.path = ?
        LIMIT 1
      `,
    )
    .bind(normalizedPath)
    .first<{ id: string }>();

  if (existing) {
    return { ok: false as const, error: "That public path is already in use." };
  }

  const title = input.title.trim();
  if (!title) {
    return { ok: false as const, error: "A title is required." };
  }

  const summary = input.summary?.trim() || null;
  const seoTitle = input.seoTitle?.trim() || title;
  const metaDescription = input.metaDescription?.trim() || summary || title;
  const canonicalUrlOverride = input.canonicalUrlOverride?.trim() || null;
  const robotsDirective = input.robotsDirective?.trim() || null;
  const ogImage = input.ogImage?.trim() || null;
  const sectionsJson = input.sections ? JSON.stringify(input.sections) : null;
  const settingsJson = JSON.stringify({
    templateKey: input.templateKey,
    alternateLinks: input.alternateLinks ?? [],
  });
  const groupId = `route-group:${crypto.randomUUID()}`;
  const variantId = `route-variant:${crypto.randomUUID()}`;
  const locale = localeFromPath(normalizedPath);

  await db
    .prepare(
      `
        INSERT INTO cms_route_groups (id, kind, render_strategy, canonical_locale, canonical_path)
        VALUES (?, 'page', 'structured_sections', ?, ?)
      `,
    )
    .bind(groupId, locale, normalizedPath)
    .run();

  await db
    .prepare(
      `
        INSERT INTO cms_route_variants (
          id, group_id, locale, path, status, title, summary, sections_json, settings_json,
          seo_title, meta_description, og_image, canonical_url_override, robots_directive, updated_by
        ) VALUES (?, ?, ?, ?, 'published', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `,
    )
    .bind(
      variantId,
      groupId,
      locale,
      normalizedPath,
      title,
      summary,
      sectionsJson,
      settingsJson,
      seoTitle,
      metaDescription,
      ogImage,
      canonicalUrlOverride,
      robotsDirective,
      actor.email,
    )
    .run();

  await db
    .prepare(
      `
        INSERT INTO cms_route_revisions (id, variant_id, route_path, locale, snapshot_json, revision_note, created_by)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `,
    )
    .bind(
      `revision:${variantId}:${crypto.randomUUID()}`,
      variantId,
      normalizedPath,
      locale,
      JSON.stringify({
        path: normalizedPath,
        title,
        summary,
        seoTitle,
        metaDescription,
        canonicalUrlOverride,
        robotsDirective,
        ogImage,
        templateKey: input.templateKey,
        alternateLinks: input.alternateLinks ?? [],
        sections: input.sections ?? null,
      }),
      input.revisionNote?.trim() || "Created route page.",
      actor.email,
    )
    .run();

  await recordD1Audit(locals, actor, normalizedPath);

  return {
    ok: true as const,
    route: {
      path: normalizedPath,
      title,
      summary: summary ?? undefined,
      seoTitle,
      metaDescription,
      canonicalUrlOverride: canonicalUrlOverride ?? undefined,
      robotsDirective: robotsDirective ?? undefined,
      ogImage: ogImage ?? undefined,
      templateKey: input.templateKey,
      alternateLinks: input.alternateLinks ?? [],
      sections: input.sections ?? null,
    } satisfies RuntimeStructuredPageRouteRecord,
  };
}

export async function getRuntimeArchiveRoute(pathname: string, locals?: App.Locals | null) {
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
          updated_at: string | null;
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
        updatedAt: row.updated_at ?? undefined,
      } satisfies RuntimeArchiveRouteRecord;
    },
  );
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
      return { ok: false as const, error: "The runtime content registry is unavailable." };
    }
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
    return { ok: false as const, error: "The selected archive route could not be found." };
  }

  const title = input.title.trim();
  if (!title) {
    return { ok: false as const, error: "A title is required." };
  }

  const summary = input.summary?.trim() || null;
  const seoTitle = input.seoTitle?.trim() || title;
  const metaDescription = input.metaDescription?.trim() || summary || "";
  const canonicalUrlOverride = input.canonicalUrlOverride?.trim() || null;
  const robotsDirective = input.robotsDirective?.trim() || null;

  await db
    .prepare(
      `
        UPDATE cms_route_variants
        SET title = ?, summary = ?, seo_title = ?, meta_description = ?, canonical_url_override = ?, robots_directive = ?,
            updated_at = CURRENT_TIMESTAMP, updated_by = ?
        WHERE id = ?
      `,
    )
    .bind(title, summary, seoTitle, metaDescription, canonicalUrlOverride, robotsDirective, actor.email, route.id)
    .run();

  await db
    .prepare(
      `
        INSERT INTO cms_route_revisions (id, variant_id, route_path, locale, snapshot_json, revision_note, created_by)
        VALUES (?, ?, ?, 'en', ?, ?, ?)
      `,
    )
    .bind(
      `revision:${route.id}:${crypto.randomUUID()}`,
      route.id,
      normalizedPath,
      JSON.stringify({ path: normalizedPath, title, summary, seoTitle, metaDescription, canonicalUrlOverride, robotsDirective }),
      input.revisionNote?.trim() || null,
      actor.email,
    )
    .run();

  await db
    .prepare(
      `
        INSERT INTO audit_events (user_email, action, resource_type, resource_id, summary)
        VALUES (?, 'archive.update', 'content', ?, ?)
      `,
    )
    .bind(actor.email, normalizedPath, `Updated archive route ${normalizedPath}.`)
    .run();

  return {
    ok: true as const,
    route: {
      path: normalizedPath,
      title,
      summary: summary ?? undefined,
      seoTitle,
      metaDescription,
      canonicalUrlOverride: canonicalUrlOverride ?? undefined,
      robotsDirective: robotsDirective ?? undefined,
    } satisfies RuntimeArchiveRouteRecord,
  };
}
