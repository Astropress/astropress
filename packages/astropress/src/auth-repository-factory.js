function mapSessionUser(row) {
  return {
    email: row.email,
    role: row.role,
    name: row.name,
  };
}

function isUsableToken(expiresAt, consumedAt, active, now) {
  return !consumedAt && active && Date.parse(expiresAt) >= now;
}

export function createAstropressAuthRepository(input) {
  return {
    async authenticatePersistedAdminUser(email, password) {
      const normalizedEmail = email.trim().toLowerCase();
      if (!normalizedEmail || !password) {
        return null;
      }

      const user = input.findActiveAdminUserByEmail(normalizedEmail);
      if (!user || !input.verifyPassword(password, user.passwordHash)) {
        return null;
      }

      return mapSessionUser(user);
    },
    createSession(user, metadata) {
      const userId = input.findActiveAdminUserIdByEmail(user.email.toLowerCase());
      if (!userId) {
        throw new Error(`Cannot create a session for unknown admin user ${user.email}.`);
      }

      const sessionToken = input.randomId();
      const csrfToken = input.randomId();
      input.insertSession({
        sessionToken,
        userId,
        csrfToken,
        ipAddress: metadata?.ipAddress ?? null,
        userAgent: metadata?.userAgent ?? null,
      });
      return sessionToken;
    },
    getSessionUser(sessionToken) {
      if (!sessionToken) {
        return null;
      }

      input.cleanupExpiredSessions();
      const row = input.findLiveSessionById(sessionToken);
      if (!row) {
        return null;
      }

      const lastActiveAt = Date.parse(row.lastActiveAt);
      if (!Number.isFinite(lastActiveAt) || input.now() - lastActiveAt > input.sessionTtlMs) {
        input.revokeSessionById(sessionToken);
        return null;
      }

      input.touchSession(sessionToken);
      return mapSessionUser(row);
    },
    getCsrfToken(sessionToken) {
      if (!sessionToken) {
        return null;
      }

      input.cleanupExpiredSessions();
      const row = input.findLiveSessionById(sessionToken);
      if (!row) {
        return null;
      }

      const lastActiveAt = Date.parse(row.lastActiveAt);
      if (!Number.isFinite(lastActiveAt) || input.now() - lastActiveAt > input.sessionTtlMs) {
        input.revokeSessionById(sessionToken);
        return null;
      }

      input.touchSession(sessionToken);
      return row.csrfToken;
    },
    revokeSession(sessionToken) {
      if (!sessionToken) {
        return;
      }
      input.revokeSessionById(sessionToken);
    },
    createPasswordResetToken(email, actor) {
      const normalizedEmail = email.trim().toLowerCase();
      if (!normalizedEmail) {
        return { ok: false, error: "Email is required." };
      }

      const user = input.findPasswordResetUserByEmail(normalizedEmail);
      if (!user) {
        return actor
          ? { ok: false, error: "That admin user could not be found." }
          : { ok: true, resetUrl: null };
      }

      input.consumePasswordResetTokensForUser(user.id);

      const rawToken = input.randomId();
      const tokenId = `reset-${input.randomId()}`;
      const expiresAt = new Date(input.now() + 60 * 60 * 1000).toISOString();
      input.insertPasswordResetToken({
        tokenId,
        userId: user.id,
        tokenHash: input.hashOpaqueToken(rawToken),
        expiresAt,
        requestedBy: actor?.email ?? null,
      });

      if (actor) {
        input.recordAuthAudit({
          actor,
          action: "auth.password_reset_issue",
          summary: `Issued a password reset link for ${normalizedEmail}.`,
          targetId: normalizedEmail,
        });
      }

      return { ok: true, resetUrl: `/ap-admin/reset-password?token=${encodeURIComponent(rawToken)}` };
    },
    getInviteRequest(rawToken) {
      const trimmedToken = rawToken.trim();
      if (!trimmedToken) {
        return null;
      }

      const row = input.findInviteTokenByHash(input.hashOpaqueToken(trimmedToken));
      if (!row || !isUsableToken(row.expiresAt, row.acceptedAt, row.active, input.now())) {
        return null;
      }

      return {
        email: row.email,
        name: row.name,
        role: row.role,
        expiresAt: row.expiresAt,
      };
    },
    getPasswordResetRequest(rawToken) {
      const trimmedToken = rawToken.trim();
      if (!trimmedToken) {
        return null;
      }

      const row = input.findPasswordResetTokenByHash(input.hashOpaqueToken(trimmedToken));
      if (!row || !isUsableToken(row.expiresAt, row.consumedAt, row.active, input.now())) {
        return null;
      }

      return {
        email: row.email,
        name: row.name,
        role: row.role,
        expiresAt: row.expiresAt,
      };
    },
    consumeInviteToken(rawToken, password) {
      const trimmedPassword = password.trim();
      if (trimmedPassword.length < 12) {
        return { ok: false, error: "Password must be at least 12 characters." };
      }

      const row = input.findInviteTokenByHash(input.hashOpaqueToken(rawToken.trim()));
      if (!row || !isUsableToken(row.expiresAt, row.acceptedAt, row.active, input.now())) {
        return { ok: false, error: "That invitation link is invalid or has expired." };
      }

      input.updateAdminUserPassword(row.userId, input.hashPassword(trimmedPassword));
      input.acceptInvitesForUser(row.userId);
      input.recordAuthAudit({
        actor: { email: row.email, role: row.role, name: row.name },
        action: "auth.invite_accept",
        summary: `${row.email} accepted an admin invitation.`,
        targetId: row.email,
      });

      return {
        ok: true,
        user: {
          email: row.email,
          role: row.role,
          name: row.name,
        },
      };
    },
    consumePasswordResetToken(rawToken, password) {
      const trimmedPassword = password.trim();
      if (trimmedPassword.length < 12) {
        return { ok: false, error: "Password must be at least 12 characters." };
      }

      const row = input.findPasswordResetTokenByHash(input.hashOpaqueToken(rawToken.trim()));
      if (!row || !isUsableToken(row.expiresAt, row.consumedAt, row.active, input.now())) {
        return { ok: false, error: "That password reset link is invalid or has expired." };
      }

      input.updateAdminUserPassword(row.userId, input.hashPassword(trimmedPassword));
      input.markPasswordResetTokenConsumed(row.id);
      input.revokeSessionsForUser(row.userId);
      input.recordAuthAudit({
        actor: { email: row.email, role: row.role, name: row.name },
        action: "auth.password_reset_complete",
        summary: `${row.email} completed a password reset.`,
        targetId: row.email,
      });

      return {
        ok: true,
        user: {
          email: row.email,
          role: row.role,
          name: row.name,
        },
      };
    },
    recordSuccessfulLogin(actor) {
      input.recordAuthAudit({
        actor,
        action: "auth.login",
        summary: `${actor.name} signed in successfully.`,
        targetId: actor.email,
      });
    },
    recordLogout(actor) {
      input.recordAuthAudit({
        actor,
        action: "auth.logout",
        summary: `${actor.name} signed out.`,
        targetId: actor.email,
      });
    },
  };
}
