import { createAstropressAuthRepository } from "../auth-repository-factory";
import type { Actor } from "../persistence-types";
import { createAstropressUserRepository } from "../user-repository-factory";
import { recordAudit } from "./audit-log";
import {
	type ActiveAdminRow,
	type AdminRole,
	type AdminUserRow,
	type AuditRow,
	type AuthStoreOptions,
	type InviteJoinRow,
	type LiveSessionRow,
	type ResetJoinRow,
	SQL_ACCEPT_INVITES,
	SQL_CLEANUP_SESSIONS,
	SQL_CONSUME_RESET,
	SQL_CONSUME_RESET_TOKENS,
	SQL_FIND_ACTIVE_ID,
	SQL_FIND_ACTIVE_USER,
	SQL_FIND_INVITE,
	SQL_FIND_LIVE_SESSION,
	SQL_FIND_PW_RESET_USER,
	SQL_FIND_RESET_TOKEN,
	SQL_FIND_USER,
	SQL_INSERT_INVITE,
	SQL_INSERT_RESET_TOKEN,
	SQL_INSERT_SESSION,
	SQL_INSERT_USER,
	SQL_LIST_AUDIT,
	SQL_LIST_USERS,
	SQL_REVOKE_SESSION,
	SQL_REVOKE_SESSIONS_EMAIL,
	SQL_REVOKE_USER_SESSIONS,
	SQL_SET_USER_ACTIVE,
	SQL_TOUCH_SESSION,
	SQL_UPDATE_PASSWORD,
} from "./auth-helpers";
import {
	type AstropressSqliteDatabaseLike,
	hashOpaqueToken,
	hashPasswordSync,
	verifyPasswordSync,
} from "./utils";

