import { createAstropressRedirectRepository } from "../redirect-repository-factory.js";
import { createAstropressCommentRepository } from "../comment-repository-factory.js";
import { createAstropressTranslationRepository } from "../translation-repository-factory.js";
import { createAstropressSettingsRepository } from "../settings-repository-factory.js";
import { defaultSiteSettings } from "../site-settings.js";
import { normalizePath } from "./utils.js";

function createSqliteSettingsStore(getDb) {
  function recordAudit(actor, action, summary, resourceType, resourceId) {
    getDb().prepare(`
          INSERT INTO audit_events (user_email, action, resource_type, resource_id, summary)
          VALUES (?, ?, ?, ?, ?)
        `).run(actor.email, action, resourceType, resourceId, summary);
  }

  function getRedirectRules() {
    const rows = getDb().prepare(`
          SELECT source_path, target_path, status_code
          FROM redirect_rules
          WHERE deleted_at IS NULL
          ORDER BY source_path ASC
        `).all();
    return rows.map((row) => ({
      sourcePath: row.source_path,
      targetPath: row.target_path,
      statusCode: row.status_code,
    }));
  }

  const sqliteRedirectRepository = createAstropressRedirectRepository({
    getRedirectRules,
    normalizePath,
    getExistingRedirect(sourcePath) {
      const existing = getDb().prepare("SELECT deleted_at FROM redirect_rules WHERE source_path = ? LIMIT 1").get(sourcePath);
      return existing ? { deletedAt: existing.deleted_at } : null;
    },
    upsertRedirect({ sourcePath, targetPath, statusCode, actor }) {
      getDb().prepare(`
            INSERT INTO redirect_rules (source_path, target_path, status_code, created_by, deleted_at)
            VALUES (?, ?, ?, ?, NULL)
            ON CONFLICT(source_path) DO UPDATE SET
              target_path = excluded.target_path,
              status_code = excluded.status_code,
              created_by = excluded.created_by,
              deleted_at = NULL
          `).run(sourcePath, targetPath, statusCode, actor.email);
    },
    markRedirectDeleted(sourcePath) {
      return getDb().prepare("UPDATE redirect_rules SET deleted_at = CURRENT_TIMESTAMP WHERE source_path = ? AND deleted_at IS NULL").run(sourcePath).changes > 0;
    },
    recordRedirectAudit({ actor, action, summary, targetId }) {
      recordAudit(actor, action, summary, "redirect", targetId);
    },
  });

  function getComments() {
    const rows = getDb().prepare(`
          SELECT id, author, email, body, route, status, policy, submitted_at
          FROM comments
          ORDER BY
            CASE status WHEN 'pending' THEN 0 WHEN 'approved' THEN 1 ELSE 2 END,
            datetime(submitted_at) DESC,
            id DESC
        `).all();
    return rows.map((row) => ({
      id: row.id,
      author: row.author,
      /* v8 ignore next 2 */
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
    getCommentRoute(commentId) {
      const comment = getDb().prepare("SELECT route FROM comments WHERE id = ? LIMIT 1").get(commentId);
      return comment?.route ?? null;
    },
    updateCommentStatus(commentId, nextStatus) {
      return getDb().prepare("UPDATE comments SET status = ? WHERE id = ?").run(nextStatus, commentId).changes > 0;
    },
    insertPublicComment(comment) {
      /* v8 ignore next 1 */
      const submittedAt = comment.submittedAt ?? new Date().toISOString();
      getDb().prepare(`
            INSERT INTO comments (id, author, email, body, route, status, policy, submitted_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        /* v8 ignore next 1 */
          `).run(comment.id, comment.author, comment.email ?? null, comment.body ?? null, comment.route, comment.status, comment.policy, submittedAt);
      return submittedAt;
    },
    recordCommentAudit({ actor, action, summary, targetId }) {
      recordAudit(actor, action, summary, "comment", targetId);
    },
  });

  const sqliteTranslationRepository = createAstropressTranslationRepository({
    readTranslationState(route) {
      const row = getDb().prepare("SELECT state FROM translation_overrides WHERE route = ? LIMIT 1").get(route);
      return row?.state;
    },
    persistTranslationState(route, state, actor) {
      getDb().prepare(`
            INSERT INTO translation_overrides (route, state, updated_at, updated_by)
            VALUES (?, ?, CURRENT_TIMESTAMP, ?)
            ON CONFLICT(route) DO UPDATE SET
              state = excluded.state,
              updated_at = CURRENT_TIMESTAMP,
              updated_by = excluded.updated_by
          `).run(route, state, actor.email);
    },
    recordTranslationAudit({ actor, route, state }) {
      recordAudit(actor, "translation.update", `Updated translation state for ${route} to ${state}.`, "content", route);
    },
  });

  function getSettings() {
    const row = getDb().prepare(`
          SELECT site_title, site_tagline, donation_url, newsletter_enabled, comments_default_policy, admin_slug
          FROM site_settings
          WHERE id = 1
          LIMIT 1
        `).get();
    if (!row) {
      return { ...defaultSiteSettings };
    }
    return {
      siteTitle: row.site_title,
      siteTagline: row.site_tagline,
      donationUrl: row.donation_url,
      newsletterEnabled: row.newsletter_enabled === 1,
      commentsDefaultPolicy: row.comments_default_policy,
      /* v8 ignore next 1 */
      adminSlug: row.admin_slug ?? "ap-admin",
    };
  }

  const sqliteSettingsRepository = createAstropressSettingsRepository({
    getSettings,
    persistSettings(updated, actor) {
      getDb().prepare(`
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
          `).run(1, updated.siteTitle, updated.siteTagline, updated.donationUrl, updated.newsletterEnabled ? 1 : 0, updated.commentsDefaultPolicy, updated.adminSlug, actor.email);
    },
    recordSettingsAudit(actor) {
      recordAudit(actor, "settings.update", "Updated site settings.", "auth", "site-settings");
    },
  });

  return { sqliteRedirectRepository, sqliteCommentRepository, sqliteTranslationRepository, sqliteSettingsRepository };
}

export { createSqliteSettingsStore };
