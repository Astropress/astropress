// @ts-nocheck
// 
import { afterEach, describe, expect, it, vi } from "vitest";

import { createSessionTokenDigest, hashPassword } from "../src/crypto-utils.js";
import {
  authenticateRuntimeAdminUser,
  createRuntimeSession,
  getRuntimeCsrfToken,
  getRuntimeSessionUser,
  recordRuntimeSuccessfulLogin,
  recordRuntimeLogout,
  revokeRuntimeSession,
  SESSION_TTL_MS,
} from "../src/runtime-admin-auth.js";
import { SqliteBackedD1Database } from "./helpers/provider-test-fixtures.js";
import { makeDb } from "./helpers/make-db.js";

function makeLocals() {
  const db = makeDb();
  const d1 = new SqliteBackedD1Database(db);
  const locals = {
    runtime: {
      env: {
        DB: d1,
      },
    },
  } as App.Locals;

  return { db, locals };
}

describe("runtime admin auth secret rotation", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("signs newly created sessions with the current SESSION_SECRET only", async () => {
    vi.stubEnv("SESSION_SECRET", "current-session-secret");
    vi.stubEnv("SESSION_SECRET_PREV", "previous-session-secret");

    const { db, locals } = makeLocals();
    db.prepare(
      "INSERT INTO admin_users (email, role, password_hash, name, active) VALUES (?, ?, ?, ?, 1)",
    ).run("admin@example.com", "admin", await hashPassword("correctpass"), "Admin User");

    const sessionToken = await createRuntimeSession(
      { email: "admin@example.com", role: "admin", name: "Admin User" },
      undefined,
      locals,
    );

    const stored = db.prepare("SELECT id FROM admin_sessions LIMIT 1").get() as { id: string };
    expect(stored.id).toBe(await createSessionTokenDigest(sessionToken, "current-session-secret"));
    expect(stored.id).not.toBe(await createSessionTokenDigest(sessionToken, "previous-session-secret"));

    db.close();
  });

  it("accepts and revokes sessions signed with SESSION_SECRET_PREV during rotation", async () => {
    vi.stubEnv("SESSION_SECRET", "current-session-secret");
    vi.stubEnv("SESSION_SECRET_PREV", "previous-session-secret");

    const { db, locals } = makeLocals();
    db.prepare(
      "INSERT INTO admin_users (id, email, role, password_hash, name, active) VALUES (?, ?, ?, ?, ?, 1)",
    ).run(1, "admin@example.com", "admin", await hashPassword("correctpass"), "Admin User");

    const legacySessionToken = "legacy-session-token";
    const legacyDigest = await createSessionTokenDigest(legacySessionToken, "previous-session-secret");
    db.prepare(
      "INSERT INTO admin_sessions (id, user_id, csrf_token, ip_address, user_agent) VALUES (?, ?, ?, ?, ?)",
    ).run(legacyDigest, 1, "csrf-token", null, "vitest");

    await expect(getRuntimeSessionUser(legacySessionToken, locals)).resolves.toMatchObject({
      email: "admin@example.com",
      role: "admin",
    });

    await revokeRuntimeSession(legacySessionToken, locals);

    const revoked = db.prepare("SELECT revoked_at FROM admin_sessions WHERE id = ?").get(legacyDigest) as { revoked_at: string | null };
    expect(revoked.revoked_at).not.toBeNull();

    db.close();
  });
});

