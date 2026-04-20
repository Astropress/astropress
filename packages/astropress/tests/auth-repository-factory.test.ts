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
			verifyPassword: (password, storedHash) =>
				storedHash === `password:${password}`,
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
			randomId: vi
				.fn()
				.mockReturnValueOnce("session-1")
				.mockReturnValueOnce("csrf-1"),
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

		expect(
			repository.consumeInviteToken(
				"invite-token",
				"correct horse battery staple",
			),
		).toEqual({
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
			repository.consumePasswordResetToken(
				"raw-reset-token",
				"correct horse battery staple",
			),
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
