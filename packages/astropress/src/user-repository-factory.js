function isValidEmailAddress(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

export function createAstropressUserRepository(input) {
  return {
    listAdminUsers: (...args) => input.listAdminUsers(...args),
    inviteAdminUser(rawInput, actor) {
      const name = rawInput.name.trim();
      const email = rawInput.email.trim().toLowerCase();
      const role = rawInput.role === "admin" ? "admin" : rawInput.role === "editor" ? "editor" : "";

      if (!name || !email || !role) {
        return { ok: false, error: "Name, email, and role are required." };
      }

      if (!isValidEmailAddress(email)) {
        return { ok: false, error: "Enter a valid email address." };
      }

      const existing = input.findAdminUserByEmail(email);
      if (existing) {
        return { ok: false, error: "That email address already belongs to an admin user." };
      }

      const created = input.createInvitedAdminUser({
        email,
        passwordHash: input.hashPassword(crypto.randomUUID()),
        role,
        name,
      });
      if (!created) {
        return { ok: false, error: "The invited user could not be created." };
      }

      const userId = input.getAdminUserIdByEmail(email);
      if (!userId) {
        return { ok: false, error: "The invited user could not be created." };
      }

      const rawToken = crypto.randomUUID();
      const inviteId = `invite-${crypto.randomUUID()}`;
      const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();

      const insertedInvite = input.insertUserInvite({
        inviteId,
        userId,
        tokenHash: input.hashOpaqueToken(rawToken),
        expiresAt,
        invitedBy: actor.email,
      });
      if (!insertedInvite) {
        return { ok: false, error: "The invitation link could not be created." };
      }

      input.recordUserAudit({
        actor,
        action: "user.invite",
        summary: `Invited ${email} as an ${role} user.`,
        targetId: email,
      });
      return { ok: true, inviteUrl: `/wp-admin/accept-invite?token=${encodeURIComponent(rawToken)}` };
    },
    suspendAdminUser(email, actor) {
      const normalizedEmail = email.trim().toLowerCase();
      if (!normalizedEmail) {
        return { ok: false, error: "Email is required." };
      }

      if (normalizedEmail === actor.email.toLowerCase()) {
        return { ok: false, error: "You cannot suspend the account you are currently using." };
      }

      const suspended = input.setAdminUserActiveState(normalizedEmail, false);
      if (!suspended) {
        return { ok: false, error: "That admin user could not be suspended." };
      }

      input.revokeAdminSessionsForEmail(normalizedEmail);
      input.recordUserAudit({
        actor,
        action: "user.suspend",
        summary: `Suspended ${normalizedEmail}.`,
        targetId: normalizedEmail,
      });
      return { ok: true };
    },
    unsuspendAdminUser(email, actor) {
      const normalizedEmail = email.trim().toLowerCase();
      if (!normalizedEmail) {
        return { ok: false, error: "Email is required." };
      }

      const restored = input.setAdminUserActiveState(normalizedEmail, true);
      if (!restored) {
        return { ok: false, error: "That admin user could not be restored." };
      }

      input.recordUserAudit({
        actor,
        action: "user.restore",
        summary: `Restored ${normalizedEmail}.`,
        targetId: normalizedEmail,
      });
      return { ok: true };
    },
  };
}
