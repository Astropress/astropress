import { createAstropressAuthRepository } from "../auth-repository-factory";
import { createAstropressUserRepository } from "../user-repository-factory";
import { hashOpaqueToken, hashPasswordSync, verifyPasswordSync, type AstropressSqliteDatabaseLike } from "./utils";
import { recordAudit } from "./audit-log";
import type { SessionUser, Actor } from "../persistence-types";

type AdminRole = SessionUser["role"];

interface PasswordResetTokenRow {
  id: string;
  user_id: number;
  token_hash: string;
  expires_at: string;
  consumed_at: string | null;
  created_at: string;
}

interface UserInviteRow {
  id: string;
  user_id: number;
  token_hash: string;
  expires_at: string;
  accepted_at: string | null;
  created_at: string;
}

interface AuthStoreOptions {
  sessionTtlMs: number;
  now: () => number;
  randomId: () => string;
}

export function createSqliteAuthStore(
  getDb: () => AstropressSqliteDatabaseLike,
  options: AuthStoreOptions,
) {
  const { sessionTtlMs, now, randomId } = options;

  function getPersistedAuditEvents() {
    const rows = getDb()
      .prepare(
        `
          SELECT id, user_email, action, resource_type, resource_id, summary, created_at
          FROM audit_events
          ORDER BY datetime(created_at) DESC, id DESC
        `,
      )
      .all() as Array<{
      id: number;
      user_email: string;
      action: string;
      resource_type: string;
      resource_id: string | null;
      summary: string;
      created_at: string;
    }>;

    return rows.map((row) => ({
      id: `sqlite-audit-${row.id}`,
      action: row.action,
      actorEmail: row.user_email,
      actorRole: "admin" as const,
      summary: row.summary,
      targetType:
        row.resource_type === "redirect" || row.resource_type === "comment" || row.resource_type === "content"
          ? row.resource_type
          : ("auth" as const),
      targetId: row.resource_id ?? `${row.id}`,
      createdAt: row.created_at,
    }));
  }

  function cleanupExpiredSessions() {
    getDb()
      .prepare(
        `
          UPDATE admin_sessions
          SET revoked_at = CURRENT_TIMESTAMP
          WHERE revoked_at IS NULL
            AND last_active_at < datetime('now', '-12 hours')
        `,
      )
      .run();
  }

  function listAdminUsers() {
    const rows = getDb()
      .prepare(
        `
          SELECT
            id,
            email,
            role,
            name,
            active,
            created_at,
            EXISTS (
              SELECT 1
              FROM user_invites i
              WHERE i.user_id = admin_users.id
                AND i.accepted_at IS NULL
                AND datetime(i.expires_at) > CURRENT_TIMESTAMP
            ) AS has_pending_invite
          FROM admin_users
          ORDER BY CASE role WHEN 'admin' THEN 0 ELSE 1 END, datetime(created_at) ASC, email ASC
        `,
      )
      .all() as Array<{
      id: number;
      email: string;
      role: AdminRole;
      name: string;
      active: number;
      created_at: string;
      has_pending_invite: number;
    }>;

    return rows.map((row) => ({
      id: row.id,
      email: row.email,
      role: row.role,
      name: row.name,
      active: row.active === 1,
      status: (row.active !== 1 ? "suspended" : row.has_pending_invite === 1 ? "invited" : "active") as
        | "active"
        | "invited"
        | "suspended",
      createdAt: row.created_at,
    }));
  }

  const sqliteUserRepository = createAstropressUserRepository({
    listAdminUsers,
    hashPassword: hashPasswordSync,
    hashOpaqueToken,
    findAdminUserByEmail(email: string) {
      return (getDb().prepare("SELECT id FROM admin_users WHERE email = ? LIMIT 1").get(email) as { id: number } | undefined) ?? null;
    },
    createInvitedAdminUser({ email, passwordHash, role, name }: { email: string; passwordHash: string; role: AdminRole; name: string }) {
      try {
        getDb()
          .prepare(
            `
              INSERT INTO admin_users (email, password_hash, role, name, active)
              VALUES (?, ?, ?, ?, 1)
            `,
          )
          .run(email, passwordHash, role, name);
        return true;
      } catch {
        return false;
      }
    },
    getAdminUserIdByEmail(email: string) {
      return (getDb().prepare("SELECT id FROM admin_users WHERE email = ? LIMIT 1").get(email) as { id: number } | undefined)?.id ?? null;
    },
    insertUserInvite({ inviteId, userId, tokenHash, expiresAt, invitedBy }: { inviteId: string; userId: number; tokenHash: string; expiresAt: string; invitedBy: string }) {
      try {
        getDb()
          .prepare(
            `
              INSERT INTO user_invites (id, user_id, token_hash, expires_at, invited_by)
              VALUES (?, ?, ?, ?, ?)
            `,
          )
          .run(inviteId, userId, tokenHash, expiresAt, invitedBy);
        return true;
      } catch {
        return false;
      }
    },
    setAdminUserActiveState(email: string, nextActive: boolean) {
      const expectedActive = nextActive ? 0 : 1;
      return (
        getDb()
          .prepare("UPDATE admin_users SET active = ? WHERE email = ? AND active = ?")
          .run(nextActive ? 1 : 0, email, expectedActive).changes > 0
      );
    },
    revokeAdminSessionsForEmail(email: string) {
      getDb()
        .prepare(
          `
            UPDATE admin_sessions
            SET revoked_at = CURRENT_TIMESTAMP
            WHERE user_id = (SELECT id FROM admin_users WHERE email = ?)
              AND revoked_at IS NULL
          `,
        )
        .run(email);
    },
    recordUserAudit({ actor, action, summary, targetId }: { actor: Actor; action: string; summary: string; targetId: string }) {
      recordAudit(getDb(), actor, action, summary, "auth", targetId);
    },
  });

  const sqliteAuthRepository = createAstropressAuthRepository({
    sessionTtlMs,
    now,
    randomId,
    hashOpaqueToken,
    hashPassword: hashPasswordSync,
    verifyPassword: verifyPasswordSync,
    cleanupExpiredSessions,
    findActiveAdminUserByEmail(email: string) {
      const row = getDb()
        .prepare(
          `
            SELECT id, email, password_hash, role, name
            FROM admin_users
            WHERE email = ?
              AND active = 1
            LIMIT 1
          `,
        )
        .get(email) as
        | {
            id: number;
            email: string;
            password_hash: string;
            role: AdminRole;
            name: string;
          }
        | undefined;

      if (!row) {
        return null;
      }

      return {
        id: row.id,
        email: row.email,
        passwordHash: row.password_hash,
        role: row.role,
        name: row.name,
      };
    },
    findActiveAdminUserIdByEmail(email: string) {
      return (
        getDb().prepare("SELECT id FROM admin_users WHERE email = ? AND active = 1 LIMIT 1").get(email) as
          | { id: number }
          | undefined
      )?.id ?? null;
    },
    insertSession({ sessionToken, userId, csrfToken, ipAddress, userAgent }: { sessionToken: string; userId: number; csrfToken: string; ipAddress: string | null; userAgent: string | null }) {
      getDb()
        .prepare(
          `
            INSERT INTO admin_sessions (id, user_id, csrf_token, ip_address, user_agent)
            VALUES (?, ?, ?, ?, ?)
          `,
        )
        .run(sessionToken, userId, csrfToken, ipAddress ?? null, userAgent ?? null);
    },
    findLiveSessionById(sessionToken: string) {
      const row = getDb()
        .prepare(
          `
            SELECT s.id, s.csrf_token, s.last_active_at, u.email, u.role, u.name
            FROM admin_sessions s
            JOIN admin_users u ON u.id = s.user_id
            WHERE s.id = ?
              AND s.revoked_at IS NULL
              AND u.active = 1
            LIMIT 1
          `,
        )
        .get(sessionToken) as
        | {
            id: string;
            csrf_token: string;
            last_active_at: string;
            email: string;
            role: AdminRole;
            name: string;
          }
        | undefined;

      if (!row) {
        return null;
      }

      return {
        id: row.id,
        csrfToken: row.csrf_token,
        lastActiveAt: row.last_active_at,
        email: row.email,
        role: row.role,
        name: row.name,
      };
    },
    touchSession(sessionToken: string) {
      getDb().prepare("UPDATE admin_sessions SET last_active_at = CURRENT_TIMESTAMP WHERE id = ?").run(sessionToken);
    },
    revokeSessionById(sessionToken: string) {
      getDb()
        .prepare(
          `
            UPDATE admin_sessions
            SET revoked_at = CURRENT_TIMESTAMP
            WHERE id = ?
              AND revoked_at IS NULL
          `,
        )
        .run(sessionToken);
    },
    findInviteTokenByHash(tokenHash: string) {
      const row = getDb()
        .prepare(
          `
            SELECT i.id, i.user_id, i.token_hash, i.expires_at, i.accepted_at, i.created_at,
                   u.email, u.name, u.role, u.active
            FROM user_invites i
            JOIN admin_users u ON u.id = i.user_id
            WHERE i.token_hash = ?
            LIMIT 1
          `,
        )
        .get(tokenHash) as
        | (UserInviteRow & {
            email: string;
            name: string;
            role: AdminRole;
            active: number;
          })
        | undefined;

      if (!row) {
        return null;
      }

      return {
        id: row.id,
        userId: row.user_id,
        email: row.email,
        name: row.name,
        role: row.role,
        expiresAt: row.expires_at,
        acceptedAt: row.accepted_at,
        active: row.active === 1,
      };
    },
    updateAdminUserPassword(userId: number, passwordHash: string) {
      getDb().prepare("UPDATE admin_users SET password_hash = ? WHERE id = ?").run(passwordHash, userId);
    },
    acceptInvitesForUser(userId: number) {
      getDb()
        .prepare(
          `
            UPDATE user_invites
            SET accepted_at = CURRENT_TIMESTAMP
            WHERE user_id = ?
              AND accepted_at IS NULL
          `,
        )
        .run(userId);
    },
    findPasswordResetUserByEmail(email: string) {
      const row = getDb()
        .prepare(
          `
            SELECT id, email, role, name
            FROM admin_users
            WHERE email = ?
              AND active = 1
            LIMIT 1
          `,
        )
        .get(email) as
        | {
            id: number;
            email: string;
            role: AdminRole;
            name: string;
          }
        | undefined;

      return row ?? null;
    },
    consumePasswordResetTokensForUser(userId: number) {
      getDb()
        .prepare(
          `
            UPDATE password_reset_tokens
            SET consumed_at = CURRENT_TIMESTAMP
            WHERE user_id = ?
              AND consumed_at IS NULL
          `,
        )
        .run(userId);
    },
    insertPasswordResetToken({ tokenId, userId, tokenHash, expiresAt, requestedBy }: { tokenId: string; userId: number; tokenHash: string; expiresAt: string; requestedBy: string }) {
      getDb()
        .prepare(
          `
            INSERT INTO password_reset_tokens (id, user_id, token_hash, expires_at, requested_by)
            VALUES (?, ?, ?, ?, ?)
          `,
        )
        .run(tokenId, userId, tokenHash, expiresAt, requestedBy);
    },
    findPasswordResetTokenByHash(tokenHash: string) {
      const row = getDb()
        .prepare(
          `
            SELECT t.id, t.user_id, t.token_hash, t.expires_at, t.consumed_at, t.created_at,
                   u.email, u.name, u.role, u.active
            FROM password_reset_tokens t
            JOIN admin_users u ON u.id = t.user_id
            WHERE t.token_hash = ?
            LIMIT 1
          `,
        )
        .get(tokenHash) as
        | (PasswordResetTokenRow & {
            email: string;
            name: string;
            role: AdminRole;
            active: number;
          })
        | undefined;

      if (!row) {
        return null;
      }

      return {
        id: row.id,
        userId: row.user_id,
        email: row.email,
        name: row.name,
        role: row.role,
        expiresAt: row.expires_at,
        consumedAt: row.consumed_at,
        active: row.active === 1,
      };
    },
    markPasswordResetTokenConsumed(tokenId: string) {
      getDb().prepare("UPDATE password_reset_tokens SET consumed_at = CURRENT_TIMESTAMP WHERE id = ?").run(tokenId);
    },
    revokeSessionsForUser(userId: number) {
      getDb()
        .prepare(
          `
            UPDATE admin_sessions
            SET revoked_at = CURRENT_TIMESTAMP
            WHERE user_id = ?
              AND revoked_at IS NULL
          `,
        )
        .run(userId);
    },
    recordAuthAudit({ actor, action, summary, targetId }: { actor: Actor; action: string; summary: string; targetId: string }) {
      recordAudit(getDb(), actor, action, summary, "auth", targetId);
    },
  });

  return { sqliteUserRepository, sqliteAuthRepository, getPersistedAuditEvents };
}
