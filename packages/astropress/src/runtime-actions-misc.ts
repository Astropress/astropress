import type { Actor } from "./persistence-types";
import { defaultSiteSettings, type SiteSettings } from "./site-settings";
import { withLocalStoreFallback } from "./admin-store-dispatch";
import { normalizeTranslationState, translationStates, type TranslationState } from "./translation-state";
import { normalizeRedirectPath } from "./admin-normalizers";
import { recordD1Audit } from "./d1-audit";

export async function updateRuntimeTranslationState(route: string, state: string, actor: Actor, locals?: App.Locals | null) {
  return withLocalStoreFallback(
    locals,
    async (db) => {
      const normalizedState = normalizeTranslationState(state, "__invalid__" as TranslationState);
      if (!(translationStates as readonly string[]).includes(normalizedState)) {
        return { ok: false as const, error: `Invalid translation state. Must be one of: ${translationStates.join(", ")}` };
      }

      await db
        .prepare(
          `
            INSERT INTO translation_overrides (route, state, updated_at, updated_by)
            VALUES (?, ?, CURRENT_TIMESTAMP, ?)
            ON CONFLICT(route) DO UPDATE SET
              state = excluded.state,
              updated_at = CURRENT_TIMESTAMP,
              updated_by = excluded.updated_by
          `,
        )
        .bind(route, normalizedState, actor.email)
        .run();

      await recordD1Audit(locals, actor, "translation.update", "content", route, `Updated translation state for ${route} to ${normalizedState}.`);
      return { ok: true as const };
    },
    /* v8 ignore next 1 */
    (localStore) => localStore.updateTranslationState(route, state, actor),
  );
}

export async function createRuntimeRedirectRule(
  input: { sourcePath: string; targetPath: string; statusCode: number },
  actor: Actor,
  locals?: App.Locals | null,
) {
  return withLocalStoreFallback(
    locals,
    async (db) => {
      const sourcePath = normalizeRedirectPath(input.sourcePath);
      const targetPath = normalizeRedirectPath(input.targetPath);
      const statusCode = input.statusCode === 302 ? 302 : 301;

      if (!sourcePath || !targetPath) {
        return { ok: false as const, error: "Both legacy and target paths are required." };
      }

      if (sourcePath === targetPath) {
        return { ok: false as const, error: "Legacy and target paths must be different." };
      }

      const existing = await db
        .prepare("SELECT deleted_at FROM redirect_rules WHERE source_path = ? LIMIT 1")
        .bind(sourcePath)
        .first<{ deleted_at: string | null }>();

      if (existing && existing.deleted_at === null) {
        return { ok: false as const, error: "That legacy path already has a reviewed redirect rule." };
      }

      await db
        .prepare(
          `
            INSERT INTO redirect_rules (source_path, target_path, status_code, created_by, deleted_at)
            VALUES (?, ?, ?, ?, NULL)
            ON CONFLICT(source_path) DO UPDATE SET
              target_path = excluded.target_path,
              status_code = excluded.status_code,
              created_by = excluded.created_by,
              deleted_at = NULL
          `,
        )
        .bind(sourcePath, targetPath, statusCode, actor.email)
        .run();

      await recordD1Audit(
        locals,
        actor,
        "redirect.create",
        "redirect",
        sourcePath,
        `Created redirect ${sourcePath} -> ${targetPath} (${statusCode}).`,
      );

      return { ok: true as const, rule: { sourcePath, targetPath, statusCode } };
    },
    /* v8 ignore next 1 */
    (localStore) => localStore.createRedirectRule(input, actor),
  );
}

export async function deleteRuntimeRedirectRule(sourcePath: string, actor: Actor, locals?: App.Locals | null) {
  return withLocalStoreFallback(
    locals,
    async (db) => {
      const normalizedSourcePath = normalizeRedirectPath(sourcePath);
      const result = await db
        .prepare("UPDATE redirect_rules SET deleted_at = CURRENT_TIMESTAMP WHERE source_path = ? AND deleted_at IS NULL")
        .bind(normalizedSourcePath)
        .run();

      /* v8 ignore next 4 */
      if (!result.success) {
        return { ok: false as const };
      }

      const row = await db
        .prepare("SELECT deleted_at FROM redirect_rules WHERE source_path = ? LIMIT 1")
        .bind(normalizedSourcePath)
        .first<{ deleted_at: string | null }>();

      if (!row?.deleted_at) {
        return { ok: false as const };
      }

      await recordD1Audit(locals, actor, "redirect.delete", "redirect", normalizedSourcePath, `Deleted redirect ${normalizedSourcePath}.`);
      return { ok: true as const };
    },
    /* v8 ignore next 1 */
    (localStore) => localStore.deleteRedirectRule(sourcePath, actor),
  );
}

