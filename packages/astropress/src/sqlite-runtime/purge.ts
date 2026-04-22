import type { UserPurgeResult } from "../admin-action-user-purge";
import type { AstropressSqliteDatabaseLike } from "./utils";

export function createSqlitePurgeOps(
	getDb: () => AstropressSqliteDatabaseLike,
) {
	return {
		purgeUserData(
			email: string,
			options: { deleteAccount?: boolean } = {},
		): UserPurgeResult {
			const db = getDb();

			const userRow = db
				.prepare("SELECT id FROM admin_users WHERE email = ? LIMIT 1")
				.get(email) as { id: number } | undefined;

			// Revoke sessions (delete all sessions for this user)
			let revokedSessions = 0;
			if (userRow) {
				const result = db
					.prepare("DELETE FROM admin_sessions WHERE user_id = ?")
					.run(userRow.id);
				revokedSessions = result.changes as number;
			}

			// Anonymise audit events
			const auditResult = db
				.prepare(
					"UPDATE audit_events SET user_email = '[deleted]' WHERE user_email = ?",
				)
				.run(email);
			const anonymisedAuditEvents = auditResult.changes as number;

			// Delete comments
			const commentsResult = db
				.prepare("DELETE FROM comments WHERE email = ?")
				.run(email);
			const deletedComments = commentsResult.changes as number;

			// Delete contact submissions
			const submissionsResult = db
				.prepare("DELETE FROM contact_submissions WHERE email = ?")
				.run(email);
			const deletedContactSubmissions = submissionsResult.changes as number;

			// Suspend or delete the admin user
			let adminUserAction: UserPurgeResult["adminUserAction"];
			if (!userRow) {
				adminUserAction = "not_found";
			} else if (options.deleteAccount) {
				db.prepare("DELETE FROM admin_users WHERE email = ?").run(email);
				adminUserAction = "deleted";
			} else {
				db.prepare("UPDATE admin_users SET active = 0 WHERE email = ?").run(
					email,
				);
				adminUserAction = "suspended";
			}

			return {
				ok: true,
				email,
				revokedSessions,
				anonymisedAuditEvents,
				deletedComments,
				deletedContactSubmissions,
				adminUserAction,
			};
		},
	};
}
