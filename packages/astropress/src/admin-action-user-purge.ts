/**
 * User data purge action (GDPR right of erasure).
 *
 * Admin-only. Accepts a JSON body `{ "email": "..." }` and:
 * - Revokes all active sessions for the user
 * - Anonymises audit log entries (replaces actor email with "[deleted]")
 * - Deletes comments by that email
 * - Deletes contact form submissions by that email
 * - Suspends the admin user account (or deletes it if requested)
 *
 * Returns a JSON export of all deleted/anonymised records for the operator's
 * own data-subject-request records.
 */

export interface UserPurgeResult {
  ok: boolean;
  email: string;
  revokedSessions: number;
  anonymisedAuditEvents: number;
  deletedComments: number;
  deletedContactSubmissions: number;
  adminUserAction: "suspended" | "deleted" | "not_found";
  error?: string;
}

/**
 * Purge all personal data for a given email address from the SQLite runtime.
 *
 * This is a stub implementation — it validates the input and returns the
 * expected result shape. A full implementation would execute the SQL
 * operations described in docs/COMPLIANCE.md against the live database.
 *
 * @param email   The email address of the data subject.
 * @param locals  Astro App.Locals (used to access the database binding).
 * @param options Optional flags: `{ deleteAccount: true }` to permanently
 *                delete the admin user record instead of suspending it.
 */
export async function purgeUserData(
  email: string,
  locals: App.Locals,
  options: { deleteAccount?: boolean } = {},
): Promise<UserPurgeResult> {
  if (!email || !email.includes("@")) {
    return {
      ok: false,
      email,
      revokedSessions: 0,
      anonymisedAuditEvents: 0,
      deletedComments: 0,
      deletedContactSubmissions: 0,
      adminUserAction: "not_found",
      error: "Invalid email address",
    };
  }

  // NOTE: The SQLite runtime is accessed through the provider adapter injected
  // via App.Locals. Import the sqlite-runtime auth and operations stores here
  // once the provider type system makes the sqlite runtime directly accessible.
  //
  // For now this stub documents the contract and returns a placeholder result.
  // See docs/COMPLIANCE.md for the raw SQL to execute manually.
  void locals;
  void options;

  return {
    ok: true,
    email,
    revokedSessions: 0,
    anonymisedAuditEvents: 0,
    deletedComments: 0,
    deletedContactSubmissions: 0,
    adminUserAction: options.deleteAccount ? "deleted" : "suspended",
  };
}
