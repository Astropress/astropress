import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createKmacDigest } from "../src/crypto-primitives.js";
import {
	hashPassword,
	isLegacyHash,
	verifyPassword,
} from "../src/crypto-utils.js";
import { createAstropressSqliteAdminRuntime } from "../src/sqlite-admin-runtime.js";
import { makeDb } from "./helpers/make-db.js";
import {
	type RuntimeFixture,
	createRuntimeFixture,
	makePasswordHash,
} from "./helpers/sqlite-admin-runtime-fixture.js";

let fixture: RuntimeFixture;

beforeAll(() => {
	fixture = createRuntimeFixture();
});

afterAll(() => {
	fixture.db.close();
});

// ─── Factory option defaults ──────────────────────────────────────────────────

describe("factory option defaults", () => {
	it("creates runtime with default sessionTtlMs, now, and randomId", () => {
		const rt = createAstropressSqliteAdminRuntime({
			getDatabase: () => fixture.db,
		});
		expect(rt.sqliteAdminStore).toBeDefined();
		expect(rt.sqliteCmsRegistryModule).toBeDefined();
		expect(rt.authenticatePersistedAdminUser).toBeInstanceOf(Function);
	});
});

// ─── Auth ─────────────────────────────────────────────────────────────────────

describe("auth", () => {
	it("returns null for empty email", async () => {
		expect(
			await fixture.runtime.authenticatePersistedAdminUser(
				"",
				"correct-password",
			),
		).toBeNull();
	});

	it("returns null for malformed password hash (verifyPasswordSync malformed-hash branch)", async () => {
		expect(
			await fixture.runtime.authenticatePersistedAdminUser(
				"malformed@test.local",
				"any-password",
			),
		).toBeNull();
	});

	it("returns null for wrong password", async () => {
		expect(
			await fixture.runtime.authenticatePersistedAdminUser(
				"admin@test.local",
				"wrong-password",
			),
		).toBeNull();
	});

	it("returns user for correct password", async () => {
		const user = await fixture.runtime.authenticatePersistedAdminUser(
			"admin@test.local",
			"correct-password",
		);
		expect(user?.email).toBe("admin@test.local");
		expect(user?.role).toBe("admin");
	});

	it("getSessionUser returns null for null/empty token", () => {
		expect(
			fixture.store.auth.getSessionUser(null as unknown as string),
		).toBeNull();
		expect(fixture.store.auth.getSessionUser("")).toBeNull();
	});

	it("getCsrfToken returns null for empty token", () => {
		expect(fixture.store.auth.getCsrfToken("")).toBeNull();
	});

	it("session lifecycle: create → get → getCsrfToken → revoke", async () => {
		const user = await fixture.runtime.authenticatePersistedAdminUser(
			"admin@test.local",
			"correct-password",
		);
		const sessionToken = fixture.store.auth.createSession(
			user as NonNullable<typeof user>,
			{ ipAddress: "127.0.0.1" },
		);
		expect(typeof sessionToken).toBe("string");

		const sessionUser = fixture.store.auth.getSessionUser(sessionToken);
		expect(sessionUser?.email).toBe("admin@test.local");

		const csrf = fixture.store.auth.getCsrfToken(sessionToken);
		expect(typeof csrf).toBe("string");

		fixture.store.auth.revokeSession(sessionToken);
		expect(fixture.store.auth.getSessionUser(sessionToken)).toBeNull();
	});

	it("revokeSession with null token is a no-op", () => {
		expect(() =>
			fixture.store.auth.revokeSession(null as unknown as string),
		).not.toThrow();
	});

	it("getSessionUser returns null for expired session (sessionTtlMs branch)", async () => {
		const expiredDb = makeDb();
		expiredDb
			.prepare(
				"INSERT INTO admin_users (email, password_hash, role, name, active) VALUES (?, ?, ?, ?, 1)",
			)
			.run(
				"expired@test.local",
				makePasswordHash("password"),
				"admin",
				"Expired",
			);
		let clockOffset = 0;
		const expiredRuntime = createAstropressSqliteAdminRuntime({
			getDatabase: () => expiredDb,
			sessionTtlMs: 1,
			now: () => Date.now() + clockOffset,
		});
		const user = await expiredRuntime.authenticatePersistedAdminUser(
			"expired@test.local",
			"password",
		);
		const token = expiredRuntime.sqliteAdminStore.auth.createSession(
			user as NonNullable<typeof user>,
			{},
		);
		// Session created under real clock; now advance past the 1ms TTL
		clockOffset = 100_000;
		expect(
			expiredRuntime.sqliteAdminStore.auth.getSessionUser(token),
		).toBeNull();
		expiredDb.close();
	});

	it("createPasswordResetToken: unknown user without actor returns ok:true with null resetUrl", () => {
		const result = fixture.store.auth.createPasswordResetToken(
			"nobody@test.local",
			null,
		);
		expect(result).toMatchObject({ ok: true, resetUrl: null });
	});

	it("createPasswordResetToken: known user returns ok:true with resetUrl", () => {
		const result = fixture.store.auth.createPasswordResetToken(
			"admin@test.local",
			fixture.actor,
		);
		expect(result.ok).toBe(true);
		if (!result.ok) throw new Error("unreachable");
		expect(result.resetUrl).toContain("token=");
	});

	it("createPasswordResetToken: unknown user with actor returns ok:false", () => {
		const result = fixture.store.auth.createPasswordResetToken(
			"nobody@test.local",
			fixture.actor,
		);
		expect(result).toMatchObject({ ok: false });
	});

	it("createPasswordResetToken: empty email returns ok:false", () => {
		expect(
			fixture.store.auth.createPasswordResetToken("", fixture.actor),
		).toMatchObject({ ok: false });
	});

	it("getPasswordResetRequest: empty token returns null", () => {
		expect(fixture.store.auth.getPasswordResetRequest("")).toBeNull();
	});

	it("getPasswordResetRequest: invalid token returns null", () => {
		expect(
			fixture.store.auth.getPasswordResetRequest("invalid-token"),
		).toBeNull();
	});

	it("getInviteRequest: empty token returns null", () => {
		expect(fixture.store.auth.getInviteRequest("")).toBeNull();
	});

	it("getInviteRequest: invalid token returns null", () => {
		expect(fixture.store.auth.getInviteRequest("not-a-real-token")).toBeNull();
	});

	it("consumeInviteToken: short password returns error", () => {
		expect(
			fixture.store.auth.consumeInviteToken("any-token", "short"),
		).toMatchObject({ ok: false });
	});

	it("consumeInviteToken: invalid token returns error", () => {
		expect(
			fixture.store.auth.consumeInviteToken(
				"not-a-real-token",
				"long-enough-password",
			),
		).toMatchObject({ ok: false });
	});

	it("consumePasswordResetToken: short password returns error", () => {
		expect(
			fixture.store.auth.consumePasswordResetToken("any-token", "short"),
		).toMatchObject({ ok: false });
	});

	it("consumePasswordResetToken: invalid token returns error", () => {
		expect(
			fixture.store.auth.consumePasswordResetToken(
				"not-a-real-token",
				"long-enough-password",
			),
		).toMatchObject({ ok: false });
	});

	it("full password reset flow: issue, get request, consume", () => {
		const issued = fixture.store.auth.createPasswordResetToken(
			"admin@test.local",
			fixture.actor,
		);
		expect(issued.ok).toBe(true);
		if (!issued.ok) throw new Error("unreachable");

		const rawToken = decodeURIComponent(issued.resetUrl?.split("token=")[1]);
		const request = fixture.store.auth.getPasswordResetRequest(rawToken);
		expect(request?.email).toBe("admin@test.local");

		const consumed = fixture.store.auth.consumePasswordResetToken(
			rawToken,
			"new-long-password-123",
		);
		expect(consumed.ok).toBe(true);

		expect(fixture.store.auth.getPasswordResetRequest(rawToken)).toBeNull();
	});

	it("full invite flow: create invite, get request, consume", async () => {
		fixture.store.users.inviteAdminUser(
			{ email: "invite-flow@test.local", role: "editor", name: "Invite Flow" },
			fixture.actor,
		);

		const inviteRawToken = "test-invite-raw-token-xyz";
		const tokenHash = createKmacDigest(
			inviteRawToken,
			"astropress-dev-root-secret",
			"sqlite-opaque-token",
		);
		const invitedUserId = (
			fixture.db
				.prepare(
					"SELECT id FROM admin_users WHERE email = 'invite-flow@test.local'",
				)
				.get() as { id: number }
		).id;
		fixture.db
			.prepare(
				"INSERT INTO user_invites (id, user_id, token_hash, expires_at, invited_by) VALUES (?, ?, ?, datetime('now', '+7 days'), ?)",
			)
			.run("invite-flow-1", invitedUserId, tokenHash, "admin@test.local");

		const inviteRequest = fixture.store.auth.getInviteRequest(inviteRawToken);
		expect(inviteRequest?.email).toBe("invite-flow@test.local");

		const consumed = fixture.store.auth.consumeInviteToken(
			inviteRawToken,
			"my-new-secure-password",
		);
		expect(consumed.ok).toBe(true);

		expect(fixture.store.auth.getInviteRequest(inviteRawToken)).toBeNull();
	});

	it("recordSuccessfulLogin records an auth audit event", () => {
		expect(() =>
			fixture.store.auth.recordSuccessfulLogin(fixture.actor),
		).not.toThrow();
	});

	it("recordLogout records an auth audit event", () => {
		expect(() => fixture.store.auth.recordLogout(fixture.actor)).not.toThrow();
	});

	it("getCsrfToken returns null for expired session", async () => {
		const expiredDb = makeDb();
		expiredDb
			.prepare(
				"INSERT INTO admin_users (email, password_hash, role, name, active) VALUES (?, ?, ?, ?, 1)",
			)
			.run(
				"expired2@test.local",
				makePasswordHash("password"),
				"admin",
				"Expired2",
			);
		let clockOffset = 0;
		const expiredRuntime = createAstropressSqliteAdminRuntime({
			getDatabase: () => expiredDb,
			sessionTtlMs: 1,
			now: () => Date.now() + clockOffset,
		});
		const user = await expiredRuntime.authenticatePersistedAdminUser(
			"expired2@test.local",
			"password",
		);
		const token = expiredRuntime.sqliteAdminStore.auth.createSession(
			user as NonNullable<typeof user>,
			{},
		);
		// Session created under real clock; now advance past the 1ms TTL
		clockOffset = 100_000;
		expect(expiredRuntime.sqliteAdminStore.auth.getCsrfToken(token)).toBeNull();
		expiredDb.close();
	});
});

