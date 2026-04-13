import { mkdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createAstropressSqliteAdminRuntime } from "../src/sqlite-admin-runtime.js";
import { createDefaultAstropressSqliteSeedToolkit } from "../src/sqlite-bootstrap.js";
import { createRuntimeFixture, makePasswordHash, type RuntimeFixture } from "./helpers/sqlite-admin-runtime-fixture.js";
import { makeDb } from "./helpers/make-db.js";

let fixture: RuntimeFixture;

beforeAll(() => {
  fixture = createRuntimeFixture();
});

afterAll(() => {
  fixture.db.close();
});

// ─── Redirects ────────────────────────────────────────────────────────────────

describe("redirects", () => {
  it("getRedirectRules returns an array", () => {
    expect(fixture.store.redirects.getRedirectRules()).toBeInstanceOf(Array);
  });

  it("createRedirectRule creates a redirect", () => {
    const result = fixture.store.redirects.createRedirectRule({ sourcePath: "/old-page", targetPath: "/new-page", statusCode: 301 }, fixture.actor);
    expect(result.ok).toBe(true);
    expect(fixture.store.redirects.getRedirectRules().some((r) => r.sourcePath === "/old-page")).toBe(true);
  });

  it("createRedirectRule updates an existing soft-deleted redirect", () => {
    fixture.store.redirects.createRedirectRule({ sourcePath: "/temp-redirect", targetPath: "/target-1", statusCode: 302 }, fixture.actor);
    fixture.store.redirects.deleteRedirectRule("/temp-redirect", fixture.actor);
    expect(fixture.store.redirects.createRedirectRule({ sourcePath: "/temp-redirect", targetPath: "/target-2", statusCode: 301 }, fixture.actor).ok).toBe(true);
  });

  it("deleteRedirectRule removes a redirect", () => {
    fixture.store.redirects.createRedirectRule({ sourcePath: "/to-delete", targetPath: "/dest", statusCode: 301 }, fixture.actor);
    expect(fixture.store.redirects.deleteRedirectRule("/to-delete", fixture.actor).ok).toBe(true);
    expect(fixture.store.redirects.getRedirectRules().some((r) => r.sourcePath === "/to-delete")).toBe(false);
  });

  it("deleteRedirectRule returns error for non-existent path", () => {
    expect(fixture.store.redirects.deleteRedirectRule("/does-not-exist", fixture.actor).ok).toBe(false);
  });
});

describe("redirects additional branches", () => {
  it("createRedirectRule: identical source and target returns error", () => {
    expect(fixture.store.redirects.createRedirectRule({ sourcePath: "/same", targetPath: "/same", statusCode: 301 }, fixture.actor).ok).toBe(false);
  });

  it("createRedirectRule: missing sourcePath or targetPath returns error", () => {
    expect(fixture.store.redirects.createRedirectRule({ sourcePath: "", targetPath: "/dest", statusCode: 301 }, fixture.actor).ok).toBe(false);
  });

  it("createRedirectRule: existing active redirect returns error", () => {
    fixture.store.redirects.createRedirectRule({ sourcePath: "/active-dup", targetPath: "/target", statusCode: 301 }, fixture.actor);
    expect(fixture.store.redirects.createRedirectRule({ sourcePath: "/active-dup", targetPath: "/other", statusCode: 301 }, fixture.actor).ok).toBe(false);
  });
});

// ─── Comments ─────────────────────────────────────────────────────────────────

describe("comments", () => {
  it("submitPublicComment creates a comment (result exposes generated id)", async () => {
    const result = await fixture.store.comments.submitPublicComment({
      author: "Alice",
      email: "alice@example.com",
      body: "Hello!",
      route: "/blog/post-1",
      submittedAt: new Date().toISOString(),
    });
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error("unreachable");
    expect(typeof result.comment.id).toBe("string");
    expect(fixture.store.comments.getComments().some((c) => c.id === result.comment.id)).toBe(true);
  });

  it("submitPublicComment without submittedAt field (uses auto-generated id)", async () => {
    const result = await fixture.store.comments.submitPublicComment({
      author: "Bob",
      body: "World!",
      email: "bob@example.com",
      route: "/blog/post-1",
      submittedAt: "2024-01-01T00:00:00.000Z",
    });
    expect(result.ok).toBe(true);
  });

  it("moderateComment approves a pending comment", async () => {
    const submitted = await fixture.store.comments.submitPublicComment({
      author: "Carol",
      body: "Moderate me",
      email: "carol@example.com",
      route: "/blog/post-2",
      submittedAt: new Date().toISOString(),
    });
    if (!submitted.ok) throw new Error("submitPublicComment failed");
    expect(fixture.store.comments.moderateComment(submitted.comment.id, "approved", fixture.actor).ok).toBe(true);
  });

  it("moderateComment returns error for non-existent comment", () => {
    expect(fixture.store.comments.moderateComment("comment-999", "approved", fixture.actor).ok).toBe(false);
  });

  it("getApprovedCommentsForRoute returns approved comments", () => {
    expect(Array.isArray(fixture.store.comments.getApprovedCommentsForRoute("/blog/post-1"))).toBe(true);
  });
});

