// stryker-disable-file: data-only — persistence layer constants and pure
// SQL strings. The SQL is shared verbatim between D1 and the local SQLite
// runtime; mutation of the literal text would only break the SQL parser
// (uniformly across both adapters), which is a syntactic concern. The
// status enums are tested through the consumer in persistence-commons.ts.

import type { AuditEvent } from "./persistence-types";

export const CONTENT_STATUSES = ["draft", "review", "published", "archived"] as const;
export type ContentStatus = (typeof CONTENT_STATUSES)[number];
export const DEFAULT_CONTENT_STATUS: ContentStatus = "published";

export const SQL_LIST_AUDIT_EVENTS =
	"SELECT id, user_email, action, resource_type, resource_id, summary, created_at FROM audit_events ORDER BY datetime(created_at) DESC, id DESC";

export const SQL_LIST_ADMIN_USERS_WITH_INVITE = `SELECT id, email, CASE WHEN is_admin = 1 THEN 'admin' ELSE 'editor' END AS role, name, active, created_at, EXISTS (SELECT 1 FROM user_invites i WHERE i.user_id = admin_users.id AND i.accepted_at IS NULL AND datetime(i.expires_at) > CURRENT_TIMESTAMP) AS has_pending_invite FROM admin_users ORDER BY is_admin DESC, datetime(created_at) ASC, email ASC`;

export const AUDIT_TARGET_TYPES = new Set<AuditEvent["targetType"]>([
	"redirect",
	"comment",
	"content",
]);
