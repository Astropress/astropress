// Direct integration tests for src/sqlite-runtime/auth.ts targeting Stryker
// survivors. Uses STATIC imports (no vi.resetModules/dynamic import) so
// Stryker's per-test coverage tracker can attribute the kills to this file.
import { DatabaseSync } from "node:sqlite";
import { beforeEach, describe, expect, it } from "vitest";

import { hashPasswordArgon2id } from "../src/crypto-primitives.js";
import { readAstropressSqliteSchemaSql } from "../src/sqlite-bootstrap.js";
import { createSqliteAuthStore } from "../src/sqlite-runtime/auth.js";
import { hashOpaqueToken } from "../src/sqlite-runtime/utils.js";

const ROOT_SECRET = "test-root-secret-aaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";
const ADMIN_EMAIL = "admin@test.local";
const ADMIN_PASSWORD = "correct-horse-battery-staple-12345";
const ADMIN_NAME = "Test Admin";

function makeArgon2Hash(password: string): string {
	return hashPasswordArgon2id(password, { iterations: 2 });
}

function freshStore() {
	const db = new DatabaseSync(":memory:");
	db.exec(readAstropressSqliteSchemaSql());
	// Seed an active admin user with a real argon2id hash so verifyPassword works.
	db.prepare(
		"INSERT INTO admin_users (email, password_hash, name, active, is_admin) VALUES (?, ?, ?, 1, 1)",
	).run(ADMIN_EMAIL, makeArgon2Hash(ADMIN_PASSWORD), ADMIN_NAME);
	// Seed a suspended admin user for the active=0 branches.
	db.prepare(
		"INSERT INTO admin_users (email, password_hash, name, active, is_admin) VALUES (?, ?, ?, 0, 1)",
	).run("suspended@test.local", makeArgon2Hash("x"), "Suspended User");

	let counter = 0;
	const store = createSqliteAuthStore(() => db, {
		sessionTtlMs: 12 * 60 * 60 * 1000,
		now: () => 1_700_000_000_000,
		randomId: () => `id-${++counter}`,
		rootSecret: ROOT_SECRET,
	});
	return { db, store };
}

function adminUserId(db: DatabaseSync, email: string): number {
	return (db.prepare("SELECT id FROM admin_users WHERE email = ?").get(email) as { id: number }).id;
}

let ctx: ReturnType<typeof freshStore>;
beforeEach(() => {
	ctx = freshStore();
});

// ─── getPersistedAuditEvents — mapAuditTargetType + id template + targetId fallback ──────────

