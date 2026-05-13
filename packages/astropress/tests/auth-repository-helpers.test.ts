import { describe, expect, test, vi } from "vitest";
import {
	type AstropressAuthRepositoryInput,
	type AstropressAuthSessionRow,
	type AstropressInviteTokenRecord,
	type AstropressPasswordResetTokenRecord,
	buildResetUrl,
	issuePasswordResetToken,
	isUsableToken,
	mapSessionUser,
	resolveUsableInviteToken,
	resolveUsablePasswordResetToken,
	resolveValidSession,
	validatePasswordInput,
} from "../src/auth-repository-helpers";
import type { Actor } from "../src/persistence-types";

function makeDeps(
	overrides: Partial<AstropressAuthRepositoryInput> = {},
): AstropressAuthRepositoryInput {
	const defaults: AstropressAuthRepositoryInput = {
		sessionTtlMs: 60_000,
		now: () => 1_000_000,
		randomId: () => "rand-id",
		hashOpaqueToken: (v) => `hash(${v})`,
		hashPassword: (v) => `pwhash(${v})`,
		verifyPassword: () => true,
		cleanupExpiredSessions: vi.fn(),
		findActiveAdminUserByEmail: () => null,
		findActiveAdminUserIdByEmail: () => null,
		insertSession: vi.fn(),
		findLiveSessionById: () => null,
		touchSession: vi.fn(),
		revokeSessionById: vi.fn(),
		findInviteTokenByHash: () => null,
		updateAdminUserPassword: vi.fn(),
		acceptInvitesForUser: vi.fn(),
		findPasswordResetUserByEmail: () => null,
		consumePasswordResetTokensForUser: vi.fn(),
		insertPasswordResetToken: vi.fn(),
		findPasswordResetTokenByHash: () => null,
		markPasswordResetTokenConsumed: vi.fn(),
		revokeSessionsForUser: vi.fn(),
		recordAuthAudit: vi.fn(),
	};
	return { ...defaults, ...overrides };
}

describe("mapSessionUser", () => {
	test("projects only email/role/name", () => {
		expect(
			mapSessionUser({
				email: "a@b.com",
				role: "admin",
				name: "Alice",
			}),
		).toEqual({ email: "a@b.com", role: "admin", name: "Alice" });
	});
});

describe("isUsableToken", () => {
	const now = 1_000_000;
	const future = new Date(now + 60_000).toISOString();
	const past = new Date(now - 60_000).toISOString();

	test("returns true for active, unconsumed, not-expired token", () => {
		expect(isUsableToken(future, null, true, now)).toBe(true);
	});

	test("returns false when consumedAt is set", () => {
		expect(isUsableToken(future, "2026-01-01", true, now)).toBe(false);
	});

	test("returns false when active=false", () => {
		expect(isUsableToken(future, null, false, now)).toBe(false);
	});

	test("returns false when expired (parsed expiresAt < now)", () => {
		expect(isUsableToken(past, null, true, now)).toBe(false);
	});

	test("expiresAt exactly equals now → still usable (>= boundary)", () => {
		const exact = new Date(now).toISOString();
		expect(isUsableToken(exact, null, true, now)).toBe(true);
	});

	test("expiresAt one ms before now → not usable", () => {
		const justExpired = new Date(now - 1).toISOString();
		expect(isUsableToken(justExpired, null, true, now)).toBe(false);
	});
});

