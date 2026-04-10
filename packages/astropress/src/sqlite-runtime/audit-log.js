import { peekCmsConfig } from "../config.js";

export function recordAuditEvent(db, input) {
  db.prepare(
    `INSERT INTO audit_events (user_email, action, resource_type, resource_id, summary, details)
     VALUES (?, ?, ?, ?, ?, ?)`,
  ).run(
    input.userEmail,
    input.action,
    input.resourceType,
    input.resourceId ?? null,
    input.summary,
    input.details ? JSON.stringify(input.details) : null,
  );

  const retentionDays = peekCmsConfig()?.auditRetentionDays ?? 90;
  if (retentionDays > 0) {
    db.prepare(
      `DELETE FROM audit_events WHERE created_at < datetime('now', '-' || ? || ' days')`,
    ).run(retentionDays);
  }
}

export function listAuditEvents(db, options = {}) {
  const limit = options.limit ?? 50;
  const offset = options.offset ?? 0;

  let rows;
  if (options.resourceId) {
    rows = db
      .prepare(
        `SELECT id, user_email, action, resource_type, resource_id, summary, details, created_at
         FROM audit_events
         WHERE resource_id = ?
         ORDER BY created_at DESC
         LIMIT ? OFFSET ?`,
      )
      .all(options.resourceId, limit, offset);
  } else {
    rows = db
      .prepare(
        `SELECT id, user_email, action, resource_type, resource_id, summary, details, created_at
         FROM audit_events
         ORDER BY created_at DESC
         LIMIT ? OFFSET ?`,
      )
      .all(limit, offset);
  }

  return rows.map((row) => ({
    id: row.id,
    userEmail: row.user_email,
    action: row.action,
    resourceType: row.resource_type,
    resourceId: row.resource_id,
    summary: row.summary,
    details: row.details ? JSON.parse(row.details) : null,
    createdAt: row.created_at,
  }));
}
