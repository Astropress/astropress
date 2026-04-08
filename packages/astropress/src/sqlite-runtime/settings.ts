import { createAstropressRedirectRepository } from "../redirect-repository-factory";
import { createAstropressCommentRepository } from "../comment-repository-factory";
import { createAstropressTranslationRepository } from "../translation-repository-factory";
import { createAstropressSettingsRepository } from "../settings-repository-factory";
import { defaultSiteSettings, type SiteSettings } from "../site-settings";
import { normalizePath, type AstropressSqliteDatabaseLike } from "./utils";
import type { SessionUser } from "../persistence-types";

interface Actor extends SessionUser {}

type CommentStatus = "pending" | "approved" | "rejected";
type CommentPolicy = "legacy-readonly" | "disabled" | "open-moderated";

export function createSqliteSettingsStore(getDb: () => AstropressSqliteDatabaseLike) {
  function recordAudit(actor: Actor, action: string, summary: string, resourceType: string, resourceId: string) {
    getDb()
      .prepare(
        `
          INSERT INTO audit_events (user_email, action, resource_type, resource_id, summary)
          VALUES (?, ?, ?, ?, ?)
        `,
      )
      .run(actor.email, action, resourceType, resourceId, summary);
  }

  function getRedirectRules() {
    const rows = getDb()
      .prepare(
        `
          SELECT source_path, target_path, status_code
          FROM redirect_rules
          WHERE deleted_at IS NULL
          ORDER BY source_path ASC
        `,
      )
      .all() as Array<{ source_path: string; target_path: string; status_code: 301 | 302 }>;

    return rows.map((row) => ({
      sourcePath: row.source_path,
      targetPath: row.target_path,
      statusCode: row.status_code,
    }));
  }

  const sqliteRedirectRepository = createAstropressRedirectRepository({
    getRedirectRules,
    normalizePath,
    getExistingRedirect(sourcePath: string) {
      const existing = getDb()
        .prepare("SELECT deleted_at FROM redirect_rules WHERE source_path = ? LIMIT 1")
        .get(sourcePath) as { deleted_at: string | null } | undefined;
      return existing ? { deletedAt: existing.deleted_at } : null;
    },
    upsertRedirect({ sourcePath, targetPath, statusCode, actor }: { sourcePath: string; targetPath: string; statusCode: 301 | 302; actor: Actor }) {
      getDb()
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
        .run(sourcePath, targetPath, statusCode, actor.email);
    },
    markRedirectDeleted(sourcePath: string) {
      return (
        getDb()
          .prepare("UPDATE redirect_rules SET deleted_at = CURRENT_TIMESTAMP WHERE source_path = ? AND deleted_at IS NULL")
          .run(sourcePath).changes > 0
      );
    },
    recordRedirectAudit({ actor, action, summary, targetId }: { actor: Actor; action: string; summary: string; targetId: string }) {
      recordAudit(actor, action, summary, "redirect", targetId);
    },
  });

  function getComments() {
    const rows = getDb()
      .prepare(
        `
          SELECT id, author, email, body, route, status, policy, submitted_at
          FROM comments
          ORDER BY
            CASE status WHEN 'pending' THEN 0 WHEN 'approved' THEN 1 ELSE 2 END,
            datetime(submitted_at) DESC,
            id DESC
        `,
      )
      .all() as Array<{
      id: string;
      author: string;
      email: string | null;
      body: string | null;
      route: string;
      status: CommentStatus;
      policy: CommentPolicy;
      submitted_at: string;
    }>;

    return rows.map((row) => ({
      id: row.id,
      author: row.author,
      email: row.email ?? undefined,
      body: row.body ?? undefined,
      route: row.route,
      status: row.status,
      policy: row.policy,
      submittedAt: row.submitted_at,
    }));
  }

  const sqliteCommentRepository = createAstropressCommentRepository({
    getComments,
    getCommentRoute(commentId: string) {
      const comment = getDb().prepare("SELECT route FROM comments WHERE id = ? LIMIT 1").get(commentId) as
        | { route: string }
        | undefined;
      return comment?.route ?? null;
    },
    updateCommentStatus(commentId: string, nextStatus: CommentStatus) {
      return getDb().prepare("UPDATE comments SET status = ? WHERE id = ?").run(nextStatus, commentId).changes > 0;
    },
    insertPublicComment(comment: { id: string; author: string; email?: string; body?: string; route: string; status: CommentStatus; policy: CommentPolicy; submittedAt?: string }) {
      const submittedAt = comment.submittedAt ?? new Date().toISOString();
      getDb()
        .prepare(
          `
            INSERT INTO comments (id, author, email, body, route, status, policy, submitted_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
          `,
        )
        .run(
          comment.id,
          comment.author,
          comment.email ?? null,
          comment.body ?? null,
          comment.route,
          comment.status,
          comment.policy,
          submittedAt,
        );
      return submittedAt;
    },
    recordCommentAudit({ actor, action, summary, targetId }: { actor: Actor; action: string; summary: string; targetId: string }) {
      recordAudit(actor, action, summary, "comment", targetId);
    },
  });

  const sqliteTranslationRepository = createAstropressTranslationRepository({
    readTranslationState(route: string) {
      const row = getDb().prepare("SELECT state FROM translation_overrides WHERE route = ? LIMIT 1").get(route) as
        | { state: string }
        | undefined;
      return row?.state;
    },
    persistTranslationState(route: string, state: string, actor: Actor) {
      getDb()
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
        .run(route, state, actor.email);
    },
    recordTranslationAudit({ actor, route, state }: { actor: Actor; route: string; state: string }) {
      recordAudit(actor, "translation.update", `Updated translation state for ${route} to ${state}.`, "content", route);
    },
  });

  function getSettings(): SiteSettings {
    const row = getDb()
      .prepare(
        `
          SELECT site_title, site_tagline, donation_url, newsletter_enabled, comments_default_policy, admin_slug
          FROM site_settings
          WHERE id = 1
          LIMIT 1
        `,
      )
      .get() as
      | {
          site_title: string;
          site_tagline: string;
          donation_url: string;
          newsletter_enabled: number;
          comments_default_policy: SiteSettings["commentsDefaultPolicy"];
          admin_slug: string;
        }
      | undefined;

    if (!row) {
      return { ...defaultSiteSettings };
    }

    return {
      siteTitle: row.site_title,
      siteTagline: row.site_tagline,
      donationUrl: row.donation_url,
      newsletterEnabled: row.newsletter_enabled === 1,
      commentsDefaultPolicy: row.comments_default_policy,
      adminSlug: row.admin_slug ?? "ap-admin",
    };
  }

  const sqliteSettingsRepository = createAstropressSettingsRepository({
    getSettings,
    persistSettings(updated: SiteSettings, actor: Actor) {
      getDb()
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
        .run(
          1,
          updated.siteTitle,
          updated.siteTagline,
          updated.donationUrl,
          updated.newsletterEnabled ? 1 : 0,
          updated.commentsDefaultPolicy,
          updated.adminSlug,
          actor.email,
        );
    },
    recordSettingsAudit(actor: Actor) {
      recordAudit(actor, "settings.update", "Updated site settings.", "auth", "site-settings");
    },
  });

  return { sqliteRedirectRepository, sqliteCommentRepository, sqliteTranslationRepository, sqliteSettingsRepository };
}
