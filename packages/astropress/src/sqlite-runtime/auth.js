import { createAstropressAuthRepository } from "../auth-repository-factory.js";
import { createAstropressUserRepository } from "../user-repository-factory.js";
import { hashOpaqueToken, hashPasswordSync, verifyPasswordSync } from "./utils.js";

function createSqliteAuthStore(getDb, options) {
  const { sessionTtlMs, now, randomId } = options;

  function recordAudit(actor, action, summary, resourceType, resourceId) {
    getDb().prepare(`
          INSERT INTO audit_events (user_email, action, resource_type, resource_id, summary)
          VALUES (?, ?, ?, ?, ?)
        `).run(actor.email, action, resourceType, resourceId, summary);
  }

  function getPersistedAuditEvents() {
    const rows = getDb().prepare(`
          SELECT id, user_email, action, resource_type, resource_id, summary, created_at
          FROM audit_events
          ORDER BY datetime(created_at) DESC, id DESC
        `).all();
    return rows.map((row) => ({
      id: `sqlite-audit-${row.id}`,
      action: row.action,
      actorEmail: row.user_email,
      actorRole: "admin",
      summary: row.summary,
      targetType: row.resource_type === "redirect" || row.resource_type === "comment" || row.resource_type === "content" ? row.resource_type : "auth",
      /* v8 ignore next 1 */
      targetId: row.resource_id ?? `${row.id}`,
      createdAt: row.created_at,
    }));
  }

  function cleanupExpiredSessions() {
    getDb().prepare(`
          UPDATE admin_sessions
          SET revoked_at = CURRENT_TIMESTAMP
          WHERE revoked_at IS NULL
            AND last_active_at < datetime('now', '-12 hours')
        `).run();
  }

  function listAdminUsers() {
    const rows = getDb().prepare(`
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
        `).all();
    return rows.map((row) => ({
      id: row.id,
      email: row.email,
      role: row.role,
      name: row.name,
      active: row.active === 1,
      status: row.active !== 1 ? "suspended" : row.has_pending_invite === 1 ? "invited" : "active",
      createdAt: row.created_at,
    }));
  }

  const sqliteUserRepository = createAstropressUserRepository({
    listAdminUsers,
    hashPassword: hashPasswordSync,
    hashOpaqueToken,
    findAdminUserByEmail(email) {
      return getDb().prepare("SELECT id FROM admin_users WHERE email = ? LIMIT 1").get(email) ?? null;
    },
    createInvitedAdminUser({ email, passwordHash, role, name }) {
      try {
        getDb().prepare(`
              INSERT INTO admin_users (email, password_hash, role, name, active)
              VALUES (?, ?, ?, ?, 1)
            `).run(email, passwordHash, role, name);
        return true;
      /* v8 ignore next 3 */
      } catch {
        return false;
      }
    },
    getAdminUserIdByEmail(email) {
      /* v8 ignore next 1 */
      return getDb().prepare("SELECT id FROM admin_users WHERE email = ? LIMIT 1").get(email)?.id ?? null;
    },
    insertUserInvite({ inviteId, userId, tokenHash, expiresAt, invitedBy }) {
      try {
        getDb().prepare(`
              INSERT INTO user_invites (id, user_id, token_hash, expires_at, invited_by)
              VALUES (?, ?, ?, ?, ?)
            `).run(inviteId, userId, tokenHash, expiresAt, invitedBy);
        return true;
      /* v8 ignore next 3 */
      } catch {
        return false;
      }
    },
    setAdminUserActiveState(email, nextActive) {
      const expectedActive = nextActive ? 0 : 1;
      return getDb().prepare("UPDATE admin_users SET active = ? WHERE email = ? AND active = ?").run(nextActive ? 1 : 0, email, expectedActive).changes > 0;
    },
    revokeAdminSessionsForEmail(email) {
      getDb().prepare(`
            UPDATE admin_sessions
            SET revoked_at = CURRENT_TIMESTAMP
            WHERE user_id = (SELECT id FROM admin_users WHERE email = ?)
              AND revoked_at IS NULL
          `).run(email);
    },
    recordUserAudit({ actor, action, summary, targetId }) {
      recordAudit(actor, action, summary, "auth", targetId);
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
    findActiveAdminUserByEmail(email) {
      const row = getDb().prepare(`
            SELECT id, email, password_hash, role, name
            FROM admin_users
            WHERE email = ?
              AND active = 1
            LIMIT 1
          `).get(email);
      /* v8 ignore next 3 */
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
    findActiveAdminUserIdByEmail(email) {
      return getDb().prepare("SELECT id FROM admin_users WHERE email = ? AND active = 1 LIMIT 1").get(email)?.id ?? null;
    },
    insertSession({ sessionToken, userId, csrfToken, ipAddress, userAgent }) {
      getDb().prepare(`
            INSERT INTO admin_sessions (id, user_id, csrf_token, ip_address, user_agent)
            VALUES (?, ?, ?, ?, ?)
          `).run(sessionToken, userId, csrfToken, ipAddress ?? null, userAgent ?? null);
    },
    findLiveSessionById(sessionToken) {
      const row = getDb().prepare(`
            SELECT s.id, s.csrf_token, s.last_active_at, u.email, u.role, u.name
            FROM admin_sessions s
            JOIN admin_users u ON u.id = s.user_id
            WHERE s.id = ?
              AND s.revoked_at IS NULL
              AND u.active = 1
            LIMIT 1
          `).get(sessionToken);
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
    touchSession(sessionToken) {
      getDb().prepare("UPDATE admin_sessions SET last_active_at = CURRENT_TIMESTAMP WHERE id = ?").run(sessionToken);
    },
    revokeSessionById(sessionToken) {
      getDb().prepare(`
            UPDATE admin_sessions
            SET revoked_at = CURRENT_TIMESTAMP
            WHERE id = ?
              AND revoked_at IS NULL
          `).run(sessionToken);
    },
    findInviteTokenByHash(tokenHash) {
      const row = getDb().prepare(`
            SELECT i.id, i.user_id, i.token_hash, i.expires_at, i.accepted_at, i.created_at,
                   u.email, u.name, u.role, u.active
            FROM user_invites i
            JOIN admin_users u ON u.id = i.user_id
            WHERE i.token_hash = ?
            LIMIT 1
          `).get(tokenHash);
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
    updateAdminUserPassword(userId, passwordHash) {
      getDb().prepare("UPDATE admin_users SET password_hash = ? WHERE id = ?").run(passwordHash, userId);
    },
    acceptInvitesForUser(userId) {
      getDb().prepare(`
            UPDATE user_invites
            SET accepted_at = CURRENT_TIMESTAMP
            WHERE user_id = ?
              AND accepted_at IS NULL
          `).run(userId);
    },
    findPasswordResetUserByEmail(email) {
      const row = getDb().prepare(`
            SELECT id, email, role, name
            FROM admin_users
            WHERE email = ?
              AND active = 1
            LIMIT 1
          `).get(email);
      return row ?? null;
    },
    consumePasswordResetTokensForUser(userId) {
      getDb().prepare(`
            UPDATE password_reset_tokens
            SET consumed_at = CURRENT_TIMESTAMP
            WHERE user_id = ?
              AND consumed_at IS NULL
          `).run(userId);
    },
    insertPasswordResetToken({ tokenId, userId, tokenHash, expiresAt, requestedBy }) {
      getDb().prepare(`
            INSERT INTO password_reset_tokens (id, user_id, token_hash, expires_at, requested_by)
            VALUES (?, ?, ?, ?, ?)
          `).run(tokenId, userId, tokenHash, expiresAt, requestedBy);
    },
    findPasswordResetTokenByHash(tokenHash) {
      const row = getDb().prepare(`
            SELECT t.id, t.user_id, t.token_hash, t.expires_at, t.consumed_at, t.created_at,
                   u.email, u.name, u.role, u.active
            FROM password_reset_tokens t
            JOIN admin_users u ON u.id = t.user_id
            WHERE t.token_hash = ?
            LIMIT 1
          `).get(tokenHash);
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
    markPasswordResetTokenConsumed(tokenId) {
      getDb().prepare("UPDATE password_reset_tokens SET consumed_at = CURRENT_TIMESTAMP WHERE id = ?").run(tokenId);
    },
    revokeSessionsForUser(userId) {
      getDb().prepare(`
            UPDATE admin_sessions
            SET revoked_at = CURRENT_TIMESTAMP
            WHERE user_id = ?
              AND revoked_at IS NULL
          `).run(userId);
    },
    recordAuthAudit({ actor, action, summary, targetId }) {
      recordAudit(actor, action, summary, "auth", targetId);
    },
  });

  return { sqliteUserRepository, sqliteAuthRepository, getPersistedAuditEvents };
}

export { createSqliteAuthStore };