describe("resolveValidSession", () => {
	test("returns null when sessionToken is empty string", () => {
		const deps = makeDeps();
		expect(resolveValidSession("", deps)).toBeNull();
		expect(deps.cleanupExpiredSessions).not.toHaveBeenCalled();
	});

	test("returns null when sessionToken is null", () => {
		const deps = makeDeps();
		expect(resolveValidSession(null, deps)).toBeNull();
		expect(deps.cleanupExpiredSessions).not.toHaveBeenCalled();
	});

	test("returns null when sessionToken is undefined", () => {
		const deps = makeDeps();
		expect(resolveValidSession(undefined, deps)).toBeNull();
		expect(deps.cleanupExpiredSessions).not.toHaveBeenCalled();
	});

	test("calls cleanupExpiredSessions before lookup", () => {
		const deps = makeDeps({
			findLiveSessionById: () => null,
		});
		resolveValidSession("tok", deps);
		expect(deps.cleanupExpiredSessions).toHaveBeenCalledOnce();
	});

	test("returns null when session not found", () => {
		const deps = makeDeps({ findLiveSessionById: () => null });
		expect(resolveValidSession("tok", deps)).toBeNull();
		expect(deps.revokeSessionById).not.toHaveBeenCalled();
		expect(deps.touchSession).not.toHaveBeenCalled();
	});

	test("returns null and revokes when lastActiveAt is unparseable", () => {
		const row: AstropressAuthSessionRow = {
			id: "s1",
			csrfToken: "c",
			lastActiveAt: "not-a-date",
			email: "a@b.com",
			role: "admin",
			name: "A",
		};
		const deps = makeDeps({ findLiveSessionById: () => row });
		expect(resolveValidSession("tok", deps)).toBeNull();
		expect(deps.revokeSessionById).toHaveBeenCalledWith("tok");
		expect(deps.touchSession).not.toHaveBeenCalled();
	});

	test("returns null and revokes when session is past TTL", () => {
		const now = 1_000_000;
		const row: AstropressAuthSessionRow = {
			id: "s1",
			csrfToken: "c",
			lastActiveAt: new Date(now - 70_000).toISOString(),
			email: "a@b.com",
			role: "admin",
			name: "A",
		};
		const deps = makeDeps({
			sessionTtlMs: 60_000,
			now: () => now,
			findLiveSessionById: () => row,
		});
		expect(resolveValidSession("tok", deps)).toBeNull();
		expect(deps.revokeSessionById).toHaveBeenCalledWith("tok");
	});

	test("exact-TTL boundary: now - lastActive == ttl → still valid (> boundary)", () => {
		const now = 1_000_000;
		const row: AstropressAuthSessionRow = {
			id: "s1",
			csrfToken: "c",
			lastActiveAt: new Date(now - 60_000).toISOString(),
			email: "a@b.com",
			role: "admin",
			name: "A",
		};
		const deps = makeDeps({
			sessionTtlMs: 60_000,
			now: () => now,
			findLiveSessionById: () => row,
		});
		expect(resolveValidSession("tok", deps)).toBe(row);
		expect(deps.touchSession).toHaveBeenCalledWith("tok");
		expect(deps.revokeSessionById).not.toHaveBeenCalled();
	});

	test("one-ms past TTL → revoked", () => {
		const now = 1_000_000;
		const row: AstropressAuthSessionRow = {
			id: "s1",
			csrfToken: "c",
			lastActiveAt: new Date(now - 60_001).toISOString(),
			email: "a@b.com",
			role: "admin",
			name: "A",
		};
		const deps = makeDeps({
			sessionTtlMs: 60_000,
			now: () => now,
			findLiveSessionById: () => row,
		});
		expect(resolveValidSession("tok", deps)).toBeNull();
		expect(deps.revokeSessionById).toHaveBeenCalledWith("tok");
	});

	test("happy path: touches session and returns row", () => {
		const now = 1_000_000;
		const row: AstropressAuthSessionRow = {
			id: "s1",
			csrfToken: "c",
			lastActiveAt: new Date(now - 1000).toISOString(),
			email: "a@b.com",
			role: "admin",
			name: "A",
		};
		const deps = makeDeps({
			now: () => now,
			findLiveSessionById: () => row,
		});
		expect(resolveValidSession("tok", deps)).toBe(row);
		expect(deps.touchSession).toHaveBeenCalledWith("tok");
	});
});

describe("resolveUsableInviteToken", () => {
	test("empty trimmed token short-circuits before any DB call", () => {
		const hashSpy = vi.fn(() => "h");
		const findSpy = vi.fn(() => null);
		const deps = makeDeps({
			hashOpaqueToken: hashSpy,
			findInviteTokenByHash: findSpy,
		});
		expect(resolveUsableInviteToken("   ", deps)).toBeNull();
		expect(hashSpy).not.toHaveBeenCalled();
		expect(findSpy).not.toHaveBeenCalled();
	});

	test("trims whitespace before hashing", () => {
		const hashSpy = vi.fn(() => "h");
		const deps = makeDeps({
			hashOpaqueToken: hashSpy,
			findInviteTokenByHash: () => null,
		});
		resolveUsableInviteToken("  raw  ", deps);
		expect(hashSpy).toHaveBeenCalledWith("raw");
	});

	test("returns null when no row found", () => {
		const deps = makeDeps({ findInviteTokenByHash: () => null });
		expect(resolveUsableInviteToken("raw", deps)).toBeNull();
	});

	test("returns null when token is unusable (consumed/expired/inactive)", () => {
		const past = new Date(0).toISOString();
		const row: AstropressInviteTokenRecord = {
			id: "i1",
			userId: 1,
			expiresAt: past,
			acceptedAt: null,
			active: true,
			email: "a@b.com",
			role: "admin",
			name: "A",
		};
		const deps = makeDeps({
			findInviteTokenByHash: () => row,
			now: () => 1_000_000,
		});
		expect(resolveUsableInviteToken("raw", deps)).toBeNull();
	});

	test("returns the row when usable", () => {
		const now = 1_000_000;
		const row: AstropressInviteTokenRecord = {
			id: "i1",
			userId: 1,
			expiresAt: new Date(now + 60_000).toISOString(),
			acceptedAt: null,
			active: true,
			email: "a@b.com",
			role: "admin",
			name: "A",
		};
		const deps = makeDeps({
			findInviteTokenByHash: () => row,
			now: () => now,
		});
		expect(resolveUsableInviteToken("raw", deps)).toBe(row);
	});
});

