// ─── Structured Page Route Mutations ─────────────────────────────────────────
// Extracted from runtime-route-registry-pages.ts to keep that file under the 400-line limit.

import { getCloudflareBindings } from "./runtime-env";
import { normalizePath } from "./admin-normalizers";
import { recordD1Audit } from "./d1-audit";
import {
  loadSafeLocalCmsRegistry,
  localeFromPath,
  type RuntimeStructuredPageRouteRecord,
} from "./runtime-route-registry-dispatch";

interface Actor {
  email: string;
  role: "admin" | "editor";
  name: string;
}

type D1Like = ReturnType<typeof getCloudflareBindings>["DB"];

const SQL_CHECK_VARIANT_PATH = `SELECT v.id FROM cms_route_variants v WHERE v.path = ? LIMIT 1`;
const SQL_FIND_STRUCTURED_ROUTE = `
  SELECT v.id
  FROM cms_route_variants v
  INNER JOIN cms_route_groups g ON g.id = v.group_id
  WHERE g.kind = 'page' AND g.render_strategy = 'structured_sections' AND v.path = ?
  LIMIT 1
`;
const SQL_UPDATE_ROUTE_VARIANT = `
  UPDATE cms_route_variants
  SET title = ?, summary = ?, seo_title = ?, meta_description = ?, canonical_url_override = ?, robots_directive = ?,
      og_image = ?, sections_json = ?, settings_json = ?, updated_at = CURRENT_TIMESTAMP, updated_by = ?
  WHERE id = ?
`;
const SQL_INSERT_ROUTE_REVISION = `
  INSERT INTO cms_route_revisions (id, variant_id, route_path, locale, snapshot_json, revision_note, created_by)
  VALUES (?, ?, ?, ?, ?, ?, ?)
`;
const SQL_INSERT_ROUTE_GROUP = `
  INSERT INTO cms_route_groups (id, kind, render_strategy, canonical_locale, canonical_path)
  VALUES (?, 'page', 'structured_sections', ?, ?)
`;
const SQL_INSERT_NEW_ROUTE_VARIANT = `
  INSERT INTO cms_route_variants (
    id, group_id, locale, path, status, title, summary, sections_json, settings_json,
    seo_title, meta_description, og_image, canonical_url_override, robots_directive, updated_by
  ) VALUES (?, ?, ?, ?, 'published', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
`;

/** Check if a variant path already exists. */
async function isVariantPathTaken(db: NonNullable<D1Like>, normalizedPath: string): Promise<boolean> {
  const existing = await db.prepare(SQL_CHECK_VARIANT_PATH).bind(normalizedPath).first<{ id: string }>();
  return !!existing;
}

/** Normalize optional route page input fields, centralising branchy fallback logic. */
function normalizeRoutePageInput(input: {
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
}) {
  const title = input.title.trim();
  const summary = input.summary?.trim() || null;
  const seoTitle = input.seoTitle?.trim() || title;
  const metaDescription = input.metaDescription?.trim() || summary || title;
  const canonicalUrlOverride = input.canonicalUrlOverride?.trim() || null;
  const robotsDirective = input.robotsDirective?.trim() || null;
  const ogImage = input.ogImage?.trim() || null;
  const sectionsJson = input.sections ? JSON.stringify(input.sections) : null;
  const settingsJson = JSON.stringify({ templateKey: input.templateKey, alternateLinks: input.alternateLinks ?? [] });
  return { title, summary, seoTitle, metaDescription, canonicalUrlOverride, robotsDirective, ogImage, sectionsJson, settingsJson };
}

/** Build the route record returned to the caller after a save/create. */
function buildRouteResult(normalizedPath: string, fields: ReturnType<typeof normalizeRoutePageInput>, input: {
  templateKey: string;
  alternateLinks?: Array<{ hreflang: string; href: string }>;
  sections?: Record<string, unknown> | null;
}): RuntimeStructuredPageRouteRecord {
  return {
    path: normalizedPath,
    title: fields.title,
    summary: fields.summary ?? undefined,
    seoTitle: fields.seoTitle,
    metaDescription: fields.metaDescription,
    canonicalUrlOverride: fields.canonicalUrlOverride ?? undefined,
    robotsDirective: fields.robotsDirective ?? undefined,
    ogImage: fields.ogImage ?? undefined,
    templateKey: input.templateKey,
    alternateLinks: input.alternateLinks ?? [],
    sections: input.sections ?? null,
  };
}

