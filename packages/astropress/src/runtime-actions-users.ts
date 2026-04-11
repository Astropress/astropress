import { hashPassword } from "./crypto-utils";
import type { Actor } from "./persistence-types";
import { getAdminDb, withLocalStoreFallback } from "./admin-store-dispatch";
import { normalizeEmail } from "./admin-normalizers";
import { recordD1Audit } from "./d1-audit";

// ─── Password reset — extracted to runtime-actions-password-reset.ts ──────────
export { createRuntimePasswordResetToken, getRuntimePasswordResetRequest, consumeRuntimePasswordResetToken } from "./runtime-actions-password-reset";

async function hashOpaqueToken(token: string) {
  const encoded = new TextEncoder().encode(token);
  const digest = await crypto.subtle.digest("SHA-256", encoded);
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

async function getD1InviteToken(rawToken: string, locals?: App.Locals | null) {
  const db = getAdminDb(locals);
  if (!db || !rawToken.trim()) {
    return null;
  }

  const row = await db
    .prepare(
      `
        SELECT i.id, i.user_id, i.expires_at, i.accepted_at,
               u.email, u.name, u.role, u.active
        FROM user_invites i
        JOIN admin_users u ON u.id = i.user_id
        WHERE i.token_hash = ?
        LIMIT 1
      `,
    )
    .bind(await hashOpaqueToken(rawToken))
    .first<{
      id: string;
      user_id: number;
      expires_at: string;
      accepted_at: string | null;
      email: string;
      name: string;
      role: "admin" | "editor";
      active: number;
    }>();

  if (!row || row.accepted_at || row.active !== 1 || Date.parse(row.expires_at) < Date.now()) {
    return null;
  }

  return row;
}

export async function inviteRuntimeAdminUser(
  input: { name: string; email: string; role: string },
  actor: Actor,
  locals?: App.Locals | null,
) {
  return withLocalStoreFallback(
    locals,
    async (db) => {
      const name = input.name.trim();
      const email = normalizeEmail(input.email);
      const role = input.role === "admin" ? "admin" : input.role === "editor" ? "editor" : "";

      if (!name || !email || !role) {
        return { ok: false as const, error: "Name, email, and role are required." };
      }

      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        return { ok: false as const, error: "Enter a valid email address." };
      }

      const existing = await db.prepare("SELECT id FROM admin_users WHERE email = ? LIMIT 1").bind(email).first<{ id: number }>();
      if (existing) {
        return { ok: false as const, error: "That email address already belongs to an admin user." };
      }

      await db
        .prepare(
          `
            INSERT INTO admin_users (email, password_hash, role, name, active)
            VALUES (?, ?, ?, ?, 1)
          `,
        )
        .bind(email, await hashPassword(crypto.randomUUID()), role, name)
        .run();

      const user = await db.prepare("SELECT id FROM admin_users WHERE email = ? LIMIT 1").bind(email).first<{ id: number }>();
      /* v8 ignore next 3 */
      if (!user) {
        return { ok: false as const, error: "The invited user could not be created." };
      }

      const rawToken = crypto.randomUUID();
      const inviteId = `invite-${crypto.randomUUID()}`;
      const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();

      await db
        .prepare(
          `
            INSERT INTO user_invites (id, user_id, token_hash, expires_at, invited_by)
            VALUES (?, ?, ?, ?, ?)
          `,
        )
        .bind(inviteId, user.id, await hashOpaqueToken(rawToken), expiresAt, actor.email)
        .run();

      await recordD1Audit(locals, actor, "user.invite", "auth", email, `Invited ${email} as an ${role} user.`);
      return { ok: true as const, inviteUrl: `/ap-admin/accept-invite?token=${encodeURIComponent(rawToken)}` };
    },
    /* v8 ignore next 1 */
    (localStore) => localStore.inviteAdminUser(input, actor),
  );
}

