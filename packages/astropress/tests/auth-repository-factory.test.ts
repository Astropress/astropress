import { describe, expect, it, vi } from "vitest";
import { createAstropressAuthRepository } from "../src/auth-repository-factory";

describe("createAstropressAuthRepository", () => {
	it("authenticates a persisted admin user", async () => {
		const repository = createAstropressAuthRepository({
			sessionTtlMs: 1000,
			now: () => 1_000,
			randomId: () => "token-1",
			hashOpaqueToken: (value) => `hash:${value}`,
			hashPassword: (value) => `password:${value}`,
			verifyPassword: (password, storedHash) => storedHash === `password:${password}`,
			cleanupExpiredSessions: vi.fn(),
			findActiveAdminUserByEmail: () => ({
				id: 1,
				email: "admin@example.com",
				passwordHash: "password:correct horse battery staple",
				role: "admin",
				name: "Admin",
			}),
			findActiveAdminUserIdByEmail: () => 1,
			insertSession: vi.fn(),
			findLiveSessionById: vi.fn(),
			touchSession: vi.fn(),
			revokeSessionById: vi.fn(),
			findInviteTokenByHash: vi.fn(),
			updateAdminUserPassword: vi.fn(),
			acceptInvitesForUser: vi.fn(),
			findPasswordResetUserByEmail: vi.fn(),
			consumePasswordResetTokensForUser: vi.fn(),
			insertPasswordResetToken: vi.fn(),
			findPasswordResetTokenByHash: vi.fn(),
			markPasswordResetTokenConsumed: vi.fn(),
			revokeSessionsForUser: vi.fn(),
			recordAuthAudit: vi.fn(),
		});

		await expect(
			repository.authenticatePersistedAdminUser(
				"admin@example.com",
				"correct horse battery staple",
			),
		).resolves.toEqual({
			email: "admin@example.com",
			role: "admin",
			name: "Admin",
		});
	});

	it("creates and reads a live session", () => {
		const insertSession = vi.fn();
		const touchSession = vi.fn();
		const repository = createAstropressAuthRepository({
			sessionTtlMs: 60_000,
			now: () => 100_000,
			randomId: vi.fn().mockReturnValueOnce("session-1").mockReturnValueOnce("csrf-1"),
			hashOpaqueToken: (value) => value,
			hashPassword: (value) => value,
			verifyPassword: vi.fn(),
			cleanupExpiredSessions: vi.fn(),
			findActiveAdminUserByEmail: vi.fn(),
			findActiveAdminUserIdByEmail: () => 42,
			insertSession,
			findLiveSessionById: () => ({
				id: "session-1",
				csrfToken: "csrf-1",
				lastActiveAt: new Date(90_000).toISOString(),
				email: "admin@example.com",
				role: "admin",
				name: "Admin",
			}),
			touchSession,
			revokeSessionById: vi.fn(),
			findInviteTokenByHash: vi.fn(),
			updateAdminUserPassword: vi.fn(),
			acceptInvitesForUser: vi.fn(),
			findPasswordResetUserByEmail: vi.fn(),
			consumePasswordResetTokensForUser: vi.fn(),
			insertPasswordResetToken: vi.fn(),
			findPasswordResetTokenByHash: vi.fn(),
			markPasswordResetTokenConsumed: vi.fn(),
			revokeSessionsForUser: vi.fn(),
			recordAuthAudit: vi.fn(),
		});

		expect(
			repository.createSession({
				email: "admin@example.com",
				role: "admin",
				name: "Admin",
			}),
		).toBe("session-1");
		expect(insertSession).toHaveBeenCalledWith({
			sessionToken: "session-1",
			userId: 42,
			csrfToken: "csrf-1",
			ipAddress: null,
			userAgent: null,
		});
		expect(repository.getSessionUser("session-1")).toEqual({
			email: "admin@example.com",
			role: "admin",
			name: "Admin",
		});
		expect(repository.getCsrfToken("session-1")).toBe("csrf-1");
		expect(touchSession).toHaveBeenCalledWith("session-1");
	});

	it("rejects expired sessions", () => {
		const revokeSessionById = vi.fn();
		const repository = createAstropressAuthRepository({
			sessionTtlMs: 60_000,
			now: () => 200_000,
			randomId: () => "token",
			hashOpaqueToken: (value) => value,
			hashPassword: (value) => value,
			verifyPassword: vi.fn(),
			cleanupExpiredSessions: vi.fn(),
			findActiveAdminUserByEmail: vi.fn(),
			findActiveAdminUserIdByEmail: vi.fn(),
			insertSession: vi.fn(),
			findLiveSessionById: () => ({
				id: "session-1",
				csrfToken: "csrf-1",
				lastActiveAt: new Date(100_000).toISOString(),
				email: "admin@example.com",
				role: "admin",
				name: "Admin",
			}),
			touchSession: vi.fn(),
			revokeSessionById,
			findInviteTokenByHash: vi.fn(),
			updateAdminUserPassword: vi.fn(),
			acceptInvitesForUser: vi.fn(),
			findPasswordResetUserByEmail: vi.fn(),
			consumePasswordResetTokensForUser: vi.fn(),
			insertPasswordResetToken: vi.fn(),
			findPasswordResetTokenByHash: vi.fn(),
			markPasswordResetTokenConsumed: vi.fn(),
			revokeSessionsForUser: vi.fn(),
			recordAuthAudit: vi.fn(),
		});

		expect(repository.getSessionUser("session-1")).toBeNull();
		expect(revokeSessionById).toHaveBeenCalledWith("session-1");
	});

	it("accepts a valid invite token", () => {
		const updateAdminUserPassword = vi.fn();
		const acceptInvitesForUser = vi.fn();
		const recordAuthAudit = vi.fn();
		const repository = createAstropressAuthRepository({
			sessionTtlMs: 60_000,
			now: () => Date.parse("2026-01-01T00:00:00.000Z"),
			randomId: () => "token",
			hashOpaqueToken: (value) => `hash:${value}`,
			hashPassword: (value) => `password:${value}`,
			verifyPassword: vi.fn(),
			cleanupExpiredSessions: vi.fn(),
			findActiveAdminUserByEmail: vi.fn(),
			findActiveAdminUserIdByEmail: vi.fn(),
			insertSession: vi.fn(),
			findLiveSessionById: vi.fn(),
			touchSession: vi.fn(),
			revokeSessionById: vi.fn(),
			findInviteTokenByHash: () => ({
				id: "invite-1",
				userId: 5,
				email: "editor@example.com",
				role: "editor",
				name: "Editor",
				expiresAt: "2026-01-02T00:00:00.000Z",
				acceptedAt: null,
				active: true,
			}),
			updateAdminUserPassword,
			acceptInvitesForUser,
			findPasswordResetUserByEmail: vi.fn(),
			consumePasswordResetTokensForUser: vi.fn(),
			insertPasswordResetToken: vi.fn(),
			findPasswordResetTokenByHash: vi.fn(),
			markPasswordResetTokenConsumed: vi.fn(),
			revokeSessionsForUser: vi.fn(),
			recordAuthAudit,
		});

		expect(repository.consumeInviteToken("invite-token", "correct horse battery staple")).toEqual({
			ok: true,
			user: {
				email: "editor@example.com",
				role: "editor",
				name: "Editor",
			},
		});
		expect(updateAdminUserPassword).toHaveBeenCalledWith(
			5,
			"password:correct horse battery staple",
		);
		expect(acceptInvitesForUser).toHaveBeenCalledWith(5);
		expect(recordAuthAudit).toHaveBeenCalled();
	});

	it("creates and consumes a password reset token", () => {
		const insertPasswordResetToken = vi.fn();
		const markPasswordResetTokenConsumed = vi.fn();
		const revokeSessionsForUser = vi.fn();
		const repository = createAstropressAuthRepository({
			sessionTtlMs: 60_000,
			now: () => Date.parse("2026-01-01T00:00:00.000Z"),
			randomId: vi
				.fn()
				.mockReturnValueOnce("raw-reset-token")
				.mockReturnValueOnce("id-reset-token"),
			hashOpaqueToken: (value) => `hash:${value}`,
			hashPassword: (value) => `password:${value}`,
			verifyPassword: vi.fn(),
			cleanupExpiredSessions: vi.fn(),
			findActiveAdminUserByEmail: vi.fn(),
			findActiveAdminUserIdByEmail: vi.fn(),
			insertSession: vi.fn(),
			findLiveSessionById: vi.fn(),
			touchSession: vi.fn(),
			revokeSessionById: vi.fn(),
			findInviteTokenByHash: vi.fn(),
			updateAdminUserPassword: vi.fn(),
			acceptInvitesForUser: vi.fn(),
			findPasswordResetUserByEmail: () => ({
				id: 3,
				email: "admin@example.com",
				role: "admin",
				name: "Admin",
			}),
			consumePasswordResetTokensForUser: vi.fn(),
			insertPasswordResetToken,
			findPasswordResetTokenByHash: () => ({
				id: "reset-id",
				userId: 3,
				email: "admin@example.com",
				role: "admin",
				name: "Admin",
				expiresAt: "2026-01-01T01:00:00.000Z",
				consumedAt: null,
				active: true,
			}),
			markPasswordResetTokenConsumed,
			revokeSessionsForUser,
			recordAuthAudit: vi.fn(),
		});

		expect(repository.createPasswordResetToken("admin@example.com")).toEqual({
			ok: true,
			resetUrl: "/ap-admin/reset-password?token=raw-reset-token",
		});
		expect(insertPasswordResetToken).toHaveBeenCalledWith({
			tokenId: "reset-id-reset-token",
			userId: 3,
			tokenHash: "hash:raw-reset-token",
			expiresAt: "2026-01-01T01:00:00.000Z",
			requestedBy: null,
		});
		expect(
			repository.consumePasswordResetToken("raw-reset-token", "correct horse battery staple"),
		).toEqual({
			ok: true,
			user: {
				email: "admin@example.com",
				role: "admin",
				name: "Admin",
			},
		});
		expect(markPasswordResetTokenConsumed).toHaveBeenCalledWith("reset-id");
		expect(revokeSessionsForUser).toHaveBeenCalledWith(3);
	});
});