describe("getPersistedAuditEvents survivors", () => {
	function insertAudit(opts: {
		email?: string | null;
		action?: string;
		resourceType?: string | null;
		resourceId?: string | null;
		summary?: string;
		details?: string | null;
	}) {
		ctx.db
			.prepare(
				"INSERT INTO audit_events (user_email, action, resource_type, resource_id, summary, details) VALUES (?, ?, ?, ?, ?, ?)",
			)
			.run(
				opts.email ?? ADMIN_EMAIL,
				opts.action ?? "test",
				opts.resourceType ?? null,
				opts.resourceId ?? null,
				opts.summary ?? "summary",
				opts.details ?? null,
			);
	}

	it("targetType maps known resource_type values verbatim (kills 50:8 'deployment' and 51:8 'testimonial' StringLiteral mutants)", () => {
		insertAudit({ resourceType: "deployment" });
		insertAudit({ resourceType: "testimonial" });
		insertAudit({ resourceType: "comment" });
		insertAudit({ resourceType: "content" });
		insertAudit({ resourceType: "redirect" });
		insertAudit({ resourceType: "something-else" });
		const events = ctx.store.getPersistedAuditEvents();
		const byResource = (rt: string) => events.find((e) => e.summary === "summary" && rt);
		expect(events.find((e) => e.targetType === "deployment")).toBeDefined();
		expect(events.find((e) => e.targetType === "testimonial")).toBeDefined();
		expect(events.find((e) => e.targetType === "comment")).toBeDefined();
		expect(events.find((e) => e.targetType === "content")).toBeDefined();
		expect(events.find((e) => e.targetType === "redirect")).toBeDefined();
		// "something-else" falls into the default → "auth" branch.
		expect(events.filter((e) => e.targetType === "auth").length).toBeGreaterThan(0);
		// Silence unused linter for byResource (kept for diagnostic clarity above).
		void byResource;
	});

	it("event id uses the literal 'sqlite-audit-' prefix (kills 81:8 StringLiteral template→empty)", () => {
		insertAudit({ resourceType: "content", resourceId: "post-1" });
		const events = ctx.store.getPersistedAuditEvents();
		expect(events.every((e) => /^sqlite-audit-\d+$/.test(e.id))).toBe(true);
	});

	it("targetId falls back to the audit row id when resource_id is null (kills 87:14 LogicalOperator ?? →&&)", () => {
		// Schema requires resource_type NOT NULL; use a non-mapped type so it routes to the
		// default switch case. The 87:14 mutant is about resource_id null fallback to row.id.
		insertAudit({ resourceType: "uncategorized", resourceId: null });
		const events = ctx.store.getPersistedAuditEvents();
		const event = events[0];
		expect(event.targetId).toMatch(/^\d+$/); // The row id, not the string "null".
		// `null ?? \`${id}\`` = id. Mutant `null && \`${id}\`` = null → targetId would be null.
		expect(event.targetId).not.toBeNull();
		expect(event.targetId.length).toBeGreaterThan(0);
	});

	it("targetId uses resource_id verbatim when present (kills the ?? right-side as well)", () => {
		insertAudit({ resourceType: "content", resourceId: "post-42" });
		const events = ctx.store.getPersistedAuditEvents();
		const event = events.find((e) => e.targetType === "content");
		expect(event?.targetId).toBe("post-42");
	});
});

// ─── User repository helpers ────────────────────────────────────────────────

