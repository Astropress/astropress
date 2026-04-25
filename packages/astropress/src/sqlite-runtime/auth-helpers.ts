import {
	type PersistedAdminUserRow,
	type PersistedAuditEventRow,
	SQL_LIST_ADMIN_USERS_WITH_INVITE,
	SQL_LIST_AUDIT_EVENTS,
} from "../persistence-commons";
import type { SessionUser } from "../persistence-types";

export type AdminRole = SessionUser["role"];

export interface PasswordResetTokenRow {
	id: string;
	user_id: number;
	token_hash: string;
	expires_at: string;
	consumed_at: string | null;
	created_at: string;
}
export interface UserInviteRow {
	id: string;
	user_id: number;
	token_hash: string;
	expires_at: string;
	accepted_at: string | null;
	created_at: string;
}
export interface AuthStoreOptions {
	sessionTtlMs: number;
	now: () => number;
	randomId: () => string;
	rootSecret: string;
}

export type AuditRow = PersistedAuditEventRow;
export type AdminUserRow = PersistedAdminUserRow;
export type ActiveAdminRow = {
	id: number;
	email: string;
	password_hash: string;
	role: AdminRole;
	name: string;
};
export type LiveSessionRow = {
	id: string;
	csrf_token: string;
	last_active_at: string;
	email: string;
	role: AdminRole;
	name: string;
};
export type InviteJoinRow = UserInviteRow & {
	email: string;
	name: string;
	role: AdminRole;
	active: number;
};
export type ResetJoinRow = PasswordResetTokenRow & {
	email: string;
	name: string;
	role: AdminRole;
	active: number;
};

export const SQL_LIST_AUDIT = SQL_LIST_AUDIT_EVENTS;
export const SQL_CLEANUP_SESSIONS = `UPDATE admin_sessions SET revoked_at = CURRENT_TIMESTAMP WHERE revoked_at IS NULL AND last_active_at < datetime('now', '-12 hours')`;
export const SQL_LIST_USERS = SQL_LIST_ADMIN_USERS_WITH_INVITE;
export const SQL_FIND_USER =
	"SELECT id FROM admin_users WHERE email = ? LIMIT 1";
export const SQL_INSERT_USER =
	"INSERT INTO admin_users (email, password_hash, role, name, active) VALUES (?, ?, ?, ?, 1)";
export const SQL_INSERT_INVITE =
	"INSERT INTO user_invites (id, user_id, token_hash, expires_at, invited_by) VALUES (?, ?, ?, ?, ?)";
export const SQL_REVOKE_SESSIONS_EMAIL =
	"UPDATE admin_sessions SET revoked_at = CURRENT_TIMESTAMP WHERE user_id = (SELECT id FROM admin_users WHERE email = ?) AND revoked_at IS NULL";
export const SQL_FIND_ACTIVE_USER =
	"SELECT id, email, password_hash, role, name FROM admin_users WHERE email = ? AND active = 1 LIMIT 1";
export const SQL_FIND_ACTIVE_ID =
	"SELECT id FROM admin_users WHERE email = ? AND active = 1 LIMIT 1";
export const SQL_INSERT_SESSION =
	"INSERT INTO admin_sessions (id, user_id, csrf_token, ip_address, user_agent) VALUES (?, ?, ?, ?, ?)";
export const SQL_FIND_LIVE_SESSION =
	"SELECT s.id, s.csrf_token, s.last_active_at, u.email, u.role, u.name FROM admin_sessions s JOIN admin_users u ON u.id = s.user_id WHERE s.id = ? AND s.revoked_at IS NULL AND u.active = 1 LIMIT 1";
export const SQL_REVOKE_SESSION =
	"UPDATE admin_sessions SET revoked_at = CURRENT_TIMESTAMP WHERE id = ? AND revoked_at IS NULL";
export const SQL_FIND_INVITE =
	"SELECT i.id, i.user_id, i.token_hash, i.expires_at, i.accepted_at, i.created_at, u.email, u.name, u.role, u.active FROM user_invites i JOIN admin_users u ON u.id = i.user_id WHERE i.token_hash = ? LIMIT 1";
export const SQL_ACCEPT_INVITES =
	"UPDATE user_invites SET accepted_at = CURRENT_TIMESTAMP WHERE user_id = ? AND accepted_at IS NULL";
export const SQL_FIND_PW_RESET_USER =
	"SELECT id, email, role, name FROM admin_users WHERE email = ? AND active = 1 LIMIT 1";
export const SQL_CONSUME_RESET_TOKENS =
	"UPDATE password_reset_tokens SET consumed_at = CURRENT_TIMESTAMP WHERE user_id = ? AND consumed_at IS NULL";
export const SQL_INSERT_RESET_TOKEN =
	"INSERT INTO password_reset_tokens (id, user_id, token_hash, expires_at, requested_by) VALUES (?, ?, ?, ?, ?)";
export const SQL_FIND_RESET_TOKEN =
	"SELECT t.id, t.user_id, t.token_hash, t.expires_at, t.consumed_at, t.created_at, u.email, u.name, u.role, u.active FROM password_reset_tokens t JOIN admin_users u ON u.id = t.user_id WHERE t.token_hash = ? LIMIT 1";
export const SQL_REVOKE_USER_SESSIONS =
	"UPDATE admin_sessions SET revoked_at = CURRENT_TIMESTAMP WHERE user_id = ? AND revoked_at IS NULL";
export const SQL_SET_USER_ACTIVE =
	"UPDATE admin_users SET active = ? WHERE email = ? AND active = ?";
export const SQL_TOUCH_SESSION =
	"UPDATE admin_sessions SET last_active_at = CURRENT_TIMESTAMP WHERE id = ?";
export const SQL_UPDATE_PASSWORD =
	"UPDATE admin_users SET password_hash = ? WHERE id = ?";
export const SQL_CONSUME_RESET =
	"UPDATE password_reset_tokens SET consumed_at = CURRENT_TIMESTAMP WHERE id = ?";
