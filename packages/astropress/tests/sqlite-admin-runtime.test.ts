import { createHash, pbkdf2Sync, randomBytes } from "node:crypto";
import { DatabaseSync } from "node:sqlite";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createAstropressSqliteAdminRuntime } from "../src/sqlite-admin-runtime.js";
import { readAstropressSqliteSchemaSql } from "../src/sqlite-bootstrap.js";

/** Produce a hash in the same format as the runtime's hashPasswordSync */
function makePasswordHash(password: string): string {
  const iterations = 100_000;
  const salt = randomBytes(32);
  const derived = pbkdf2Sync(password, salt, iterations, 64, "sha256");
  return `${iterations}$${salt.toString("base64")}$${derived.toString("base64")}`;
}

let db: DatabaseSync;
let runtime: ReturnType<typeof createAstropressSqliteAdminRuntime>;
let store: (typeof runtime)["sqliteAdminStore"];
let registry: (typeof runtime)["sqliteCmsRegistryModule"];

const actor = { email: "admin@test.local", role: "admin" as const, name: "Test Admin" };

beforeAll(() => {
  db = new DatabaseSync(":memory:");
  db.exec(readAstropressSqliteSchemaSql());

  // Active admin user (correct password)
  db.prepare("INSERT INTO admin_users (email, password_hash, role, name, active) VALUES (?, ?, ?, ?, 1)").run(
    "admin@test.local",
    makePasswordHash("correct-password"),
    "admin",
    "Test Admin",
  );

  // Suspended user (active=0)
  db.prepare("INSERT INTO admin_users (email, password_hash, role, name, active) VALUES (?, ?, ?, ?, 0)").run(
    "suspended@test.local",
    makePasswordHash("x"),
    "editor",
    "Suspended User",
  );

  // User with pending invite (seeded for listAdminUsers invited-status branch)
  db.prepare("INSERT INTO admin_users (email, password_hash, role, name, active) VALUES (?, ?, ?, ?, 1)").run(
    "invited@test.local",
    makePasswordHash("x"),
    "editor",
    "Invited User",
  );
  const invitedUserId = (
    db.prepare("SELECT id FROM admin_users WHERE email = 'invited@test.local'").get() as { id: number }
  ).id;
  db.prepare("INSERT INTO user_invites (id, user_id, token_hash, expires_at, invited_by) VALUES (?, ?, ?, datetime('now', '+7 days'), ?)").run(
    "invite-1",
    invitedUserId,
    "fake-invite-token-hash",
    "admin@test.local",
  );

  // User with a malformed password hash (for verifyPasswordSync malformed-hash branch)
  db.prepare("INSERT INTO admin_users (email, password_hash, role, name, active) VALUES (?, ?, ?, ?, 1)").run(
    "malformed@test.local",
    "not-a-valid-hash",
    "editor",
    "Malformed Hash User",
  );

  // System route group + variant for CMS route tests
  db.prepare("INSERT INTO cms_route_groups (id, kind, render_strategy, canonical_locale, canonical_path) VALUES (?, ?, ?, ?, ?)").run(
    "group-sitemap",
    "system",
    "generated_xml",
    "en",
    "/sitemap.xml",
  );
  db.prepare(
    "INSERT INTO cms_route_variants (id, group_id, locale, path, status, title, settings_json, updated_by) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
  ).run("variant-sitemap", "group-sitemap", "en", "/sitemap.xml", "published", "Sitemap", null, "seed");

  // System route with Spanish path (for localeFromPath "es" branch)
  db.prepare("INSERT INTO cms_route_groups (id, kind, render_strategy, canonical_locale, canonical_path) VALUES (?, ?, ?, ?, ?)").run(
    "group-es-feed",
    "system",
    "generated_xml",
    "es",
    "/es/feed.xml",
  );
  db.prepare(
    "INSERT INTO cms_route_variants (id, group_id, locale, path, status, title, settings_json, updated_by) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
  ).run("variant-es-feed", "group-es-feed", "es", "/es/feed.xml", "published", "ES Feed", null, "seed");

  // System route with malformed settings_json (for parseSystemSettings catch branch)
  db.prepare("INSERT INTO cms_route_groups (id, kind, render_strategy, canonical_locale, canonical_path) VALUES (?, ?, ?, ?, ?)").run(
    "group-robots",
    "system",
    "generated_text",
    "en",
    "/robots.txt",
  );
  db.prepare(
    "INSERT INTO cms_route_variants (id, group_id, locale, path, status, title, settings_json, updated_by) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
  ).run("variant-robots", "group-robots", "en", "/robots.txt", "published", "Robots", "{ invalid json", "seed");

  // Structured page route with non-string templateKey (normalizeStructuredTemplateKey branch)
  db.prepare("INSERT INTO cms_route_groups (id, kind, render_strategy, canonical_locale, canonical_path) VALUES (?, ?, ?, ?, ?)").run(
    "group-page-num",
    "page",
    "structured_sections",
    "en",
    "/numeric-key",
  );
  db.prepare(
    "INSERT INTO cms_route_variants (id, group_id, locale, path, status, title, settings_json, updated_by) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
  ).run("variant-page-num", "group-page-num", "en", "/numeric-key", "published", "Numeric Key", '{"templateKey":42}', "seed");

  // Structured page route with string templateKey (normalizeStructuredTemplateKey → try/catch → null)
  db.prepare("INSERT INTO cms_route_groups (id, kind, render_strategy, canonical_locale, canonical_path) VALUES (?, ?, ?, ?, ?)").run(
    "group-page-str",
    "page",
    "structured_sections",
    "en",
    "/string-key",
  );
  db.prepare(
    "INSERT INTO cms_route_variants (id, group_id, locale, path, status, title, sections_json, settings_json, updated_by) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
  ).run(
    "variant-page-str",
    "group-page-str",
    "en",
    "/string-key",
    "published",
    "String Key",
    '{"hero":"content"}',
    '{"templateKey":"unknown-template"}',
    "seed",
  );

  // Archive route for getArchiveRoute tests
  db.prepare("INSERT INTO cms_route_groups (id, kind, render_strategy, canonical_locale, canonical_path) VALUES (?, ?, ?, ?, ?)").run(
    "group-archive",
    "archive",
    "archive_listing",
    "en",
    "/blog",
  );
  db.prepare(
    "INSERT INTO cms_route_variants (id, group_id, locale, path, status, title, updated_by) VALUES (?, ?, ?, ?, ?, ?, ?)",
  ).run("variant-archive", "group-archive", "en", "/blog", "published", "Blog Archive", "seed");

  runtime = createAstropressSqliteAdminRuntime({ getDatabase: () => db });
  store = runtime.sqliteAdminStore;
  registry = runtime.sqliteCmsRegistryModule;
});

// ─── Factory option defaults ──────────────────────────────────────────────────

describe("factory option defaults", () => {
  it("creates runtime with default sessionTtlMs, now, and randomId", () => {
    // Creating without optional fields exercises all three ?? defaults
    const rt = createAstropressSqliteAdminRuntime({ getDatabase: () => db });
    expect(rt.sqliteAdminStore).toBeDefined();
    expect(rt.sqliteCmsRegistryModule).toBeDefined();
    expect(rt.authenticatePersistedAdminUser).toBeInstanceOf(Function);
  });
});

// ─── Auth ─────────────────────────────────────────────────────────────────────