describe("sqliteUserRepository helpers", () => {
	it("createInvitedAdminUser sets is_admin=1 when role='admin' and is_admin=0 when role='editor' (kills 122:38 ConditionalExpression/EqualityOperator + 122:47 StringLiteral)", async () => {
		const result = await ctx.store.sqliteUserRepository.inviteAdminUser(
			{ email: "new-admin@test.local", role: "admin", name: "New Admin" },
			{ email: ADMIN_EMAIL, role: "admin", name: ADMIN_NAME },
		);
		expect(result.ok).toBe(true);
		const admin = ctx.db
			.prepare("SELECT is_admin FROM admin_users WHERE email = ?")
			.get("new-admin@test.local") as { is_admin: number };
		expect(admin.is_admin).toBe(1);

		const result2 = await ctx.store.sqliteUserRepository.inviteAdminUser(
			{ email: "new-editor@test.local", role: "editor", name: "New Editor" },
			{ email: ADMIN_EMAIL, role: "admin", name: ADMIN_NAME },
		);
		expect(result2.ok).toBe(true);
		const editor = ctx.db
			.prepare("SELECT is_admin FROM admin_users WHERE email = ?")
			.get("new-editor@test.local") as { is_admin: number };
		expect(editor.is_admin).toBe(0);
	});

	it("inviteAdminUser inserts an audit row with resource_type='auth' (kills 172:6 BlockStatement {} and 173:49 StringLiteral 'auth'→'')", async () => {
		await ctx.store.sqliteUserRepository.inviteAdminUser(
			{ email: "audited@test.local", role: "editor", name: "Audited" },
			{ email: ADMIN_EMAIL, role: "admin", name: ADMIN_NAME },
		);
		const rows = ctx.db
			.prepare("SELECT resource_type FROM audit_events WHERE action = 'user.invite'")
			.all() as Array<{ resource_type: string }>;
		expect(rows.length).toBeGreaterThan(0);
		expect(rows.every((r) => r.resource_type === "auth")).toBe(true);
	});

	it("suspendAdminUser revokes admin sessions for the email (kills 159:46 BlockStatement {} on revokeAdminSessionsForEmail)", async () => {
		// Prepare a session for ADMIN_EMAIL.
		const userId = adminUserId(ctx.db, ADMIN_EMAIL);
		ctx.db
			.prepare(
				"INSERT INTO admin_sessions (id, user_id, csrf_token) VALUES ('sess-1', ?, 'csrf-1')",
			)
			.run(userId);
		// Suspending a different admin so admin_users target row is independent; but to actually trigger
		// revokeAdminSessionsForEmail on ADMIN_EMAIL we need to suspend ADMIN_EMAIL. The helper revokes
		// the *target email's* sessions. Suspend a different invited user but verify pattern.
		// Easier: suspend the suspended user (toggle restore) then suspend ADMIN_EMAIL? Need an
		// active editor. Promote suspended user back to active then suspend.
		ctx.db
			.prepare(
				"UPDATE admin_users SET active = 1, is_admin = 0 WHERE email = 'suspended@test.local'",
			)
			.run();
		ctx.db
			.prepare(
				"INSERT INTO admin_sessions (id, user_id, csrf_token) VALUES ('sess-2', (SELECT id FROM admin_users WHERE email = 'suspended@test.local'), 'csrf-2')",
			)
			.run();
		await ctx.store.sqliteUserRepository.suspendAdminUser("suspended@test.local", {
			email: ADMIN_EMAIL,
			role: "admin",
			name: ADMIN_NAME,
		});
		const session = ctx.db
			.prepare("SELECT revoked_at FROM admin_sessions WHERE id = 'sess-2'")
			.get() as { revoked_at: string | null };
		expect(session.revoked_at).not.toBeNull();
		// The ADMIN_EMAIL session must remain untouched.
		const ownSession = ctx.db
			.prepare("SELECT revoked_at FROM admin_sessions WHERE id = 'sess-1'")
			.get() as { revoked_at: string | null };
		expect(ownSession.revoked_at).toBeNull();
	});

	it("inviteAdminUser fails when the email already exists (drives findAdminUserByEmail through a real lookup — kills 105:39 BlockStatement, 106:11 LogicalOperator, 129:11 OptionalChaining)", async () => {
		const result = await ctx.store.sqliteUserRepository.inviteAdminUser(
			{ email: ADMIN_EMAIL, role: "editor", name: "Dup" },
			{ email: ADMIN_EMAIL, role: "admin", name: ADMIN_NAME },
		);
		expect(result.ok).toBe(false);
	});
});

// ─── Auth repository helpers ────────────────────────────────────────────────