export function createSqliteAuthStore(
	getDb: () => AstropressSqliteDatabaseLike,
	options: AuthStoreOptions,
) {
	const { sessionTtlMs, now, randomId, rootSecret } = options;

	function getPersistedAuditEvents() {
		const rows = getDb().prepare(SQL_LIST_AUDIT).all() as AuditRow[];
		return rows.map((row) => ({
			id: `sqlite-audit-${row.id}`,
			action: row.action,
			actorEmail: row.user_email,
			actorRole: "admin" as const,
			summary: row.summary,
			targetType:
				row.resource_type === "redirect" ||
				row.resource_type === "comment" ||
				row.resource_type === "content"
					? row.resource_type
					: ("auth" as const),
			targetId: row.resource_id ?? `${row.id}`,
			createdAt: row.created_at,
		}));
	}

	function cleanupExpiredSessions() {
		getDb().prepare(SQL_CLEANUP_SESSIONS).run();
	}

	function listAdminUsers() {
		const rows = getDb().prepare(SQL_LIST_USERS).all() as AdminUserRow[];
		return rows.map((row) => ({
			id: row.id,
			email: row.email,
			role: row.role,
			name: row.name,
			active: row.active === 1,
			status: (row.active !== 1
				? "suspended"
				: row.has_pending_invite === 1
					? "invited"
					: "active") as "active" | "invited" | "suspended",
			createdAt: row.created_at,
		}));
	}

	const sqliteUserRepository = createAstropressUserRepository({
		listAdminUsers,
		hashPassword: hashPasswordSync,
		hashOpaqueToken: (value) => hashOpaqueToken(value, rootSecret),
		findAdminUserByEmail(email: string) {
			return (
				(getDb().prepare(SQL_FIND_USER).get(email) as
					| { id: number }
					| undefined) ?? null
			);
		},
		createInvitedAdminUser({
			email,
			passwordHash,
			role,
			name,
		}: { email: string; passwordHash: string; role: AdminRole; name: string }) {
			try {
				getDb().prepare(SQL_INSERT_USER).run(email, passwordHash, role, name);
				return true;
			} catch {
				return false;
			}
		},
		getAdminUserIdByEmail(email: string) {
			return (
				(
					getDb().prepare(SQL_FIND_USER).get(email) as
						| { id: number }
						| undefined
				)?.id ?? null
			);
		},
		insertUserInvite({
			inviteId,
			userId,
			tokenHash,
			expiresAt,
			invitedBy,
		}: {
			inviteId: string;
			userId: number;
			tokenHash: string;
			expiresAt: string;
			invitedBy: string;
		}) {
			try {
				getDb()
					.prepare(SQL_INSERT_INVITE)
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
					.prepare(SQL_SET_USER_ACTIVE)
					.run(nextActive ? 1 : 0, email, expectedActive).changes > 0
			);
		},
		revokeAdminSessionsForEmail(email: string) {
			getDb().prepare(SQL_REVOKE_SESSIONS_EMAIL).run(email);
		},
		recordUserAudit({
			actor,
			action,
			summary,
			targetId,
		}: { actor: Actor; action: string; summary: string; targetId: string }) {
			recordAudit(getDb(), actor, action, summary, "auth", targetId);
		},
	});

	const sqliteAuthRepository = createAstropressAuthRepository({
		sessionTtlMs,
		now,
		randomId,
		hashOpaqueToken: (value) => hashOpaqueToken(value, rootSecret),
		hashPassword: hashPasswordSync,
		verifyPassword: verifyPasswordSync,
		cleanupExpiredSessions,
		findActiveAdminUserByEmail(email: string) {
			const row = getDb().prepare(SQL_FIND_ACTIVE_USER).get(email) as
				| ActiveAdminRow
				| undefined;
			if (!row) return null;
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
				(
					getDb().prepare(SQL_FIND_ACTIVE_ID).get(email) as
						| { id: number }
						| undefined
				)?.id ?? null
			);
		},
		insertSession({
			sessionToken,
			userId,
			csrfToken,
			ipAddress,
			userAgent,
		}: {
			sessionToken: string;
			userId: number;
			csrfToken: string;
			ipAddress: string | null;
			userAgent: string | null;
		}) {
			getDb()
				.prepare(SQL_INSERT_SESSION)
				.run(
					sessionToken,
					userId,
					csrfToken,
					ipAddress ?? null,
					userAgent ?? null,
				);
		},
		findLiveSessionById(sessionToken: string) {
			const row = getDb().prepare(SQL_FIND_LIVE_SESSION).get(sessionToken) as
				| LiveSessionRow
				| undefined;
			if (!row) return null;
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
			getDb().prepare(SQL_TOUCH_SESSION).run(sessionToken);
		},
		revokeSessionById(sessionToken: string) {
			getDb().prepare(SQL_REVOKE_SESSION).run(sessionToken);
		},
		findInviteTokenByHash(tokenHash: string) {
			const row = getDb().prepare(SQL_FIND_INVITE).get(tokenHash) as
				| InviteJoinRow
				| undefined;
			if (!row) return null;
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
			getDb().prepare(SQL_UPDATE_PASSWORD).run(passwordHash, userId);
		},
		acceptInvitesForUser(userId: number) {
			getDb().prepare(SQL_ACCEPT_INVITES).run(userId);
		},
		findPasswordResetUserByEmail(email: string) {
			return (
				(getDb().prepare(SQL_FIND_PW_RESET_USER).get(email) as
					| { id: number; email: string; role: AdminRole; name: string }
					| undefined) ?? null
			);
		},
		consumePasswordResetTokensForUser(userId: number) {
			getDb().prepare(SQL_CONSUME_RESET_TOKENS).run(userId);
		},
		insertPasswordResetToken({
			tokenId,
			userId,
			tokenHash,
			expiresAt,
			requestedBy,
		}: {
			tokenId: string;
			userId: number;
			tokenHash: string;
			expiresAt: string;
			requestedBy: string;
		}) {
			getDb()
				.prepare(SQL_INSERT_RESET_TOKEN)
				.run(tokenId, userId, tokenHash, expiresAt, requestedBy);
		},
		findPasswordResetTokenByHash(tokenHash: string) {
			const row = getDb().prepare(SQL_FIND_RESET_TOKEN).get(tokenHash) as
				| ResetJoinRow
				| undefined;
			if (!row) return null;
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
			getDb().prepare(SQL_CONSUME_RESET).run(tokenId);
		},
		revokeSessionsForUser(userId: number) {
			getDb().prepare(SQL_REVOKE_USER_SESSIONS).run(userId);
		},
		recordAuthAudit({
			actor,
			action,
			summary,
			targetId,
		}: { actor: Actor; action: string; summary: string; targetId: string }) {
			recordAudit(getDb(), actor, action, summary, "auth", targetId);
		},
	});

	return {
		sqliteUserRepository,
		sqliteAuthRepository,
		getPersistedAuditEvents,
	};
}