describe("resolveUsablePasswordResetToken", () => {
	test("empty trimmed token short-circuits before any DB call", () => {
		const hashSpy = vi.fn(() => "h");
		const findSpy = vi.fn(() => null);
		const deps = makeDeps({
			hashOpaqueToken: hashSpy,
			findPasswordResetTokenByHash: findSpy,
		});
		expect(resolveUsablePasswordResetToken("   ", deps)).toBeNull();
		expect(hashSpy).not.toHaveBeenCalled();
		expect(findSpy).not.toHaveBeenCalled();
	});

	test("trims whitespace before hashing", () => {
		const hashSpy = vi.fn(() => "h");
		const deps = makeDeps({
			hashOpaqueToken: hashSpy,
			findPasswordResetTokenByHash: () => null,
		});
		resolveUsablePasswordResetToken("  raw  ", deps);
		expect(hashSpy).toHaveBeenCalledWith("raw");
	});

	test("returns null when no row found", () => {
		const deps = makeDeps({ findPasswordResetTokenByHash: () => null });
		expect(resolveUsablePasswordResetToken("raw", deps)).toBeNull();
	});

	test("returns the row when usable", () => {
		const now = 1_000_000;
		const row: AstropressPasswordResetTokenRecord = {
			id: "r1",
			userId: 1,
			expiresAt: new Date(now + 60_000).toISOString(),
			consumedAt: null,
			active: true,
			email: "a@b.com",
			role: "admin",
			name: "A",
		};
		const deps = makeDeps({
			findPasswordResetTokenByHash: () => row,
			now: () => now,
		});
		expect(resolveUsablePasswordResetToken("raw", deps)).toBe(row);
	});

	test("returns null when token consumed", () => {
		const now = 1_000_000;
		const row: AstropressPasswordResetTokenRecord = {
			id: "r1",
			userId: 1,
			expiresAt: new Date(now + 60_000).toISOString(),
			consumedAt: "2026-01-01",
			active: true,
			email: "a@b.com",
			role: "admin",
			name: "A",
		};
		const deps = makeDeps({
			findPasswordResetTokenByHash: () => row,
			now: () => now,
		});
		expect(resolveUsablePasswordResetToken("raw", deps)).toBeNull();
	});
});

describe("validatePasswordInput", () => {
	test("trims the input before length check", () => {
		const result = validatePasswordInput("  ab  ");
		expect(result.ok).toBe(false);
	});

	test("returns ok:false with empty trimmedPassword on rejection", () => {
		const result = validatePasswordInput("short");
		expect(result).toEqual({ ok: false, trimmedPassword: "" });
	});

	test("11 chars after trim → rejected (boundary < 12)", () => {
		const result = validatePasswordInput("abcdefghijk");
		expect(result.ok).toBe(false);
	});

	test("12 chars after trim → accepted (boundary)", () => {
		const result = validatePasswordInput("abcdefghijkl");
		expect(result).toEqual({ ok: true, trimmedPassword: "abcdefghijkl" });
	});

	test("returns the trimmed password on success (not the raw)", () => {
		const result = validatePasswordInput("  abcdefghijkl  ");
		expect(result).toEqual({ ok: true, trimmedPassword: "abcdefghijkl" });
	});
});

describe("buildResetUrl", () => {
	test("URL-encodes the token", () => {
		expect(buildResetUrl("a b/c")).toBe("/ap-admin/reset-password?token=a%20b%2Fc");
	});

	test("happy-path token unchanged in path prefix", () => {
		expect(buildResetUrl("plain")).toBe("/ap-admin/reset-password?token=plain");
	});
});