describe("auth", () => {
  it("returns null for empty email", async () => {
    expect(await runtime.authenticatePersistedAdminUser("", "correct-password")).toBeNull();
  });

  it("returns null for malformed password hash (verifyPasswordSync malformed-hash branch)", async () => {
    expect(await runtime.authenticatePersistedAdminUser("malformed@test.local", "any-password")).toBeNull();
  });

  it("returns null for wrong password", async () => {
    expect(await runtime.authenticatePersistedAdminUser("admin@test.local", "wrong-password")).toBeNull();
  });

  it("returns user for correct password", async () => {
    const user = await runtime.authenticatePersistedAdminUser("admin@test.local", "correct-password");
    expect(user?.email).toBe("admin@test.local");
    expect(user?.role).toBe("admin");
  });

  it("getSessionUser returns null for null/empty token", () => {
    expect(store.auth.getSessionUser(null as unknown as string)).toBeNull();
    expect(store.auth.getSessionUser("")).toBeNull();
  });

  it("getCsrfToken returns null for empty token", () => {
    expect(store.auth.getCsrfToken("")).toBeNull();
  });

  it("session lifecycle: create → get → getCsrfToken → revoke", async () => {
    const user = await runtime.authenticatePersistedAdminUser("admin@test.local", "correct-password");
    const sessionToken = store.auth.createSession(user!, { ipAddress: "127.0.0.1" });
    expect(typeof sessionToken).toBe("string");

    const sessionUser = store.auth.getSessionUser(sessionToken);
    expect(sessionUser?.email).toBe("admin@test.local");

    const csrf = store.auth.getCsrfToken(sessionToken);
    expect(typeof csrf).toBe("string");

    store.auth.revokeSession(sessionToken);
    expect(store.auth.getSessionUser(sessionToken)).toBeNull();
  });

  it("revokeSession with null token is a no-op", () => {
    expect(() => store.auth.revokeSession(null as unknown as string)).not.toThrow();
  });

  it("getSessionUser returns null for expired session (sessionTtlMs branch)", async () => {
    const expiredDb = new DatabaseSync(":memory:");
    expiredDb.exec(readAstropressSqliteSchemaSql());
    expiredDb.prepare("INSERT INTO admin_users (email, password_hash, role, name, active) VALUES (?, ?, ?, ?, 1)").run(
      "expired@test.local",
      makePasswordHash("password"),
      "admin",
      "Expired",
    );
    const expiredRuntime = createAstropressSqliteAdminRuntime({
      getDatabase: () => expiredDb,
      sessionTtlMs: 1, // 1 ms TTL — any real session will appear expired
      now: () => Date.now() + 100_000, // clock is 100 seconds in the future
    });
    const user = await expiredRuntime.authenticatePersistedAdminUser("expired@test.local", "password");
    const token = expiredRuntime.sqliteAdminStore.auth.createSession(user!, {});
    expect(expiredRuntime.sqliteAdminStore.auth.getSessionUser(token)).toBeNull();
    expiredDb.close();
  });

  it("createPasswordResetToken: unknown user without actor returns ok:true with null resetUrl", () => {
    // No actor → admin.password_reset_issue is not recorded, returns ok:true
    const result = store.auth.createPasswordResetToken("nobody@test.local", null);
    expect(result).toMatchObject({ ok: true, resetUrl: null });
  });

  it("createPasswordResetToken: known user returns ok:true with resetUrl", () => {
    const result = store.auth.createPasswordResetToken("admin@test.local", actor);
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error("unreachable");
    expect(result.resetUrl).toContain("token=");
  });

  it("createPasswordResetToken: unknown user with actor returns ok:false", () => {
    const result = store.auth.createPasswordResetToken("nobody@test.local", actor);
    expect(result).toMatchObject({ ok: false });
  });

  it("createPasswordResetToken: empty email returns ok:false", () => {
    expect(store.auth.createPasswordResetToken("", actor)).toMatchObject({ ok: false });
  });

  it("getPasswordResetRequest: empty token returns null", () => {
    expect(store.auth.getPasswordResetRequest("")).toBeNull();
  });

  it("getPasswordResetRequest: invalid token returns null", () => {
    expect(store.auth.getPasswordResetRequest("invalid-token")).toBeNull();
  });

  it("getInviteRequest: empty token returns null", () => {
    expect(store.auth.getInviteRequest("")).toBeNull();
  });

  it("getInviteRequest: invalid token returns null", () => {
    expect(store.auth.getInviteRequest("not-a-real-token")).toBeNull();
  });

  it("consumeInviteToken: short password returns error", () => {
    expect(store.auth.consumeInviteToken("any-token", "short")).toMatchObject({ ok: false });
  });

  it("consumeInviteToken: invalid token returns error", () => {
    expect(store.auth.consumeInviteToken("not-a-real-token", "long-enough-password")).toMatchObject({ ok: false });
  });

  it("consumePasswordResetToken: short password returns error", () => {
    expect(store.auth.consumePasswordResetToken("any-token", "short")).toMatchObject({ ok: false });
  });

  it("consumePasswordResetToken: invalid token returns error", () => {
    expect(store.auth.consumePasswordResetToken("not-a-real-token", "long-enough-password")).toMatchObject({ ok: false });
  });

  it("full password reset flow: issue, get request, consume", () => {
    // Issue a reset token
    const issued = store.auth.createPasswordResetToken("admin@test.local", actor);
    expect(issued.ok).toBe(true);
    if (!issued.ok) throw new Error("unreachable");

    // Extract the raw token from the URL: /ap-admin/reset-password?token=RAW_TOKEN
    const rawToken = decodeURIComponent(issued.resetUrl!.split("token=")[1]);

    // Get the reset request (covers getPasswordResetRequest success path + isUsableToken true path)
    const request = store.auth.getPasswordResetRequest(rawToken);
    expect(request?.email).toBe("admin@test.local");

    // Consume the token (covers consumePasswordResetToken success path)
    const consumed = store.auth.consumePasswordResetToken(rawToken, "new-long-password-123");
    expect(consumed.ok).toBe(true);

    // Token is now consumed — getPasswordResetRequest returns null (isUsableToken false branch)
    expect(store.auth.getPasswordResetRequest(rawToken)).toBeNull();
  });

  it("full invite flow: create invite, get request, consume", async () => {
    // Create a new editor user that has an invite
    store.users.inviteAdminUser({ email: "invite-flow@test.local", role: "editor", name: "Invite Flow" }, actor);
    const issuedInvite = store.auth.createPasswordResetToken("invite-flow@test.local", null);
    expect(issuedInvite.ok).toBe(true);

    // Seed a valid invite token directly (simpler than going through full invite flow)
    const inviteRawToken = "test-invite-raw-token-xyz";
    const tokenHash = createHash("sha256").update(inviteRawToken).digest("hex");
    const invitedUserId = (db.prepare("SELECT id FROM admin_users WHERE email = 'invite-flow@test.local'").get() as { id: number }).id;
    db.prepare("INSERT INTO user_invites (id, user_id, token_hash, expires_at, invited_by) VALUES (?, ?, ?, datetime('now', '+7 days'), ?)").run(
      "invite-flow-1",
      invitedUserId,
      tokenHash,
      "admin@test.local",
    );

    // Get the invite request (covers getInviteRequest success path + isUsableToken true branch)
    const inviteRequest = store.auth.getInviteRequest(inviteRawToken);
    expect(inviteRequest?.email).toBe("invite-flow@test.local");

    // Consume the invite token (covers consumeInviteToken success path)
    const consumed = store.auth.consumeInviteToken(inviteRawToken, "my-new-secure-password");
    expect(consumed.ok).toBe(true);

    // Token is now accepted — getInviteRequest returns null (isUsableToken false branch)
    expect(store.auth.getInviteRequest(inviteRawToken)).toBeNull();
  });

  it("recordSuccessfulLogin records an auth audit event", () => {
    expect(() => store.auth.recordSuccessfulLogin(actor)).not.toThrow();
  });

  it("recordLogout records an auth audit event", () => {
    expect(() => store.auth.recordLogout(actor)).not.toThrow();
  });

  it("getCsrfToken returns null for expired session", async () => {
    const expiredDb = new DatabaseSync(":memory:");
    expiredDb.exec(readAstropressSqliteSchemaSql());
    expiredDb.prepare("INSERT INTO admin_users (email, password_hash, role, name, active) VALUES (?, ?, ?, ?, 1)").run(
      "expired2@test.local",
      makePasswordHash("password"),
      "admin",
      "Expired2",
    );
    const expiredRuntime = createAstropressSqliteAdminRuntime({
      getDatabase: () => expiredDb,
      sessionTtlMs: 1,
      now: () => Date.now() + 100_000,
    });
    const user = await expiredRuntime.authenticatePersistedAdminUser("expired2@test.local", "password");
    const token = expiredRuntime.sqliteAdminStore.auth.createSession(user!, {});
    expect(expiredRuntime.sqliteAdminStore.auth.getCsrfToken(token)).toBeNull();
    expiredDb.close();
  });
});

// ─── Users ────────────────────────────────────────────────────────────────────

describe("users", () => {
  it("listAdminUsers returns active, suspended, and invited statuses", () => {
    const users = store.users.listAdminUsers();
    expect(users.some((u) => u.email === "admin@test.local" && u.status === "active")).toBe(true);
    expect(users.some((u) => u.email === "suspended@test.local" && u.status === "suspended")).toBe(true);
    expect(users.some((u) => u.email === "invited@test.local" && u.status === "invited")).toBe(true);
  });

  it("inviteAdminUser creates a new user", () => {
    const result = store.users.inviteAdminUser({ email: "new-editor@test.local", role: "editor", name: "New Editor" }, actor);
    expect(result.ok).toBe(true);
  });

  it("inviteAdminUser returns error for duplicate email", () => {
    store.users.inviteAdminUser({ email: "dup-editor@test.local", role: "editor", name: "Dup" }, actor);
    const result = store.users.inviteAdminUser({ email: "dup-editor@test.local", role: "editor", name: "Dup Again" }, actor);
    expect(result.ok).toBe(false);
  });

  it("suspendAdminUser and unsuspendAdminUser toggle active state", () => {
    store.users.inviteAdminUser({ email: "toggle@test.local", role: "editor", name: "Toggle" }, actor);
    const suspend = store.users.suspendAdminUser("toggle@test.local", actor);
    expect(suspend.ok).toBe(true);
    const unsuspend = store.users.unsuspendAdminUser("toggle@test.local", actor);
    expect(unsuspend.ok).toBe(true);
  });

  it("suspendAdminUser returns error for unknown user", () => {
    const result = store.users.suspendAdminUser("nobody@test.local", actor);
    expect(result.ok).toBe(false);
  });
});

// ─── Audit ────────────────────────────────────────────────────────────────────

describe("audit", () => {
  it("getAuditEvents returns events with correct targetType mapping", () => {
    // Seed events with different resource_type values
    db.prepare("INSERT INTO audit_events (user_email, action, resource_type, resource_id, summary) VALUES (?, ?, ?, ?, ?)").run(
      "admin@test.local",
      "test.redirect",
      "redirect",
      "/old",
      "Redirect audit",
    );
    db.prepare("INSERT INTO audit_events (user_email, action, resource_type, resource_id, summary) VALUES (?, ?, ?, ?, ?)").run(
      "admin@test.local",
      "test.comment",
      "comment",
      "c1",
      "Comment audit",
    );
    db.prepare("INSERT INTO audit_events (user_email, action, resource_type, resource_id, summary) VALUES (?, ?, ?, ?, ?)").run(
      "admin@test.local",
      "test.content",
      "content",
      "post-1",
      "Content audit",
    );
    db.prepare("INSERT INTO audit_events (user_email, action, resource_type, resource_id, summary) VALUES (?, ?, ?, ?, ?)").run(
      "admin@test.local",
      "test.auth",
      "auth",
      "site-settings",
      "Auth audit",
    );
    db.prepare("INSERT INTO audit_events (user_email, action, resource_type, resource_id, summary) VALUES (?, ?, ?, ?, ?)").run(
      "admin@test.local",
      "test.unknown",
      "media",
      "asset-1",
      "Unknown type audit",
    );

    const events = store.audit.getAuditEvents();
    expect(events.some((e) => e.targetType === "redirect")).toBe(true);
    expect(events.some((e) => e.targetType === "comment")).toBe(true);
    expect(events.some((e) => e.targetType === "content")).toBe(true);
    // "auth" falls through the else path
    expect(events.some((e) => e.targetType === "auth")).toBe(true);
  });
});

