import {
	type AstropressAuthRepositoryInput,
	type AstropressAuthSessionRow,
	type AstropressInviteTokenRecord,
	type AstropressPasswordResetTokenRecord,
	issuePasswordResetToken,
	mapSessionUser,
	resolveUsableInviteToken,
	resolveUsablePasswordResetToken,
	resolveValidSession,
	validatePasswordInput,
} from "./auth-repository-helpers";
import type {
	Actor,
	AuthRepository,
	PasswordResetRequest,
	SessionUser,
} from "./persistence-types";

export type {
	AstropressAuthRepositoryInput,
	AstropressAuthSessionRow,
	AstropressInviteTokenRecord,
	AstropressPasswordResetTokenRecord,
};

export function createAstropressAuthRepository(
	input: AstropressAuthRepositoryInput,
): AuthRepository & {
	authenticatePersistedAdminUser(
		email: string,
		password: string,
	): Promise<SessionUser | null>;
} {
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
			const userId = input.findActiveAdminUserIdByEmail(
				user.email.toLowerCase(),
			);
			if (!userId) {
				throw new Error(
					`Cannot create a session for unknown admin user ${user.email}.`,
				);
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
				return {
					ok: false as const,
					error: "Password must be at least 12 characters.",
				};
			}

			const row = resolveUsableInviteToken(rawToken, input);
			if (!row) {
				return {
					ok: false as const,
					error: "That invitation link is invalid or has expired.",
				};
			}

			input.updateAdminUserPassword(
				row.userId,
				input.hashPassword(pw.trimmedPassword),
			);
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
				return {
					ok: false as const,
					error: "Password must be at least 12 characters.",
				};
			}

			const row = resolveUsablePasswordResetToken(rawToken, input);
			if (!row) {
				return {
					ok: false as const,
					error: "That password reset link is invalid or has expired.",
				};
			}

			input.updateAdminUserPassword(
				row.userId,
				input.hashPassword(pw.trimmedPassword),
			);
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