describe("issuePasswordResetToken", () => {
	const actor: Actor = { email: "admin@example.com" };

	test("returns error when email is whitespace-only", () => {
		const deps = makeDeps();
		const r = issuePasswordResetToken("   ", actor, deps);
		expect(r).toEqual({ ok: false, error: "Email is required." });
		expect(deps.findPasswordResetUserByEmail).toBeDefined();
		expect(deps.insertPasswordResetToken).not.toHaveBeenCalled();
	});

	test("lowercases and trims email before lookup", () => {
		const lookupSpy = vi.fn(() => null);
		const deps = makeDeps({ findPasswordResetUserByEmail: lookupSpy });
		issuePasswordResetToken("  ALICE@Example.COM  ", actor, deps);
		expect(lookupSpy).toHaveBeenCalledWith("alice@example.com");
	});

	test("with actor + unknown user → returns ok:false with verbatim error", () => {
		const deps = makeDeps({ findPasswordResetUserByEmail: () => null });
		const r = issuePasswordResetToken("a@b.com", actor, deps);
		expect(r).toEqual({ ok: false, error: "That admin user could not be found." });
	});

	test("without actor + unknown user → returns ok:true with null resetUrl (no enumeration leak)", () => {
		const deps = makeDeps({ findPasswordResetUserByEmail: () => null });
		const r = issuePasswordResetToken("a@b.com", undefined, deps);
		expect(r).toEqual({ ok: true, resetUrl: null });
	});

	test("happy path: inserts token and returns reset URL", () => {
		let n = 0;
		const deps = makeDeps({
			findPasswordResetUserByEmail: () => ({
				id: 7,
				email: "a@b.com",
				role: "admin",
				name: "A",
			}),
			randomId: () => `r${++n}`,
			hashOpaqueToken: (v) => `H(${v})`,
			now: () => 1_700_000_000_000,
		});
		const r = issuePasswordResetToken("a@b.com", actor, deps);
		expect(deps.consumePasswordResetTokensForUser).toHaveBeenCalledWith(7);
		expect(deps.insertPasswordResetToken).toHaveBeenCalledWith({
			tokenId: "reset-r2",
			userId: 7,
			tokenHash: "H(r1)",
			expiresAt: new Date(1_700_000_000_000 + 60 * 60 * 1000).toISOString(),
			requestedBy: "admin@example.com",
		});
		expect(r).toEqual({
			ok: true,
			resetUrl: "/ap-admin/reset-password?token=r1",
		});
	});

	test("expiry is exactly 60 minutes past deps.now()", () => {
		const now = 5_000_000;
		let captured = "";
		const deps = makeDeps({
			findPasswordResetUserByEmail: () => ({
				id: 1,
				email: "a@b.com",
				role: "admin",
				name: "A",
			}),
			now: () => now,
			insertPasswordResetToken: (input) => {
				captured = input.expiresAt;
			},
		});
		issuePasswordResetToken("a@b.com", actor, deps);
		expect(captured).toBe(new Date(now + 3_600_000).toISOString());
	});

	test("requestedBy is null when actor is undefined and user exists", () => {
		let captured: string | null | undefined;
		const deps = makeDeps({
			findPasswordResetUserByEmail: () => ({
				id: 1,
				email: "a@b.com",
				role: "admin",
				name: "A",
			}),
			insertPasswordResetToken: (input) => {
				captured = input.requestedBy;
			},
		});
		issuePasswordResetToken("a@b.com", undefined, deps);
		expect(captured).toBeNull();
	});

	test("records audit with exact action/summary/targetId when actor present", () => {
		const auditSpy = vi.fn();
		const deps = makeDeps({
			findPasswordResetUserByEmail: () => ({
				id: 1,
				email: "a@b.com",
				role: "admin",
				name: "A",
			}),
			recordAuthAudit: auditSpy,
		});
		issuePasswordResetToken("a@b.com", actor, deps);
		expect(auditSpy).toHaveBeenCalledWith({
			actor,
			action: "auth.password_reset_issue",
			summary: "Issued a password reset link for a@b.com.",
			targetId: "a@b.com",
		});
	});

	test("does NOT record audit when actor absent (silent self-service flow)", () => {
		const auditSpy = vi.fn();
		const deps = makeDeps({
			findPasswordResetUserByEmail: () => ({
				id: 1,
				email: "a@b.com",
				role: "admin",
				name: "A",
			}),
			recordAuthAudit: auditSpy,
		});
		issuePasswordResetToken("a@b.com", undefined, deps);
		expect(auditSpy).not.toHaveBeenCalled();
	});
});
