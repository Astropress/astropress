export function createSqlitePurgeOps(getDb) {
  return {
    purgeUserData(email, options = {}) {
      const db = getDb();

      const userRow = db.prepare("SELECT id FROM admin_users WHERE email = ? LIMIT 1").get(email);

      let revokedSessions = 0;
      if (userRow) {
        const result = db.prepare("DELETE FROM admin_sessions WHERE user_id = ?").run(userRow.id);
        revokedSessions = result.changes;
      }

      const auditResult = db
        .prepare("UPDATE audit_events SET user_email = '[deleted]' WHERE user_email = ?")
        .run(email);
      const anonymisedAuditEvents = auditResult.changes;

      const commentsResult = db.prepare("DELETE FROM comments WHERE email = ?").run(email);
      const deletedComments = commentsResult.changes;

      const submissionsResult = db.prepare("DELETE FROM contact_submissions WHERE email = ?").run(email);
      const deletedContactSubmissions = submissionsResult.changes;

      let adminUserAction;
      if (!userRow) {
        adminUserAction = "not_found";
      } else if (options.deleteAccount) {
        db.prepare("DELETE FROM admin_users WHERE email = ?").run(email);
        adminUserAction = "deleted";
      } else {
        db.prepare("UPDATE admin_users SET active = 0 WHERE email = ?").run(email);
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
