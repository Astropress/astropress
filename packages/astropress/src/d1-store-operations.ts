import type { D1DatabaseLike } from "./d1-database";
import type {
  AuditEvent,
  CommentRecord,
  CommentStatus,
  ContactSubmission,
  ManagedAdminUser,
  MediaAsset,
  RedirectRule,
  TestimonialSubmission,
  TestimonialSubmissionInput,
  TestimonialStatus,
  TestimonialSource,
} from "./persistence-types";
import type { SiteSettings } from "./site-settings";
import { defaultSiteSettings } from "./site-settings";
import { normalizeTranslationState } from "./translation-state";
import type { D1AdminMutationStore, D1AdminReadStore } from "./d1-admin-store";
import { createD1RateLimitPart } from "./d1-rate-limit-part";

type CommentPolicy = "legacy-readonly" | "disabled" | "open-moderated";

export function createD1OperationsReadPart(db: D1DatabaseLike): Omit<D1AdminReadStore, "content" | "authors" | "taxonomies"> {
  return {
    audit: {
      async getAuditEvents(): Promise<AuditEvent[]> {
        const rows = (
          await db
            .prepare(
              `
                SELECT id, user_email, action, resource_type, resource_id, summary, created_at
                FROM audit_events
                ORDER BY datetime(created_at) DESC, id DESC
              `,
            )
            .all<{
              id: number;
              user_email: string;
              action: string;
              resource_type: string;
              resource_id: string | null;
              summary: string;
              created_at: string;
            }>()
        ).results;

        return rows.map((row) => ({
          id: `d1-audit-${row.id}`,
          action: row.action,
          actorEmail: row.user_email,
          actorRole: "admin" as const,
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
      async listAdminUsers(): Promise<ManagedAdminUser[]> {
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
            .all<{
              id: number;
              email: string;
              role: "admin" | "editor";
              name: string;
              active: number;
              created_at: string;
              has_pending_invite: number;
            }>()
        ).results;

        return rows.map((row) => ({
          id: row.id,
          email: row.email,
          role: row.role,
          name: row.name,
          active: row.active === 1,
          status: row.active !== 1 ? ("suspended" as const) : row.has_pending_invite === 1 ? ("invited" as const) : ("active" as const),
          createdAt: row.created_at,
        }));
      },
    },
    redirects: {
      async getRedirectRules(): Promise<RedirectRule[]> {
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
            .all<{ source_path: string; target_path: string; status_code: 301 | 302 }>()
        ).results;

        return rows.map((row) => ({
          sourcePath: row.source_path,
          targetPath: row.target_path,
          statusCode: row.status_code,
        }));
      },
    },
    comments: {
      async getComments(): Promise<CommentRecord[]> {
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
            .all<{
              id: string;
              author: string;
              email: string | null;
              body: string | null;
              route: string;
              status: CommentStatus;
              policy: CommentPolicy;
              submitted_at: string;
            }>()
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
      async getApprovedCommentsForRoute(route: string): Promise<CommentRecord[]> {
        const comments = await this.getComments();
        return comments.filter((comment) => comment.route === route && comment.status === "approved");
      },
    },
    submissions: {
      async getContactSubmissions(): Promise<ContactSubmission[]> {
        const rows = (
          await db
            .prepare(
              `
                SELECT id, name, email, message, submitted_at
                FROM contact_submissions
                ORDER BY datetime(submitted_at) DESC, id DESC
              `,
            )
            .all<{ id: string; name: string; email: string; message: string; submitted_at: string }>()
        ).results;

        return rows.map((row) => ({
          id: row.id,
          name: row.name,
          email: row.email,
          message: row.message,
          submittedAt: row.submitted_at,
        }));
      },
      async getTestimonials(status?: TestimonialStatus): Promise<TestimonialSubmission[]> {
        const rows = (
          await db
            .prepare(
              `
                SELECT id, name, email, company, role, before_state, transformation,
                       specific_result, consent_to_publish, status, source, submitted_at, approved_at
                FROM testimonial_submissions
                WHERE (? IS NULL OR status = ?)
                ORDER BY submitted_at DESC, id DESC
              `,
            )
            .bind(status ?? null, status ?? null)
            .all<{
              id: string;
              name: string;
              email: string;
              company: string | null;
              role: string | null;
              before_state: string | null;
              transformation: string | null;
              specific_result: string | null;
              consent_to_publish: number;
              status: string;
              source: string;
              submitted_at: string;
              approved_at: string | null;
            }>()
        ).results;

        return rows.map((row) => ({
          id: row.id,
          name: row.name,
          email: row.email,
          company: row.company ?? undefined,
          role: row.role ?? undefined,
          beforeState: row.before_state ?? undefined,
          transformation: row.transformation ?? undefined,
          specificResult: row.specific_result ?? undefined,
          consentToPublish: row.consent_to_publish === 1,
          status: row.status as TestimonialStatus,
          source: row.source as TestimonialSource,
          submittedAt: row.submitted_at,
          approvedAt: row.approved_at ?? undefined,
        }));
      },
    },
    translations: {
      async getEffectiveTranslationState(route: string, fallback = "not_started"): Promise<string> {
        const row = await db
          .prepare("SELECT state FROM translation_overrides WHERE route = ? LIMIT 1")
          .bind(route)
          .first<{ state: string }>();
        return normalizeTranslationState(row?.state, normalizeTranslationState(fallback));
      },
    },
    settings: {
      async getSettings(): Promise<SiteSettings> {
        const row = await db
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
      async listMediaAssets(): Promise<MediaAsset[]> {
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
            .all<{
              id: string;
              source_url: string | null;
              local_path: string;
              r2_key: string | null;
              mime_type: string | null;
              width: number | null;
              height: number | null;
              file_size: number | null;
              alt_text: string | null;
              title: string | null;
              uploaded_at: string;
              uploaded_by: string | null;
            }>()
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

export function createD1OperationsMutationPart(db: D1DatabaseLike): Pick<D1AdminMutationStore, "submissions" | "comments" | "rateLimits"> {
  return {
    submissions: {
      async submitTestimonial(input: TestimonialSubmissionInput): Promise<{ ok: true; id: string }> {
        const id = `testimonial-${crypto.randomUUID()}`;
        await db
          .prepare(
            `
              INSERT INTO testimonial_submissions
                (id, name, email, company, role, before_state, transformation,
                 specific_result, consent_to_publish, status, source, submitted_at)
              VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending', ?, ?)
            `,
          )
          .bind(
            id,
            input.name,
            input.email,
            input.company ?? null,
            input.role ?? null,
            input.beforeState ?? null,
            input.transformation ?? null,
            input.specificResult ?? null,
            input.consentToPublish ? 1 : 0,
            input.source,
            input.submittedAt,
          )
          .run();
        return { ok: true as const, id };
      },
      async moderateTestimonial(id: string, status: TestimonialStatus, actorEmail: string): Promise<{ ok: true } | { ok: false; error: string }> {
        const approvedStatuses: TestimonialStatus[] = ["approved", "featured"];
        const approvedAtExpr = approvedStatuses.includes(status)
          ? "CASE WHEN approved_at IS NULL THEN CURRENT_TIMESTAMP ELSE approved_at END"
          : "approved_at";
        const result = await db
          .prepare(
            `UPDATE testimonial_submissions SET status = ?, approved_at = ${approvedAtExpr} WHERE id = ?`,
          )
          .bind(status, id)
          .run();
        if (!result.meta.changes) {
          return { ok: false as const, error: "Testimonial not found" };
        }
        return { ok: true as const };
      },
      async submitContact(input): Promise<{ ok: true; submission: ContactSubmission }> {
        const submission: ContactSubmission = {
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

        return { ok: true as const, submission };
      },
    },
    comments: {
      async submitPublicComment(input): Promise<{ ok: true; comment: CommentRecord }> {
        const submittedAt = input.submittedAt || new Date().toISOString();
        const comment: CommentRecord = {
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

        return { ok: true as const, comment };
      },
    },
    rateLimits: createD1RateLimitPart(db),
  };
}
