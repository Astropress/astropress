import type { Actor, AuthRepository, PasswordResetRequest, SessionUser } from "./persistence-types";

export interface AstropressAuthSessionRow extends SessionUser {
  id: string;
  csrfToken: string;
  lastActiveAt: string;
}

export interface AstropressInviteTokenRecord extends SessionUser {
  id: string;
  userId: number;
  expiresAt: string;
  acceptedAt: string | null;
  active: boolean;
}

export interface AstropressPasswordResetTokenRecord extends SessionUser {
  id: string;
  userId: number;
  expiresAt: string;
  consumedAt: string | null;
  active: boolean;
}

export interface AstropressAuthRepositoryInput {
  sessionTtlMs: number;
  now(): number;
  randomId(): string;
  hashOpaqueToken(value: string): string;
  hashPassword(value: string): string;
  verifyPassword(password: string, storedHash: string): boolean;
  cleanupExpiredSessions(): void;
  findActiveAdminUserByEmail(email: string): { id: number; email: string; passwordHash: string; role: SessionUser["role"]; name: string } | null | undefined;
  findActiveAdminUserIdByEmail(email: string): number | null | undefined;
  insertSession(input: {
    sessionToken: string;
    userId: number;
    csrfToken: string;
    ipAddress?: string | null;
    userAgent?: string | null;
  }): void;
  findLiveSessionById(sessionToken: string): AstropressAuthSessionRow | null | undefined;
  touchSession(sessionToken: string): void;
  revokeSessionById(sessionToken: string): void;
  findInviteTokenByHash(tokenHash: string): AstropressInviteTokenRecord | null | undefined;
  updateAdminUserPassword(userId: number, passwordHash: string): void;
  acceptInvitesForUser(userId: number): void;
  findPasswordResetUserByEmail(email: string): { id: number; email: string; role: SessionUser["role"]; name: string } | null | undefined;
  consumePasswordResetTokensForUser(userId: number): void;
  insertPasswordResetToken(input: {
    tokenId: string;
    userId: number;
    tokenHash: string;
    expiresAt: string;
    requestedBy: string | null;
  }): void;
  findPasswordResetTokenByHash(tokenHash: string): AstropressPasswordResetTokenRecord | null | undefined;
  markPasswordResetTokenConsumed(tokenId: string): void;
  revokeSessionsForUser(userId: number): void;
  recordAuthAudit(input: {
    actor: Actor;
    action:
      | "auth.login"
      | "auth.logout"
      | "auth.invite_accept"
      | "auth.password_reset_issue"
      | "auth.password_reset_complete";
    summary: string;
    targetId: string;
  }): void;
}

function mapSessionUser(row: Pick<AstropressAuthSessionRow, "email" | "role" | "name">): SessionUser {
  return {
    email: row.email,
    role: row.role,
    name: row.name,
  };
}

function isUsableToken(expiresAt: string, consumedAt: string | null, active: boolean, now: number): boolean {
  return !consumedAt && active && Date.parse(expiresAt) >= now;
}

function resolveValidSession(
  sessionToken: string | null | undefined,
  deps: AstropressAuthRepositoryInput,
): AstropressAuthSessionRow | null {
  if (!sessionToken) {
    return null;
  }

  deps.cleanupExpiredSessions();
  const row = deps.findLiveSessionById(sessionToken);
  if (!row) {
    return null;
  }

  const lastActiveAt = Date.parse(row.lastActiveAt);
  if (!Number.isFinite(lastActiveAt) || deps.now() - lastActiveAt > deps.sessionTtlMs) {
    deps.revokeSessionById(sessionToken);
    return null;
  }

  deps.touchSession(sessionToken);
  return row;
}

function resolveUsableInviteToken(
  rawToken: string,
  deps: AstropressAuthRepositoryInput,
): AstropressInviteTokenRecord | null {
  const trimmedToken = rawToken.trim();
  if (!trimmedToken) {
    return null;
  }

  const row = deps.findInviteTokenByHash(deps.hashOpaqueToken(trimmedToken));
  if (!row || !isUsableToken(row.expiresAt, row.acceptedAt, row.active, deps.now())) {
    return null;
  }

  return row;
}

function resolveUsablePasswordResetToken(
  rawToken: string,
  deps: AstropressAuthRepositoryInput,
): AstropressPasswordResetTokenRecord | null {
  const trimmedToken = rawToken.trim();
  if (!trimmedToken) {
    return null;
  }

  const row = deps.findPasswordResetTokenByHash(deps.hashOpaqueToken(trimmedToken));
  if (!row || !isUsableToken(row.expiresAt, row.consumedAt, row.active, deps.now())) {
    return null;
  }

  return row;
}