/** Build the snapshot JSON for a route revision. */
function buildRouteSnapshot(normalizedPath: string, fields: ReturnType<typeof normalizeRoutePageInput>, input: {
  templateKey: string;
  alternateLinks?: Array<{ hreflang: string; href: string }>;
  sections?: Record<string, unknown> | null;
}) {
  return JSON.stringify({
    path: normalizedPath,
    title: fields.title,
    summary: fields.summary,
    seoTitle: fields.seoTitle,
    metaDescription: fields.metaDescription,
    canonicalUrlOverride: fields.canonicalUrlOverride,
    robotsDirective: fields.robotsDirective,
    ogImage: fields.ogImage,
    templateKey: input.templateKey,
    alternateLinks: input.alternateLinks ?? [],
    sections: input.sections ?? null,
  });
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
    /* v8 ignore next 2 */
    return local.saveStructuredPageRoute(normalizedPath, input, actor);
  }

  const route = await db
    .prepare(SQL_FIND_STRUCTURED_ROUTE)
    .bind(normalizedPath)
    .first<{ id: string }>();

  if (!route) {
    return { ok: false as const, error: "The selected route page could not be found." };
  }

  const f = normalizeRoutePageInput(input);
  if (!f.title) {
    return { ok: false as const, error: "A title is required." };
  }

  await db.prepare(SQL_UPDATE_ROUTE_VARIANT).bind(
    f.title, f.summary, f.seoTitle, f.metaDescription, f.canonicalUrlOverride, f.robotsDirective,
    f.ogImage, f.sectionsJson, f.settingsJson, actor.email, route.id,
  ).run();

  await db.prepare(SQL_INSERT_ROUTE_REVISION).bind(
    `revision:${route.id}:${crypto.randomUUID()}`, route.id, normalizedPath,
    localeFromPath(normalizedPath), buildRouteSnapshot(normalizedPath, f, input),
    input.revisionNote?.trim() || null, actor.email,
  ).run();

  await recordD1Audit(locals, actor, "system.update", "content", normalizedPath, `Updated system route ${normalizedPath}.`);
  return { ok: true as const, route: buildRouteResult(normalizedPath, f, input) };
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
    /* v8 ignore next 2 */
    return local.createStructuredPageRoute(normalizedPath, input, actor);
  }

  if (await isVariantPathTaken(db, normalizedPath)) {
    return { ok: false as const, error: "That public path is already in use." };
  }

  const f = normalizeRoutePageInput(input);
  if (!f.title) {
    return { ok: false as const, error: "A title is required." };
  }

  const groupId = `route-group:${crypto.randomUUID()}`;
  const variantId = `route-variant:${crypto.randomUUID()}`;
  const locale = localeFromPath(normalizedPath);

  await db.prepare(SQL_INSERT_ROUTE_GROUP).bind(groupId, locale, normalizedPath).run();

  await db.prepare(SQL_INSERT_NEW_ROUTE_VARIANT).bind(
    variantId, groupId, locale, normalizedPath, f.title, f.summary, f.sectionsJson, f.settingsJson,
    f.seoTitle, f.metaDescription, f.ogImage, f.canonicalUrlOverride, f.robotsDirective, actor.email,
  ).run();

  await db.prepare(SQL_INSERT_ROUTE_REVISION).bind(
    `revision:${variantId}:${crypto.randomUUID()}`, variantId, normalizedPath, locale,
    buildRouteSnapshot(normalizedPath, f, input), input.revisionNote?.trim() || "Created route page.", actor.email,
  ).run();

  await recordD1Audit(locals, actor, "system.update", "content", normalizedPath, `Updated system route ${normalizedPath}.`);
  return { ok: true as const, route: buildRouteResult(normalizedPath, f, input) };
}