describe("authenticateRuntimeAdminUser", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  async function seedUser(db: ReturnType<typeof makeDb>, opts: { active?: number } = {}) {
    db.prepare(
      "INSERT INTO admin_users (id, email, role, password_hash, name, active) VALUES (?, ?, ?, ?, ?, ?)",
    ).run(1, "admin@example.com", "admin", await hashPassword("correctpass"), "Admin User", opts.active ?? 1);
  }

  it("returns SessionUser for correct credentials", async () => {
    const { db, locals } = makeLocals();
    await seedUser(db);
    const result = await authenticateRuntimeAdminUser("admin@example.com", "correctpass", locals);
    expect(result).toMatchObject({ email: "admin@example.com", role: "admin", name: "Admin User" });
    db.close();
  });

  it("normalizes email — case-insensitive lookup", async () => {
    const { db, locals } = makeLocals();
    await seedUser(db);
    const result = await authenticateRuntimeAdminUser("  ADMIN@EXAMPLE.COM  ", "correctpass", locals);
    expect(result).not.toBeNull();
    expect(result?.email).toBe("admin@example.com");
    db.close();
  });

  it("returns null for wrong password", async () => {
    const { db, locals } = makeLocals();
    await seedUser(db);
    const result = await authenticateRuntimeAdminUser("admin@example.com", "wrongpass", locals);
    expect(result).toBeNull();
    db.close();
  });

  it("returns null for unknown user", async () => {
    const { db, locals } = makeLocals();
    const result = await authenticateRuntimeAdminUser("unknown@example.com", "somepass", locals);
    expect(result).toBeNull();
    db.close();
  });

  it("returns null when email is empty — kills guard mutation via seeded empty-email user", async () => {
    const { db, locals } = makeLocals();
    // Seed user with empty email so that if the !normalizedEmail guard is removed,
    // the DB lookup would find this user and return a non-null result.
    db.prepare(
      "INSERT INTO admin_users (id, email, role, password_hash, name, active) VALUES (?, ?, ?, ?, ?, 1)",
    ).run(99, "", "editor", await hashPassword("secret"), "Empty Email User");
    const result = await authenticateRuntimeAdminUser("", "secret", locals);
    expect(result).toBeNull();
    db.close();
  });

  it("returns null when password is empty — kills guard mutation via seeded empty-password user", async () => {
    const { db, locals } = makeLocals();
    // Seed user whose password hash is for "" so that if the !password guard is removed,
    // verifyPassword("", hash) returns true and a non-null result escapes.
    db.prepare(
      "INSERT INTO admin_users (id, email, role, password_hash, name, active) VALUES (?, ?, ?, ?, ?, 1)",
    ).run(2, "emptypass@example.com", "editor", await hashPassword(""), "Empty Pass User");
    const result = await authenticateRuntimeAdminUser("emptypass@example.com", "", locals);
    expect(result).toBeNull();
    db.close();
  });

  it("returns null for inactive user (active=0)", async () => {
    const { db, locals } = makeLocals();
    await seedUser(db, { active: 0 });
    const result = await authenticateRuntimeAdminUser("admin@example.com", "correctpass", locals);
    expect(result).toBeNull();
    db.close();
  });
});

describe("getRuntimeCsrfToken", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("returns the csrf_token for a valid session", async () => {
    const { db, locals } = makeLocals();
    db.prepare(
      "INSERT INTO admin_users (id, email, role, password_hash, name, active) VALUES (?, ?, ?, ?, ?, 1)",
    ).run(1, "admin@example.com", "admin", await hashPassword("pass"), "Admin");
    db.prepare(
      "INSERT INTO admin_sessions (id, user_id, csrf_token, ip_address, user_agent) VALUES (?, ?, ?, ?, ?)",
    ).run("test-session-id", 1, "expected-csrf-token", null, "vitest");

    const token = await getRuntimeCsrfToken("test-session-id", locals);
    expect(token).toBe("expected-csrf-token");
    db.close();
  });

  it("returns null for a non-existent session token", async () => {
    const { db, locals } = makeLocals();
    const token = await getRuntimeCsrfToken("does-not-exist", locals);
    expect(token).toBeNull();
    db.close();
  });

  it("returns null for null sessionToken", async () => {
    const { db, locals } = makeLocals();
    const token = await getRuntimeCsrfToken(null, locals);
    expect(token).toBeNull();
    db.close();
  });

  it("returns null for undefined sessionToken", async () => {
    const { db, locals } = makeLocals();
    const token = await getRuntimeCsrfToken(undefined, locals);
    expect(token).toBeNull();
    db.close();
  });
});

