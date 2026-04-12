import { DatabaseSync } from "node:sqlite";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createAstropressCloudflareAdapter } from "../src/adapters/cloudflare.js";
import { SqliteBackedD1Database } from "./helpers/provider-test-fixtures.js";
import { readAstropressSqliteSchemaSql } from "../src/sqlite-bootstrap.js";
import { hashPassword } from "../src/crypto-utils.js";

describe("cloudflare adapter security defaults", () => {
  it("does not allow insecure fallback sign-in unless explicitly enabled", async () => {
    const adapter = createAstropressCloudflareAdapter({
      users: [{ id: "admin-1", email: "admin@example.com", role: "admin", password: "password" }],
    });

    await expect(adapter.auth.signIn("admin@example.com", "password")).resolves.toBeNull();
  });

  it("supports explicit insecure fallback auth only for test-style callers", async () => {
    const adapter = createAstropressCloudflareAdapter({
      allowInsecureFallbackAuth: true,
      users: [{ id: "admin-1", email: "admin@example.com", role: "admin", password: "password" }],
    });

    await expect(adapter.auth.signIn("admin@example.com", "password")).resolves.toMatchObject({
      email: "admin@example.com",
      role: "admin",
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
    const db = new DatabaseSync(":memory:");
    db.exec(readAstropressSqliteSchemaSql());
    db.prepare("INSERT INTO admin_users (email, role, password_hash, name, active) VALUES (?, ?, ?, 'Admin', 1)").run(
      "admin@example.com",
      "admin",
      await hashPassword("correctpass"),
    );
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
    const db = new DatabaseSync(":memory:");
    db.exec(readAstropressSqliteSchemaSql());
    db.prepare("INSERT INTO admin_users (email, role, password_hash, name, active) VALUES (?, ?, ?, 'Admin', 1)").run(
      "admin@example.com",
      "admin",
      await hashPassword("correctpass"),
    );
    const d1 = new SqliteBackedD1Database(db);
    const adapter = createAstropressCloudflareAdapter({ db: d1 });
    await adapter.auth.signIn("admin@example.com", "correctpass");
    expect(console.warn).not.toHaveBeenCalled();
    db.close();
  });

  it("session sign-in/lookup round-trips correctly with a custom secret", async () => {
    process.env.CLOUDFLARE_SESSION_SECRET = "custom-test-secret-xyz";

    const db = new DatabaseSync(":memory:");
    db.exec(readAstropressSqliteSchemaSql());
    db.prepare("INSERT INTO admin_users (email, role, password_hash, name, active) VALUES (?, ?, ?, 'Admin', 1)").run(
      "admin@example.com",
      "admin",
      await hashPassword("correctpass"),
    );

    const d1 = new SqliteBackedD1Database(db);
    const adapter = createAstropressCloudflareAdapter({ db: d1 });

    const session = await adapter.auth.signIn("admin@example.com", "correctpass");
    expect(session).not.toBeNull();
    expect(session?.email).toBe("admin@example.com");

    const looked = await adapter.auth.getSession(session!.id);
    expect(looked).toMatchObject({ email: "admin@example.com" });

    await adapter.auth.signOut(session!.id);
    expect(await adapter.auth.getSession(session!.id)).toBeNull();

    db.close();
  });
});