function validatePasswordInput(password: string) {
  const trimmedPassword = password.trim();
  if (trimmedPassword.length < 12) {
    return { ok: false as const, trimmedPassword: "" };
  }
  return { ok: true as const, trimmedPassword };
}

function buildResetUrl(rawToken: string): string {
  return `/ap-admin/reset-password` + `?token=${encodeURIComponent(rawToken)}`;
}

function issuePasswordResetToken(
  email: string,
  actor: Actor | undefined,
  deps: AstropressAuthRepositoryInput,
) {
  const normalizedEmail = email.trim().toLowerCase();
  if (!normalizedEmail) {
    return { ok: false as const, error: "Email is required." };
  }

  const user = deps.findPasswordResetUserByEmail(normalizedEmail);
  if (!user) {
    return actor
      ? { ok: false as const, error: "That admin user could not be found." }
      : { ok: true as const, resetUrl: null as string | null };
  }

  deps.consumePasswordResetTokensForUser(user.id);

  const rawToken = deps.randomId();
  const tokenId = `reset-${deps.randomId()}`;
  const expiresAt = new Date(deps.now() + 60 * 60 * 1000).toISOString();
  deps.insertPasswordResetToken({
    tokenId,
    userId: user.id,
    tokenHash: deps.hashOpaqueToken(rawToken),
    expiresAt,
    requestedBy: actor?.email ?? null,
  });

  if (actor) {
    deps.recordAuthAudit({
      actor,
      action: "auth.password_reset_issue",
      summary: `Issued a password reset link for ${normalizedEmail}.`,
      targetId: normalizedEmail,
    });
  }

  return { ok: true as const, resetUrl: buildResetUrl(rawToken) };
}

export function createAstropressAuthRepository(
  input: AstropressAuthRepositoryInput,
): AuthRepository & { authenticatePersistedAdminUser(email: string, password: string): Promise<SessionUser | null> } {
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
      const row = resolveValidSession(sessionToken, input);
      return row ? mapSessionUser(row) : null;
    },
    getCsrfToken(sessionToken) {
      const row = resolveValidSession(sessionToken, input);
      return row ? row.csrfToken : null;
    },
    revokeSession(sessionToken) {
      if (!sessionToken) {
        return;
      }
      input.revokeSessionById(sessionToken);
    },
    createPasswordResetToken(email, actor) {
      return issuePasswordResetToken(email, actor, input);
    },
    getInviteRequest(rawToken) {
      const row = resolveUsableInviteToken(rawToken, input);
      if (!row) {
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
      const row = resolveUsablePasswordResetToken(rawToken, input);
      if (!row) {
        return null;
      }

      return {
        email: row.email,
        name: row.name,
        role: row.role,
        expiresAt: row.expiresAt,
      } as PasswordResetRequest;
    },
    consumeInviteToken(rawToken, password) {
      const pw = validatePasswordInput(password);
      if (!pw.ok) {
        return { ok: false as const, error: "Password must be at least 12 characters." };
      }

      const row = resolveUsableInviteToken(rawToken, input);
      if (!row) {
        return { ok: false as const, error: "That invitation link is invalid or has expired." };
      }

      input.updateAdminUserPassword(row.userId, input.hashPassword(pw.trimmedPassword));
      input.acceptInvitesForUser(row.userId);
      input.recordAuthAudit({
        actor: { email: row.email, role: row.role, name: row.name },
        action: "auth.invite_accept",
        summary: `${row.email} accepted an admin invitation.`,
        targetId: row.email,
      });

      return {
        ok: true as const,
        user: {
          email: row.email,
          role: row.role,
          name: row.name,
        },
      };
    },
    consumePasswordResetToken(rawToken, password) {
      const pw = validatePasswordInput(password);
      if (!pw.ok) {
        return { ok: false as const, error: "Password must be at least 12 characters." };
      }

      const row = resolveUsablePasswordResetToken(rawToken, input);
      if (!row) {
        return { ok: false as const, error: "That password reset link is invalid or has expired." };
      }

      input.updateAdminUserPassword(row.userId, input.hashPassword(pw.trimmedPassword));
      input.markPasswordResetTokenConsumed(row.id);
      input.revokeSessionsForUser(row.userId);
      input.recordAuthAudit({
        actor: { email: row.email, role: row.role, name: row.name },
        action: "auth.password_reset_complete",
        summary: `${row.email} completed a password reset.`,
        targetId: row.email,
      });

      return {
        ok: true as const,
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
