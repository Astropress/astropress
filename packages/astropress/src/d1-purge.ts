import type { UserPurgeResult } from "./admin-action-user-purge";
import type { D1DatabaseLike } from "./d1-database";

export function createD1PurgeOps(db: D1DatabaseLike) {
	return {
		async purgeUserData(
			email: string,
			options: { deleteAccount?: boolean } = {},
		): Promise<UserPurgeResult> {
			const userRow = await db
				.prepare("SELECT id FROM admin_users WHERE email = ? LIMIT 1")
				.bind(email)
				.first<{ id: number }>();

			let revokedSessions = 0;
			if (userRow) {
				const result = await db
					.prepare("DELETE FROM admin_sessions WHERE user_id = ?")
					.bind(userRow.id)
					.run();
				revokedSessions = result.meta?.changes ?? 0;
			}

			const auditResult = await db
				.prepare(
					"UPDATE audit_events SET user_email = '[deleted]' WHERE user_email = ?",
				)
				.bind(email)
				.run();
			const anonymisedAuditEvents = auditResult.meta?.changes ?? 0;

			const commentsResult = await db
				.prepare("DELETE FROM comments WHERE email = ?")
				.bind(email)
				.run();
			const deletedComments = commentsResult.meta?.changes ?? 0;

			const submissionsResult = await db
				.prepare("DELETE FROM contact_submissions WHERE email = ?")
				.bind(email)
				.run();
			const deletedContactSubmissions = submissionsResult.meta?.changes ?? 0;

			let adminUserAction: UserPurgeResult["adminUserAction"];
			if (!userRow) {
				adminUserAction = "not_found";
			} else if (options.deleteAccount) {
				await db
					.prepare("DELETE FROM admin_users WHERE email = ?")
					.bind(email)
					.run();
				adminUserAction = "deleted";
			} else {
				await db
					.prepare("UPDATE admin_users SET active = 0 WHERE email = ?")
					.bind(email)
					.run();
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
