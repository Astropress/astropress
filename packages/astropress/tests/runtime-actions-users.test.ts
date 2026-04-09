import { DatabaseSync } from "node:sqlite";
import { beforeEach, describe, expect, it } from "vitest";

import { registerCms } from "../src/config";
import { readAstropressSqliteSchemaSql } from "../src/sqlite-bootstrap.js";
import { makeLocals } from "./helpers/make-locals.js";
import {
  consumeRuntimeInviteToken,
  consumeRuntimePasswordResetToken,
  createRuntimePasswordResetToken,
  getRuntimeInviteRequest,
  getRuntimePasswordResetRequest,
  inviteRuntimeAdminUser,
  suspendRuntimeAdminUser,
  unsuspendRuntimeAdminUser,
} from "../src/runtime-actions-users";

function makeDb() {
  const db = new DatabaseSync(":memory:");
  db.exec(readAstropressSqliteSchemaSql());
  return db;
}

const actor = { email: "admin@test.local", role: "admin" as const, name: "Test Admin" };

let db: DatabaseSync;
let locals: App.Locals;

beforeEach(() => {
  db = makeDb();
  locals = makeLocals(db);
  registerCms({ templateKeys: ["content"], siteUrl: "https://example.com", seedPages: [], archives: [], translationStatus: [] });

  db.prepare("INSERT INTO admin_users (email, password_hash, role, name, active) VALUES (?, ?, ?, ?, ?)").run(
    "admin@test.local", "hash", "admin", "Test Admin", 1,
  );
  db.prepare("INSERT INTO admin_users (email, password_hash, role, name, active) VALUES (?, ?, ?, ?, ?)").run(
    "editor@test.local", "hash", "editor", "Test Editor", 1,
  );
});

describe("inviteRuntimeAdminUser", () => {
  it("creates a user and returns an invite URL", async () => {
    const result = await inviteRuntimeAdminUser(
      { name: "New User", email: "new@test.local", role: "editor" },
      actor,
      locals,
    );
    expect(result).toMatchObject({ ok: true });
    expect((result as { inviteUrl: string }).inviteUrl).toContain("/accept-invite?token=");
  });

  it("rejects duplicate email", async () => {
    const result = await inviteRuntimeAdminUser(
      { name: "Dup", email: "editor@test.local", role: "editor" },
      actor,
      locals,
    );
    expect(result).toMatchObject({ ok: false });
  });

  it("rejects missing name", async () => {
    const result = await inviteRuntimeAdminUser({ name: "  ", email: "x@test.local", role: "editor" }, actor, locals);
    expect(result).toMatchObject({ ok: false });
  });

  it("rejects invalid role", async () => {
    const result = await inviteRuntimeAdminUser({ name: "X", email: "x@test.local", role: "superuser" }, actor, locals);
    expect(result).toMatchObject({ ok: false });
  });

  it("rejects invalid email format", async () => {
    const result = await inviteRuntimeAdminUser({ name: "X", email: "not-an-email", role: "editor" }, actor, locals);
    expect(result).toMatchObject({ ok: false });
  });
});

describe("getRuntimeInviteRequest / consumeRuntimeInviteToken", () => {
  async function createInvite() {
    const invite = await inviteRuntimeAdminUser({ name: "Invite User", email: "invite@test.local", role: "editor" }, actor, locals);
    const rawToken = (invite as { inviteUrl: string }).inviteUrl.split("token=")[1];
    return decodeURIComponent(rawToken);
  }

  it("returns invite details for a valid token", async () => {
    const token = await createInvite();
    const request = await getRuntimeInviteRequest(token, locals);
    expect(request).toMatchObject({ email: "invite@test.local", role: "editor" });
  });

  it("returns null for an unknown token", async () => {
    const request = await getRuntimeInviteRequest("bad-token", locals);
    expect(request).toBeNull();
  });

  it("consumes an invite token and sets password", async () => {
    const token = await createInvite();
    const result = await consumeRuntimeInviteToken(token, "newpassword123", locals);
    expect(result).toMatchObject({ ok: true });
  });

  it("rejects a short password", async () => {
    const token = await createInvite();
    const result = await consumeRuntimeInviteToken(token, "short", locals);
    expect(result).toMatchObject({ ok: false });
  });
});

