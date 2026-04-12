import { defaultSiteSettings } from "./site-settings.js";
import { normalizeTranslationState } from "./translation-state.js";
import { createD1RateLimitPart } from "./d1-rate-limit-part.js";

export function createD1OperationsReadPart(db) {
  return {
    audit: {
      async getAuditEvents() {
        const rows = (
          await db
            .prepare(
              `
                SELECT id, user_email, action, resource_type, resource_id, summary, created_at
                FROM audit_events
                ORDER BY datetime(created_at) DESC, id DESC
              `,
            )
            .all()
        ).results;

        return rows.map((row) => ({
          id: `d1-audit-${row.id}`,
          action: row.action,
          actorEmail: row.user_email,
          actorRole: "admin",
          summary: row.summary,
          targetType:
            row.resource_type === "redirect" || row.resource_type === "comment" || row.resource_type === "content"
              ? row.resource_type
              : "auth",
          targetId: row.resource_id ?? `${row.id}`,
          createdAt: row.created_at,
        }));
      },
    },
    users: {
      async listAdminUsers() {
        const rows = (
          await db
            .prepare(
              `
                SELECT
                  id, email, role, name, active, created_at,
                  EXISTS (
                    SELECT 1
                    FROM user_invites i
                    WHERE i.user_id = admin_users.id
                      AND i.accepted_at IS NULL
                      AND datetime(i.expires_at) > CURRENT_TIMESTAMP
                  ) AS has_pending_invite
                FROM admin_users
                ORDER BY CASE role WHEN 'admin' THEN 0 ELSE 1 END, datetime(created_at) ASC, email ASC
              `,
            )
            .all()
        ).results;

        return rows.map((row) => ({
          id: row.id,
          email: row.email,
          role: row.role,
          name: row.name,
          active: row.active === 1,
          status: row.active !== 1 ? "suspended" : row.has_pending_invite === 1 ? "invited" : "active",
          createdAt: row.created_at,
        }));
      },
    },
    redirects: {
      async getRedirectRules() {
        const rows = (
          await db
            .prepare(
              `
                SELECT source_path, target_path, status_code
                FROM redirect_rules
                WHERE deleted_at IS NULL
                ORDER BY source_path ASC
              `,
            )
            .all()
        ).results;

        return rows.map((row) => ({
          sourcePath: row.source_path,
          targetPath: row.target_path,
          statusCode: row.status_code,
        }));
      },
    },
    comments: {
      async getComments() {
        const rows = (
          await db
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
            .all()
        ).results;

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
      },
      async getApprovedCommentsForRoute(route) {
        const comments = await this.getComments();
        return comments.filter((comment) => comment.route === route && comment.status === "approved");
      },
    },
    submissions: {
      async getContactSubmissions() {
        const rows = (
          await db
            .prepare(
              `
                SELECT id, name, email, message, submitted_at
                FROM contact_submissions
                ORDER BY datetime(submitted_at) DESC, id DESC
              `,
            )
            .all()
        ).results;

        return rows.map((row) => ({
          id: row.id,
          name: row.name,
          email: row.email,
          message: row.message,
          submittedAt: row.submitted_at,
        }));
      },
    },
    translations: {
      async getEffectiveTranslationState(route, fallback = "not_started") {
        const row = await db
          .prepare("SELECT state FROM translation_overrides WHERE route = ? LIMIT 1")
          .bind(route)
          .first();
        return normalizeTranslationState(row?.state, normalizeTranslationState(fallback));
      },
    },
    settings: {
      async getSettings() {
        const row = await db
          .prepare(
            `
              SELECT site_title, site_tagline, donation_url, newsletter_enabled, comments_default_policy, admin_slug
              FROM site_settings
              WHERE id = 1
              LIMIT 1
            `,
          )
          .first();

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
      },
    },
    rateLimits: createD1RateLimitPart(db),
    media: {
      async listMediaAssets() {
        const rows = (
          await db
            .prepare(
              `
                SELECT id, source_url, local_path, r2_key, mime_type, width, height, file_size, alt_text, title, uploaded_at, uploaded_by
                FROM media_assets
                WHERE deleted_at IS NULL
                ORDER BY datetime(uploaded_at) DESC, id DESC
              `,
            )
            .all()
        ).results;

        return rows.map((row) => ({
          id: row.id,
          sourceUrl: row.source_url,
          localPath: row.local_path,
          r2Key: row.r2_key,
          mimeType: row.mime_type,
          width: row.width,
          height: row.height,
          fileSize: row.file_size,
          altText: row.alt_text ?? "",
          title: row.title ?? "",
          uploadedAt: row.uploaded_at,
          uploadedBy: row.uploaded_by ?? "",
        }));
      },
    },
  };
}

export function createD1OperationsMutationPart(db) {
  return {
    submissions: {
      async submitContact(input) {
        const submission = {
          id: `contact-${crypto.randomUUID()}`,
          name: input.name,
          email: input.email,
          message: input.message,
          submittedAt: input.submittedAt,
        };

        await db
          .prepare(
            `
              INSERT INTO contact_submissions (id, name, email, message, submitted_at)
              VALUES (?, ?, ?, ?, ?)
            `,
          )
          .bind(submission.id, submission.name, submission.email, submission.message, submission.submittedAt)
          .run();

        return { ok: true, submission };
      },
    },
    comments: {
      async submitPublicComment(input) {
        const submittedAt = input.submittedAt || new Date().toISOString();
        const comment = {
          id: `public-${crypto.randomUUID()}`,
          author: input.author,
          email: input.email,
          body: input.body,
          route: input.route,
          status: "pending",
          policy: "open-moderated",
          submittedAt,
        };

        await db
          .prepare(
            `
              INSERT INTO comments (id, author, email, body, route, status, policy, submitted_at)
              VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            `,
          )
          .bind(comment.id, comment.author, comment.email ?? null, comment.body ?? null, comment.route, comment.status, comment.policy, submittedAt)
          .run();

        return { ok: true, comment };
      },
    },
    rateLimits: createD1RateLimitPart(db),
  };
}
