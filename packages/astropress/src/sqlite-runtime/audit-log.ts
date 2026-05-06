import { peekCmsConfig } from "../config";
import { buildAuditEntry } from "../persistence-commons";
import type { AstropressSqliteDatabaseLike } from "./utils";

// audit-boundary: opaque-passthrough -- SQL row-shape mirror; columns narrowed at row-mapper boundary
type AuditDetails = Record<string, unknown>;

function parseDetailsJson(value: string | null): AuditDetails | null {
	if (!value) return null;
	// audit-boundary: opaque-passthrough -- SQL row-shape mirror; columns narrowed at row-mapper boundary
	return JSON.parse(value) as Record<string, unknown>;
}

export interface AuditEventRecord {
	id: number;
	userEmail: string;
	action: string;
	resourceType: string;
	resourceId: string | null;
	summary: string;
	// audit-boundary: opaque-passthrough -- SQL row-shape mirror; columns narrowed at row-mapper boundary
	details: Record<string, unknown> | null;
	createdAt: string;
}

export interface RecordAuditEventInput {
	userEmail: string;
	action: string;
	resourceType: string;
	resourceId?: string | null;
	summary: string;
	// audit-boundary: opaque-passthrough -- SQL row-shape mirror; columns narrowed at row-mapper boundary
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

export function recordAuditEvent(
	db: AstropressSqliteDatabaseLike,
	input: RecordAuditEventInput,
): void {
	const entry = buildAuditEntry({
		actor: { email: input.userEmail },
		action: input.action,
		resourceType: input.resourceType,
		resourceId: input.resourceId,
		summary: input.summary,
		details: input.details,
	});
	db.prepare(
		`INSERT INTO audit_events (user_email, action, resource_type, resource_id, summary, details)
     VALUES (?, ?, ?, ?, ?, ?)`,
	).run(
		entry.userEmail,
		entry.action,
		entry.resourceType,
		entry.resourceId,
		entry.summary,
		entry.details,
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

	// audit-boundary: opaque-passthrough -- raw rows from driver; mapped below at row-shape boundary
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

	return (
		rows as Array<{
			id: number;
			user_email: string;
			action: string;
			resource_type: string;
			resource_id: string | null;
			summary: string;
			details: string | null;
			created_at: string;
		}>
	).map((row) => ({
		id: row.id,
		userEmail: row.user_email,
		action: row.action,
		resourceType: row.resource_type,
		resourceId: row.resource_id,
		summary: row.summary,
		details: parseDetailsJson(row.details),
		createdAt: row.created_at,
	}));
}
