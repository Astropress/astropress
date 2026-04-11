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

  await recordD1Audit(locals, actor, "system.update", "content", normalizedPath, `Updated system route ${normalizedPath}.`);

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
    /* v8 ignore next 2 */
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

  await recordD1Audit(locals, actor, "system.update", "content", normalizedPath, `Updated system route ${normalizedPath}.`);

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
