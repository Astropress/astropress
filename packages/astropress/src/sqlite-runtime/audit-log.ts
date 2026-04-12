import type { AstropressSqliteDatabaseLike } from "./utils";
import { peekCmsConfig } from "../config";

export interface AuditEventRecord {
  id: number;
  userEmail: string;
  action: string;
  resourceType: string;
  resourceId: string | null;
  summary: string;
  details: Record<string, unknown> | null;
  createdAt: string;
}

export interface RecordAuditEventInput {
  userEmail: string;
  action: string;
  resourceType: string;
  resourceId?: string | null;
  summary: string;
  details?: Record<string, unknown> | null;
}

export function recordAudit(
  db: AstropressSqliteDatabaseLike,
  actor: { email: string },
  action: string,
  summary: string,
  resourceType: string,
  resourceId: string,
): void {
  recordAuditEvent(db, {
    userEmail: actor.email,
    action,
    resourceType,
    resourceId,
    summary,
  });
}

export function recordAuditEvent(db: AstropressSqliteDatabaseLike, input: RecordAuditEventInput): void {
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

export function listAuditEvents(
  db: AstropressSqliteDatabaseLike,
  options: { limit?: number; offset?: number; resourceId?: string } = {},
): AuditEventRecord[] {
  const limit = options.limit ?? 50;
  const offset = options.offset ?? 0;

  let rows: unknown[];
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

  return (rows as Array<{
    id: number;
    user_email: string;
    action: string;
    resource_type: string;
    resource_id: string | null;
    summary: string;
    details: string | null;
    created_at: string;
  }>).map((row) => ({
    id: row.id,
    userEmail: row.user_email,
    action: row.action,
    resourceType: row.resource_type,
    resourceId: row.resource_id,
    summary: row.summary,
    details: row.details ? (JSON.parse(row.details) as Record<string, unknown>) : null,
    createdAt: row.created_at,
  }));
}
