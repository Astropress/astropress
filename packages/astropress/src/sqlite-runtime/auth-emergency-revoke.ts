import type { DatabaseSync } from "node:sqlite";

export interface SqliteAuthRevokeResult {
	sessionsRevoked: number;
	tokensRevoked: number;
}

export function revokeSessionsInDb(
	db: InstanceType<typeof DatabaseSync>,
	userEmail: string | undefined,
): number {
	if (userEmail) {
		const result = db
			.prepare(
				`UPDATE admin_sessions SET revoked_at = CURRENT_TIMESTAMP
         WHERE user_id = (SELECT id FROM admin_users WHERE email = ?)
           AND revoked_at IS NULL`,
			)
			.run(userEmail) as { changes: number };
		return result.changes;
	}
	const result = db
		.prepare(
			`UPDATE admin_sessions SET revoked_at = CURRENT_TIMESTAMP
       WHERE revoked_at IS NULL`,
		)
		.run() as { changes: number };
	return result.changes;
}

export function revokeApiTokensInDb(
	db: InstanceType<typeof DatabaseSync>,
): number {
	const result = db
		.prepare(
			`UPDATE api_tokens SET revoked_at = CURRENT_TIMESTAMP
       WHERE revoked_at IS NULL`,
		)
		.run() as { changes: number };
	return result.changes;
}

export function recordEmergencyRevokeAuditEvent(
	db: InstanceType<typeof DatabaseSync>,
	scope: string,
	userEmail: string | null,
	sessionsRevoked: number,
	tokensRevoked: number,
): void {
	db.prepare(
		`INSERT INTO audit_events (user_email, action, resource_type, resource_id, summary, details)
     VALUES (?, ?, ?, ?, ?, ?)`,
	).run(
		"cli",
		"auth.emergency-revoke",
		"auth",
		null,
		`Emergency revoke: scope=${scope}${userEmail ? `, user=${userEmail}` : ""}`,
		JSON.stringify({ scope, userEmail, sessionsRevoked, tokensRevoked }),
	);
}