describe("createRuntimeSession session storage", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("stores a digest of the session token, not the raw UUID", async () => {
    vi.stubEnv("SESSION_SECRET", "my-test-secret");

    const { db, locals } = makeLocals();
    db.prepare(
      "INSERT INTO admin_users (id, email, role, password_hash, name, active) VALUES (?, ?, ?, ?, ?, 1)",
    ).run(1, "admin@example.com", "admin", await hashPassword("pass"), "Admin");

    const sessionToken = await createRuntimeSession(
      { email: "admin@example.com", role: "admin", name: "Admin" },
      { ipAddress: "127.0.0.1", userAgent: "vitest" },
      locals,
    );

    const stored = db.prepare("SELECT id FROM admin_sessions LIMIT 1").get() as { id: string };
    // Stored ID must be the HMAC digest, not the raw UUID
    expect(stored.id).not.toBe(sessionToken);
    expect(stored.id).toBe(await createSessionTokenDigest(sessionToken, "my-test-secret"));
    db.close();
  });

  it("stores ip_address and user_agent metadata in the session row", async () => {
    const { db, locals } = makeLocals();
    db.prepare(
      "INSERT INTO admin_users (id, email, role, password_hash, name, active) VALUES (?, ?, ?, ?, ?, 1)",
    ).run(1, "admin@example.com", "admin", await hashPassword("pass"), "Admin");

    await createRuntimeSession(
      { email: "admin@example.com", role: "admin", name: "Admin" },
      { ipAddress: "10.0.0.1", userAgent: "test-agent/1.0" },
      locals,
    );

    const row = db.prepare("SELECT ip_address, user_agent FROM admin_sessions LIMIT 1").get() as { ip_address: string; user_agent: string };
    expect(row.ip_address).toBe("10.0.0.1");
    expect(row.user_agent).toBe("test-agent/1.0");
    db.close();
  });
});

describe("session TTL expiry", () => {
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllEnvs();
  });

  it("revokes and returns null for session with non-parseable last_active_at", async () => {
    const { db, locals } = makeLocals();
    db.prepare(
      "INSERT INTO admin_users (id, email, role, password_hash, name, active) VALUES (?, ?, ?, ?, ?, 1)",
    ).run(1, "admin@example.com", "admin", await hashPassword("pass"), "Admin");
    // 'zzzinvalid' sorts after any valid ISO date, so cleanupExpiredSessions won't revoke it
    db.prepare(
      "INSERT INTO admin_sessions (id, user_id, csrf_token, last_active_at, ip_address, user_agent) VALUES (?, ?, ?, ?, ?, ?)",
    ).run("session-bad-ts", 1, "csrf", "zzzinvalid", null, "vitest");

    const result = await getRuntimeSessionUser("session-bad-ts", locals);
    expect(result).toBeNull();

    const row = db.prepare("SELECT revoked_at FROM admin_sessions WHERE id = ?").get("session-bad-ts") as { revoked_at: string | null };
    expect(row.revoked_at).not.toBeNull();
    db.close();
  });

  it("revokes and returns null for session past TTL via faked clock", async () => {
    vi.useFakeTimers();
    const realNow = Date.now();
    vi.setSystemTime(realNow);

    const { db, locals } = makeLocals();
    db.prepare(
      "INSERT INTO admin_users (id, email, role, password_hash, name, active) VALUES (?, ?, ?, ?, ?, 1)",
    ).run(1, "admin@example.com", "admin", await hashPassword("pass"), "Admin");
    db.prepare(
      "INSERT INTO admin_sessions (id, user_id, csrf_token, ip_address, user_agent) VALUES (?, ?, ?, ?, ?)",
    ).run("session-ttl-test", 1, "csrf", null, "vitest");

    // Advance fake clock by 13 hours — SQLite datetime('now') stays at real time,
    // so cleanupExpiredSessions won't touch it, but Date.now() > TTL check fires
    vi.setSystemTime(realNow + 13 * 60 * 60 * 1000);

    const result = await getRuntimeSessionUser("session-ttl-test", locals);
    expect(result).toBeNull();

    const row = db.prepare("SELECT revoked_at FROM admin_sessions WHERE id = ?").get("session-ttl-test") as { revoked_at: string | null };
    expect(row.revoked_at).not.toBeNull();
    db.close();
  });
});