// ---------------------------------------------------------------------------
// Mutation-coverage gap fillers
// ---------------------------------------------------------------------------

type RepoInput = Parameters<typeof createAstropressAuthRepository>[0];

function makeAuthRepo(overrides: Partial<RepoInput> = {}) {
	const defaults: RepoInput = {
		sessionTtlMs: 60_000,
		now: () => 100_000,
		randomId: vi.fn().mockReturnValueOnce("session-1").mockReturnValueOnce("csrf-1"),
		hashOpaqueToken: (value) => `hash:${value}`,
		hashPassword: (value) => `password:${value}`,
		verifyPassword: vi.fn(),
		cleanupExpiredSessions: vi.fn(),
		findActiveAdminUserByEmail: vi.fn(),
		findActiveAdminUserIdByEmail: vi.fn(() => 42),
		insertSession: vi.fn(),
		findLiveSessionById: vi.fn(),
		touchSession: vi.fn(),
		revokeSessionById: vi.fn(),
		findInviteTokenByHash: vi.fn(),
		updateAdminUserPassword: vi.fn(),
		acceptInvitesForUser: vi.fn(),
		findPasswordResetUserByEmail: vi.fn(),
		consumePasswordResetTokensForUser: vi.fn(),
		insertPasswordResetToken: vi.fn(),
		findPasswordResetTokenByHash: vi.fn(),
		markPasswordResetTokenConsumed: vi.fn(),
		revokeSessionsForUser: vi.fn(),
		recordAuthAudit: vi.fn(),
	};
	const merged = { ...defaults, ...overrides };
	return { repository: createAstropressAuthRepository(merged), input: merged };
}