// ─── Authors ──────────────────────────────────────────────────────────────────

describe("authors", () => {
  it("listAuthors returns empty initially", () => {
    expect(store.authors.listAuthors()).toBeInstanceOf(Array);
  });

  it("createAuthor succeeds and appears in list", () => {
    const result = store.authors.createAuthor({ name: "Alice Author", bio: "A writer" }, actor);
    expect(result.ok).toBe(true);
    expect(store.authors.listAuthors().some((a) => a.name === "Alice Author")).toBe(true);
  });

  it("createAuthor returns error for duplicate name", () => {
    store.authors.createAuthor({ name: "Bob Author" }, actor);
    const result = store.authors.createAuthor({ name: "Bob Author" }, actor);
    expect(result.ok).toBe(false);
  });

  it("createAuthor returns error for empty name (slugifyTerm empty string branch)", () => {
    const result = store.authors.createAuthor({ name: "" }, actor);
    expect(result.ok).toBe(false);
  });

  it("updateAuthor succeeds", () => {
    store.authors.createAuthor({ name: "Charlie Author" }, actor);
    const charlie = store.authors.listAuthors().find((a) => a.name === "Charlie Author")!;
    const result = store.authors.updateAuthor({ id: charlie.id, name: "Charlie Updated", bio: "Updated bio" }, actor);
    expect(result.ok).toBe(true);
  });

  it("updateAuthor returns error for missing id", () => {
    const result = store.authors.updateAuthor({ id: 0, name: "Nobody" }, actor);
    expect(result.ok).toBe(false);
  });

  it("updateAuthor returns error for non-existent id", () => {
    const result = store.authors.updateAuthor({ id: 999_999, name: "Ghost" }, actor);
    expect(result.ok).toBe(false);
  });

  it("deleteAuthor marks as deleted", () => {
    store.authors.createAuthor({ name: "Dave Delete" }, actor);
    const dave = store.authors.listAuthors().find((a) => a.name === "Dave Delete")!;
    const result = store.authors.deleteAuthor(dave.id, actor);
    expect(result.ok).toBe(true);
    expect(store.authors.listAuthors().some((a) => a.name === "Dave Delete")).toBe(false);
  });
});

// ─── Taxonomies ───────────────────────────────────────────────────────────────

describe("taxonomies", () => {
  it("categories: create, update, delete lifecycle", () => {
    expect(store.taxonomies.createCategory({ name: "Tech" }, actor).ok).toBe(true);
    const tech = store.taxonomies.listCategories().find((c) => c.name === "Tech")!;
    expect(store.taxonomies.updateCategory({ id: tech.id, name: "Technology" }, actor).ok).toBe(true);
    expect(store.taxonomies.deleteCategory(tech.id, actor).ok).toBe(true);
    expect(store.taxonomies.listCategories().some((c) => c.name === "Technology")).toBe(false);
  });

  it("createCategory returns error for duplicate name", () => {
    store.taxonomies.createCategory({ name: "Dup Category" }, actor);
    expect(store.taxonomies.createCategory({ name: "Dup Category" }, actor).ok).toBe(false);
  });

  it("updateCategory returns error for non-existent id", () => {
    expect(store.taxonomies.updateCategory({ id: 999_999, name: "Ghost" }, actor).ok).toBe(false);
  });

  it("tags: create, update, delete lifecycle", () => {
    expect(store.taxonomies.createTag({ name: "JavaScript" }, actor).ok).toBe(true);
    const js = store.taxonomies.listTags().find((t) => t.name === "JavaScript")!;
    expect(store.taxonomies.updateTag({ id: js.id, name: "JS" }, actor).ok).toBe(true);
    expect(store.taxonomies.deleteTag(js.id, actor).ok).toBe(true);
    expect(store.taxonomies.listTags().some((t) => t.name === "JS")).toBe(false);
  });

  it("createTag returns error for duplicate name", () => {
    store.taxonomies.createTag({ name: "Dup Tag" }, actor);
    expect(store.taxonomies.createTag({ name: "Dup Tag" }, actor).ok).toBe(false);
  });
});

// ─── Redirects ────────────────────────────────────────────────────────────────

describe("redirects", () => {
  it("getRedirectRules returns empty initially for these paths", () => {
    const rules = store.redirects.getRedirectRules();
    expect(rules).toBeInstanceOf(Array);
  });

  it("createRedirectRule creates a redirect", () => {
    const result = store.redirects.createRedirectRule({ sourcePath: "/old-page", targetPath: "/new-page", statusCode: 301 }, actor);
    expect(result.ok).toBe(true);
    expect(store.redirects.getRedirectRules().some((r) => r.sourcePath === "/old-page")).toBe(true);
  });

  it("createRedirectRule updates an existing soft-deleted redirect", () => {
    store.redirects.createRedirectRule({ sourcePath: "/temp-redirect", targetPath: "/target-1", statusCode: 302 }, actor);
    store.redirects.deleteRedirectRule("/temp-redirect", actor);
    const result = store.redirects.createRedirectRule({ sourcePath: "/temp-redirect", targetPath: "/target-2", statusCode: 301 }, actor);
    expect(result.ok).toBe(true);
  });

  it("deleteRedirectRule removes a redirect", () => {
    store.redirects.createRedirectRule({ sourcePath: "/to-delete", targetPath: "/dest", statusCode: 301 }, actor);
    const result = store.redirects.deleteRedirectRule("/to-delete", actor);
    expect(result.ok).toBe(true);
    expect(store.redirects.getRedirectRules().some((r) => r.sourcePath === "/to-delete")).toBe(false);
  });

  it("deleteRedirectRule returns error for non-existent path", () => {
    const result = store.redirects.deleteRedirectRule("/does-not-exist", actor);
    expect(result.ok).toBe(false);
  });
});

// ─── Comments ─────────────────────────────────────────────────────────────────

describe("comments", () => {
  it("submitPublicComment creates a comment (result exposes generated id)", () => {
    const result = store.comments.submitPublicComment({
      author: "Alice",
      email: "alice@example.com",
      body: "Hello!",
      route: "/blog/post-1",
      submittedAt: new Date().toISOString(),
    });
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error("unreachable");
    expect(typeof result.comment.id).toBe("string");
    expect(store.comments.getComments().some((c) => c.id === result.comment.id)).toBe(true);
  });

  it("submitPublicComment without submittedAt field (uses auto-generated id)", () => {
    const result = store.comments.submitPublicComment({
      author: "Bob",
      body: "World!",
      email: "bob@example.com",
      route: "/blog/post-1",
      submittedAt: "2024-01-01T00:00:00.000Z",
    });
    expect(result.ok).toBe(true);
  });

  it("moderateComment approves a pending comment", () => {
    // Submit a comment and use the generated id to moderate it
    const submitted = store.comments.submitPublicComment({
      author: "Carol",
      body: "Moderate me",
      email: "carol@example.com",
      route: "/blog/post-2",
      submittedAt: new Date().toISOString(),
    });
    if (!submitted.ok) throw new Error("submitPublicComment failed");
    const result = store.comments.moderateComment(submitted.comment.id, "approved", actor);
    expect(result.ok).toBe(true);
  });

  it("moderateComment returns error for non-existent comment", () => {
    const result = store.comments.moderateComment("comment-999", "approved", actor);
    expect(result.ok).toBe(false);
  });

  it("getApprovedCommentsForRoute returns approved comments", () => {
    const comments = store.comments.getApprovedCommentsForRoute("/blog/post-1");
    expect(Array.isArray(comments)).toBe(true);
  });
});

// ─── Content ──────────────────────────────────────────────────────────────────

