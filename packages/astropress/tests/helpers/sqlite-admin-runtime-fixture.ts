import { pbkdf2Sync, randomBytes } from "node:crypto";
import { DatabaseSync } from "node:sqlite";
import { createAstropressSqliteAdminRuntime } from "../../src/sqlite-admin-runtime.js";
import { readAstropressSqliteSchemaSql } from "../../src/sqlite-bootstrap.js";

export type RuntimeFixture = {
  db: DatabaseSync;
  runtime: ReturnType<typeof createAstropressSqliteAdminRuntime>;
  store: ReturnType<typeof createAstropressSqliteAdminRuntime>["sqliteAdminStore"];
  registry: ReturnType<typeof createAstropressSqliteAdminRuntime>["sqliteCmsRegistryModule"];
  actor: { email: string; role: "admin"; name: string };
};

export function makePasswordHash(password: string): string {
  const iterations = 100_000;
  const salt = randomBytes(32);
  const derived = pbkdf2Sync(password, salt, iterations, 64, "sha256");
  return `${iterations}$${salt.toString("base64")}$${derived.toString("base64")}`;
}

/**
 * Creates a fresh in-memory SQLite runtime with a full set of seed data.
 * Each test file should call this once inside a `beforeAll` so that tests
 * within a file share one DB while files remain isolated from each other.
 */
export function createRuntimeFixture(): RuntimeFixture {
  const db = new DatabaseSync(":memory:");
  db.exec(readAstropressSqliteSchemaSql());

  // Active admin user (correct password)
  db.prepare("INSERT INTO admin_users (email, password_hash, role, name, active) VALUES (?, ?, ?, ?, 1)").run(
    "admin@test.local", makePasswordHash("correct-password"), "admin", "Test Admin",
  );

  // Suspended user (active=0)
  db.prepare("INSERT INTO admin_users (email, password_hash, role, name, active) VALUES (?, ?, ?, ?, 0)").run(
    "suspended@test.local", makePasswordHash("x"), "editor", "Suspended User",
  );

  // User with pending invite (for listAdminUsers invited-status branch)
  db.prepare("INSERT INTO admin_users (email, password_hash, role, name, active) VALUES (?, ?, ?, ?, 1)").run(
    "invited@test.local", makePasswordHash("x"), "editor", "Invited User",
  );
  const invitedUserId = (
    db.prepare("SELECT id FROM admin_users WHERE email = 'invited@test.local'").get() as { id: number }
  ).id;
  db.prepare("INSERT INTO user_invites (id, user_id, token_hash, expires_at, invited_by) VALUES (?, ?, ?, datetime('now', '+7 days'), ?)").run(
    "invite-1", invitedUserId, "fake-invite-token-hash", "admin@test.local",
  );

  // User with malformed password hash (for verifyPasswordSync malformed-hash branch)
  db.prepare("INSERT INTO admin_users (email, password_hash, role, name, active) VALUES (?, ?, ?, ?, 1)").run(
    "malformed@test.local", "not-a-valid-hash", "editor", "Malformed Hash User",
  );

  // System route group + variant (null settings_json)
  db.prepare("INSERT INTO cms_route_groups (id, kind, render_strategy, canonical_locale, canonical_path) VALUES (?, ?, ?, ?, ?)").run(
    "group-sitemap", "system", "generated_xml", "en", "/sitemap.xml",
  );
  db.prepare("INSERT INTO cms_route_variants (id, group_id, locale, path, status, title, settings_json, updated_by) VALUES (?, ?, ?, ?, ?, ?, ?, ?)").run(
    "variant-sitemap", "group-sitemap", "en", "/sitemap.xml", "published", "Sitemap", null, "seed",
  );

  // System route with Spanish path (for localeFromPath "es" branch)
  db.prepare("INSERT INTO cms_route_groups (id, kind, render_strategy, canonical_locale, canonical_path) VALUES (?, ?, ?, ?, ?)").run(
    "group-es-feed", "system", "generated_xml", "es", "/es/feed.xml",
  );
  db.prepare("INSERT INTO cms_route_variants (id, group_id, locale, path, status, title, settings_json, updated_by) VALUES (?, ?, ?, ?, ?, ?, ?, ?)").run(
    "variant-es-feed", "group-es-feed", "es", "/es/feed.xml", "published", "ES Feed", null, "seed",
  );

  // System route with malformed settings_json (for parseSystemSettings catch branch)
  db.prepare("INSERT INTO cms_route_groups (id, kind, render_strategy, canonical_locale, canonical_path) VALUES (?, ?, ?, ?, ?)").run(
    "group-robots", "system", "generated_text", "en", "/robots.txt",
  );
  db.prepare("INSERT INTO cms_route_variants (id, group_id, locale, path, status, title, settings_json, updated_by) VALUES (?, ?, ?, ?, ?, ?, ?, ?)").run(
    "variant-robots", "group-robots", "en", "/robots.txt", "published", "Robots", "{ invalid json", "seed",
  );

  // Structured page route with non-string templateKey (normalizeStructuredTemplateKey branch)
  db.prepare("INSERT INTO cms_route_groups (id, kind, render_strategy, canonical_locale, canonical_path) VALUES (?, ?, ?, ?, ?)").run(
    "group-page-num", "page", "structured_sections", "en", "/numeric-key",
  );
  db.prepare("INSERT INTO cms_route_variants (id, group_id, locale, path, status, title, settings_json, updated_by) VALUES (?, ?, ?, ?, ?, ?, ?, ?)").run(
    "variant-page-num", "group-page-num", "en", "/numeric-key", "published", "Numeric Key", '{"templateKey":42}', "seed",
  );

  // Structured page route with string templateKey (normalizeStructuredTemplateKey → try/catch → null)
  db.prepare("INSERT INTO cms_route_groups (id, kind, render_strategy, canonical_locale, canonical_path) VALUES (?, ?, ?, ?, ?)").run(
    "group-page-str", "page", "structured_sections", "en", "/string-key",
  );
  db.prepare("INSERT INTO cms_route_variants (id, group_id, locale, path, status, title, sections_json, settings_json, updated_by) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)").run(
    "variant-page-str", "group-page-str", "en", "/string-key", "published", "String Key",
    '{"hero":"content"}', '{"templateKey":"unknown-template"}', "seed",
  );

  // Archive route for getArchiveRoute tests
  db.prepare("INSERT INTO cms_route_groups (id, kind, render_strategy, canonical_locale, canonical_path) VALUES (?, ?, ?, ?, ?)").run(
    "group-archive", "archive", "archive_listing", "en", "/blog",
  );
  db.prepare("INSERT INTO cms_route_variants (id, group_id, locale, path, status, title, updated_by) VALUES (?, ?, ?, ?, ?, ?, ?)").run(
    "variant-archive", "group-archive", "en", "/blog", "published", "Blog Archive", "seed",
  );

  const runtime = createAstropressSqliteAdminRuntime({ getDatabase: () => db });
  const store = runtime.sqliteAdminStore;
  const registry = runtime.sqliteCmsRegistryModule;
  const actor = { email: "admin@test.local", role: "admin" as const, name: "Test Admin" };

  return { db, runtime, store, registry, actor };
}
