import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createAstropressCloudflareAdapter } from "../src/adapters/cloudflare.js";
import {
	cleanupExpiredCloudflareSessions,
	resolveCloudflareSessionSecret,
	resolveCloudflareSessionSecretCandidates,
} from "../src/adapters/cloudflare-auth.js";
import { createSessionTokenDigest, hashPassword } from "../src/crypto-utils.js";
import { makeDb } from "./helpers/make-db.js";
import { SqliteBackedD1Database } from "./helpers/provider-test-fixtures.js";

describe("cloudflare adapter security defaults", () => {
	it("does not allow insecure fallback sign-in unless explicitly enabled", async () => {
		const adapter = createAstropressCloudflareAdapter({
			users: [
				{
					id: "admin-1",
					email: "admin@example.com",
					isAdmin: true,
					password: "password",
				},
			],
		});

		await expect(adapter.auth.signIn("admin@example.com", "password")).resolves.toBeNull();
	});

	it("supports explicit insecure fallback auth only for test-style callers", async () => {
		const adapter = createAstropressCloudflareAdapter({
			allowInsecureFallbackAuth: true,
			users: [
				{
					id: "admin-1",
					email: "admin@example.com",
					isAdmin: true,
					password: "password",
				},
			],
		});

		await expect(adapter.auth.signIn("admin@example.com", "password")).resolves.toMatchObject({
			email: "admin@example.com",
			isAdmin: true,
		});
	});
});