describe("authenticatePersistedAdminUser — input normalisation and guard rails", () => {
	it("lowercases and trims the email before the lookup", async () => {
		const findActiveAdminUserByEmail = vi.fn(() => null);
		const { repository } = makeAuthRepo({ findActiveAdminUserByEmail });
		await repository.authenticatePersistedAdminUser("  Admin@Example.COM  ", "pw");
		expect(findActiveAdminUserByEmail).toHaveBeenCalledWith("admin@example.com");
	});

	it("returns null without a lookup when the email trims to empty", async () => {
		const findActiveAdminUserByEmail = vi.fn();
		const { repository } = makeAuthRepo({ findActiveAdminUserByEmail });
		expect(await repository.authenticatePersistedAdminUser("   ", "pw")).toBeNull();
		expect(findActiveAdminUserByEmail).not.toHaveBeenCalled();
	});

	it("returns null without a lookup when the password is empty", async () => {
		const findActiveAdminUserByEmail = vi.fn();
		const { repository } = makeAuthRepo({ findActiveAdminUserByEmail });
		expect(await repository.authenticatePersistedAdminUser("a@b.c", "")).toBeNull();
		expect(findActiveAdminUserByEmail).not.toHaveBeenCalled();
	});

	it("returns null when verifyPassword returns false", async () => {
		const { repository } = makeAuthRepo({
			findActiveAdminUserByEmail: () => ({
				id: 1,
				email: "a@b.c",
				passwordHash: "h",
				role: "admin",
				name: "A",
			}),
			verifyPassword: () => false,
		});
		expect(await repository.authenticatePersistedAdminUser("a@b.c", "wrong")).toBeNull();
	});
});

describe("createSession — unknown user error contains the email", () => {
	it("throws with the email embedded when no active admin id is found", () => {
		const { repository } = makeAuthRepo({ findActiveAdminUserIdByEmail: () => null });
		expect(() =>
			repository.createSession({ email: "ghost@example.com", role: "admin", name: "G" }),
		).toThrow("Cannot create a session for unknown admin user ghost@example.com.");
	});
});