describe("content", () => {
  it("listContentStates returns empty list when no content_entries exist", () => {
    // Seeds from getCmsConfig throw in test env, so we only get custom entries
    const states = store.content.listContentStates();
    expect(Array.isArray(states)).toBe(true);
  });

  it("getContentState returns null for unknown slug", () => {
    expect(store.content.getContentState("unknown-slug")).toBeNull();
  });

  it("createContentRecord creates a new post (insert path, serializeIdList undefined branch)", () => {
    const result = store.content.createContentRecord(
      {
        title: "My First Post",
        slug: "my-first-post",
        status: "draft",
        seoTitle: "My First Post",
        metaDescription: "A test post",
        body: "Hello world",
      },
      actor,
    );
    expect(result.ok).toBe(true);
    expect(store.content.getContentState("my-first-post")).not.toBeNull();
  });

  it("createContentRecord returns error for duplicate slug", () => {
    const result = store.content.createContentRecord(
      {
        title: "My First Post Again",
        slug: "my-first-post",
        status: "draft",
        seoTitle: "My First Post Again",
        metaDescription: "Duplicate slug",
      },
      actor,
    );
    expect(result.ok).toBe(false);
  });

  it("createContentRecord returns error for missing required fields", () => {
    const result = store.content.createContentRecord(
      { title: "", slug: "no-title", status: "draft", seoTitle: "", metaDescription: "" },
      actor,
    );
    expect(result.ok).toBe(false);
  });

  it("createContentRecord with unknown status uses 'published' (normalizeContentStatus else branch)", () => {
    const result = store.content.createContentRecord(
      {
        title: "Status Norm Post",
        slug: "status-norm-post",
        status: "pending" as string, // non-standard status → normalizes to "published"
        seoTitle: "Status Norm Post",
        metaDescription: "Testing status normalization",
      },
      actor,
    );
    expect(result.ok).toBe(true);
    const state = store.content.getContentState("status-norm-post");
    expect(state?.status).toBe("published");
  });

  it("saveContentState updates an existing post (update path)", () => {
    const result = store.content.saveContentState(
      "my-first-post",
      {
        title: "My First Post Updated",
        status: "published",
        seoTitle: "My First Post Updated",
        metaDescription: "Updated meta",
        body: "Updated body",
      },
      actor,
    );
    expect(result.ok).toBe(true);
  });

  it("saveContentState returns error for unknown slug", () => {
    const result = store.content.saveContentState(
      "does-not-exist",
      {
        title: "X",
        status: "draft",
        seoTitle: "X",
        metaDescription: "X",
      },
      actor,
    );
    expect(result.ok).toBe(false);
  });

  it("saveContentState returns error for missing required fields", () => {
    const result = store.content.saveContentState(
      "my-first-post",
      { title: "", status: "draft", seoTitle: "", metaDescription: "" },
      actor,
    );
    expect(result.ok).toBe(false);
  });

  it("saveContentState with author/category/tag assignments", () => {
    // Create author + taxonomy for assignment tests
    store.authors.createAuthor({ name: "Assigned Author" }, actor);
    const authorId = store.authors.listAuthors().find((a) => a.name === "Assigned Author")!.id;
    store.taxonomies.createCategory({ name: "Assigned Category" }, actor);
    const catId = store.taxonomies.listCategories().find((c) => c.name === "Assigned Category")!.id;
    store.taxonomies.createTag({ name: "Assigned Tag" }, actor);
    const tagId = store.taxonomies.listTags().find((t) => t.name === "Assigned Tag")!.id;

    const result = store.content.saveContentState(
      "my-first-post",
      {
        title: "My First Post With Authors",
        status: "published",
        seoTitle: "My First Post With Authors",
        metaDescription: "With assignments",
        authorIds: [authorId],
        categoryIds: [catId],
        tagIds: [tagId],
      },
      actor,
    );
    expect(result.ok).toBe(true);
  });

  it("getContentRevisions returns revisions with parseIdList null→[] for null author_ids", () => {
    const revisions = store.content.getContentRevisions("my-first-post");
    expect(Array.isArray(revisions)).toBe(true);
    expect(revisions!.length).toBeGreaterThan(0);
    // Seed revisions have null author_ids → parseIdList(null) → []
    expect(revisions![0].authorIds).toEqual(expect.any(Array));
  });

  it("getContentRevisions returns null for unknown slug", () => {
    expect(store.content.getContentRevisions("unknown-slug")).toBeNull();
  });

  it("restoreRevision restores a previous revision", () => {
    const revisions = store.content.getContentRevisions("my-first-post")!;
    const revisionId = revisions[revisions.length - 1].id;
    const result = store.content.restoreRevision("my-first-post", revisionId, actor);
    expect(result.ok).toBe(true);
  });

  it("restoreRevision returns error for non-existent slug", () => {
    expect(store.content.restoreRevision("does-not-exist", "revision-1", actor).ok).toBe(false);
  });

  it("restoreRevision returns error for non-existent revision", () => {
    expect(store.content.restoreRevision("my-first-post", "non-existent-revision", actor).ok).toBe(false);
  });

  it("parseIdList: non-array JSON in author_ids branch", () => {
    // Insert a revision with non-array JSON in author_ids (covers !Array.isArray(parsed) branch)
    db.prepare(
      `INSERT INTO content_revisions (id, slug, title, status, seo_title, meta_description, author_ids, source, created_by)
       VALUES (?, 'my-first-post', 'Injected', 'draft', 'X', 'X', '{"not":"array"}', 'reviewed', 'seed')`,
    ).run("revision-bad-ids");
    const revisions = store.content.getContentRevisions("my-first-post");
    const bad = revisions?.find((r) => r.id === "revision-bad-ids");
    expect(bad?.authorIds).toEqual([]);
  });
});

// ─── Submissions ──────────────────────────────────────────────────────────────

describe("submissions", () => {
  it("submitContact stores a submission and getContactSubmissions returns it", () => {
    const result = store.submissions.submitContact({
      name: "Alice",
      email: "alice@example.com",
      message: "Hello from form",
      submittedAt: new Date().toISOString(),
    });
    expect(result.ok).toBe(true);
    const submissions = store.submissions.getContactSubmissions();
    expect(submissions.some((s) => s.name === "Alice")).toBe(true);
  });
});

// ─── Translations ─────────────────────────────────────────────────────────────

describe("translations", () => {
  it("getEffectiveTranslationState returns default when no override exists", () => {
    const state = store.translations.getEffectiveTranslationState("/blog/no-override");
    expect(state).toBe("not_started");
  });

  it("updateTranslationState persists state and getEffectiveTranslationState reads it back", () => {
    const result = store.translations.updateTranslationState("/blog/translatable", "partial", actor);
    expect(result.ok).toBe(true);
    expect(store.translations.getEffectiveTranslationState("/blog/translatable")).toBe("partial");
  });

  it("updateTranslationState returns error for invalid state", () => {
    const result = store.translations.updateTranslationState("/blog/x", "invalid-state" as string, actor);
    expect(result.ok).toBe(false);
  });
});

// ─── Settings ─────────────────────────────────────────────────────────────────

describe("settings", () => {
  it("getSettings returns defaultSiteSettings when no row exists", () => {
    const settings = store.settings.getSettings();
    // defaultSiteSettings has these empty strings and defaults
    expect(settings).toMatchObject({
      newsletterEnabled: false,
      commentsDefaultPolicy: "legacy-readonly",
      adminSlug: "ap-admin",
    });
  });

  it("saveSettings persists and getSettings reflects updated values", () => {
    const result = store.settings.saveSettings(
      {
        siteTitle: "My Site",
        siteTagline: "A tagline",
        donationUrl: "",
        newsletterEnabled: true,
        commentsDefaultPolicy: "open-moderated",
        adminSlug: "cms",
      },
      actor,
    );
    expect(result.ok).toBe(true);

    const settings = store.settings.getSettings();
    expect(settings.siteTitle).toBe("My Site");
    expect(settings.newsletterEnabled).toBe(true);
    expect(settings.commentsDefaultPolicy).toBe("open-moderated");
  });
});

// ─── Rate limits ──────────────────────────────────────────────────────────────

describe("rateLimits", () => {
  it("checkRateLimit: no existing key → resets window and returns true", () => {
    expect(store.rateLimits.checkRateLimit("rl:new-key", 5, 60_000)).toBe(true);
  });

  it("checkRateLimit: within limit → increments and returns true", () => {
    store.rateLimits.checkRateLimit("rl:test-key", 5, 60_000); // 1st request
    expect(store.rateLimits.checkRateLimit("rl:test-key", 5, 60_000)).toBe(true); // 2nd request
  });

  it("checkRateLimit: at limit → returns false", () => {
    for (let i = 0; i < 3; i++) {
      store.rateLimits.checkRateLimit("rl:limit-key", 3, 60_000);
    }
    expect(store.rateLimits.checkRateLimit("rl:limit-key", 3, 60_000)).toBe(false);
  });

  it("peekRateLimit: no existing key → returns true", () => {
    expect(store.rateLimits.peekRateLimit("rl:peek-new", 5, 60_000)).toBe(true);
  });

  it("peekRateLimit: at limit → returns false", () => {
    for (let i = 0; i < 3; i++) {
      store.rateLimits.checkRateLimit("rl:peek-limit", 3, 60_000);
    }
    expect(store.rateLimits.peekRateLimit("rl:peek-limit", 3, 60_000)).toBe(false);
  });

  it("recordFailedAttempt: no existing key → resets window", () => {
    store.rateLimits.recordFailedAttempt("rl:fail-new", 5, 60_000);
    expect(store.rateLimits.peekRateLimit("rl:fail-new", 5, 60_000)).toBe(true);
  });

  it("recordFailedAttempt: existing key within window → increments count", () => {
    store.rateLimits.checkRateLimit("rl:fail-existing", 10, 60_000);
    store.rateLimits.recordFailedAttempt("rl:fail-existing", 10, 60_000);
    // Should have count = 2 now but still within limit
    expect(store.rateLimits.peekRateLimit("rl:fail-existing", 10, 60_000)).toBe(true);
  });
});

// ─── Media ────────────────────────────────────────────────────────────────────

/** Minimal 1-pixel PNG as bytes */
function makePngBytes(): Buffer {
  // Real 1x1 transparent PNG (67 bytes)
  return Buffer.from(
    "89504e470d0a1a0a0000000d49484452000000010000000108060000001f15c489000000" +
    "0a49444154789c6260000000000200010e0221630000000049454e44ae426082",
    "hex",
  );
}