describe("sqliteAuthRepository helpers", () => {
	it("authenticatePersistedAdminUser returns null for unknown email rather than throwing (kills 187:8 ConditionalExpression false on `if (!row) return null`)", async () => {
		const result = await ctx.store.sqliteAuthRepository.authenticatePersistedAdminUser(
			"ghost@test.local",
			"any-password",
		);
		expect(result).toBeNull();
	});

	it("authenticatePersistedAdminUser returns the live user for a valid credential", async () => {
		const result = await ctx.store.sqliteAuthRepository.authenticatePersistedAdminUser(
			ADMIN_EMAIL,
			ADMIN_PASSWORD,
		);
		expect(result).not.toBeNull();
		expect(result?.email).toBe(ADMIN_EMAIL);
	});

	it("createSession throws for unknown user (kills 198:5 OptionalChaining (...)?.id ?? null returning undefined)", () => {
		expect(() =>
			ctx.store.sqliteAuthRepository.createSession(
				{ email: "ghost@test.local", role: "admin", name: "Ghost" },
				{ ipAddress: null, userAgent: null },
			),
		).toThrow(/unknown admin user/);
	});

	it("createSession persists ipAddress/userAgent as NULL when metadata is undefined (kills 216:43 and 216:62 LogicalOperators)", async () => {
		const user = await ctx.store.sqliteAuthRepository.authenticatePersistedAdminUser(
			ADMIN_EMAIL,
			ADMIN_PASSWORD,
		);
		const token = ctx.store.sqliteAuthRepository.createSession(user!, undefined);
		const row = ctx.db
			.prepare("SELECT ip_address, user_agent FROM admin_sessions WHERE id = ?")
			.get(token) as { ip_address: string | null; user_agent: string | null };
		expect(row.ip_address).toBeNull();
		expect(row.user_agent).toBeNull();
	});

	it("createSession persists provided ipAddress/userAgent verbatim", async () => {
		const user = await ctx.store.sqliteAuthRepository.authenticatePersistedAdminUser(
			ADMIN_EMAIL,
			ADMIN_PASSWORD,
		);
		const token = ctx.store.sqliteAuthRepository.createSession(user!, {
			ipAddress: "10.0.0.1",
			userAgent: "vitest/1.0",
		});
		const row = ctx.db
			.prepare("SELECT ip_address, user_agent FROM admin_sessions WHERE id = ?")
			.get(token) as { ip_address: string; user_agent: string };
		expect(row.ip_address).toBe("10.0.0.1");
		expect(row.user_agent).toBe("vitest/1.0");
	});

	it("getSessionUser updates last_active_at via touchSession (kills 232:38 BlockStatement {} on touchSession)", async () => {
		const user = await ctx.store.sqliteAuthRepository.authenticatePersistedAdminUser(
			ADMIN_EMAIL,
			ADMIN_PASSWORD,
		);
		const token = ctx.store.sqliteAuthRepository.createSession(user!, null);
		// Move last_active_at back by ~2 minutes — still within the 12-hour cleanup window AND within
		// the now()-derived TTL guard (Date.parse of a real CURRENT_TIMESTAMP-derived string yields a
		// value far in the future relative to now()=1_700_000_000_000, so resolveValidSession's TTL
		// check `now() - lastActiveAt > sessionTtlMs` is satisfied negatively and the session stays valid).
		ctx.db
			.prepare(
				"UPDATE admin_sessions SET last_active_at = datetime('now', '-2 minutes') WHERE id = ?",
			)
			.run(token);
		const before = ctx.db
			.prepare("SELECT last_active_at FROM admin_sessions WHERE id = ?")
			.get(token) as { last_active_at: string };
		const result = ctx.store.sqliteAuthRepository.getSessionUser(token);
		expect(result).not.toBeNull();
		const after = ctx.db
			.prepare("SELECT last_active_at FROM admin_sessions WHERE id = ?")
			.get(token) as { last_active_at: string };
		expect(after.last_active_at).not.toBe(before.last_active_at);
	});

	it("revokeSession marks the session row revoked", async () => {
		const user = await ctx.store.sqliteAuthRepository.authenticatePersistedAdminUser(
			ADMIN_EMAIL,
			ADMIN_PASSWORD,
		);
		const token = ctx.store.sqliteAuthRepository.createSession(user!, null);
		ctx.store.sqliteAuthRepository.revokeSession(token);
		const row = ctx.db.prepare("SELECT revoked_at FROM admin_sessions WHERE id = ?").get(token) as {
			revoked_at: string | null;
		};
		expect(row.revoked_at).not.toBeNull();
	});

	it("recordSuccessfulLogin inserts audit row with resource_type='auth' (kills 316:49 StringLiteral 'auth'→'')", () => {
		ctx.store.sqliteAuthRepository.recordSuccessfulLogin({
			email: ADMIN_EMAIL,
			role: "admin",
			name: ADMIN_NAME,
		});
		const rows = ctx.db
			.prepare("SELECT resource_type FROM audit_events WHERE action = 'auth.login'")
			.all() as Array<{ resource_type: string }>;
		expect(rows.length).toBeGreaterThan(0);
		expect(rows.every((r) => r.resource_type === "auth")).toBe(true);
	});

	it("getInviteRequest returns null for unknown token (drives hashOpaqueToken path; kills 104:20 ArrowFunction () => undefined)", () => {
		const result = ctx.store.sqliteAuthRepository.getInviteRequest("not-a-real-token");
		expect(result).toBeNull();
	});

	it("consumeInviteToken updates the user password and accepts the invite (kills 252:65 BlockStatement {} on updateAdminUserPassword and exercises 249:13 row.active === 1)", () => {
		// Seed an invited user with a known token hash.
		const userId = adminUserId(ctx.db, ADMIN_EMAIL);
		const rawToken = "invite-token-xyz";
		const tokenHash = hashOpaqueToken(rawToken, ROOT_SECRET);
		ctx.db
			.prepare(
				"INSERT INTO user_invites (id, user_id, token_hash, expires_at, invited_by) VALUES ('inv-1', ?, ?, datetime('now', '+1 day'), ?)",
			)
			.run(userId, tokenHash, ADMIN_EMAIL);
		const beforeHash = (
			ctx.db.prepare("SELECT password_hash FROM admin_users WHERE id = ?").get(userId) as {
				password_hash: string;
			}
		).password_hash;

		const result = ctx.store.sqliteAuthRepository.consumeInviteToken(
			rawToken,
			"new-strong-password-123",
		);
		expect(result.ok).toBe(true);

		const afterHash = (
			ctx.db.prepare("SELECT password_hash FROM admin_users WHERE id = ?").get(userId) as {
				password_hash: string;
			}
		).password_hash;
		// If updateAdminUserPassword body is {}, hash would be unchanged → mutant survives.
		expect(afterHash).not.toBe(beforeHash);

		const accepted = ctx.db
			.prepare("SELECT accepted_at FROM user_invites WHERE id = 'inv-1'")
			.get() as { accepted_at: string | null };
		expect(accepted.accepted_at).not.toBeNull();
	});

	it("getInviteRequest reflects the user's active=0 state in findInviteTokenByHash (kills 249:13 ConditionalExpression `row.active === 1` →true)", () => {
		const suspendedId = adminUserId(ctx.db, "suspended@test.local");
		const rawToken = "invite-token-suspended";
		const tokenHash = hashOpaqueToken(rawToken, ROOT_SECRET);
		ctx.db
			.prepare(
				"INSERT INTO user_invites (id, user_id, token_hash, expires_at, invited_by) VALUES ('inv-s', ?, ?, datetime('now', '+1 day'), ?)",
			)
			.run(suspendedId, tokenHash, ADMIN_EMAIL);
		// resolveUsableInviteToken inside auth-repository-factory rejects suspended users — that
		// would mask the active flag from the mapped shape. Instead drive the helper indirectly via
		// the consume path with a wrong-format password to trigger validation BEFORE active check.
		// Even simpler: directly query and verify the JSON-shape semantics via the live SQL row.
		const row = ctx.db
			.prepare(
				"SELECT u.active FROM user_invites i JOIN admin_users u ON u.id = i.user_id WHERE i.id = 'inv-s'",
			)
			.get() as { active: number };
		expect(row.active).toBe(0);
		// The mapped `active === 1` boolean MUST be false. We verify by trying getInviteRequest with
		// an active=0 user — the upstream guard returns null, killing the equality direction.
		const result = ctx.store.sqliteAuthRepository.getInviteRequest(rawToken);
		expect(result).toBeNull();
	});

	it("createPasswordResetToken consumes existing reset tokens before issuing the new one (kills 265:53 BlockStatement {} on consumePasswordResetTokensForUser)", () => {
		const userId = adminUserId(ctx.db, ADMIN_EMAIL);
		ctx.db
			.prepare(
				"INSERT INTO password_reset_tokens (id, user_id, token_hash, expires_at, requested_by) VALUES ('old-token', ?, 'h1', datetime('now', '+1 day'), ?)",
			)
			.run(userId, ADMIN_EMAIL);
		const beforeConsumed = (
			ctx.db
				.prepare("SELECT consumed_at FROM password_reset_tokens WHERE id = 'old-token'")
				.get() as {
				consumed_at: string | null;
			}
		).consumed_at;
		expect(beforeConsumed).toBeNull();

		ctx.store.sqliteAuthRepository.createPasswordResetToken(ADMIN_EMAIL, {
			email: ADMIN_EMAIL,
			role: "admin",
			name: ADMIN_NAME,
		});

		const afterConsumed = (
			ctx.db
				.prepare("SELECT consumed_at FROM password_reset_tokens WHERE id = 'old-token'")
				.get() as {
				consumed_at: string | null;
			}
		).consumed_at;
		expect(afterConsumed).not.toBeNull();
	});

	it("consumePasswordResetToken revokes all sessions for the user (kills 302:41 BlockStatement {} on revokeSessionsForUser and exercises 296:13 row.active === 1)", () => {
		const userId = adminUserId(ctx.db, ADMIN_EMAIL);
		// Create two active sessions for the user.
		ctx.db
			.prepare(
				"INSERT INTO admin_sessions (id, user_id, csrf_token) VALUES ('s-a', ?, 'csrf-a'), ('s-b', ?, 'csrf-b')",
			)
			.run(userId, userId);
		// Issue a reset token directly so we know the raw token.
		const rawToken = "reset-token-xyz";
		const tokenHash = hashOpaqueToken(rawToken, ROOT_SECRET);
		ctx.db
			.prepare(
				"INSERT INTO password_reset_tokens (id, user_id, token_hash, expires_at, requested_by) VALUES ('rt-1', ?, ?, datetime('now', '+1 day'), ?)",
			)
			.run(userId, tokenHash, ADMIN_EMAIL);

		const result = ctx.store.sqliteAuthRepository.consumePasswordResetToken(
			rawToken,
			"another-strong-password-123",
		);
		expect(result.ok).toBe(true);
		const sessions = ctx.db
			.prepare("SELECT id, revoked_at FROM admin_sessions WHERE user_id = ?")
			.all(userId) as Array<{ id: string; revoked_at: string | null }>;
		expect(sessions.length).toBe(2);
		expect(sessions.every((s) => s.revoked_at !== null)).toBe(true);
	});

	it("cleanupExpiredSessions revokes sessions whose last_active_at is older than 12 hours (kills 92:36 BlockStatement {})", () => {
		const userId = adminUserId(ctx.db, ADMIN_EMAIL);
		ctx.db
			.prepare(
				"INSERT INTO admin_sessions (id, user_id, csrf_token, last_active_at) VALUES ('old-sess', ?, 'csrf-old', datetime('now', '-13 hours'))",
			)
			.run(userId);
		// Fresh session must NOT be revoked.
		ctx.db
			.prepare(
				"INSERT INTO admin_sessions (id, user_id, csrf_token, last_active_at) VALUES ('new-sess', ?, 'csrf-new', CURRENT_TIMESTAMP)",
			)
			.run(userId);
		// Drive cleanupExpiredSessions through any path that calls it — easiest is to issue a
		// password reset request, which goes through validateAdminCleanupHook on most code paths.
		// Or: call getSessionUser for a fresh session, which calls resolveValidSession →
		// cleanupExpiredSessions (in helpers).
		const user = (async () => {
			const u = await ctx.store.sqliteAuthRepository.authenticatePersistedAdminUser(
				ADMIN_EMAIL,
				ADMIN_PASSWORD,
			);
			return u;
		})();
		void user;
		// Drive cleanupExpiredSessions: any session-touching path that calls the helper.
		// The simplest is to call getSessionUser on an unknown token (it still runs cleanup first).
		ctx.store.sqliteAuthRepository.getSessionUser("nonexistent-token");
		const old = ctx.db
			.prepare("SELECT revoked_at FROM admin_sessions WHERE id = 'old-sess'")
			.get() as { revoked_at: string | null };
		expect(old.revoked_at).not.toBeNull();
		const fresh = ctx.db
			.prepare("SELECT revoked_at FROM admin_sessions WHERE id = 'new-sess'")
			.get() as { revoked_at: string | null };
		expect(fresh.revoked_at).toBeNull();
	});
});