describe("session last_active_at refresh on access", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("updates last_active_at when getRuntimeSessionUser is called with a valid session", async () => {
    vi.stubEnv("SESSION_SECRET", "refresh-test-secret");

    const { db, locals } = makeLocals();
    db.prepare(
      "INSERT INTO admin_users (id, email, role, password_hash, name, active) VALUES (?, ?, ?, ?, ?, 1)",
    ).run(1, "admin@example.com", "admin", await hashPassword("pass"), "Admin");

    const sessionToken = await createRuntimeSession(
      { email: "admin@example.com", role: "admin", name: "Admin" },
      undefined,
      locals,
    );

    // Back-date the session 1 hour (safely within 12h cleanup window)
    db.prepare("UPDATE admin_sessions SET last_active_at = datetime('now', '-1 hour')").run();
    const before = (db.prepare("SELECT last_active_at FROM admin_sessions LIMIT 1").get() as { last_active_at: string }).last_active_at;

    await getRuntimeSessionUser(sessionToken, locals);

    const row = db.prepare("SELECT last_active_at FROM admin_sessions LIMIT 1").get() as { last_active_at: string };
    // The UPDATE should have refreshed it past the backdated -1 hour value
    expect(Date.parse(row.last_active_at)).toBeGreaterThan(Date.parse(before));
    db.close();
  });
});

describe("audit event recording", () => {
  it("recordRuntimeSuccessfulLogin inserts an auth.login audit row", async () => {
    const { db, locals } = makeLocals();
    const actor = { email: "admin@example.com", role: "admin" as const, name: "Admin" };

    await recordRuntimeSuccessfulLogin(actor, locals);

    const row = db.prepare(
      "SELECT action, user_email FROM audit_events WHERE action = 'auth.login' LIMIT 1",
    ).get() as { action: string; user_email: string } | undefined;

    expect(row).not.toBeUndefined();
    expect(row?.action).toBe("auth.login");
    expect(row?.user_email).toBe("admin@example.com");
    db.close();
  });

  it("recordRuntimeLogout inserts an auth.logout audit row", async () => {
    const { db, locals } = makeLocals();
    const actor = { email: "admin@example.com", role: "admin" as const, name: "Admin" };

    await recordRuntimeLogout(actor, locals);

    const row = db.prepare(
      "SELECT action, user_email FROM audit_events WHERE action = 'auth.logout' LIMIT 1",
    ).get() as { action: string; user_email: string } | undefined;

    expect(row).not.toBeUndefined();
    expect(row?.action).toBe("auth.logout");
    expect(row?.user_email).toBe("admin@example.com");
    db.close();
  });

  it("recordRuntimeSuccessfulLogin stores the summary string", async () => {
    const { db, locals } = makeLocals();
    const actor = { email: "admin@example.com", role: "admin" as const, name: "Test Admin" };

    await recordRuntimeSuccessfulLogin(actor, locals);

    const row = db.prepare(
      "SELECT summary FROM audit_events WHERE action = 'auth.login' LIMIT 1",
    ).get() as { summary: string } | undefined;

    expect(row?.summary).toContain("Test Admin");
    db.close();
  });
});

describe("createRuntimeSession — unknown user guard", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("throws when user email does not exist in the database", async () => {
    const { db, locals } = makeLocals();
    // No user inserted — the SELECT in createRuntimeSession returns null

    await expect(
      createRuntimeSession(
        { email: "ghost@example.com", role: "admin", name: "Ghost" },
        undefined,
        locals,
      ),
    ).rejects.toThrow("ghost@example.com");
    db.close();
  });
});

describe("revokeRuntimeSession — null token guard", () => {
  it("returns without error when sessionToken is null", async () => {
    const { db, locals } = makeLocals();
    await expect(revokeRuntimeSession(null, locals)).resolves.toBeUndefined();
    db.close();
  });

  it("returns without error when sessionToken is undefined", async () => {
    const { db, locals } = makeLocals();
    await expect(revokeRuntimeSession(undefined, locals)).resolves.toBeUndefined();
    db.close();
  });
});

