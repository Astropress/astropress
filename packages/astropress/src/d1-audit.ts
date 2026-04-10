import type { Actor } from "./persistence-types";
import { getCloudflareBindings } from "./runtime-env";
import { peekCmsConfig } from "./config";

export async function recordD1Audit(
  locals: App.Locals | null | undefined,
  actor: Actor,
  action: string,
  resourceType: string,
  resourceId: string,
  summary: string,
): Promise<void> {
  const db = getCloudflareBindings(locals).DB;
  /* v8 ignore next 3 */
  if (!db) {
    return;
  }

  await db
    .prepare(
      `
        INSERT INTO audit_events (user_email, action, resource_type, resource_id, summary)
        VALUES (?, ?, ?, ?, ?)
      `,
    )
    .bind(actor.email, action, resourceType, resourceId, summary)
    .run();

  const retentionDays = peekCmsConfig()?.auditRetentionDays ?? 90;
  if (retentionDays > 0) {
    await db
      .prepare(`DELETE FROM audit_events WHERE created_at < datetime('now', '-' || ? || ' days')`)
      .bind(retentionDays)
      .run();
  }
}
