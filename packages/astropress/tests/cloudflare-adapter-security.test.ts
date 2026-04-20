import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createAstropressCloudflareAdapter } from "../src/adapters/cloudflare.js";
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
					role: "admin",
					password: "password",
				},
			],
		});

		await expect(
			adapter.auth.signIn("admin@example.com", "password"),
		).resolves.toBeNull();
	});

	it("supports explicit insecure fallback auth only for test-style callers", async () => {
		const adapter = createAstropressCloudflareAdapter({
			allowInsecureFallbackAuth: true,
			users: [
				{
					id: "admin-1",
					email: "admin@example.com",
					role: "admin",
					password: "password",
				},
			],
		});

		await expect(
			adapter.auth.signIn("admin@example.com", "password"),
		).resolves.toMatchObject({
			email: "admin@example.com",
			role: "admin",
		});
	});
});

describe("cloudflare session secret", () => {
	beforeEach(() => {
		vi.spyOn(console, "warn").mockImplementation(() => {});
		// biome-ignore lint/performance/noDelete: = undefined sets the string "undefined", not actual unset
		delete process.env.CLOUDFLARE_SESSION_SECRET;
	});

	afterEach(() => {
		vi.restoreAllMocks();
		// biome-ignore lint/performance/noDelete: = undefined sets the string "undefined", not actual unset
		delete process.env.CLOUDFLARE_SESSION_SECRET;
	});

	it("emits console.warn when using the default hardcoded secret", async () => {
		const db = makeDb();
		db.prepare(
			"INSERT INTO admin_users (email, role, password_hash, name, active) VALUES (?, ?, ?, 'Admin', 1)",
		).run("admin@example.com", "admin", await hashPassword("correctpass"));
		const d1 = new SqliteBackedD1Database(db);
		const adapter = createAstropressCloudflareAdapter({ db: d1 });
		await adapter.auth.signIn("admin@example.com", "correctpass");
		expect(console.warn).toHaveBeenCalledWith(
			expect.any(String),
			expect.stringContaining(
				"CLOUDFLARE_SESSION_SECRET is using the insecure default",
			),
		);
		db.close();
	});

	it("suppresses console.warn when CLOUDFLARE_SESSION_SECRET is set to a custom value", async () => {
		process.env.CLOUDFLARE_SESSION_SECRET = "my-long-random-secret-value";
		const db = makeDb();
		db.prepare(
			"INSERT INTO admin_users (email, role, password_hash, name, active) VALUES (?, ?, ?, 'Admin', 1)",
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
			"INSERT INTO admin_users (email, role, password_hash, name, active) VALUES (?, ?, ?, 'Admin', 1)",
		).run("admin@example.com", "admin", await hashPassword("correctpass"));

		const d1 = new SqliteBackedD1Database(db);
		const adapter = createAstropressCloudflareAdapter({ db: d1 });

		const session = await adapter.auth.signIn(
			"admin@example.com",
			"correctpass",
		);
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
			"INSERT INTO admin_users (email, role, password_hash, name, active) VALUES (?, ?, ?, 'Admin', 1)",
		).run("admin@example.com", "admin", await hashPassword("correctpass"));

		const d1 = new SqliteBackedD1Database(db);
		const adapter = createAstropressCloudflareAdapter({ db: d1 });

		const session = await adapter.auth.signIn(
			"admin@example.com",
			"correctpass",
		);
		expect(session).not.toBeNull();

		process.env.CLOUDFLARE_SESSION_SECRET = "new-cloudflare-secret";
		process.env.CLOUDFLARE_SESSION_SECRET_PREV = "old-cloudflare-secret";

		await expect(adapter.auth.getSession(session?.id)).resolves.toMatchObject({
			email: "admin@example.com",
			role: "admin",
		});

		await adapter.auth.signOut(session?.id);
		expect(await adapter.auth.getSession(session?.id)).toBeNull();

		db.close();
	});

	it("signs rotated Cloudflare sessions with the current secret, not the previous one", async () => {
		process.env.CLOUDFLARE_SESSION_SECRET = "new-cloudflare-secret";
		process.env.CLOUDFLARE_SESSION_SECRET_PREV = "old-cloudflare-secret";

		const db = makeDb();
		db.prepare(
			"INSERT INTO admin_users (email, role, password_hash, name, active) VALUES (?, ?, ?, 'Admin', 1)",
		).run("admin@example.com", "admin", await hashPassword("correctpass"));

		const d1 = new SqliteBackedD1Database(db);
		const adapter = createAstropressCloudflareAdapter({ db: d1 });

		const session = await adapter.auth.signIn(
			"admin@example.com",
			"correctpass",
		);
		expect(session).not.toBeNull();

		const stored = db
			.prepare("SELECT id FROM admin_sessions LIMIT 1")
			.get() as { id: string };
		expect(stored.id).toBe(
			await createSessionTokenDigest(session?.id, "new-cloudflare-secret"),
		);
		expect(stored.id).not.toBe(
			await createSessionTokenDigest(session?.id, "old-cloudflare-secret"),
		);

		db.close();
	});
});