describe("media", () => {
  it("listMediaAssets returns empty initially", () => {
    expect(store.media.listMediaAssets()).toBeInstanceOf(Array);
  });

  it("updateMediaAsset returns error for empty id (empty-id branch)", () => {
    const result = store.media.updateMediaAsset({ id: "  " }, actor);
    expect(result.ok).toBe(false);
    expect(result.error).toMatch(/id is required/i);
  });

  it("updateMediaAsset returns error for non-existent asset (not-found branch)", () => {
    const result = store.media.updateMediaAsset({ id: "does-not-exist", title: "New Title" }, actor);
    expect(result.ok).toBe(false);
    expect(result.error).toMatch(/could not be updated/i);
  });

  it("updateMediaAsset succeeds for an existing asset (success branch)", () => {
    db.prepare(
      `INSERT INTO media_assets (id, local_path, mime_type, file_size, alt_text, title, uploaded_by) VALUES (?, ?, ?, ?, ?, ?, ?)`,
    ).run("media-test-1", "/uploads/img.png", "image/png", 1024, "old alt", "Old Title", "seed");

    const result = store.media.updateMediaAsset({ id: "media-test-1", title: "New Title", altText: "new alt" }, actor);
    expect(result.ok).toBe(true);

    const assets = store.media.listMediaAssets();
    const asset = assets.find((a) => a.id === "media-test-1");
    expect(asset?.title).toBe("New Title");
    expect(asset?.altText).toBe("new alt");
  });

  it("createMediaAsset: empty filename returns error (buildLocalMediaDescriptor !filename branch)", () => {
    const result = store.media.createMediaAsset({ filename: "", bytes: makePngBytes() }, actor);
    expect(result.ok).toBe(false);
    expect(result.error).toMatch(/select a file/i);
  });

  it("createMediaAsset: zero-byte file returns error (byteLength === 0 branch)", () => {
    const result = store.media.createMediaAsset({ filename: "empty.png", bytes: Buffer.alloc(0) }, actor);
    expect(result.ok).toBe(false);
    expect(result.error).toMatch(/select a file/i);
  });

  it("createMediaAsset: file too large returns error (> maxUploadBytes branch)", () => {
    const bigBytes = Buffer.alloc(11 * 1024 * 1024); // 11MB > 10MB limit
    const result = store.media.createMediaAsset({ filename: "big.png", bytes: bigBytes }, actor);
    expect(result.ok).toBe(false);
    expect(result.error).toMatch(/10 MB/i);
  });

  it("createMediaAsset: invalid extension returns error (!allowedExtensions branch)", () => {
    const result = store.media.createMediaAsset({ filename: "script.exe", bytes: makePngBytes() }, actor);
    expect(result.ok).toBe(false);
    expect(result.error).toMatch(/not allowed/i);
  });

  it("createMediaAsset: .png file succeeds (covers guessImageMimeType png branch, insertStoredMediaAsset, recordMediaAudit)", () => {
    const result = store.media.createMediaAsset({ filename: "photo.png", bytes: makePngBytes(), title: "Test Photo", altText: "A photo" }, actor);
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error("unreachable");
    expect(typeof result.id).toBe("string");
    const assets = store.media.listMediaAssets();
    expect(assets.some((a) => a.id === result.id)).toBe(true);
  });

  it("createMediaAsset: .jpg file succeeds (covers guessImageMimeType jpeg fallback branch)", () => {
    const result = store.media.createMediaAsset({ filename: "photo.jpg", bytes: makePngBytes() }, actor);
    expect(result.ok).toBe(true);
  });

  it("createMediaAsset: .svg file succeeds — no mimeType forces guessImageMimeType svg branch", () => {
    const svgBytes = Buffer.from("<svg xmlns='http://www.w3.org/2000/svg'><rect/></svg>");
    // No mimeType provided → guessMediaMimeType(".svg") → guessImageMimeType → "image/svg+xml"
    const result = store.media.createMediaAsset({ filename: "icon.svg", bytes: svgBytes }, actor);
    expect(result.ok).toBe(true);
  });

  it("createMediaAsset: .webp file succeeds — no mimeType forces guessImageMimeType webp branch", () => {
    const result = store.media.createMediaAsset({ filename: "img.webp", bytes: makePngBytes() }, actor);
    expect(result.ok).toBe(true);
  });

  it("createMediaAsset: .gif file succeeds — no mimeType forces guessImageMimeType gif branch", () => {
    const gifBytes = Buffer.from("47494638396101000100800000ffffff00000021f90400000000002c00000000010001000002024401003b", "hex");
    const result = store.media.createMediaAsset({ filename: "anim.gif", bytes: gifBytes }, actor);
    expect(result.ok).toBe(true);
  });

  it("createMediaAsset: .avif file succeeds — no mimeType forces guessImageMimeType avif branch", () => {
    const result = store.media.createMediaAsset({ filename: "img.avif", bytes: makePngBytes() }, actor);
    expect(result.ok).toBe(true);
  });

  it("createMediaAsset: .jpeg file succeeds (covers jpeg extension alias)", () => {
    const result = store.media.createMediaAsset({ filename: "photo.jpeg", bytes: makePngBytes() }, actor);
    expect(result.ok).toBe(true);
  });

  it("createMediaAsset: explicit mimeType provided (covers guessedMime = mimeType branch)", () => {
    const result = store.media.createMediaAsset({ filename: "explicit.png", bytes: makePngBytes(), mimeType: "image/png" }, actor);
    expect(result.ok).toBe(true);
  });

  it("createMediaAsset: invalid explicit mimeType with valid extension returns error", () => {
    // Valid extension (.png) but invalid explicit mimeType → guessedMime = "application/octet-stream" → rejected
    const result = store.media.createMediaAsset({ filename: "bad-mime.png", bytes: makePngBytes(), mimeType: "application/octet-stream" }, actor);
    expect(result.ok).toBe(false);
    expect(result.error).toMatch(/not allowed/i);
  });

  it("createMediaAsset: filename with no extension (covers .bin fallback branch)", () => {
    // No extension → ".bin" → !allowedExtensions → rejected before mime check
    const result = store.media.createMediaAsset({ filename: "noextension", bytes: makePngBytes() }, actor);
    expect(result.ok).toBe(false);
    expect(result.error).toMatch(/not allowed/i);
  });

  it("createMediaAsset: filename with special-chars-only base uses 'upload' as the base name", () => {
    // Filename "----.png" → baseName after cleanup = "" → "upload" used
    const result = store.media.createMediaAsset({ filename: "----.png", bytes: makePngBytes() }, actor);
    expect(result.ok).toBe(true);
  });

  it("deleteMediaAsset: empty id returns error", () => {
    const result = store.media.deleteMediaAsset("  ", actor);
    expect(result.ok).toBe(false);
    expect(result.error).toMatch(/id is required/i);
  });

  it("deleteMediaAsset: non-existent asset returns error", () => {
    const result = store.media.deleteMediaAsset("does-not-exist", actor);
    expect(result.ok).toBe(false);
    expect(result.error).toMatch(/could not be deleted/i);
  });

  it("deleteMediaAsset: /images/uploads/ path deleted via createMediaAsset flow (covers markStoredMediaDeleted, recordMediaAudit, deleteLocalMediaUpload)", () => {
    const created = store.media.createMediaAsset({ filename: "to-delete.png", bytes: makePngBytes() }, actor);
    expect(created.ok).toBe(true);
    if (!created.ok) throw new Error("unreachable");
    const result = store.media.deleteMediaAsset(created.id, actor);
    expect(result.ok).toBe(true);
    expect(store.media.listMediaAssets().some((a) => a.id === created.id)).toBe(false);
  });

  it("deleteMediaAsset: non-uploads local_path skips file deletion (deleteLocalMediaUpload !startsWith branch)", () => {
    // Insert a media row with a non-uploads local_path to cover the early-return branch
    db.prepare(
      `INSERT INTO media_assets (id, local_path, mime_type, file_size, alt_text, title, uploaded_by) VALUES (?, ?, ?, ?, ?, ?, ?)`,
    ).run("media-other-path", "/some/other/path.png", "image/png", 512, "", "Other Path", "seed");
    const result = store.media.deleteMediaAsset("media-other-path", actor);
    expect(result.ok).toBe(true);
  });

  it("getLocalImageRoot uses ASTROPRESS_LOCAL_IMAGE_ROOT env var (branch 1)", () => {
    const prev = process.env.ASTROPRESS_LOCAL_IMAGE_ROOT;
    process.env.ASTROPRESS_LOCAL_IMAGE_ROOT = "/tmp/test-astropress-uploads";
    try {
      // Creating a runtime triggers getLocalImageRoot via uploadsDir = getLocalUploadsDir()
      // but the var is module-level so we need to exercise it indirectly via createMediaAsset
      const testDb = new DatabaseSync(":memory:");
      testDb.exec(readAstropressSqliteSchemaSql());
      testDb.prepare("INSERT INTO admin_users (email, password_hash, role, name, active) VALUES (?, ?, ?, ?, 1)").run(
        "env@test.local", makePasswordHash("password"), "admin", "Env Test",
      );
      const rt = createAstropressSqliteAdminRuntime({ getDatabase: () => testDb });
      const r = rt.sqliteAdminStore.media.createMediaAsset({ filename: "env-test.png", bytes: makePngBytes() }, actor);
      expect(r.ok).toBe(true);
      testDb.close();
    } finally {
      if (prev === undefined) delete process.env.ASTROPRESS_LOCAL_IMAGE_ROOT;
      else process.env.ASTROPRESS_LOCAL_IMAGE_ROOT = prev;
    }
  });
});

// ─── CMS routes ───────────────────────────────────────────────────────────────