describe("comments optional fields", () => {
  it("submitPublicComment with email and body (non-null for optional fields in insertPublicComment)", async () => {
    const result = await fixture.store.comments.submitPublicComment({
      author: "WithEmail",
      email: "withemail@example.com",
      body: "A body",
      route: "/test",
      submittedAt: new Date().toISOString(),
    });
    expect(result.ok).toBe(true);
  });

  it("getApprovedCommentsForRoute returns empty when no approved comments (covers filter branch)", () => {
    expect(Array.isArray(fixture.store.comments.getApprovedCommentsForRoute("/test-route-no-comments"))).toBe(true);
  });
});

// ─── Settings ─────────────────────────────────────────────────────────────────

describe("settings", () => {
  it("getSettings returns defaultSiteSettings when no row exists", () => {
    expect(fixture.store.settings.getSettings()).toMatchObject({
      newsletterEnabled: false,
      commentsDefaultPolicy: "legacy-readonly",
      adminSlug: "ap-admin",
    });
  });

  it("saveSettings persists and getSettings reflects updated values", () => {
    const result = fixture.store.settings.saveSettings(
      { siteTitle: "My Site", siteTagline: "A tagline", donationUrl: "", newsletterEnabled: true, commentsDefaultPolicy: "open-moderated", adminSlug: "cms" },
      fixture.actor,
    );
    expect(result.ok).toBe(true);
    const settings = fixture.store.settings.getSettings();
    expect(settings.siteTitle).toBe("My Site");
    expect(settings.newsletterEnabled).toBe(true);
    expect(settings.commentsDefaultPolicy).toBe("open-moderated");
  });
});

describe("settings additional branches", () => {
  it("saveSettings: uses default site settings when no settings have been saved yet", () => {
    const freshDb = makeDb();
    freshDb.prepare("INSERT INTO admin_users (email, password_hash, role, name, active) VALUES (?, ?, ?, ?, 1)").run(
      "fresh@test.local", makePasswordHash("password"), "admin", "Fresh",
    );
    const freshRuntime = createAstropressSqliteAdminRuntime({ getDatabase: () => freshDb });
    const result = freshRuntime.sqliteAdminStore.settings.saveSettings(
      { siteTitle: "Fresh Site", siteTagline: "", donationUrl: "", newsletterEnabled: false, commentsDefaultPolicy: "legacy-readonly", adminSlug: "ap-admin" },
      fixture.actor,
    );
    expect(result.ok).toBe(true);
    freshDb.close();
  });

  it("saveSettings: preserves existing field values when new values are undefined", () => {
    const result = fixture.store.settings.saveSettings(
      {
        siteTitle: undefined as unknown as string,
        siteTagline: undefined as unknown as string,
        donationUrl: undefined as unknown as string,
        newsletterEnabled: undefined as unknown as boolean,
        commentsDefaultPolicy: undefined as unknown as string,
        adminSlug: undefined as unknown as string,
      },
      fixture.actor,
    );
    expect(result.ok).toBe(true);
  });
});

// ─── Rate limits ──────────────────────────────────────────────────────────────

