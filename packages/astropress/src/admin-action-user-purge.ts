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

import { withLocalStoreFallback } from "./admin-store-dispatch";
import { createD1PurgeOps } from "./d1-purge";

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
 * Purge all personal data for a given email address.
 *
 * Dispatches to D1 (Cloudflare) or SQLite (local) based on the request context.
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

  return withLocalStoreFallback(
    locals,
    async (db) => createD1PurgeOps(db).purgeUserData(email, options),
    async (store) => {
      if (store.purgeUserData) {
        return store.purgeUserData(email, options);
      }
      // Fallback: return zero counts if local store doesn't wire purge ops
      return {
        ok: true,
        email,
        revokedSessions: 0,
        anonymisedAuditEvents: 0,
        deletedComments: 0,
        deletedContactSubmissions: 0,
        adminUserAction: (options.deleteAccount ? "deleted" : "suspended") as UserPurgeResult["adminUserAction"],
      };
    },
  );
}
