import { createAstropressAuthRepository } from "../auth-repository-factory";
import type { Actor, SessionUser } from "../persistence-types";
import { createAstropressUserRepository } from "../user-repository-factory";
import { recordAudit } from "./audit-log";
import {
	type AstropressSqliteDatabaseLike,
	hashOpaqueToken,
	hashPasswordSync,
	verifyPasswordSync,
} from "./utils";

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
	rootSecret: string;
}

type AuditRow = {
	id: number;
	user_email: string;
	action: string;
	resource_type: string;
	resource_id: string | null;
	summary: string;
	created_at: string;
};
type AdminUserRow = {
	id: number;
	email: string;
	role: AdminRole;
	name: string;
	active: number;
	created_at: string;
	has_pending_invite: number;
};
type ActiveAdminRow = {
	id: number;
	email: string;
	password_hash: string;
	role: AdminRole;
	name: string;
};
type LiveSessionRow = {
	id: string;
	csrf_token: string;
	last_active_at: string;
	email: string;
	role: AdminRole;
	name: string;
};
type InviteJoinRow = UserInviteRow & {
	email: string;
	name: string;
	role: AdminRole;
	active: number;
};
type ResetJoinRow = PasswordResetTokenRow & {
	email: string;
	name: string;
	role: AdminRole;
	active: number;
};

const SQL_LIST_AUDIT =
	"SELECT id, user_email, action, resource_type, resource_id, summary, created_at FROM audit_events ORDER BY datetime(created_at) DESC, id DESC";
const SQL_CLEANUP_SESSIONS = `UPDATE admin_sessions SET revoked_at = CURRENT_TIMESTAMP WHERE revoked_at IS NULL AND last_active_at < datetime('now', '-12 hours')`;
const SQL_LIST_USERS = `SELECT id, email, role, name, active, created_at, EXISTS (SELECT 1 FROM user_invites i WHERE i.user_id = admin_users.id AND i.accepted_at IS NULL AND datetime(i.expires_at) > CURRENT_TIMESTAMP) AS has_pending_invite FROM admin_users ORDER BY CASE role WHEN 'admin' THEN 0 ELSE 1 END, datetime(created_at) ASC, email ASC`;
const SQL_FIND_USER = "SELECT id FROM admin_users WHERE email = ? LIMIT 1";
const SQL_INSERT_USER =
	"INSERT INTO admin_users (email, password_hash, role, name, active) VALUES (?, ?, ?, ?, 1)";
const SQL_INSERT_INVITE =
	"INSERT INTO user_invites (id, user_id, token_hash, expires_at, invited_by) VALUES (?, ?, ?, ?, ?)";
const SQL_REVOKE_SESSIONS_EMAIL =
	"UPDATE admin_sessions SET revoked_at = CURRENT_TIMESTAMP WHERE user_id = (SELECT id FROM admin_users WHERE email = ?) AND revoked_at IS NULL";
const SQL_FIND_ACTIVE_USER =
	"SELECT id, email, password_hash, role, name FROM admin_users WHERE email = ? AND active = 1 LIMIT 1";
const SQL_FIND_ACTIVE_ID =
	"SELECT id FROM admin_users WHERE email = ? AND active = 1 LIMIT 1";
const SQL_INSERT_SESSION =
	"INSERT INTO admin_sessions (id, user_id, csrf_token, ip_address, user_agent) VALUES (?, ?, ?, ?, ?)";
const SQL_FIND_LIVE_SESSION =
	"SELECT s.id, s.csrf_token, s.last_active_at, u.email, u.role, u.name FROM admin_sessions s JOIN admin_users u ON u.id = s.user_id WHERE s.id = ? AND s.revoked_at IS NULL AND u.active = 1 LIMIT 1";
const SQL_REVOKE_SESSION =
	"UPDATE admin_sessions SET revoked_at = CURRENT_TIMESTAMP WHERE id = ? AND revoked_at IS NULL";
const SQL_FIND_INVITE =
	"SELECT i.id, i.user_id, i.token_hash, i.expires_at, i.accepted_at, i.created_at, u.email, u.name, u.role, u.active FROM user_invites i JOIN admin_users u ON u.id = i.user_id WHERE i.token_hash = ? LIMIT 1";
const SQL_ACCEPT_INVITES =
	"UPDATE user_invites SET accepted_at = CURRENT_TIMESTAMP WHERE user_id = ? AND accepted_at IS NULL";
const SQL_FIND_PW_RESET_USER =
	"SELECT id, email, role, name FROM admin_users WHERE email = ? AND active = 1 LIMIT 1";
const SQL_CONSUME_RESET_TOKENS =
	"UPDATE password_reset_tokens SET consumed_at = CURRENT_TIMESTAMP WHERE user_id = ? AND consumed_at IS NULL";
const SQL_INSERT_RESET_TOKEN =
	"INSERT INTO password_reset_tokens (id, user_id, token_hash, expires_at, requested_by) VALUES (?, ?, ?, ?, ?)";
const SQL_FIND_RESET_TOKEN =
	"SELECT t.id, t.user_id, t.token_hash, t.expires_at, t.consumed_at, t.created_at, u.email, u.name, u.role, u.active FROM password_reset_tokens t JOIN admin_users u ON u.id = t.user_id WHERE t.token_hash = ? LIMIT 1";
const SQL_REVOKE_USER_SESSIONS =
	"UPDATE admin_sessions SET revoked_at = CURRENT_TIMESTAMP WHERE user_id = ? AND revoked_at IS NULL";

const SQL_SET_USER_ACTIVE =
	"UPDATE admin_users SET active = ? WHERE email = ? AND active = ?";
const SQL_TOUCH_SESSION =
	"UPDATE admin_sessions SET last_active_at = CURRENT_TIMESTAMP WHERE id = ?";
const SQL_UPDATE_PASSWORD =
	"UPDATE admin_users SET password_hash = ? WHERE id = ?";
const SQL_CONSUME_RESET =
	"UPDATE password_reset_tokens SET consumed_at = CURRENT_TIMESTAMP WHERE id = ?";

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