export async function getRuntimeInviteRequest(rawToken: string, locals?: App.Locals | null) {
  return withLocalStoreFallback(
    locals,
    async () => {
      const row = await getD1InviteToken(rawToken, locals);
      if (!row) {
        return null;
      }
      return {
        email: row.email,
        name: row.name,
        role: row.role,
        expiresAt: row.expires_at,
      };
    },
    /* v8 ignore next 1 */
    (localStore) => localStore.getInviteRequest(rawToken),
  );
}

export async function consumeRuntimeInviteToken(rawToken: string, password: string, locals?: App.Locals | null) {
  return withLocalStoreFallback(
    locals,
    async (db) => {
      const trimmedPassword = password.trim();
      if (trimmedPassword.length < 12) {
        return { ok: false as const, error: "Password must be at least 12 characters." };
      }

      const row = await getD1InviteToken(rawToken, locals);
      /* v8 ignore next 3 */
      if (!row) {
        return { ok: false as const, error: "That invitation link is invalid or has expired." };
      }

      await db.prepare("UPDATE admin_users SET password_hash = ? WHERE id = ?").bind(await hashPassword(trimmedPassword), row.user_id).run();
      await db
        .prepare(
          `
            UPDATE user_invites
            SET accepted_at = CURRENT_TIMESTAMP
            WHERE user_id = ?
              AND accepted_at IS NULL
          `,
        )
        .bind(row.user_id)
        .run();

      await recordD1Audit(
        locals,
        { email: row.email, role: row.role, name: row.name },
        "auth.invite_accept",
        "auth",
        row.email,
        `${row.email} accepted an admin invitation.`,
      );

      return {
        ok: true as const,
        user: {
          email: row.email,
          role: row.role,
          name: row.name,
        },
      };
    },
    /* v8 ignore next 1 */
    (localStore) => localStore.consumeInviteToken(rawToken, password),
  );
}

export async function suspendRuntimeAdminUser(email: string, actor: Actor, locals?: App.Locals | null) {
  return withLocalStoreFallback(
    locals,
    async (db) => {
      const normalizedEmail = normalizeEmail(email);
      if (!normalizedEmail) {
        return { ok: false as const, error: "Email is required." };
      }

      if (normalizedEmail === actor.email.toLowerCase()) {
        return { ok: false as const, error: "You cannot suspend the account you are currently using." };
      }

      const target = await db.prepare("SELECT id FROM admin_users WHERE email = ? AND active = 1 LIMIT 1").bind(normalizedEmail).first<{ id: number }>();
      if (!target) {
        return { ok: false as const, error: "That admin user could not be suspended." };
      }

      await db.prepare("UPDATE admin_users SET active = 0 WHERE id = ?").bind(target.id).run();
      await db
        .prepare(
          `
            UPDATE admin_sessions
            SET revoked_at = CURRENT_TIMESTAMP
            WHERE user_id = ?
              AND revoked_at IS NULL
          `,
        )
        .bind(target.id)
        .run();

      await recordD1Audit(locals, actor, "user.suspend", "auth", normalizedEmail, `Suspended ${normalizedEmail}.`);
      return { ok: true as const };
    },
    /* v8 ignore next 1 */
    (localStore) => localStore.suspendAdminUser(email, actor),
  );
}

export async function unsuspendRuntimeAdminUser(email: string, actor: Actor, locals?: App.Locals | null) {
  return withLocalStoreFallback(
    locals,
    async (db) => {
      const normalizedEmail = normalizeEmail(email);
      if (!normalizedEmail) {
        return { ok: false as const, error: "Email is required." };
      }

      const target = await db.prepare("SELECT id FROM admin_users WHERE email = ? AND active = 0 LIMIT 1").bind(normalizedEmail).first<{ id: number }>();
      if (!target) {
        return { ok: false as const, error: "That admin user could not be restored." };
      }

      await db.prepare("UPDATE admin_users SET active = 1 WHERE id = ?").bind(target.id).run();
      await recordD1Audit(locals, actor, "user.restore", "auth", normalizedEmail, `Restored ${normalizedEmail}.`);
      return { ok: true as const };
    },
    /* v8 ignore next 1 */
    (localStore) => localStore.unsuspendAdminUser(email, actor),
  );
}
