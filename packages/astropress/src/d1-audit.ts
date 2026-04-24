import { peekCmsConfig } from "./config";
import { buildAuditEntry } from "./persistence-commons";
import type { Actor } from "./persistence-types";
import { getCloudflareBindings } from "./runtime-env";

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

	const entry = buildAuditEntry({
		actor,
		action,
		resourceType,
		resourceId,
		summary,
	});

	// D1 schema predates the `details` column — only 5 values bind here.
	await db
		.prepare(
			`INSERT INTO audit_events (user_email, action, resource_type, resource_id, summary)
       VALUES (?, ?, ?, ?, ?)`,
		)
		.bind(
			entry.userEmail,
			entry.action,
			entry.resourceType,
			entry.resourceId,
			entry.summary,
		)
		.run();

	const retentionDays = peekCmsConfig()?.auditRetentionDays ?? 90;
	if (retentionDays > 0) {
		await db
			.prepare(
				`DELETE FROM audit_events WHERE created_at < datetime('now', '-' || ? || ' days')`,
			)
			.bind(retentionDays)
			.run();
	}
}