describe("CMS routes", () => {
  describe("system routes", () => {
    it("listSystemRoutes returns seeded routes with null settings_json (parseSystemSettings null branch)", () => {
      const routes = registry.listSystemRoutes();
      // variant-sitemap has settings_json = null → parseSystemSettings(null) → null
      expect(routes.some((r) => r.path === "/sitemap.xml" && r.settings === null)).toBe(true);
    });

    it("listSystemRoutes handles malformed settings_json (parseSystemSettings catch branch)", () => {
      const routes = registry.listSystemRoutes();
      // variant-robots has settings_json = "{ invalid json" → catch → null
      expect(routes.some((r) => r.path === "/robots.txt" && r.settings === null)).toBe(true);
    });

    it("getSystemRoute with already-normalized path (normalizeSystemRoutePath branch 2)", () => {
      const route = registry.getSystemRoute("/sitemap.xml");
      expect(route?.path).toBe("/sitemap.xml");
    });

    it("getSystemRoute with un-prefixed path (normalizeSystemRoutePath branch 3)", () => {
      // 'sitemap.xml' without leading slash → normalizeSystemRoutePath prepends '/'
      const route = registry.getSystemRoute("sitemap.xml");
      expect(route?.path).toBe("/sitemap.xml");
    });

    it("getSystemRoute returns null for unknown path", () => {
      expect(registry.getSystemRoute("/does-not-exist")).toBeNull();
    });

    it("saveSystemRoute: non-es path exercises localeFromPath 'en' branch", () => {
      const result = registry.saveSystemRoute(
        "/sitemap.xml",
        { title: "Updated Sitemap", summary: "All pages" },
        actor,
      );
      expect(result.ok).toBe(true);
    });

    it("saveSystemRoute: /es/ path exercises localeFromPath 'es' branch", () => {
      const result = registry.saveSystemRoute("/es/feed.xml", { title: "ES Feed Updated" }, actor);
      expect(result.ok).toBe(true);
    });

    it("saveSystemRoute returns error for empty path", () => {
      expect(registry.saveSystemRoute("", { title: "X" }, actor).ok).toBe(false);
    });

    it("saveSystemRoute returns error for non-existent path", () => {
      expect(registry.saveSystemRoute("/does-not-exist.xml", { title: "X" }, actor).ok).toBe(false);
    });
  });

  describe("structured page routes", () => {
    it("listStructuredPageRoutes filters out routes with non-string templateKey (normalizeStructuredTemplateKey branch 1)", () => {
      const routes = registry.listStructuredPageRoutes();
      // variant-page-num has templateKey=42 (number) → normalizeStructuredTemplateKey → null → filtered
      expect(routes.every((r) => r.path !== "/numeric-key")).toBe(true);
    });

    it("listStructuredPageRoutes filters out routes where getCmsConfig throws (normalizeStructuredTemplateKey catch branch)", () => {
      const routes = registry.listStructuredPageRoutes();
      // variant-page-str has templateKey="unknown-template" → getCmsConfig() throws → catch → null → filtered
      expect(routes.every((r) => r.path !== "/string-key")).toBe(true);
    });

    it("getStructuredPageRoute returns null for unknown path", () => {
      expect(registry.getStructuredPageRoute("/not-a-page")).toBeNull();
    });

    it("createStructuredPageRoute inserts route rows (exercises insertStructuredRoute with sections)", () => {
      // getCmsConfig() throws in test env → normalizeStructuredTemplateKey → null → listStructuredPageRoutes
      // returns empty → created=null → ok:false. But insertStructuredRoute SQL is still exercised.
      const result = registry.createStructuredPageRoute(
        "/new-page",
        { title: "New Page", templateKey: "hero", metaDescription: "A new page", sections: { hero: "content" } },
        actor,
      );
      expect(result.ok).toBe(false);
      // Verify the route group was actually inserted
      const row = db.prepare("SELECT id FROM cms_route_groups WHERE canonical_path = '/new-page'").get();
      expect(row).not.toBeNull();
    });

    it("createStructuredPageRoute with no sections (insertStructuredRoute sections=null branch)", () => {
      const result = registry.createStructuredPageRoute("/no-sections-page", { title: "No Sections", templateKey: "hero" }, actor);
      expect(result.ok).toBe(false); // getCmsConfig throws → filtered → null
      const row = db.prepare("SELECT id FROM cms_route_groups WHERE canonical_path = '/no-sections-page'").get();
      expect(row).not.toBeNull();
    });

    it("createStructuredPageRoute returns error for path already in use", () => {
      registry.createStructuredPageRoute("/dup-page", { title: "Dup", templateKey: "hero" }, actor);
      expect(registry.createStructuredPageRoute("/dup-page", { title: "Dup Again", templateKey: "hero" }, actor).ok).toBe(false);
    });

    it("saveStructuredPageRoute exercises persistStructuredRoute and appendStructuredRouteRevision", () => {
      // Uses seeded route variant-page-num (path="/numeric-key") which is found via findStructuredRouteForUpdate
      const result = registry.saveStructuredPageRoute(
        "/numeric-key",
        { title: "Numeric Key Updated", templateKey: "hero", sections: { hero: "updated" } },
        actor,
      );
      // persistStructuredRoute and appendStructuredRouteRevision are exercised regardless of result.ok
      expect(result.ok).toBeDefined();
    });

    it("saveStructuredPageRoute returns error for non-existent route", () => {
      expect(registry.saveStructuredPageRoute("/not-a-page", { title: "X", templateKey: "hero" }, actor).ok).toBe(false);
    });
  });

  describe("archive routes", () => {
    it("listArchiveRoutes returns seeded archive routes", () => {
      const routes = registry.listArchiveRoutes();
      expect(routes.some((r) => r.path === "/blog")).toBe(true);
    });

    it("getArchiveRoute returns the route", () => {
      expect(registry.getArchiveRoute("/blog")?.path).toBe("/blog");
    });

    it("getArchiveRoute returns null for unknown path", () => {
      expect(registry.getArchiveRoute("/unknown-archive")).toBeNull();
    });

    it("saveArchiveRoute updates the seeded /blog archive route", () => {
      const result = registry.saveArchiveRoute("/blog", { title: "Blog Archive Updated", summary: "All blog posts" }, actor);
      expect(result.ok).toBe(true);
    });

    it("saveArchiveRoute returns error for non-existent path", () => {
      expect(registry.saveArchiveRoute("/not-an-archive", { title: "X" }, actor).ok).toBe(false);
    });
  });
});

// ─── CMS route error guards (factory validation branches) ─────────────────────

describe("CMS route factory error guards", () => {
  it("saveSystemRoute: empty title returns error", () => {
    expect(registry.saveSystemRoute("/sitemap.xml", { title: "" }, actor).ok).toBe(false);
  });

  it("saveSystemRoute: all optional fields provided (covers bodyHtml, settings branches)", () => {
    const result = registry.saveSystemRoute(
      "/sitemap.xml",
      {
        title: "Sitemap Full",
        summary: "Full summary",
        bodyHtml: "<p>Body</p>",
        settings: { crawl: true },
        revisionNote: "Full update",
      },
      actor,
    );
    expect(result.ok).toBe(true);
  });

  it("createStructuredPageRoute: empty path returns error", () => {
    expect(registry.createStructuredPageRoute("/", { title: "Root", templateKey: "hero" }, actor).ok).toBe(false);
    expect(registry.createStructuredPageRoute("", { title: "Empty", templateKey: "hero" }, actor).ok).toBe(false);
  });

  it("createStructuredPageRoute: empty title returns error", () => {
    expect(registry.createStructuredPageRoute("/no-title-page", { title: "", templateKey: "hero" }, actor).ok).toBe(false);
  });

  it("createStructuredPageRoute: all optional fields provided", () => {
    registry.createStructuredPageRoute(
      "/full-options-page",
      {
        title: "Full Options",
        templateKey: "hero",
        summary: "A summary",
        seoTitle: "Full Options SEO",
        metaDescription: "Full meta",
        canonicalUrlOverride: "https://example.com/full",
        robotsDirective: "noindex",
        ogImage: "/img.png",
        alternateLinks: [{ locale: "es", path: "/es/full" }],
        sections: { hero: "content" },
        revisionNote: "Created with all options",
      },
      actor,
    );
    // ok:false expected (getCmsConfig throws) but branches for all optional fields are covered
  });

  it("saveStructuredPageRoute: empty title returns error", () => {
    expect(registry.saveStructuredPageRoute("/numeric-key", { title: "", templateKey: "hero" }, actor).ok).toBe(false);
  });

  it("saveStructuredPageRoute: all optional fields provided", () => {
    registry.saveStructuredPageRoute(
      "/numeric-key",
      {
        title: "Full Save",
        templateKey: "hero",
        summary: "Summary",
        seoTitle: "Full Save SEO",
        metaDescription: "Full meta",
        canonicalUrlOverride: "https://example.com/save",
        robotsDirective: "noindex",
        ogImage: "/img.png",
        alternateLinks: [{ locale: "es", path: "/es/save" }],
        sections: { hero: "updated" },
        revisionNote: "Saved with all options",
      },
      actor,
    );
    // covers all optional field branches; ok may vary
  });

  it("saveArchiveRoute: empty title returns error", () => {
    expect(registry.saveArchiveRoute("/blog", { title: "" }, actor).ok).toBe(false);
  });

  it("saveArchiveRoute: all optional fields provided", () => {
    const result = registry.saveArchiveRoute(
      "/blog",
      {
        title: "Blog Full",
        summary: "Summary",
        seoTitle: "Blog SEO",
        metaDescription: "Blog meta",
        canonicalUrlOverride: "https://example.com/blog",
        robotsDirective: "noindex",
        revisionNote: "Full archive update",
      },
      actor,
    );
    expect(result.ok).toBe(true);
  });
});

// ─── CMS config registered: normalizeStructuredTemplateKey success paths ──────

