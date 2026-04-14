import { afterEach, describe, expect, it, vi } from "vitest";

import { createSessionTokenDigest, hashPassword } from "../src/crypto-utils.js";
import { createRuntimeSession, getRuntimeSessionUser, revokeRuntimeSession } from "../src/runtime-admin-auth.js";
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