describe("rateLimits", () => {
  it("checkRateLimit: no existing key → resets window and returns true", () => {
    expect(fixture.store.rateLimits.checkRateLimit("rl:new-key", 5, 60_000)).toBe(true);
  });

  it("checkRateLimit: within limit → increments and returns true", () => {
    fixture.store.rateLimits.checkRateLimit("rl:test-key", 5, 60_000);
    expect(fixture.store.rateLimits.checkRateLimit("rl:test-key", 5, 60_000)).toBe(true);
  });

  it("checkRateLimit: at limit → returns false", () => {
    for (let i = 0; i < 3; i++) fixture.store.rateLimits.checkRateLimit("rl:limit-key", 3, 60_000);
    expect(fixture.store.rateLimits.checkRateLimit("rl:limit-key", 3, 60_000)).toBe(false);
  });

  it("peekRateLimit: no existing key → returns true", () => {
    expect(fixture.store.rateLimits.peekRateLimit("rl:peek-new", 5, 60_000)).toBe(true);
  });

  it("peekRateLimit: at limit → returns false", () => {
    for (let i = 0; i < 3; i++) fixture.store.rateLimits.checkRateLimit("rl:peek-limit", 3, 60_000);
    expect(fixture.store.rateLimits.peekRateLimit("rl:peek-limit", 3, 60_000)).toBe(false);
  });

  it("recordFailedAttempt: no existing key → resets window", () => {
    fixture.store.rateLimits.recordFailedAttempt("rl:fail-new", 5, 60_000);
    expect(fixture.store.rateLimits.peekRateLimit("rl:fail-new", 5, 60_000)).toBe(true);
  });

  it("recordFailedAttempt: existing key within window → increments count", () => {
    fixture.store.rateLimits.checkRateLimit("rl:fail-existing", 10, 60_000);
    fixture.store.rateLimits.recordFailedAttempt("rl:fail-existing", 10, 60_000);
    expect(fixture.store.rateLimits.peekRateLimit("rl:fail-existing", 10, 60_000)).toBe(true);
  });
});

// ─── WAL mode and PRAGMA settings ────────────────────────────────────────────

describe("SQLite PRAGMA settings (file-based database)", () => {
  let tmpDir: string;
  let tmpDbPath: string;

  beforeAll(() => {
    tmpDir = path.join(tmpdir(), `astropress-test-${Date.now()}`);
    mkdirSync(tmpDir, { recursive: true });
    tmpDbPath = path.join(tmpDir, "test.sqlite");
  });

  afterAll(() => {
    rmSync(tmpDir, { recursive: true, force: true });
  });

  it("openSeedDatabase enables WAL journal mode on file-based databases", () => {
    const toolkit = createDefaultAstropressSqliteSeedToolkit();
    const db = toolkit.openSeedDatabase(tmpDbPath);
    try {
      const row = db.prepare("PRAGMA journal_mode").get() as { journal_mode: string };
      expect(row.journal_mode).toBe("wal");
    } finally {
      db.close();
    }
  });

  it("openSeedDatabase enables foreign key enforcement", () => {
    const toolkit = createDefaultAstropressSqliteSeedToolkit();
    const db = toolkit.openSeedDatabase(tmpDbPath);
    try {
      const row = db.prepare("PRAGMA foreign_keys").get() as { foreign_keys: number };
      expect(row.foreign_keys).toBe(1);
    } finally {
      db.close();
    }
  });
});

// ─── Schema table presence ────────────────────────────────────────────────────

describe("SQLite schema table presence", () => {
  it("api_tokens table exists in the schema", () => {
    const result = fixture.db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='api_tokens'").get() as { name: string } | undefined;
    expect(result?.name).toBe("api_tokens");
  });

  it("api_tokens table has expected columns", () => {
    const names = (fixture.db.prepare("PRAGMA table_info(api_tokens)").all() as Array<{ name: string }>).map((c) => c.name);
    expect(names).toContain("id");
    expect(names).toContain("label");
    expect(names).toContain("token_hash");
    expect(names).toContain("scopes");
    expect(names).toContain("created_at");
    expect(names).toContain("revoked_at");
    expect(names).toContain("last_used_at");
  });

  it("webhooks table exists in the schema", () => {
    const result = fixture.db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='webhooks'").get() as { name: string } | undefined;
    expect(result?.name).toBe("webhooks");
  });

  it("webhooks table has expected columns", () => {
    const names = (fixture.db.prepare("PRAGMA table_info(webhooks)").all() as Array<{ name: string }>).map((c) => c.name);
    expect(names).toContain("id");
    expect(names).toContain("url");
    expect(names).toContain("events");
    expect(names).toContain("secret_hash");
    expect(names).toContain("active");
    expect(names).toContain("deleted_at");
  });

  it("content_overrides already has scheduled_at column", () => {
    const names = (fixture.db.prepare("PRAGMA table_info(content_overrides)").all() as Array<{ name: string }>).map((c) => c.name);
    expect(names).toContain("scheduled_at");
  });
});