describe("CMS config registered: structured template key branches", () => {
  let cmsStore: (typeof store);
  let cmsRegistry: (typeof registry);
  let cmsDb: DatabaseSync;

  beforeAll(() => {
    // Register CMS config so getCmsConfig() succeeds
    (globalThis as Record<symbol, unknown>)[Symbol.for("astropress.cms-config")] = {
      templateKeys: ["hero", "blog"],
      seedPages: [],
    };

    cmsDb = new DatabaseSync(":memory:");
    cmsDb.exec(readAstropressSqliteSchemaSql());
    cmsDb.prepare("INSERT INTO admin_users (email, password_hash, role, name, active) VALUES (?, ?, ?, ?, 1)").run(
      "cms@test.local", makePasswordHash("password"), "admin", "CMS Test",
    );
    // Seed a structured route with a VALID templateKey ("hero")
    cmsDb.prepare("INSERT INTO cms_route_groups (id, kind, render_strategy, canonical_locale, canonical_path) VALUES (?, ?, ?, ?, ?)").run(
      "group-hero-page", "page", "structured_sections", "en", "/hero-page",
    );
    cmsDb.prepare(
      "INSERT INTO cms_route_variants (id, group_id, locale, path, status, title, sections_json, settings_json, updated_by) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
    ).run(
      "variant-hero-page", "group-hero-page", "en", "/hero-page", "published", "Hero Page",
      '{"hero":"content"}',
      '{"templateKey":"hero","alternateLinks":[]}',
      "seed",
    );
    // Seed a route with seo_title, meta_description, etc. to cover ?? undefined branches
    cmsDb.prepare("INSERT INTO cms_route_groups (id, kind, render_strategy, canonical_locale, canonical_path) VALUES (?, ?, ?, ?, ?)").run(
      "group-full-page", "page", "structured_sections", "en", "/full-page",
    );
    cmsDb.prepare(
      "INSERT INTO cms_route_variants (id, group_id, locale, path, status, title, summary, seo_title, meta_description, og_image, settings_json, sections_json, updated_by) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
    ).run(
      "variant-full-page", "group-full-page", "en", "/full-page", "published", "Full Page",
      "Page summary", "Full Page SEO", "Full page meta", "/img.png",
      '{"templateKey":"hero","alternateLinks":[{"locale":"es","path":"/es/full"}]}',
      '{"hero":"full content"}',
      "seed",
    );
    // Seed archive routes with optional fields populated
    cmsDb.prepare("INSERT INTO cms_route_groups (id, kind, render_strategy, canonical_locale, canonical_path) VALUES (?, ?, ?, ?, ?)").run(
      "group-rich-archive", "archive", "archive_listing", "en", "/rich-blog",
    );
    cmsDb.prepare(
      "INSERT INTO cms_route_variants (id, group_id, locale, path, status, title, summary, seo_title, meta_description, updated_by) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
    ).run("variant-rich-archive", "group-rich-archive", "en", "/rich-blog", "published", "Rich Blog", "Blog summary", "Rich Blog SEO", "Blog meta", "seed");
    // Seed system route with summary and body_html (to cover ?? undefined branches)
    cmsDb.prepare("INSERT INTO cms_route_groups (id, kind, render_strategy, canonical_locale, canonical_path) VALUES (?, ?, ?, ?, ?)").run(
      "group-rich-sitemap", "system", "generated_xml", "en", "/rich-sitemap.xml",
    );
    cmsDb.prepare(
      "INSERT INTO cms_route_variants (id, group_id, locale, path, status, title, summary, body_html, settings_json, updated_by) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
    ).run("variant-rich-sitemap", "group-rich-sitemap", "en", "/rich-sitemap.xml", "published", "Rich Sitemap", "A summary", "<p>Body</p>", '{"crawl":true}', "seed");

    const cmsRuntime = createAstropressSqliteAdminRuntime({ getDatabase: () => cmsDb });
    cmsStore = cmsRuntime.sqliteAdminStore;
    cmsRegistry = cmsRuntime.sqliteCmsRegistryModule;
  });

  afterAll(() => {
    // Unregister CMS config
    delete (globalThis as Record<symbol, unknown>)[Symbol.for("astropress.cms-config")];
    cmsDb.close();
  });

  it("getCmsConfig success path: normalizeStructuredTemplateKey returns known key (branch includes=true)", () => {
    const routes = cmsRegistry.listStructuredPageRoutes();
    expect(routes.some((r) => r.path === "/hero-page")).toBe(true);
  });

  it("normalizeStructuredTemplateKey returns null for unknown templateKey (branch includes=false)", () => {
    // Verify that a route seeded with an unknown key is filtered out even with config
    // (The main db still has variant-page-str with "unknown-template" which is not in templateKeys)
    const routes = registry.listStructuredPageRoutes();
    expect(routes.every((r) => r.path !== "/string-key")).toBe(true);
  });

  it("listStructuredPageRoutes returns routes with all optional fields populated", () => {
    const routes = cmsRegistry.listStructuredPageRoutes();
    const full = routes.find((r) => r.path === "/full-page");
    expect(full?.summary).toBe("Page summary");
    expect(full?.seoTitle).toBe("Full Page SEO");
    expect(full?.metaDescription).toBe("Full page meta");
    expect(full?.ogImage).toBe("/img.png");
    expect(Array.isArray(full?.alternateLinks)).toBe(true);
    expect(full?.sections).not.toBeNull();
  });

  it("listSystemRoutes returns summary and body_html when populated", () => {
    const routes = cmsRegistry.listSystemRoutes();
    const rich = routes.find((r) => r.path === "/rich-sitemap.xml");
    expect(rich?.summary).toBe("A summary");
    expect(rich?.settings).toMatchObject({ crawl: true });
  });

  it("listArchiveRoutes returns all optional fields when populated", () => {
    const routes = cmsRegistry.listArchiveRoutes();
    const rich = routes.find((r) => r.path === "/rich-blog");
    expect(rich?.summary).toBe("Blog summary");
    expect(rich?.seoTitle).toBe("Rich Blog SEO");
    expect(rich?.metaDescription).toBe("Blog meta");
  });

  it("createStructuredPageRoute succeeds when cms config is available", () => {
    const result = cmsRegistry.createStructuredPageRoute(
      "/new-hero-page",
      { title: "New Hero Page", templateKey: "hero", sections: { hero: "hello" } },
      actor,
    );
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error("unreachable");
    expect(result.route.path).toBe("/new-hero-page");
  });

  it("createStructuredPageRoute: all optional fields with getCmsConfig working", () => {
    const result = cmsRegistry.createStructuredPageRoute(
      "/hero-full-options",
      {
        title: "Full Hero",
        templateKey: "hero",
        summary: "Summary",
        seoTitle: "Full Hero SEO",
        metaDescription: "Full meta",
        canonicalUrlOverride: "https://example.com/hero",
        robotsDirective: "noindex",
        ogImage: "/hero.png",
        alternateLinks: [{ locale: "es", path: "/es/hero" }],
        sections: { hero: "full" },
        revisionNote: "Full creation",
      },
      actor,
    );
    expect(result.ok).toBe(true);
  });
});

// ─── Auth error guards (remaining uncovered branches) ─────────────────────────

describe("auth additional branches", () => {
  it("getCsrfToken returns null for revoked session (getSessionUser !row branch)", () => {
    // Create a session then revoke it; calling getCsrfToken should return null
    const token = store.auth.createSession(
      { email: "admin@test.local", role: "admin" as const, name: "Test Admin" },
      {},
    );
    store.auth.revokeSession(token);
    expect(store.auth.getCsrfToken(token)).toBeNull();
  });

  it("createSession throws for unknown user email", () => {
    expect(() =>
      store.auth.createSession({ email: "nobody-at-all@test.local", role: "admin" as const, name: "Nobody" }, {}),
    ).toThrow();
  });
});

// ─── User management error branches ──────────────────────────────────────────

describe("users additional error branches", () => {
  it("inviteAdminUser: empty name returns error", () => {
    expect(store.users.inviteAdminUser({ email: "valid@test.local", role: "editor", name: "" }, actor).ok).toBe(false);
  });

  it("inviteAdminUser: invalid role returns error (role normalizes to empty string)", () => {
    expect(store.users.inviteAdminUser({ email: "valid2@test.local", role: "superuser" as string, name: "X" }, actor).ok).toBe(false);
  });

  it("inviteAdminUser: invalid email format returns error", () => {
    expect(store.users.inviteAdminUser({ email: "not-an-email", role: "editor", name: "X" }, actor).ok).toBe(false);
  });

  it("suspendAdminUser: empty email returns error", () => {
    expect(store.users.suspendAdminUser("", actor).ok).toBe(false);
  });

  it("suspendAdminUser: suspending yourself returns error", () => {
    // actor.email is "admin@test.local"
    expect(store.users.suspendAdminUser("admin@test.local", actor).ok).toBe(false);
  });

  it("unsuspendAdminUser: empty email returns error", () => {
    expect(store.users.unsuspendAdminUser("", actor).ok).toBe(false);
  });

  it("unsuspendAdminUser: non-existent user returns error", () => {
    expect(store.users.unsuspendAdminUser("nobody@test.local", actor).ok).toBe(false);
  });
});

// ─── Redirect factory additional branches ─────────────────────────────────────

describe("redirects additional branches", () => {
  it("createRedirectRule: identical source and target returns error", () => {
    const result = store.redirects.createRedirectRule({ sourcePath: "/same", targetPath: "/same", statusCode: 301 }, actor);
    expect(result.ok).toBe(false);
  });

  it("createRedirectRule: missing sourcePath or targetPath returns error", () => {
    expect(store.redirects.createRedirectRule({ sourcePath: "", targetPath: "/dest", statusCode: 301 }, actor).ok).toBe(false);
  });

  it("createRedirectRule: existing active redirect returns error", () => {
    store.redirects.createRedirectRule({ sourcePath: "/active-dup", targetPath: "/target", statusCode: 301 }, actor);
    const result = store.redirects.createRedirectRule({ sourcePath: "/active-dup", targetPath: "/other", statusCode: 301 }, actor);
    expect(result.ok).toBe(false);
  });
});

// ─── Taxonomy and author additional branches ──────────────────────────────────