describe("getRuntimeSessionUser", () => {
  it("returns null when sessionToken is null", async () => {
    const { db, locals } = makeLocals();
    const result = await getRuntimeSessionUser(null, locals);
    expect(result).toBeNull();
    db.close();
  });

  it("returns null when sessionToken is undefined", async () => {
    const { db, locals } = makeLocals();
    const result = await getRuntimeSessionUser(undefined, locals);
    expect(result).toBeNull();
    db.close();
  });

  it("returns null for a revoked session", async () => {
    const { db, locals } = makeLocals();
    db.prepare(
      "INSERT INTO admin_users (id, email, role, password_hash, name, active) VALUES (?, ?, ?, ?, ?, 1)",
    ).run(1, "admin@example.com", "admin", await hashPassword("pass"), "Admin");

    const sessionToken = await createRuntimeSession(
      { email: "admin@example.com", role: "admin", name: "Admin" },
      undefined,
      locals,
    );
    await revokeRuntimeSession(sessionToken, locals);

    const result = await getRuntimeSessionUser(sessionToken, locals);
    expect(result).toBeNull();
    db.close();
  });

  it("returns null for inactive user even with valid session", async () => {
    const { db, locals } = makeLocals();
    db.prepare(
      "INSERT INTO admin_users (id, email, role, password_hash, name, active) VALUES (?, ?, ?, ?, ?, 1)",
    ).run(1, "admin@example.com", "admin", await hashPassword("pass"), "Admin");

    const sessionToken = await createRuntimeSession(
      { email: "admin@example.com", role: "admin", name: "Admin" },
      undefined,
      locals,
    );

    // deactivate user after session is created
    db.prepare("UPDATE admin_users SET active = 0 WHERE id = 1").run();

    const result = await getRuntimeSessionUser(sessionToken, locals);
    expect(result).toBeNull();
    db.close();
  });
});

describe("audit event summary text", () => {
  it("recordRuntimeLogout stores a summary containing the actor name", async () => {
    // Kills StringLiteral mutation on L277: `${actor.name} signed out.` → ``
    const { db, locals } = makeLocals();
    const actor = { email: "admin@example.com", role: "admin" as const, name: "Summary Actor" };

    await recordRuntimeLogout(actor, locals);

    const row = db.prepare(
      "SELECT summary FROM audit_events WHERE action = 'auth.logout' LIMIT 1",
    ).get() as { summary: string } | undefined;

    expect(row?.summary).toContain("Summary Actor");
    db.close();
  });
});

describe("session candidate lookup order", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("finds a session stored with the current SESSION_SECRET even when SESSION_SECRET_PREV is also configured", async () => {
    // Kills ConditionalExpression: true mutation on the `if (row) break` inside getLiveD1SessionRow.
    // With if(true): the loop always breaks after the FIRST candidate (digest_prev),
    // which is not in the DB. The session stored under digest_current is never tried → returns null.
    vi.stubEnv("SESSION_SECRET", "current-only-secret");
    vi.stubEnv("SESSION_SECRET_PREV", "old-prev-secret");

    const { db, locals } = makeLocals();
    db.prepare(
      "INSERT INTO admin_users (id, email, role, password_hash, name, active) VALUES (?, ?, ?, ?, ?, 1)",
    ).run(1, "admin@example.com", "admin", await hashPassword("pass"), "Admin");

    const sessionToken = await createRuntimeSession(
      { email: "admin@example.com", role: "admin", name: "Admin" },
      undefined,
      locals,
    );

    const user = await getRuntimeSessionUser(sessionToken, locals);
    expect(user).toMatchObject({ email: "admin@example.com" });
    db.close();
  });
});

describe("revokeRuntimeSession raw-token inclusion", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("revokes a session stored as raw token when no SESSION_SECRET is configured", async () => {
    // Kills ArrayDeclaration mutation on L218: [sessionToken] → []
    // With []: sessionCandidates is empty, no UPDATE runs, session survives revoke.
    vi.stubEnv("SESSION_SECRET", "");

    const { db, locals } = makeLocals();
    db.prepare(
      "INSERT INTO admin_users (id, email, role, password_hash, name, active) VALUES (?, ?, ?, ?, ?, 1)",
    ).run(1, "admin@example.com", "admin", await hashPassword("pass"), "Admin");

    // Insert session row directly with raw UUID so we know the exact stored id.
    const rawToken = crypto.randomUUID();
    db.prepare(
      "INSERT INTO admin_sessions (id, user_id, csrf_token) VALUES (?, ?, ?)",
    ).run(rawToken, 1, crypto.randomUUID());

    const beforeRevoke = await getRuntimeSessionUser(rawToken, locals);
    expect(beforeRevoke).not.toBeNull();

    await revokeRuntimeSession(rawToken, locals);

    const afterRevoke = await getRuntimeSessionUser(rawToken, locals);
    expect(afterRevoke).toBeNull();
    db.close();
  });
});