describe("revokeSession — empty-token short-circuit", () => {
	it("does not call revokeSessionById when the token is empty", () => {
		const revokeSessionById = vi.fn();
		const { repository } = makeAuthRepo({ revokeSessionById });
		repository.revokeSession("");
		expect(revokeSessionById).not.toHaveBeenCalled();
	});

	it("does call revokeSessionById when a token is provided", () => {
		const revokeSessionById = vi.fn();
		const { repository } = makeAuthRepo({ revokeSessionById });
		repository.revokeSession("sess");
		expect(revokeSessionById).toHaveBeenCalledWith("sess");
	});
});

describe("consumeInviteToken — error messages", () => {
	it("returns the password-too-short error verbatim for a password shorter than 12 characters", () => {
		const { repository } = makeAuthRepo({ findInviteTokenByHash: vi.fn() });
		const r = repository.consumeInviteToken("token", "short");
		expect(r).toEqual({ ok: false, error: "Password must be at least 12 characters." });
	});

	it("returns the invalid-or-expired error verbatim when the invite is missing", () => {
		const { repository } = makeAuthRepo({ findInviteTokenByHash: () => null });
		const r = repository.consumeInviteToken("bad-token", "long-enough-pw-1234");
		expect(r).toEqual({ ok: false, error: "That invitation link is invalid or has expired." });
	});

	it("emits an auth.invite_accept audit with the email summary and targetId", () => {
		const recordAuthAudit = vi.fn();
		const { repository } = makeAuthRepo({
			now: () => Date.parse("2026-01-01T00:00:00.000Z"),
			findInviteTokenByHash: () => ({
				id: "i-1",
				userId: 5,
				email: "ed@example.com",
				role: "editor",
				name: "Ed",
				expiresAt: "2026-12-01T00:00:00.000Z",
				acceptedAt: null,
				active: true,
			}),
			recordAuthAudit,
		});
		repository.consumeInviteToken("tok", "long-enough-pw-1234");
		expect(recordAuthAudit).toHaveBeenCalledWith({
			actor: { email: "ed@example.com", role: "editor", name: "Ed" },
			action: "auth.invite_accept",
			summary: "ed@example.com accepted an admin invitation.",
			targetId: "ed@example.com",
		});
	});
});

describe("consumePasswordResetToken — error messages and audit", () => {
	it("returns the password-too-short error verbatim", () => {
		const { repository } = makeAuthRepo({ findPasswordResetTokenByHash: vi.fn() });
		const r = repository.consumePasswordResetToken("tok", "short");
		expect(r).toEqual({ ok: false, error: "Password must be at least 12 characters." });
	});

	it("returns the invalid-or-expired error verbatim when the reset token is missing", () => {
		const { repository } = makeAuthRepo({ findPasswordResetTokenByHash: () => null });
		const r = repository.consumePasswordResetToken("bad", "long-enough-pw-1234");
		expect(r).toEqual({
			ok: false,
			error: "That password reset link is invalid or has expired.",
		});
	});

	it("emits an auth.password_reset_complete audit with the email summary and targetId", () => {
		const recordAuthAudit = vi.fn();
		const { repository } = makeAuthRepo({
			now: () => Date.parse("2026-01-01T00:00:00.000Z"),
			findPasswordResetTokenByHash: () => ({
				id: "rid",
				userId: 3,
				email: "u@example.com",
				role: "admin",
				name: "U",
				expiresAt: "2026-12-01T00:00:00.000Z",
				consumedAt: null,
				active: true,
			}),
			recordAuthAudit,
		});
		repository.consumePasswordResetToken("tok", "long-enough-pw-1234");
		expect(recordAuthAudit).toHaveBeenCalledWith({
			actor: { email: "u@example.com", role: "admin", name: "U" },
			action: "auth.password_reset_complete",
			summary: "u@example.com completed a password reset.",
			targetId: "u@example.com",
		});
	});
});

describe("recordSuccessfulLogin / recordLogout — audit summary content", () => {
	it("recordSuccessfulLogin emits auth.login with the actor name + email", () => {
		const recordAuthAudit = vi.fn();
		const { repository } = makeAuthRepo({ recordAuthAudit });
		repository.recordSuccessfulLogin({ email: "u@example.com", role: "admin", name: "Bob" });
		expect(recordAuthAudit).toHaveBeenCalledWith({
			actor: { email: "u@example.com", role: "admin", name: "Bob" },
			action: "auth.login",
			summary: "Bob signed in successfully.",
			targetId: "u@example.com",
		});
	});

	it("recordLogout emits auth.logout with the actor name + email", () => {
		const recordAuthAudit = vi.fn();
		const { repository } = makeAuthRepo({ recordAuthAudit });
		repository.recordLogout({ email: "u@example.com", role: "admin", name: "Bob" });
		expect(recordAuthAudit).toHaveBeenCalledWith({
			actor: { email: "u@example.com", role: "admin", name: "Bob" },
			action: "auth.logout",
			summary: "Bob signed out.",
			targetId: "u@example.com",
		});
	});
});