export async function moderateRuntimeComment(
  commentId: string,
  nextStatus: "pending" | "approved" | "rejected",
  actor: Actor,
  locals?: App.Locals | null,
) {
  return withLocalStoreFallback(
    locals,
    async (db) => {
      const comment = await db.prepare("SELECT route FROM comments WHERE id = ? LIMIT 1").bind(commentId).first<{ route: string }>();
      if (!comment) {
        return { ok: false as const, error: "The selected comment record could not be found." };
      }

      await db.prepare("UPDATE comments SET status = ? WHERE id = ?").bind(nextStatus, commentId).run();
      await recordD1Audit(locals, actor, "comment.moderate", "comment", commentId, `Marked ${comment.route} as ${nextStatus}.`);
      return { ok: true as const };
    },
    /* v8 ignore next 1 */
    (localStore) => localStore.moderateComment(commentId, nextStatus, actor),
  );
}

export async function saveRuntimeSettings(partial: Partial<SiteSettings>, actor: Actor, locals?: App.Locals | null) {
  return withLocalStoreFallback(
    locals,
    async (db) => {
      const currentRow = await db
        .prepare(
          `
            SELECT site_title, site_tagline, donation_url, newsletter_enabled, comments_default_policy, admin_slug
            FROM site_settings
            WHERE id = 1
            LIMIT 1
          `,
        )
        .first<{
          site_title: string;
          site_tagline: string;
          donation_url: string;
          newsletter_enabled: number;
          comments_default_policy: SiteSettings["commentsDefaultPolicy"];
          admin_slug: string;
        }>();

      const current: SiteSettings = currentRow
        ? {
            siteTitle: currentRow.site_title,
            siteTagline: currentRow.site_tagline,
            donationUrl: currentRow.donation_url,
            newsletterEnabled: currentRow.newsletter_enabled === 1,
            commentsDefaultPolicy: currentRow.comments_default_policy,
            adminSlug: currentRow.admin_slug,
          }
        : { ...defaultSiteSettings };

      const updated: SiteSettings = {
        siteTitle: partial.siteTitle ?? current.siteTitle,
        siteTagline: partial.siteTagline ?? current.siteTagline,
        donationUrl: partial.donationUrl ?? current.donationUrl,
        newsletterEnabled: partial.newsletterEnabled ?? current.newsletterEnabled,
        commentsDefaultPolicy: partial.commentsDefaultPolicy ?? current.commentsDefaultPolicy,
        adminSlug: partial.adminSlug ?? current.adminSlug,
      };

      await db
        .prepare(
          `
            INSERT INTO site_settings (
              id, site_title, site_tagline, donation_url, newsletter_enabled, comments_default_policy, admin_slug, updated_at, updated_by
            ) VALUES (?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, ?)
            ON CONFLICT(id) DO UPDATE SET
              site_title = excluded.site_title,
              site_tagline = excluded.site_tagline,
              donation_url = excluded.donation_url,
              newsletter_enabled = excluded.newsletter_enabled,
              comments_default_policy = excluded.comments_default_policy,
              admin_slug = excluded.admin_slug,
              updated_at = CURRENT_TIMESTAMP,
              updated_by = excluded.updated_by
          `,
        )
        .bind(
          1,
          updated.siteTitle,
          updated.siteTagline,
          updated.donationUrl,
          updated.newsletterEnabled ? 1 : 0,
          updated.commentsDefaultPolicy,
          updated.adminSlug,
          actor.email,
        )
        .run();

      await recordD1Audit(locals, actor, "settings.update", "auth", "site-settings", "Updated site settings.");
      return { ok: true as const, settings: updated };
    },
    /* v8 ignore next 1 */
    (localStore) => localStore.saveSettings(partial, actor),
  );
}