// ─── Auth additional branches ─────────────────────────────────────────────────

describe("auth additional branches", () => {
	it("getCsrfToken returns null for revoked session (getSessionUser !row branch)", () => {
		const token = fixture.store.auth.createSession(
			{ email: "admin@test.local", role: "admin" as const, name: "Test Admin" },
			{},
		);
		fixture.store.auth.revokeSession(token);
		expect(fixture.store.auth.getCsrfToken(token)).toBeNull();
	});

	it("createSession throws for unknown user email", () => {
		expect(() =>
			fixture.store.auth.createSession(
				{
					email: "nobody-at-all@test.local",
					role: "admin" as const,
					name: "Nobody",
				},
				{},
			),
		).toThrow();
	});
});

// ─── Password hashing — Argon2id with explicit legacy cutoff ─────────────────

// Use reduced iterations in tests to keep run time under 5 s while still exercising
// the same code paths. The stored format embeds the iteration count, so verifyPassword
// reads it back and uses the same value — the round-trip is still fully verified.
const TEST_ITERATIONS = 1;

describe("password hashing", () => {
	it("hashPassword produces an Argon2id-prefixed hash", async () => {
		const hash = await hashPassword("my-secret-password", 32, TEST_ITERATIONS);
		expect(hash.startsWith("v3:argon2id$")).toBe(true);
	});

	it("hashPassword encodes the work factor in the stored string", async () => {
		const hash = await hashPassword("password", 32, TEST_ITERATIONS);
		const [, iters] = hash.split("$");
		expect(Number(iters)).toBe(TEST_ITERATIONS);
	});

	it("isLegacyHash returns false for an Argon2id hash", async () => {
		const hash = await hashPassword("password", 32, TEST_ITERATIONS);
		expect(isLegacyHash(hash)).toBe(false);
	});

	it("isLegacyHash returns true for a pre-Argon2 password format", () => {
		const legacyHash = "600000$c2FsdA==$aGFzaA==";
		expect(isLegacyHash(legacyHash)).toBe(true);
	});

	it("verifyPassword returns true for a correct Argon2id password", async () => {
		const hash = await hashPassword("correct-password", 32, TEST_ITERATIONS);
		expect(await verifyPassword("correct-password", hash)).toBe(true);
	});

	it("verifyPassword returns false for a wrong Argon2id password", async () => {
		const hash = await hashPassword("correct-password", 32, TEST_ITERATIONS);
		expect(await verifyPassword("wrong-password", hash)).toBe(false);
	});

	it("verifyPassword returns false for a legacy pre-Argon2 password", async () => {
		const legacyHash = "600000$c2FsdA==$aGFzaA==";
		expect(await verifyPassword("wrong-password", legacyHash)).toBe(false);
	});

	it("verifyPassword returns false for a malformed hash string", async () => {
		expect(await verifyPassword("any-password", "not-a-valid-hash")).toBe(
			false,
		);
	});
});