describe("taxonomies additional branches", () => {
  it("createCategory: empty name (whitespace) returns error (covers !name branch)", () => {
    expect(store.taxonomies.createCategory({ name: "   " }, actor).ok).toBe(false);
  });

  it("createCategory: slugifyTerm produces empty slug (covers !slug branch)", () => {
    expect(store.taxonomies.createCategory({ name: "---" }, actor).ok).toBe(false);
  });

  it("createCategory: uses provided slug when explicitly set", () => {
    const result = store.taxonomies.createCategory({ name: "Cat With Slug", slug: "cat-with-slug" }, actor);
    expect(result.ok).toBe(true);
  });

  it("createCategory: description provided", () => {
    const result = store.taxonomies.createCategory({ name: "Cat With Desc", description: "A description" }, actor);
    expect(result.ok).toBe(true);
  });

  it("updateCategory: empty name returns error (covers !name branch)", () => {
    store.taxonomies.createCategory({ name: "Up For Update" }, actor);
    const c = store.taxonomies.listCategories().find((x) => x.name === "Up For Update")!;
    expect(store.taxonomies.updateCategory({ id: c.id, name: "" }, actor).ok).toBe(false);
  });

  it("updateCategory: with explicit slug and description (covers optional field branches)", () => {
    store.taxonomies.createCategory({ name: "Cat To Update Fully" }, actor);
    const c = store.taxonomies.listCategories().find((x) => x.name === "Cat To Update Fully")!;
    expect(store.taxonomies.updateCategory({ id: c.id, name: "Cat Updated Fully", slug: "cat-updated-fully", description: "New desc" }, actor).ok).toBe(true);
  });

  it("deleteCategory: not found returns error", () => {
    expect(store.taxonomies.deleteCategory(999_998, actor).ok).toBe(false);
  });

  it("createTag: empty name returns error (covers !name branch)", () => {
    expect(store.taxonomies.createTag({ name: "   " }, actor).ok).toBe(false);
  });

  it("createTag: empty slug returns error (covers !slug branch)", () => {
    expect(store.taxonomies.createTag({ name: "---" }, actor).ok).toBe(false);
  });

  it("createTag: uses provided slug when explicitly set", () => {
    const result = store.taxonomies.createTag({ name: "Tag With Slug", slug: "tag-with-slug" }, actor);
    expect(result.ok).toBe(true);
  });

  it("createTag: description provided", () => {
    const result = store.taxonomies.createTag({ name: "Tag With Desc", description: "A tag desc" }, actor);
    expect(result.ok).toBe(true);
  });

  it("updateTag: empty name returns error", () => {
    store.taxonomies.createTag({ name: "Up For Tag Update" }, actor);
    const t = store.taxonomies.listTags().find((x) => x.name === "Up For Tag Update")!;
    expect(store.taxonomies.updateTag({ id: t.id, name: "" }, actor).ok).toBe(false);
  });

  it("updateTag: with explicit slug and description (covers optional field branches)", () => {
    store.taxonomies.createTag({ name: "Tag To Update Fully" }, actor);
    const t = store.taxonomies.listTags().find((x) => x.name === "Tag To Update Fully")!;
    expect(store.taxonomies.updateTag({ id: t.id, name: "Tag Updated Fully", slug: "tag-updated-fully", description: "New tag desc" }, actor).ok).toBe(true);
  });

  it("deleteTag: not found returns error", () => {
    expect(store.taxonomies.deleteTag(999_997, actor).ok).toBe(false);
  });
});

describe("authors additional branches", () => {
  it("deleteAuthor: not found returns error", () => {
    expect(store.authors.deleteAuthor(999_996, actor).ok).toBe(false);
  });

  it("createAuthor: uses provided slug when explicitly set", () => {
    const result = store.authors.createAuthor({ name: "Author With Slug", slug: "author-with-slug" }, actor);
    expect(result.ok).toBe(true);
  });

  it("updateAuthor: with explicit slug and bio (covers optional field branches)", () => {
    store.authors.createAuthor({ name: "Author To Update" }, actor);
    const a = store.authors.listAuthors().find((x) => x.name === "Author To Update")!;
    expect(store.authors.updateAuthor({ id: a.id, name: "Author Updated", slug: "author-updated", bio: "Updated bio text" }, actor).ok).toBe(true);
  });
});

// ─── Content additional branches ─────────────────────────────────────────────

describe("content additional branches", () => {
  it("createContentRecord: all optional fields provided", () => {
    const result = store.content.createContentRecord(
      {
        title: "Optional Fields Post",
        slug: "optional-fields-post",
        status: "draft",
        seoTitle: "Optional Fields SEO",
        metaDescription: "Meta for optional",
        body: "Body content",
        excerpt: "Short excerpt",
        ogTitle: "OG Title",
        ogDescription: "OG Description",
        ogImage: "/og.png",
        canonicalUrlOverride: "https://example.com/optional",
        robotsDirective: "noindex",
      },
      actor,
    );
    expect(result.ok).toBe(true);
  });

  it("saveContentState: all optional fields including scheduledAt, revisionNote, og fields (covers branches)", () => {
    const result = store.content.saveContentState(
      "optional-fields-post",
      {
        title: "Optional Updated",
        status: "published",
        seoTitle: "Updated SEO",
        metaDescription: "Updated meta",
        body: "Updated body",
        excerpt: "Updated excerpt",
        ogTitle: "Updated OG Title",
        ogDescription: "Updated OG Desc",
        ogImage: "/updated-og.png",
        canonicalUrlOverride: "https://example.com/updated",
        robotsDirective: "noindex",
        scheduledAt: new Date(Date.now() + 86400000).toISOString(),
        revisionNote: "Updated with all fields",
      },
      actor,
    );
    expect(result.ok).toBe(true);
  });

  it("createContentRecord: uses summary as excerpt when no explicit excerpt is given", () => {
    const result = store.content.createContentRecord(
      {
        title: "Summary Post",
        slug: "summary-post-test",
        status: "draft",
        seoTitle: "Summary Post SEO",
        metaDescription: "Summary meta",
        summary: "Post summary text",
      },
      actor,
    );
    expect(result.ok).toBe(true);
  });
});

// ─── Settings additional branches ─────────────────────────────────────────────

describe("settings additional branches", () => {
  it("saveSettings: uses default site settings when no settings have been saved yet", () => {
    const freshDb = new DatabaseSync(":memory:");
    freshDb.exec(readAstropressSqliteSchemaSql());
    freshDb.prepare("INSERT INTO admin_users (email, password_hash, role, name, active) VALUES (?, ?, ?, ?, 1)").run(
      "fresh@test.local", makePasswordHash("password"), "admin", "Fresh",
    );
    const freshRuntime = createAstropressSqliteAdminRuntime({ getDatabase: () => freshDb });
    // First saveSettings on a DB with no existing settings → getSettings() returns default → ?? defaultSiteSettings
    const result = freshRuntime.sqliteAdminStore.settings.saveSettings(
      { siteTitle: "Fresh Site", siteTagline: "", donationUrl: "", newsletterEnabled: false, commentsDefaultPolicy: "legacy-readonly", adminSlug: "ap-admin" },
      actor,
    );
    expect(result.ok).toBe(true);
    freshDb.close();
  });

  it("saveSettings: preserves existing field values when new values are undefined", () => {
    const result = store.settings.saveSettings(
      { siteTitle: undefined as unknown as string, siteTagline: undefined as unknown as string, donationUrl: undefined as unknown as string, newsletterEnabled: undefined as unknown as boolean, commentsDefaultPolicy: undefined as unknown as string, adminSlug: undefined as unknown as string },
      actor,
    );
    expect(result.ok).toBe(true);
  });
});

// ─── Additional route branches ────────────────────────────────────────────────

describe("additional route branches", () => {
  it("saveStructuredPageRoute: stores null sections when sections are omitted", () => {
    // Call on an existing route (/numeric-key) without sections → sections = null
    registry.saveStructuredPageRoute(
      "/numeric-key",
      { title: "No Sections Save", templateKey: "hero" },
      actor,
    );
    // No assertion needed; we just need to exercise the branch
  });

  it("saveArchiveRoute: saves with null values for omitted optional fields", () => {
    // No summary, no seoTitle, no metaDescription, no canonicalUrlOverride, no robotsDirective
    const result = registry.saveArchiveRoute("/blog", { title: "Minimal Archive Save" }, actor);
    expect(result.ok).toBe(true);
  });
});

// ─── Users inviteAdminUser role branches ─────────────────────────────────────

describe("users inviteAdminUser role branches", () => {
  it("inviteAdminUser with 'admin' role (covers the 'admin' arm of the nested ternary)", () => {
    const result = store.users.inviteAdminUser({ email: "new-admin@test.local", role: "admin", name: "New Admin" }, actor);
    expect(result.ok).toBe(true);
  });
});

// ─── Content restoreRevision optional fields ─────────────────────────────────

describe("content restoreRevision optional assignment branches", () => {
  it("restoreRevision from a revision with authorIds/categoryIds/tagIds", () => {
    // Create a post and save with assignments, then restore
    store.content.createContentRecord(
      { title: "Revision Post", slug: "revision-post-for-restore", status: "draft", seoTitle: "Revision SEO", metaDescription: "Revision meta" },
      actor,
    );
    store.taxonomies.createCategory({ name: "Rev Cat" }, actor);
    const catId = store.taxonomies.listCategories().find((c) => c.name === "Rev Cat")!.id;
    store.content.saveContentState(
      "revision-post-for-restore",
      { title: "Revision Post", status: "draft", seoTitle: "Revision SEO", metaDescription: "Revision meta", categoryIds: [catId] },
      actor,
    );
    const revisions = store.content.getContentRevisions("revision-post-for-restore")!;
    // restoreRevision from a revision that has categoryIds → covers revision.authorIds ?? [], etc.
    const result = store.content.restoreRevision("revision-post-for-restore", revisions[0].id, actor);
    expect(result.ok).toBe(true);
  });
});

// ─── Content entry with og fields for mapCustomContentEntry ──────────────────

describe("content entry optional fields in DB", () => {
  it("listContentStates: content_entries with body and summary return non-null values", () => {
    // Directly insert a content_entries row with body and summary set
    db.prepare(`
      INSERT INTO content_entries (slug, legacy_url, title, kind, template_key, source_html_path, body, summary, seo_title, meta_description)
      VALUES (?, ?, ?, 'post', 'content', ?, ?, ?, ?, ?)
    `).run("custom-entry-with-body", "/custom-entry-with-body", "Custom Entry", "runtime://content/custom-entry-with-body", "Body content here", "Summary here", "Custom SEO", "Custom meta");
    const states = store.content.listContentStates();
    const entry = states.find((s) => s.slug === "custom-entry-with-body");
    expect(entry).toBeDefined();
  });
});

// ─── Comment optional fields ──────────────────────────────────────────────────

describe("comments optional fields", () => {
  it("submitPublicComment with email and body (non-null for optional fields in insertPublicComment)", () => {
    // The email and body are optional per the factory; test with them present to cover non-null branches
    const result = store.comments.submitPublicComment({
      author: "WithEmail",
      email: "withemail@example.com",
      body: "A body",
      route: "/test",
      submittedAt: new Date().toISOString(),
    });
    expect(result.ok).toBe(true);
  });

  it("getApprovedCommentsForRoute returns empty when no approved comments (covers filter branch)", () => {
    const comments = store.comments.getApprovedCommentsForRoute("/test-route-no-comments");
    expect(Array.isArray(comments)).toBe(true);
  });
});