describe("session TTL boundary", () => {
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllEnvs();
  });

  it("accepts a session at exactly SESSION_TTL_MS without expiring it", async () => {
    // Kills > vs >= mutation on L81: date.now() - lastActiveAt > SESSION_TTL_MS
    // With >=: a session at exactly TTL boundary is revoked; with >: it's still valid.
    vi.useFakeTimers();
    const t0 = Date.now();

    const { db, locals } = makeLocals();
    db.prepare(
      "INSERT INTO admin_users (id, email, role, password_hash, name, active) VALUES (?, ?, ?, ?, ?, 1)",
    ).run(1, "admin@example.com", "admin", await hashPassword("pass"), "Admin");

    // Insert session using a JS Date (affected by fake clock).
    const rawToken = crypto.randomUUID();
    const lastActiveAt = new Date(t0).toISOString();
    db.prepare(
      "INSERT INTO admin_sessions (id, user_id, csrf_token, last_active_at) VALUES (?, ?, ?, ?)",
    ).run(rawToken, 1, crypto.randomUUID(), lastActiveAt);

    // Advance to exactly the TTL boundary — session must still be valid (> not >=).
    vi.setSystemTime(t0 + SESSION_TTL_MS);
    const atBoundary = await getRuntimeSessionUser(rawToken, locals);
    expect(atBoundary).not.toBeNull();

    // One millisecond past TTL — session must expire.
    vi.setSystemTime(t0 + SESSION_TTL_MS + 1);
    const pastBoundary = await getRuntimeSessionUser(rawToken, locals);
    expect(pastBoundary).toBeNull();
    db.close();
  });
});

describe("cleanupExpiredSessions bulk revoke", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("revokes stale sessions during a normal getRuntimeSessionUser call", async () => {
    // Kills BlockStatement mutation on cleanupExpiredSessions: body → {} (no-op).
    // With no-op: stale rows are never revoked_at-stamped even after a valid lookup.
    const { db, locals } = makeLocals();
    db.prepare(
      "INSERT INTO admin_users (id, email, role, password_hash, name, active) VALUES (?, ?, ?, ?, ?, 1)",
    ).run(1, "admin@example.com", "admin", await hashPassword("pass"), "Admin");

    // Insert two stale sessions (last active 13 hours ago) directly into DB.
    // SQLite datetime comparisons require "YYYY-MM-DD HH:MM:SS" format (not ISO T/Z format).
    const staleTime = new Date(Date.now() - 13 * 60 * 60 * 1000)
      .toISOString()
      .replace("T", " ")
      .slice(0, 19);
    db.prepare(
      "INSERT INTO admin_sessions (id, user_id, csrf_token, last_active_at) VALUES (?, 1, ?, ?)",
    ).run("stale-session-1", crypto.randomUUID(), staleTime);
    db.prepare(
      "INSERT INTO admin_sessions (id, user_id, csrf_token, last_active_at) VALUES (?, 1, ?, ?)",
    ).run("stale-session-2", crypto.randomUUID(), staleTime);

    // Insert a valid current session to trigger getRuntimeSessionUser (which calls cleanupExpiredSessions).
    const rawToken = crypto.randomUUID();
    db.prepare(
      "INSERT INTO admin_sessions (id, user_id, csrf_token) VALUES (?, 1, ?)",
    ).run(rawToken, crypto.randomUUID());

    await getRuntimeSessionUser(rawToken, locals);

    const staleRows = db.prepare(
      "SELECT id, revoked_at FROM admin_sessions WHERE id IN ('stale-session-1', 'stale-session-2')",
    ).all() as { id: string; revoked_at: string | null }[];

    expect(staleRows).toHaveLength(2);
    for (const row of staleRows) {
      expect(row.revoked_at, `${row.id} should be revoked`).not.toBeNull();
    }
    db.close();
  });
});