describe("cloudflare session secret", () => {
	beforeEach(() => {
		vi.spyOn(console, "warn").mockImplementation(() => {});
		delete process.env.CLOUDFLARE_SESSION_SECRET;
	});

	afterEach(() => {
		vi.restoreAllMocks();
		delete process.env.CLOUDFLARE_SESSION_SECRET;
	});

	it("emits console.warn when using the default hardcoded secret", async () => {
		const db = makeDb();
		db.prepare(
			"INSERT INTO admin_users (email, password_hash, name, active, is_admin) VALUES (?1, ?3, 'Admin', 1, CASE WHEN ?2='admin' THEN 1 ELSE 0 END)",
		).run("admin@example.com", "admin", await hashPassword("correctpass"));
		const d1 = new SqliteBackedD1Database(db);
		const adapter = createAstropressCloudflareAdapter({ db: d1 });
		await adapter.auth.signIn("admin@example.com", "correctpass");
		expect(console.warn).toHaveBeenCalledWith(
			expect.any(String),
			expect.stringContaining("CLOUDFLARE_SESSION_SECRET is using the insecure default"),
		);
		db.close();
	});

	it("suppresses console.warn when CLOUDFLARE_SESSION_SECRET is set to a custom value", async () => {
		process.env.CLOUDFLARE_SESSION_SECRET = "my-long-random-secret-value";
		const db = makeDb();
		db.prepare(
			"INSERT INTO admin_users (email, password_hash, name, active, is_admin) VALUES (?1, ?3, 'Admin', 1, CASE WHEN ?2='admin' THEN 1 ELSE 0 END)",
		).run("admin@example.com", "admin", await hashPassword("correctpass"));
		const d1 = new SqliteBackedD1Database(db);
		const adapter = createAstropressCloudflareAdapter({ db: d1 });
		await adapter.auth.signIn("admin@example.com", "correctpass");
		expect(console.warn).not.toHaveBeenCalled();
		db.close();
	});

	it("session sign-in/lookup round-trips correctly with a custom secret", async () => {
		process.env.CLOUDFLARE_SESSION_SECRET = "custom-test-secret-xyz";

		const db = makeDb();
		db.prepare(
			"INSERT INTO admin_users (email, password_hash, name, active, is_admin) VALUES (?1, ?3, 'Admin', 1, CASE WHEN ?2='admin' THEN 1 ELSE 0 END)",
		).run("admin@example.com", "admin", await hashPassword("correctpass"));

		const d1 = new SqliteBackedD1Database(db);
		const adapter = createAstropressCloudflareAdapter({ db: d1 });

		const session = await adapter.auth.signIn("admin@example.com", "correctpass");
		expect(session).not.toBeNull();
		expect(session?.email).toBe("admin@example.com");

		const looked = await adapter.auth.getSession(session?.id);
		expect(looked).toMatchObject({ email: "admin@example.com" });

		await adapter.auth.signOut(session?.id);
		expect(await adapter.auth.getSession(session?.id)).toBeNull();

		db.close();
	});

	it("keeps sessions valid when CLOUDFLARE_SESSION_SECRET_PREV is present during rotation", async () => {
		process.env.CLOUDFLARE_SESSION_SECRET = "old-cloudflare-secret";

		const db = makeDb();
		db.prepare(
			"INSERT INTO admin_users (email, password_hash, name, active, is_admin) VALUES (?1, ?3, 'Admin', 1, CASE WHEN ?2='admin' THEN 1 ELSE 0 END)",
		).run("admin@example.com", "admin", await hashPassword("correctpass"));

		const d1 = new SqliteBackedD1Database(db);
		const adapter = createAstropressCloudflareAdapter({ db: d1 });

		const session = await adapter.auth.signIn("admin@example.com", "correctpass");
		expect(session).not.toBeNull();

		process.env.CLOUDFLARE_SESSION_SECRET = "new-cloudflare-secret";
		process.env.CLOUDFLARE_SESSION_SECRET_PREV = "old-cloudflare-secret";

		await expect(adapter.auth.getSession(session?.id)).resolves.toMatchObject({
			email: "admin@example.com",
			isAdmin: true,
		});

		await adapter.auth.signOut(session?.id);
		expect(await adapter.auth.getSession(session?.id)).toBeNull();

		db.close();
	});

	it("throws in production runtime when CLOUDFLARE_SESSION_SECRET is the insecure default (pins L39 ConditionalExpression)", () => {
		const origProd = process.env.PROD;
		process.env.PROD = "true";
		delete process.env.CLOUDFLARE_SESSION_SECRET;
		try {
			expect(() => resolveCloudflareSessionSecret()).toThrow(
				/CLOUDFLARE_SESSION_SECRET must be set/,
			);
			// Pin L42 StringLiteral — also assert the "random string of 32+" tail.
			expect(() => resolveCloudflareSessionSecret()).toThrow(/random string of 32\+ characters/);
		} finally {
			if (origProd === undefined) delete process.env.PROD;
			else process.env.PROD = origProd;
		}
	});

	it("warns with the 'long random string' guidance line (pins L47 StringLiteral)", () => {
		delete process.env.CLOUDFLARE_SESSION_SECRET;
		resolveCloudflareSessionSecret();
		expect(console.warn).toHaveBeenCalledWith(
			expect.any(String),
			expect.stringContaining("long random string"),
		);
	});

	it("getConfiguredSecrets trims and deduplicates env values (pins L23 .trim() + L24 dedup/empty guards)", () => {
		// Use the exported wrapper resolveCloudflareSessionSecretCandidates to
		// exercise getConfiguredSecrets indirectly.
		process.env.CLOUDFLARE_SESSION_SECRET = "  same-secret  ";
		process.env.CLOUDFLARE_SESSION_SECRET_PREV = "same-secret";
		const candidates = resolveCloudflareSessionSecretCandidates();
		// L23 mutates `.trim()` away → "  same-secret  " stays padded and the
		// dedup check `seen.has(...)` returns false → 2 entries.
		// L24 mutates the `||` / continue → empty/duplicate entries push through.
		expect(candidates).toEqual(["same-secret"]);
		delete process.env.CLOUDFLARE_SESSION_SECRET;
		delete process.env.CLOUDFLARE_SESSION_SECRET_PREV;
	});

	it("cleanupExpiredCloudflareSessions revokes sessions older than 12h (pins L60 BlockStatement)", async () => {
		const db = makeDb();
		db.prepare(
			"INSERT INTO admin_users (email, password_hash, name, active, is_admin) VALUES (?, ?, 'Admin', 1, 1)",
		).run("admin@example.com", await hashPassword("p"));
		const userId = (
			db.prepare("SELECT id FROM admin_users WHERE email = 'admin@example.com'").get() as {
				id: number;
			}
		).id;
		// Insert a session with last_active_at >12h ago.
		db.prepare(
			"INSERT INTO admin_sessions (id, user_id, csrf_token, last_active_at) VALUES (?, ?, ?, datetime('now', '-13 hours'))",
		).run("stale-session", userId, "csrf");
		const d1 = new SqliteBackedD1Database(db);
		await cleanupExpiredCloudflareSessions(d1);
		const row = db
			.prepare("SELECT revoked_at FROM admin_sessions WHERE id = 'stale-session'")
			.get() as { revoked_at: string | null };
		// Mutant emptying the function body skips the UPDATE → revoked_at stays null.
		expect(row.revoked_at).not.toBeNull();
		db.close();
	});

	it("D1 getSession returns isAdmin reflecting the column, not always-true (pins L230 ConditionalExpression)", async () => {
		process.env.CLOUDFLARE_SESSION_SECRET = "test-secret-for-getsession-isadmin";
		const db = makeDb();
		db.prepare(
			"INSERT INTO admin_users (email, password_hash, name, active, is_admin) VALUES (?, ?, 'Editor', 1, 0)",
		).run("editor@example.com", await hashPassword("ed-pw"));
		const adapter = createAstropressCloudflareAdapter({
			db: new SqliteBackedD1Database(db),
		});
		const session = await adapter.auth.signIn("editor@example.com", "ed-pw");
		expect(session).not.toBeNull();
		const looked = await adapter.auth.getSession(session?.id ?? "");
		expect(looked?.isAdmin).toBe(false);
		db.close();
	});

	it("D1 signIn returns isAdmin reflecting the column, not always-true (pins L210 ConditionalExpression)", async () => {
		process.env.CLOUDFLARE_SESSION_SECRET = "test-secret-for-isadmin";
		const db = makeDb();
		db.prepare(
			"INSERT INTO admin_users (email, password_hash, name, active, is_admin) VALUES (?, ?, 'Editor', 1, 0)",
		).run("editor@example.com", await hashPassword("editor-pw"));
		const adapter = createAstropressCloudflareAdapter({
			db: new SqliteBackedD1Database(db),
		});
		const session = await adapter.auth.signIn("editor@example.com", "editor-pw");
		expect(session?.isAdmin).toBe(false);
		db.close();
	});

	it("D1 signIn trims email before lookup (pins L177 MethodExpression .trim())", async () => {
		process.env.CLOUDFLARE_SESSION_SECRET = "test-secret-for-trim";
		const db = makeDb();
		db.prepare(
			"INSERT INTO admin_users (email, password_hash, name, active, is_admin) VALUES (?, ?, 'Admin', 1, 1)",
		).run("admin@example.com", await hashPassword("pwd"));
		const adapter = createAstropressCloudflareAdapter({
			db: new SqliteBackedD1Database(db),
		});
		// Leading/trailing whitespace must be stripped before the SELECT.
		const session = await adapter.auth.signIn("  admin@example.com  ", "pwd");
		expect(session).not.toBeNull();
		expect(session?.email).toBe("admin@example.com");
		db.close();
	});

	it("D1 signIn records user_agent = 'astropress-cloudflare-adapter' (pins L204 StringLiteral)", async () => {
		process.env.CLOUDFLARE_SESSION_SECRET = "test-secret-for-ua";
		const db = makeDb();
		db.prepare(
			"INSERT INTO admin_users (email, password_hash, name, active, is_admin) VALUES (?, ?, 'Admin', 1, 1)",
		).run("admin@example.com", await hashPassword("pwd"));
		const adapter = createAstropressCloudflareAdapter({
			db: new SqliteBackedD1Database(db),
		});
		await adapter.auth.signIn("admin@example.com", "pwd");
		const row = db.prepare("SELECT user_agent FROM admin_sessions LIMIT 1").get() as {
			user_agent: string;
		};
		expect(row.user_agent).toBe("astropress-cloudflare-adapter");
		db.close();
	});

	it("fallback signIn trims email and returns a non-empty sessionId (pins L138 .trim() + L140 sessionId template)", async () => {
		const adapter = createAstropressCloudflareAdapter({
			allowInsecureFallbackAuth: true,
			users: [
				{
					id: "u-1",
					email: "admin@example.com",
					isAdmin: true,
					password: "pw",
				},
			],
		});
		const session = await adapter.auth.signIn("  admin@example.com  ", "pw");
		expect(session).not.toBeNull();
		// L138 .trim() — wrong-case-only would also map, but trim makes the
		// "  admin@example.com  " variant resolve to the seed user.
		expect(session?.email).toBe("admin@example.com");
		// L140 mutates the template literal to ''; original must produce a
		// non-empty session id that the same store can roundtrip.
		expect(session?.id).toBeTruthy();
		expect(String(session?.id).length).toBeGreaterThan(0);
		const lookedUp = await adapter.auth.getSession(session?.id ?? "");
		expect(lookedUp).not.toBeNull();
	});

	it("signs rotated Cloudflare sessions with the current secret, not the previous one", async () => {
		process.env.CLOUDFLARE_SESSION_SECRET = "new-cloudflare-secret";
		process.env.CLOUDFLARE_SESSION_SECRET_PREV = "old-cloudflare-secret";

		const db = makeDb();
		db.prepare(
			"INSERT INTO admin_users (email, password_hash, name, active, is_admin) VALUES (?1, ?3, 'Admin', 1, CASE WHEN ?2='admin' THEN 1 ELSE 0 END)",
		).run("admin@example.com", "admin", await hashPassword("correctpass"));

		const d1 = new SqliteBackedD1Database(db);
		const adapter = createAstropressCloudflareAdapter({ db: d1 });

		const session = await adapter.auth.signIn("admin@example.com", "correctpass");
		expect(session).not.toBeNull();

		const stored = db.prepare("SELECT id FROM admin_sessions LIMIT 1").get() as { id: string };
		expect(stored.id).toBe(await createSessionTokenDigest(session?.id, "new-cloudflare-secret"));
		expect(stored.id).not.toBe(
			await createSessionTokenDigest(session?.id, "old-cloudflare-secret"),
		);

		db.close();
	});
});