describe("createRuntimePasswordResetToken / getRuntimePasswordResetRequest / consumeRuntimePasswordResetToken", () => {
  async function createResetToken(email = "editor@test.local") {
    const r = await createRuntimePasswordResetToken(email, actor, locals);
    const rawToken = (r as { resetUrl: string }).resetUrl.split("token=")[1];
    return decodeURIComponent(rawToken);
  }

  it("creates a reset URL for a known active user", async () => {
    const result = await createRuntimePasswordResetToken("editor@test.local", actor, locals);
    expect(result).toMatchObject({ ok: true });
    expect((result as { resetUrl: string }).resetUrl).toContain("/reset-password?token=");
  });

  it("returns not-ok (with actor) for unknown email", async () => {
    const result = await createRuntimePasswordResetToken("nobody@test.local", actor, locals);
    expect(result).toMatchObject({ ok: false });
  });

  it("returns ok with null resetUrl (without actor) for unknown email", async () => {
    const result = await createRuntimePasswordResetToken("nobody@test.local", null, locals);
    expect(result).toMatchObject({ ok: true });
    expect((result as { resetUrl: null }).resetUrl).toBeNull();
  });

  it("returns reset request details for a valid token", async () => {
    const token = await createResetToken();
    const request = await getRuntimePasswordResetRequest(token, locals);
    expect(request).toMatchObject({ email: "editor@test.local" });
  });

  it("returns null for an unknown token", async () => {
    const request = await getRuntimePasswordResetRequest("bad-token", locals);
    expect(request).toBeNull();
  });

  it("consumes a reset token and updates password", async () => {
    const token = await createResetToken();
    const result = await consumeRuntimePasswordResetToken(token, "newpassword123", locals);
    expect(result).toMatchObject({ ok: true });
  });

  it("rejects a short password", async () => {
    const token = await createResetToken();
    const result = await consumeRuntimePasswordResetToken(token, "short", locals);
    expect(result).toMatchObject({ ok: false });
  });

  it("rejects an already-consumed token", async () => {
    const token = await createResetToken();
    await consumeRuntimePasswordResetToken(token, "newpassword123", locals);
    const result = await consumeRuntimePasswordResetToken(token, "anotherpassword", locals);
    expect(result).toMatchObject({ ok: false });
  });
});

describe("suspendRuntimeAdminUser / unsuspendRuntimeAdminUser", () => {
  it("suspends an active user", async () => {
    const result = await suspendRuntimeAdminUser("editor@test.local", actor, locals);
    expect(result).toMatchObject({ ok: true });
    const row = db.prepare("SELECT active FROM admin_users WHERE email = 'editor@test.local'").get() as { active: number };
    expect(row.active).toBe(0);
  });

  it("cannot suspend own account", async () => {
    const result = await suspendRuntimeAdminUser("admin@test.local", actor, locals);
    expect(result).toMatchObject({ ok: false });
  });

  it("returns not-ok for unknown or already-suspended user", async () => {
    const result = await suspendRuntimeAdminUser("nobody@test.local", actor, locals);
    expect(result).toMatchObject({ ok: false });
  });

  it("restores a suspended user", async () => {
    db.prepare("UPDATE admin_users SET active = 0 WHERE email = 'editor@test.local'").run();
    const result = await unsuspendRuntimeAdminUser("editor@test.local", actor, locals);
    expect(result).toMatchObject({ ok: true });
    const row = db.prepare("SELECT active FROM admin_users WHERE email = 'editor@test.local'").get() as { active: number };
    expect(row.active).toBe(1);
  });

  it("returns not-ok for already-active user on unsuspend", async () => {
    const result = await unsuspendRuntimeAdminUser("editor@test.local", actor, locals);
    expect(result).toMatchObject({ ok: false });
  });
});
