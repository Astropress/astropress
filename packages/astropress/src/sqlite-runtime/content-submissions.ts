import { createAstropressSubmissionRepository } from "../submission-repository-factory";
import type { AstropressSqliteDatabaseLike } from "./utils";

export function createSqliteSubmissionStore(getDb: () => AstropressSqliteDatabaseLike) {
  function getContactSubmissions() {
    const rows = getDb()
      .prepare(
        `SELECT id, name, email, message, submitted_at FROM contact_submissions ORDER BY datetime(submitted_at) DESC, id DESC`,
      )
      .all() as Array<{ id: string; name: string; email: string; message: string; submitted_at: string }>;

    return rows.map((row) => ({
      id: row.id,
      name: row.name,
      email: row.email,
      message: row.message,
      submittedAt: row.submitted_at,
    }));
  }

  const sqliteSubmissionRepository = createAstropressSubmissionRepository({
    getContactSubmissions,
    insertContactSubmission(submission) {
      getDb()
        .prepare(`INSERT INTO contact_submissions (id, name, email, message, submitted_at) VALUES (?, ?, ?, ?, ?)`)
        .run(submission.id, submission.name, submission.email, submission.message, submission.submittedAt);
    },
  });

  const sqliteSchedulingRepository = {
    schedulePublish(id: string, scheduledAt: string): void {
      getDb()
        .prepare("UPDATE content_overrides SET scheduled_at = ?, status = 'draft' WHERE slug = ?")
        .run(scheduledAt, id);
      getDb()
        .prepare(
          `INSERT INTO content_overrides (slug, scheduled_at, status, title, seo_title, meta_description, updated_at, updated_by)
           SELECT ce.slug, ?, 'draft', ce.title, ce.title, '', CURRENT_TIMESTAMP, 'scheduler'
           FROM content_entries ce WHERE ce.slug = ?
           AND NOT EXISTS (SELECT 1 FROM content_overrides co WHERE co.slug = ?)`,
        )
        .run(scheduledAt, id, id);
    },

    listScheduled(): Array<{ id: string; slug: string; title: string; scheduledAt: string }> {
      const now = new Date().toISOString();
      const rows = getDb()
        .prepare(
          `SELECT co.slug AS id, co.slug, COALESCE(co.title, ce.title, co.slug) AS title, co.scheduled_at
           FROM content_overrides co LEFT JOIN content_entries ce ON ce.slug = co.slug
           WHERE co.scheduled_at IS NOT NULL AND co.scheduled_at > ? ORDER BY co.scheduled_at ASC`,
        )
        .all(now) as Array<{ id: string; slug: string; title: string; scheduled_at: string }>;
      return rows.map((r) => ({ id: r.slug, slug: r.slug, title: r.title, scheduledAt: r.scheduled_at }));
    },

    cancelScheduledPublish(id: string): void {
      getDb().prepare("UPDATE content_overrides SET scheduled_at = NULL WHERE slug = ?").run(id);
    },

    runScheduledPublishes(): number {
      const now = new Date().toISOString();
      const result = getDb()
        .prepare(
          `UPDATE content_overrides SET status = 'published', scheduled_at = NULL WHERE scheduled_at IS NOT NULL AND scheduled_at <= ?`,
        )
        .run(now);
      return result.changes as number;
    },
  };

  return { sqliteSubmissionRepository, sqliteSchedulingRepository };
}
