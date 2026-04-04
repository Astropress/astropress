import { createHash, pbkdf2Sync, randomBytes, timingSafeEqual } from "node:crypto";
import { getCmsConfig } from "./config";
import { createAstropressAdminStoreAdapter } from "./admin-store-adapter-factory";
import { createAstropressAuthRepository } from "./auth-repository-factory";
import { createAstropressCmsRegistryModule } from "./host-runtime-factories";
import { createAstropressCmsRouteRegistry } from "./cms-route-registry-factory";
import { createAstropressContentRepository } from "./content-repository-factory";
import { createAstropressLocalMediaRepository } from "./local-media-repository-factory";
import { createAstropressRedirectRepository } from "./redirect-repository-factory";
import { createAstropressTaxonomyRepository } from "./taxonomy-repository-factory";
import { createAstropressAuthorRepository } from "./author-repository-factory";
import { createAstropressCommentRepository } from "./comment-repository-factory";
import { createAstropressSubmissionRepository } from "./submission-repository-factory";
import { createAstropressUserRepository } from "./user-repository-factory";
import { createAstropressSettingsRepository } from "./settings-repository-factory";
import { createAstropressTranslationRepository } from "./translation-repository-factory";
import { createAstropressRateLimitRepository } from "./rate-limit-repository-factory";
import { defaultSiteSettings, type SiteSettings } from "./site-settings";
import type { AdminStoreAdapter, ContentRecord, SessionUser } from "./persistence-types";

type AdminRole = SessionUser["role"];
type ContentStatus = "draft" | "review" | "published" | "archived";
type CommentStatus = "pending" | "approved" | "rejected";
type CommentPolicy = "legacy-readonly" | "disabled" | "open-moderated";

interface Actor extends SessionUser {}

interface PageRecord {
  slug: string;
  legacyUrl: string;
  title: string;
  templateKey: string;
  listingItems: Array<{
    title: string;
    href: string;
    excerpt: string;
    imageSrc: string;
    imageAlt: string;
  }>;
  paginationLinks: Array<{
    label: string;
    href: string;
    current: boolean;
  }>;
  sourceHtmlPath: string;
  updatedAt: string;
  body?: string;
  summary?: string;
  seoTitle?: string;
  metaDescription?: string;
  ogTitle?: string;
  ogDescription?: string;
  ogImage?: string;
  canonicalUrlOverride?: string;
  robotsDirective?: string;
  kind?: string;
  status?: ContentStatus;
}

interface PasswordResetTokenRow {
  id: string;
  user_id: number;
  token_hash: string;
  expires_at: string;
  consumed_at: string | null;
  created_at: string;
}

interface UserInviteRow {
  id: string;
  user_id: number;
  token_hash: string;
  expires_at: string;
  accepted_at: string | null;
  created_at: string;
}

interface SystemRouteRecord {
  path: string;
  title: string;
  summary?: string;
  bodyHtml?: string;
  renderStrategy: "structured_sections" | "generated_text" | "generated_xml";
  settings: Record<string, unknown> | null;
  updatedAt?: string;
}

interface ArchiveRouteRecord {
  path: string;
  title: string;
  summary?: string;
  seoTitle?: string;
  metaDescription?: string;
  canonicalUrlOverride?: string;
  robotsDirective?: string;
  updatedAt?: string;
}

interface StructuredPageRouteRecord {
  path: string;
  title: string;
  summary?: string;
  seoTitle?: string;
  metaDescription?: string;
  canonicalUrlOverride?: string;
  robotsDirective?: string;
  ogImage?: string;
  templateKey: string;
  alternateLinks: Array<{ hreflang: string; href: string }>;
  sections: Record<string, unknown> | null;
  updatedAt?: string;
}

interface SqliteStatementLike {
  run(...params: unknown[]): { changes?: number | bigint };
  get(...params: unknown[]): unknown;
  all(...params: unknown[]): unknown[];
}

export interface AstropressSqliteDatabaseLike {
  prepare(sql: string): SqliteStatementLike;
}

export interface AstropressSqliteAdminRuntimeOptions {
  getDatabase(): AstropressSqliteDatabaseLike;
  sessionTtlMs?: number;
  now?: () => number;
  randomId?: () => string;
}

const DEFAULT_SESSION_TTL_MS = 12 * 60 * 60 * 1000;

function normalizeStructuredTemplateKey(value: unknown): string | null {
  if (typeof value !== "string" || !value) {
    return null;
  }
  try {
    return getCmsConfig().templateKeys.includes(value) ? value : null;
  } catch {
    return null;
  }
}

function localeFromPath(pathname: string) {
  return pathname.startsWith("/es/") ? "es" : "en";
}

function getSeedPageRecords() {
  try {
    return getCmsConfig().seedPages as unknown as PageRecord[];
  } catch {
    return [] as PageRecord[];
  }
}

function hashOpaqueToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

function hashPasswordSync(password: string, iterations = 100_000) {
  const salt = randomBytes(32);
  const derived = pbkdf2Sync(password, salt, iterations, 64, "sha256");
  return `${iterations}$${salt.toString("base64")}$${derived.toString("base64")}`;
}

function verifyPasswordSync(password: string, storedHash: string) {
  const [iterationsText, saltText, hashText] = storedHash.split("$");
  const iterations = Number.parseInt(iterationsText, 10);

  if (!iterations || !saltText || !hashText) {
    return false;
  }

  const salt = Buffer.from(saltText, "base64");
  const expected = Buffer.from(hashText, "base64");
  const actual = pbkdf2Sync(password, salt, iterations, expected.length, "sha256");

  if (actual.length !== expected.length) {
    return false;
  }

  return timingSafeEqual(actual, expected);
}

function normalizePath(value: string) {
  const trimmed = value.trim();
  if (!trimmed) {
    return "";
  }

  return trimmed.startsWith("/") ? trimmed : `/${trimmed}`;
}

function slugifyTerm(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function normalizeContentStatus(input?: string | null): ContentStatus {
  if (input === "draft" || input === "review" || input === "archived" || input === "published") {
    return input;
  }
  return "published";
}

function parseIdList(value: string | null | undefined) {
  if (!value) {
    return [] as number[];
  }

  try {
    const parsed = JSON.parse(value) as unknown;
    if (!Array.isArray(parsed)) {
      return [];
    }
    return parsed.map((entry) => Number(entry)).filter((entry) => Number.isInteger(entry) && entry > 0);
  } catch {
    return [];
  }
}

function serializeIdList(values: number[] | undefined) {
  return JSON.stringify((values ?? []).filter((entry) => Number.isInteger(entry) && entry > 0).sort((a, b) => a - b));
}

function parseSystemSettings(value: string | null) {
  if (!value) {
    return null;
  }

  try {
    const parsed = JSON.parse(value) as unknown;
    return parsed && typeof parsed === "object" ? (parsed as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}

function normalizeSystemRoutePath(pathname: string) {
  const trimmed = pathname.trim();
  if (!trimmed) {
    return "";
  }
  return trimmed.startsWith("/") ? trimmed : `/${trimmed}`;
}

export function createAstropressSqliteAdminRuntime(options: AstropressSqliteAdminRuntimeOptions) {
  const getDb = options.getDatabase;
  const sessionTtlMs = options.sessionTtlMs ?? DEFAULT_SESSION_TTL_MS;
  const now = options.now ?? (() => Date.now());
  const randomId = options.randomId ?? (() => crypto.randomUUID());

  function cleanupExpiredSessions() {
    getDb()
      .prepare(
        `
          UPDATE admin_sessions
          SET revoked_at = CURRENT_TIMESTAMP
          WHERE revoked_at IS NULL
            AND last_active_at < datetime('now', '-12 hours')
        `,
      )
      .run();
  }

  function getCustomContentEntries() {
    return getDb()
      .prepare(
        `
          SELECT slug, legacy_url, title, kind, template_key, source_html_path, updated_at, body, summary,
                 seo_title, meta_description, og_title, og_description, og_image
          FROM content_entries
          ORDER BY datetime(updated_at) DESC, slug ASC
        `,
      )
      .all() as Array<{
      slug: string;
      legacy_url: string;
      title: string;
      kind: string;
      template_key: string;
      source_html_path: string;
      updated_at: string;
      body: string | null;
      summary: string | null;
      seo_title: string | null;
      meta_description: string | null;
      og_title: string | null;
      og_description: string | null;
      og_image: string | null;
    }>;
  }

  function mapCustomContentEntry(row: ReturnType<typeof getCustomContentEntries>[number]): PageRecord {
    return {
      slug: row.slug,
      legacyUrl: row.legacy_url,
      title: row.title,
      templateKey: row.template_key,
      listingItems: [],
      paginationLinks: [],
      sourceHtmlPath: row.source_html_path,
      updatedAt: row.updated_at,
      body: row.body ?? "",
      summary: row.summary ?? "",
      seoTitle: row.seo_title ?? row.title,
      metaDescription: row.meta_description ?? row.summary ?? "",
      ogTitle: row.og_title ?? undefined,
      ogDescription: row.og_description ?? undefined,
      ogImage: row.og_image ?? undefined,
      kind: row.kind,
      status: "draft",
    };
  }

  function getAllContentRecords() {
    return [...getSeedPageRecords(), ...getCustomContentEntries().map((row) => mapCustomContentEntry(row))];
  }

  function toContentRecord(pageRecord: PageRecord): ContentRecord {
    return {
      ...pageRecord,
      status: pageRecord.status ?? "published",
      seoTitle: pageRecord.seoTitle ?? pageRecord.title,
      metaDescription: pageRecord.metaDescription ?? pageRecord.summary ?? "",
    };
  }

  function findPageRecord(slug: string) {
    return getAllContentRecords().find((entry) => entry.slug === slug || entry.legacyUrl === `/${slug}`) ?? null;
  }

  function getContentAssignmentIds(slug: string) {
    const db = getDb();
    const authorIds = (
      db.prepare("SELECT author_id FROM content_authors WHERE slug = ? ORDER BY author_id ASC").all(slug) as Array<{ author_id: number }>
    ).map((row) => row.author_id);
    const categoryIds = (
      db.prepare("SELECT category_id FROM content_categories WHERE slug = ? ORDER BY category_id ASC").all(slug) as Array<{ category_id: number }>
    ).map((row) => row.category_id);
    const tagIds = (
      db.prepare("SELECT tag_id FROM content_tags WHERE slug = ? ORDER BY tag_id ASC").all(slug) as Array<{ tag_id: number }>
    ).map((row) => row.tag_id);

    return { authorIds, categoryIds, tagIds };
  }

  function replaceContentAssignments(
    slug: string,
    input: { authorIds?: number[]; categoryIds?: number[]; tagIds?: number[] },
  ) {
    const db = getDb();
    db.prepare("DELETE FROM content_authors WHERE slug = ?").run(slug);
    db.prepare("DELETE FROM content_categories WHERE slug = ?").run(slug);
    db.prepare("DELETE FROM content_tags WHERE slug = ?").run(slug);

    for (const authorId of input.authorIds ?? []) {
      db.prepare("INSERT OR IGNORE INTO content_authors (slug, author_id) VALUES (?, ?)").run(slug, authorId);
    }
    for (const categoryId of input.categoryIds ?? []) {
      db.prepare("INSERT OR IGNORE INTO content_categories (slug, category_id) VALUES (?, ?)").run(slug, categoryId);
    }
    for (const tagId of input.tagIds ?? []) {
      db.prepare("INSERT OR IGNORE INTO content_tags (slug, tag_id) VALUES (?, ?)").run(slug, tagId);
    }
  }

  function mapPersistedOverride(
    row:
      | {
          title: string;
          status: ContentStatus;
          scheduled_at: string | null;
          body: string | null;
          seo_title: string;
          meta_description: string;
          excerpt: string | null;
          og_title: string | null;
          og_description: string | null;
          og_image: string | null;
          canonical_url_override: string | null;
          robots_directive: string | null;
        }
      | undefined,
  ) {
    if (!row) {
      return null;
    }

    return {
      title: row.title,
      status: row.status,
      scheduledAt: row.scheduled_at ?? undefined,
      body: row.body ?? undefined,
      seoTitle: row.seo_title,
      metaDescription: row.meta_description,
      excerpt: row.excerpt ?? undefined,
      ogTitle: row.og_title ?? undefined,
      ogDescription: row.og_description ?? undefined,
      ogImage: row.og_image ?? undefined,
      canonicalUrlOverride: row.canonical_url_override ?? undefined,
      robotsDirective: row.robots_directive ?? undefined,
    };
  }

  function getPersistedContentOverride(slug: string) {
    const row = getDb()
      .prepare(
        `
          SELECT title, status, body, seo_title, meta_description, excerpt, og_title, og_description, og_image,
                 scheduled_at, canonical_url_override, robots_directive
          FROM content_overrides
          WHERE slug = ?
          LIMIT 1
        `,
      )
      .get(slug) as
      | {
          title: string;
          status: ContentStatus;
          scheduled_at: string | null;
          body: string | null;
          seo_title: string;
          meta_description: string;
          excerpt: string | null;
          og_title: string | null;
          og_description: string | null;
          og_image: string | null;
          canonical_url_override: string | null;
          robots_directive: string | null;
        }
      | undefined;

    return mapPersistedOverride(row);
  }

  function ensureBaselineRevision(pageRecord: PageRecord) {
    const db = getDb();
    db.prepare(
      `
        INSERT INTO content_overrides (
          slug, title, status, body, seo_title, meta_description, excerpt, og_title,
          og_description, og_image, scheduled_at, canonical_url_override, robots_directive, updated_at, updated_by
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, ?)
        ON CONFLICT(slug) DO NOTHING
      `,
    ).run(
      pageRecord.slug,
      pageRecord.title,
      pageRecord.status ?? "published",
      pageRecord.body ?? null,
      pageRecord.seoTitle ?? pageRecord.title,
      pageRecord.metaDescription ?? pageRecord.summary ?? "",
      pageRecord.summary ?? null,
      null,
      null,
      null,
      null,
      null,
      null,
      "seed-import",
    );

    const existing = db
      .prepare("SELECT id FROM content_revisions WHERE slug = ? AND source = 'imported' LIMIT 1")
      .get(pageRecord.slug) as { id: string } | undefined;

    if (existing) {
      return;
    }

    db.prepare(
      `
        INSERT INTO content_revisions (
          id, slug, title, status, scheduled_at, body, seo_title, meta_description, excerpt,
          og_title, og_description, og_image, canonical_url_override, robots_directive, revision_note, source, created_at, created_by
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'imported', ?, ?)
      `,
    ).run(
      `revision-${randomId()}`,
      pageRecord.slug,
      pageRecord.title,
      pageRecord.status ?? "published",
      null,
      pageRecord.body ?? null,
      pageRecord.seoTitle ?? pageRecord.title,
      pageRecord.metaDescription ?? pageRecord.summary ?? "",
      pageRecord.summary ?? null,
      null,
      null,
      null,
      null,
      null,
      null,
      "imported-baseline",
      "seed-import",
    );
  }

  function recordAudit(actor: Actor, action: string, summary: string, resourceType: string, resourceId: string) {
    getDb()
      .prepare(
        `
          INSERT INTO audit_events (user_email, action, resource_type, resource_id, summary)
          VALUES (?, ?, ?, ?, ?)
        `,
      )
      .run(actor.email, action, resourceType, resourceId, summary);
  }

  function getPersistedAuditEvents() {
    const rows = getDb()
      .prepare(
        `
          SELECT id, user_email, action, resource_type, resource_id, summary, created_at
          FROM audit_events
          ORDER BY datetime(created_at) DESC, id DESC
        `,
      )
      .all() as Array<{
      id: number;
      user_email: string;
      action: string;
      resource_type: string;
      resource_id: string | null;
      summary: string;
      created_at: string;
    }>;

    return rows.map((row) => ({
      id: `sqlite-audit-${row.id}`,
      action: row.action,
      actorEmail: row.user_email,
      actorRole: "admin" as const,
      summary: row.summary,
      targetType:
        row.resource_type === "redirect" || row.resource_type === "comment" || row.resource_type === "content"
          ? row.resource_type
          : ("auth" as const),
      targetId: row.resource_id ?? `${row.id}`,
      createdAt: row.created_at,
    }));
  }

  function listAdminUsers() {
    const rows = getDb()
      .prepare(
        `
          SELECT
            id,
            email,
            role,
            name,
            active,
            created_at,
            EXISTS (
              SELECT 1
              FROM user_invites i
              WHERE i.user_id = admin_users.id
                AND i.accepted_at IS NULL
                AND datetime(i.expires_at) > CURRENT_TIMESTAMP
            ) AS has_pending_invite
          FROM admin_users
          ORDER BY CASE role WHEN 'admin' THEN 0 ELSE 1 END, datetime(created_at) ASC, email ASC
        `,
      )
      .all() as Array<{
      id: number;
      email: string;
      role: AdminRole;
      name: string;
      active: number;
      created_at: string;
      has_pending_invite: number;
    }>;

    return rows.map((row) => ({
      id: row.id,
      email: row.email,
      role: row.role,
      name: row.name,
      active: row.active === 1,
      status: (row.active !== 1 ? "suspended" : row.has_pending_invite === 1 ? "invited" : "active") as
        | "active"
        | "invited"
        | "suspended",
      createdAt: row.created_at,
    }));
  }

  const sqliteUserRepository = createAstropressUserRepository({
    listAdminUsers,
    hashPassword: hashPasswordSync,
    hashOpaqueToken,
    findAdminUserByEmail(email) {
      return (getDb().prepare("SELECT id FROM admin_users WHERE email = ? LIMIT 1").get(email) as { id: number } | undefined) ?? null;
    },
    createInvitedAdminUser({ email, passwordHash, role, name }) {
      try {
        getDb()
          .prepare(
            `
              INSERT INTO admin_users (email, password_hash, role, name, active)
              VALUES (?, ?, ?, ?, 1)
            `,
          )
          .run(email, passwordHash, role, name);
        return true;
      } catch {
        return false;
      }
    },
    getAdminUserIdByEmail(email) {
      return (getDb().prepare("SELECT id FROM admin_users WHERE email = ? LIMIT 1").get(email) as { id: number } | undefined)?.id ?? null;
    },
    insertUserInvite({ inviteId, userId, tokenHash, expiresAt, invitedBy }) {
      try {
        getDb()
          .prepare(
            `
              INSERT INTO user_invites (id, user_id, token_hash, expires_at, invited_by)
              VALUES (?, ?, ?, ?, ?)
            `,
          )
          .run(inviteId, userId, tokenHash, expiresAt, invitedBy);
        return true;
      } catch {
        return false;
      }
    },
    setAdminUserActiveState(email, nextActive) {
      const expectedActive = nextActive ? 0 : 1;
      return (
        getDb()
          .prepare("UPDATE admin_users SET active = ? WHERE email = ? AND active = ?")
          .run(nextActive ? 1 : 0, email, expectedActive).changes > 0
      );
    },
    revokeAdminSessionsForEmail(email) {
      getDb()
        .prepare(
          `
            UPDATE admin_sessions
            SET revoked_at = CURRENT_TIMESTAMP
            WHERE user_id = (SELECT id FROM admin_users WHERE email = ?)
              AND revoked_at IS NULL
          `,
        )
        .run(email);
    },
    recordUserAudit({ actor, action, summary, targetId }) {
      recordAudit(actor, action, summary, "auth", targetId);
    },
  });

  const sqliteAuthRepository = createAstropressAuthRepository({
    sessionTtlMs,
    now,
    randomId,
    hashOpaqueToken,
    hashPassword: hashPasswordSync,
    verifyPassword: verifyPasswordSync,
    cleanupExpiredSessions,
    findActiveAdminUserByEmail(email) {
      const row = getDb()
        .prepare(
          `
            SELECT id, email, password_hash, role, name
            FROM admin_users
            WHERE email = ?
              AND active = 1
            LIMIT 1
          `,
        )
        .get(email) as
        | {
            id: number;
            email: string;
            password_hash: string;
            role: AdminRole;
            name: string;
          }
        | undefined;

      if (!row) {
        return null;
      }

      return {
        id: row.id,
        email: row.email,
        passwordHash: row.password_hash,
        role: row.role,
        name: row.name,
      };
    },
    findActiveAdminUserIdByEmail(email) {
      return (
        getDb().prepare("SELECT id FROM admin_users WHERE email = ? AND active = 1 LIMIT 1").get(email) as
          | { id: number }
          | undefined
      )?.id ?? null;
    },
    insertSession({ sessionToken, userId, csrfToken, ipAddress, userAgent }) {
      getDb()
        .prepare(
          `
            INSERT INTO admin_sessions (id, user_id, csrf_token, ip_address, user_agent)
            VALUES (?, ?, ?, ?, ?)
          `,
        )
        .run(sessionToken, userId, csrfToken, ipAddress ?? null, userAgent ?? null);
    },
    findLiveSessionById(sessionToken) {
      const row = getDb()
        .prepare(
          `
            SELECT s.id, s.csrf_token, s.last_active_at, u.email, u.role, u.name
            FROM admin_sessions s
            JOIN admin_users u ON u.id = s.user_id
            WHERE s.id = ?
              AND s.revoked_at IS NULL
              AND u.active = 1
            LIMIT 1
          `,
        )
        .get(sessionToken) as
        | {
            id: string;
            csrf_token: string;
            last_active_at: string;
            email: string;
            role: AdminRole;
            name: string;
          }
        | undefined;

      if (!row) {
        return null;
      }

      return {
        id: row.id,
        csrfToken: row.csrf_token,
        lastActiveAt: row.last_active_at,
        email: row.email,
        role: row.role,
        name: row.name,
      };
    },
    touchSession(sessionToken) {
      getDb().prepare("UPDATE admin_sessions SET last_active_at = CURRENT_TIMESTAMP WHERE id = ?").run(sessionToken);
    },
    revokeSessionById(sessionToken) {
      getDb()
        .prepare(
          `
            UPDATE admin_sessions
            SET revoked_at = CURRENT_TIMESTAMP
            WHERE id = ?
              AND revoked_at IS NULL
          `,
        )
        .run(sessionToken);
    },
    findInviteTokenByHash(tokenHash) {
      const row = getDb()
        .prepare(
          `
            SELECT i.id, i.user_id, i.token_hash, i.expires_at, i.accepted_at, i.created_at,
                   u.email, u.name, u.role, u.active
            FROM user_invites i
            JOIN admin_users u ON u.id = i.user_id
            WHERE i.token_hash = ?
            LIMIT 1
          `,
        )
        .get(tokenHash) as
        | (UserInviteRow & {
            email: string;
            name: string;
            role: AdminRole;
            active: number;
          })
        | undefined;

      if (!row) {
        return null;
      }

      return {
        id: row.id,
        userId: row.user_id,
        email: row.email,
        name: row.name,
        role: row.role,
        expiresAt: row.expires_at,
        acceptedAt: row.accepted_at,
        active: row.active === 1,
      };
    },
    updateAdminUserPassword(userId, passwordHash) {
      getDb().prepare("UPDATE admin_users SET password_hash = ? WHERE id = ?").run(passwordHash, userId);
    },
    acceptInvitesForUser(userId) {
      getDb()
        .prepare(
          `
            UPDATE user_invites
            SET accepted_at = CURRENT_TIMESTAMP
            WHERE user_id = ?
              AND accepted_at IS NULL
          `,
        )
        .run(userId);
    },
    findPasswordResetUserByEmail(email) {
      const row = getDb()
        .prepare(
          `
            SELECT id, email, role, name
            FROM admin_users
            WHERE email = ?
              AND active = 1
            LIMIT 1
          `,
        )
        .get(email) as
        | {
            id: number;
            email: string;
            role: AdminRole;
            name: string;
          }
        | undefined;

      return row ?? null;
    },
    consumePasswordResetTokensForUser(userId) {
      getDb()
        .prepare(
          `
            UPDATE password_reset_tokens
            SET consumed_at = CURRENT_TIMESTAMP
            WHERE user_id = ?
              AND consumed_at IS NULL
          `,
        )
        .run(userId);
    },
    insertPasswordResetToken({ tokenId, userId, tokenHash, expiresAt, requestedBy }) {
      getDb()
        .prepare(
          `
            INSERT INTO password_reset_tokens (id, user_id, token_hash, expires_at, requested_by)
            VALUES (?, ?, ?, ?, ?)
          `,
        )
        .run(tokenId, userId, tokenHash, expiresAt, requestedBy);
    },
    findPasswordResetTokenByHash(tokenHash) {
      const row = getDb()
        .prepare(
          `
            SELECT t.id, t.user_id, t.token_hash, t.expires_at, t.consumed_at, t.created_at,
                   u.email, u.name, u.role, u.active
            FROM password_reset_tokens t
            JOIN admin_users u ON u.id = t.user_id
            WHERE t.token_hash = ?
            LIMIT 1
          `,
        )
        .get(tokenHash) as
        | (PasswordResetTokenRow & {
            email: string;
            name: string;
            role: AdminRole;
            active: number;
          })
        | undefined;

      if (!row) {
        return null;
      }

      return {
        id: row.id,
        userId: row.user_id,
        email: row.email,
        name: row.name,
        role: row.role,
        expiresAt: row.expires_at,
        consumedAt: row.consumed_at,
        active: row.active === 1,
      };
    },
    markPasswordResetTokenConsumed(tokenId) {
      getDb().prepare("UPDATE password_reset_tokens SET consumed_at = CURRENT_TIMESTAMP WHERE id = ?").run(tokenId);
    },
    revokeSessionsForUser(userId) {
      getDb()
        .prepare(
          `
            UPDATE admin_sessions
            SET revoked_at = CURRENT_TIMESTAMP
            WHERE user_id = ?
              AND revoked_at IS NULL
          `,
        )
        .run(userId);
    },
    recordAuthAudit({ actor, action, summary, targetId }) {
      recordAudit(actor, action, summary, "auth", targetId);
    },
  });

  function getRedirectRules() {
    const rows = getDb()
      .prepare(
        `
          SELECT source_path, target_path, status_code
          FROM redirect_rules
          WHERE deleted_at IS NULL
          ORDER BY source_path ASC
        `,
      )
      .all() as Array<{ source_path: string; target_path: string; status_code: 301 | 302 }>;

    return rows.map((row) => ({
      sourcePath: row.source_path,
      targetPath: row.target_path,
      statusCode: row.status_code,
    }));
  }

  const sqliteRedirectRepository = createAstropressRedirectRepository({
    getRedirectRules,
    normalizePath,
    getExistingRedirect(sourcePath) {
      const existing = getDb()
        .prepare("SELECT deleted_at FROM redirect_rules WHERE source_path = ? LIMIT 1")
        .get(sourcePath) as { deleted_at: string | null } | undefined;
      return existing ? { deletedAt: existing.deleted_at } : null;
    },
    upsertRedirect({ sourcePath, targetPath, statusCode, actor }) {
      getDb()
        .prepare(
          `
            INSERT INTO redirect_rules (source_path, target_path, status_code, created_by, deleted_at)
            VALUES (?, ?, ?, ?, NULL)
            ON CONFLICT(source_path) DO UPDATE SET
              target_path = excluded.target_path,
              status_code = excluded.status_code,
              created_by = excluded.created_by,
              deleted_at = NULL
          `,
        )
        .run(sourcePath, targetPath, statusCode, actor.email);
    },
    markRedirectDeleted(sourcePath) {
      return (
        getDb()
          .prepare("UPDATE redirect_rules SET deleted_at = CURRENT_TIMESTAMP WHERE source_path = ? AND deleted_at IS NULL")
          .run(sourcePath).changes > 0
      );
    },
    recordRedirectAudit({ actor, action, summary, targetId }) {
      recordAudit(actor, action, summary, "redirect", targetId);
    },
  });

  function getComments() {
    const rows = getDb()
      .prepare(
        `
          SELECT id, author, email, body, route, status, policy, submitted_at
          FROM comments
          ORDER BY
            CASE status WHEN 'pending' THEN 0 WHEN 'approved' THEN 1 ELSE 2 END,
            datetime(submitted_at) DESC,
            id DESC
        `,
      )
      .all() as Array<{
      id: string;
      author: string;
      email: string | null;
      body: string | null;
      route: string;
      status: CommentStatus;
      policy: CommentPolicy;
      submitted_at: string;
    }>;

    return rows.map((row) => ({
      id: row.id,
      author: row.author,
      email: row.email ?? undefined,
      body: row.body ?? undefined,
      route: row.route,
      status: row.status,
      policy: row.policy,
      submittedAt: row.submitted_at,
    }));
  }

  const sqliteCommentRepository = createAstropressCommentRepository({
    getComments,
    getCommentRoute(commentId) {
      const comment = getDb().prepare("SELECT route FROM comments WHERE id = ? LIMIT 1").get(commentId) as
        | { route: string }
        | undefined;
      return comment?.route ?? null;
    },
    updateCommentStatus(commentId, nextStatus) {
      return getDb().prepare("UPDATE comments SET status = ? WHERE id = ?").run(nextStatus, commentId).changes > 0;
    },
    insertPublicComment(comment) {
      const submittedAt = comment.submittedAt ?? new Date().toISOString();
      getDb()
        .prepare(
          `
            INSERT INTO comments (id, author, email, body, route, status, policy, submitted_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
          `,
        )
        .run(
          comment.id,
          comment.author,
          comment.email ?? null,
          comment.body ?? null,
          comment.route,
          comment.status,
          comment.policy,
          submittedAt,
        );
      return submittedAt;
    },
    recordCommentAudit({ actor, action, summary, targetId }) {
      recordAudit(actor, action, summary, "comment", targetId);
    },
  });

  const sqliteContentRepository = createAstropressContentRepository({
    normalizePath,
    slugifyTerm,
    normalizeContentStatus,
    findContentRecord(slug) {
      const record = findPageRecord(slug);
      return record ? toContentRecord(record) : null;
    },
    listContentRecords() {
      return getAllContentRecords().map((record) => toContentRecord(record));
    },
    getPersistedOverride: getPersistedContentOverride,
    getContentAssignments(slug) {
      return getContentAssignmentIds(slug);
    },
    ensureBaselineRevision(record) {
      ensureBaselineRevision(record as PageRecord);
    },
    listPersistedRevisions(slug) {
      const rows = getDb()
        .prepare(
          `
            SELECT id, slug, title, status, scheduled_at, body, seo_title, meta_description, excerpt, og_title,
                   og_description, og_image, author_ids, category_ids, tag_ids, canonical_url_override, robots_directive, revision_note, source, created_at, created_by
            FROM content_revisions
            WHERE slug = ?
            ORDER BY datetime(created_at) DESC, id DESC
          `,
        )
        .all(slug) as Array<{
        id: string;
        slug: string;
        title: string;
        status: ContentStatus;
        scheduled_at: string | null;
        body: string | null;
        seo_title: string;
        meta_description: string;
        excerpt: string | null;
        og_title: string | null;
        og_description: string | null;
        og_image: string | null;
        author_ids: string | null;
        category_ids: string | null;
        tag_ids: string | null;
        canonical_url_override: string | null;
        robots_directive: string | null;
        revision_note: string | null;
        source: "imported" | "reviewed";
        created_at: string;
        created_by: string | null;
      }>;

      return rows.map((row) => ({
        id: row.id,
        slug: row.slug,
        title: row.title,
        status: row.status,
        scheduledAt: row.scheduled_at ?? undefined,
        body: row.body ?? undefined,
        authorIds: parseIdList(row.author_ids),
        categoryIds: parseIdList(row.category_ids),
        tagIds: parseIdList(row.tag_ids),
        seoTitle: row.seo_title,
        metaDescription: row.meta_description,
        excerpt: row.excerpt ?? undefined,
        ogTitle: row.og_title ?? undefined,
        ogDescription: row.og_description ?? undefined,
        ogImage: row.og_image ?? undefined,
        canonicalUrlOverride: row.canonical_url_override ?? undefined,
        robotsDirective: row.robots_directive ?? undefined,
        source: row.source,
        createdAt: row.created_at,
        revisionNote: row.revision_note ?? undefined,
        createdBy: row.created_by ?? undefined,
      }));
    },
    getPersistedRevision(slug, revisionId) {
      return this.listPersistedRevisions(slug).find((revision) => revision.id === revisionId) ?? null;
    },
    upsertContentOverride(slug, override, actor) {
      getDb()
        .prepare(
          `
            INSERT INTO content_overrides (
              slug, title, status, body, seo_title, meta_description, excerpt, og_title,
              og_description, og_image, scheduled_at, canonical_url_override, robots_directive, updated_at, updated_by
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, ?)
            ON CONFLICT(slug) DO UPDATE SET
              title = excluded.title,
              status = excluded.status,
              body = excluded.body,
              seo_title = excluded.seo_title,
              meta_description = excluded.meta_description,
              excerpt = excluded.excerpt,
              og_title = excluded.og_title,
              og_description = excluded.og_description,
              og_image = excluded.og_image,
              scheduled_at = excluded.scheduled_at,
              canonical_url_override = excluded.canonical_url_override,
              robots_directive = excluded.robots_directive,
              updated_at = CURRENT_TIMESTAMP,
              updated_by = excluded.updated_by
          `,
        )
        .run(
          slug,
          override.title,
          override.status,
          override.body ?? null,
          override.seoTitle,
          override.metaDescription,
          override.excerpt ?? null,
          override.ogTitle ?? null,
          override.ogDescription ?? null,
          override.ogImage ?? null,
          override.scheduledAt ?? null,
          override.canonicalUrlOverride ?? null,
          override.robotsDirective ?? null,
          actor.email,
        );
    },
    replaceContentAssignments(slug, assignments) {
      replaceContentAssignments(slug, assignments);
    },
    insertReviewedRevision(slug, revision, actor) {
      getDb()
        .prepare(
          `
            INSERT INTO content_revisions (
              id, slug, title, status, scheduled_at, body, seo_title, meta_description, excerpt,
              og_title, og_description, og_image, author_ids, category_ids, tag_ids, canonical_url_override, robots_directive, revision_note, source, created_by
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'reviewed', ?)
          `,
        )
        .run(
          `revision-${randomId()}`,
          slug,
          revision.title,
          revision.status,
          revision.scheduledAt ?? null,
          revision.body ?? null,
          revision.seoTitle,
          revision.metaDescription,
          revision.excerpt ?? null,
          revision.ogTitle ?? null,
          revision.ogDescription ?? null,
          revision.ogImage ?? null,
          serializeIdList(revision.authorIds),
          serializeIdList(revision.categoryIds),
          serializeIdList(revision.tagIds),
          revision.canonicalUrlOverride ?? null,
          revision.robotsDirective ?? null,
          revision.revisionNote ?? null,
          actor.email,
        );
    },
    insertContentEntry(entry) {
      try {
        getDb()
          .prepare(
            `
              INSERT INTO content_entries (
                slug, legacy_url, title, kind, template_key, source_html_path, updated_at, body, summary,
                seo_title, meta_description, og_title, og_description, og_image
              ) VALUES (?, ?, ?, 'post', 'content', ?, CURRENT_TIMESTAMP, ?, ?, ?, ?, ?, ?, ?)
            `,
          )
          .run(
            entry.slug,
            entry.legacyUrl,
            entry.title,
            `runtime://content/${entry.slug}`,
            entry.body,
            entry.summary,
            entry.seoTitle,
            entry.metaDescription,
            entry.ogTitle ?? null,
            entry.ogDescription ?? null,
            entry.ogImage ?? null,
          );
        return true;
      } catch {
        return false;
      }
    },
    recordContentAudit({ actor, action, summary, targetId }) {
      recordAudit(actor, action, summary, "content", targetId);
    },
  });

  function getContactSubmissions() {
    const rows = getDb()
      .prepare(
        `
          SELECT id, name, email, message, submitted_at
          FROM contact_submissions
          ORDER BY datetime(submitted_at) DESC, id DESC
        `,
      )
      .all() as Array<{ id: string; name: string; email: string; message: string; submitted_at: string }>;

    return rows.map((row) => ({
      id: row.id,
      name: row.name,
      email: row.email,
      message: row.message,
      submittedAt: row.submitted_at,
    }));
  }

  const sqliteSubmissionRepository = createAstropressSubmissionRepository({
    getContactSubmissions,
    insertContactSubmission(submission) {
      getDb()
        .prepare(
          `
            INSERT INTO contact_submissions (id, name, email, message, submitted_at)
            VALUES (?, ?, ?, ?, ?)
          `,
        )
        .run(submission.id, submission.name, submission.email, submission.message, submission.submittedAt);
    },
  });

  const sqliteTranslationRepository = createAstropressTranslationRepository({
    readTranslationState(route) {
      const row = getDb().prepare("SELECT state FROM translation_overrides WHERE route = ? LIMIT 1").get(route) as
        | { state: string }
        | undefined;
      return row?.state;
    },
    persistTranslationState(route, state, actor) {
      getDb()
        .prepare(
          `
            INSERT INTO translation_overrides (route, state, updated_at, updated_by)
            VALUES (?, ?, CURRENT_TIMESTAMP, ?)
            ON CONFLICT(route) DO UPDATE SET
              state = excluded.state,
              updated_at = CURRENT_TIMESTAMP,
              updated_by = excluded.updated_by
          `,
        )
        .run(route, state, actor.email);
    },
    recordTranslationAudit({ actor, route, state }) {
      recordAudit(actor, "translation.update", `Updated translation state for ${route} to ${state}.`, "content", route);
    },
  });

  function getSettings(): SiteSettings {
    const row = getDb()
      .prepare(
        `
          SELECT site_title, site_tagline, donation_url, newsletter_enabled, comments_default_policy, admin_slug
          FROM site_settings
          WHERE id = 1
          LIMIT 1
        `,
      )
      .get() as
      | {
          site_title: string;
          site_tagline: string;
          donation_url: string;
          newsletter_enabled: number;
          comments_default_policy: SiteSettings["commentsDefaultPolicy"];
          admin_slug: string;
        }
      | undefined;

    if (!row) {
      return { ...defaultSiteSettings };
    }

    return {
      siteTitle: row.site_title,
      siteTagline: row.site_tagline,
      donationUrl: row.donation_url,
      newsletterEnabled: row.newsletter_enabled === 1,
      commentsDefaultPolicy: row.comments_default_policy,
      adminSlug: row.admin_slug ?? "wp-admin",
    };
  }

  const sqliteSettingsRepository = createAstropressSettingsRepository({
    getSettings,
    persistSettings(updated, actor) {
      getDb()
        .prepare(
          `
            INSERT INTO site_settings (
              id, site_title, site_tagline, donation_url, newsletter_enabled, comments_default_policy, admin_slug, updated_at, updated_by
            ) VALUES (?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, ?)
            ON CONFLICT(id) DO UPDATE SET
              site_title = excluded.site_title,
              site_tagline = excluded.site_tagline,
              donation_url = excluded.donation_url,
              newsletter_enabled = excluded.newsletter_enabled,
              comments_default_policy = excluded.comments_default_policy,
              admin_slug = excluded.admin_slug,
              updated_at = CURRENT_TIMESTAMP,
              updated_by = excluded.updated_by
          `,
        )
        .run(
          1,
          updated.siteTitle,
          updated.siteTagline,
          updated.donationUrl,
          updated.newsletterEnabled ? 1 : 0,
          updated.commentsDefaultPolicy,
          updated.adminSlug,
          actor.email,
        );
    },
    recordSettingsAudit(actor) {
      recordAudit(actor, "settings.update", "Updated site settings.", "auth", "site-settings");
    },
  });

  function listSystemRoutes() {
    const rows = getDb()
      .prepare(
        `
          SELECT v.path, v.title, v.summary, v.body_html, v.settings_json, v.updated_at, g.render_strategy
          FROM cms_route_variants v
          INNER JOIN cms_route_groups g ON g.id = v.group_id
          WHERE g.kind = 'system'
          ORDER BY v.path ASC
        `,
      )
      .all() as Array<{
      path: string;
      title: string;
      summary: string | null;
      body_html: string | null;
      settings_json: string | null;
      updated_at: string | null;
      render_strategy: SystemRouteRecord["renderStrategy"];
    }>;

    return rows.map((row) => ({
      path: row.path,
      title: row.title,
      summary: row.summary ?? undefined,
      bodyHtml: row.body_html ?? undefined,
      settings: parseSystemSettings(row.settings_json),
      updatedAt: row.updated_at ?? undefined,
      renderStrategy: row.render_strategy,
    }));
  }

  function getSystemRoute(pathname: string) {
    const normalizedPath = normalizeSystemRoutePath(pathname);
    return listSystemRoutes().find((route) => route.path === normalizedPath) ?? null;
  }

  function listStructuredPageRoutes() {
    const rows = getDb()
      .prepare(
        `
          SELECT v.path, v.title, v.summary, v.seo_title, v.meta_description, v.canonical_url_override, v.robots_directive,
                 v.og_image, v.sections_json, v.settings_json, v.updated_at
          FROM cms_route_variants v
          INNER JOIN cms_route_groups g ON g.id = v.group_id
          WHERE g.kind = 'page' AND g.render_strategy = 'structured_sections'
          ORDER BY v.path ASC
        `,
      )
      .all() as Array<{
      path: string;
      title: string;
      summary: string | null;
      seo_title: string | null;
      meta_description: string | null;
      canonical_url_override: string | null;
      robots_directive: string | null;
      og_image: string | null;
      sections_json: string | null;
      settings_json: string | null;
      updated_at: string | null;
    }>;

    return rows
      .map((row) => {
        const settings = parseSystemSettings(row.settings_json) ?? {};
        const templateKey = normalizeStructuredTemplateKey(settings.templateKey);
        if (!templateKey) {
          return null;
        }
        return {
          path: row.path,
          title: row.title,
          summary: row.summary ?? undefined,
          seoTitle: row.seo_title ?? undefined,
          metaDescription: row.meta_description ?? undefined,
          canonicalUrlOverride: row.canonical_url_override ?? undefined,
          robotsDirective: row.robots_directive ?? undefined,
          ogImage: row.og_image ?? undefined,
          templateKey,
          alternateLinks: Array.isArray(settings.alternateLinks)
            ? (settings.alternateLinks as Array<{ hreflang: string; href: string }>)
            : [],
          sections: parseSystemSettings(row.sections_json),
          updatedAt: row.updated_at ?? undefined,
        } satisfies StructuredPageRouteRecord;
      })
      .filter(Boolean) as StructuredPageRouteRecord[];
  }

  function getStructuredPageRoute(pathname: string) {
    const normalizedPath = normalizeSystemRoutePath(pathname);
    return listStructuredPageRoutes().find((route) => route.path === normalizedPath) ?? null;
  }

  function getArchiveRoute(pathname: string) {
    const normalizedPath = normalizeSystemRoutePath(pathname);
    const row = getDb()
      .prepare(
        `
          SELECT v.path, v.title, v.summary, v.seo_title, v.meta_description, v.canonical_url_override, v.robots_directive, v.updated_at
          FROM cms_route_variants v
          INNER JOIN cms_route_groups g ON g.id = v.group_id
          WHERE g.kind = 'archive' AND v.path = ?
          LIMIT 1
        `,
      )
      .get(normalizedPath) as
      | {
          path: string;
          title: string;
          summary: string | null;
          seo_title: string | null;
          meta_description: string | null;
          canonical_url_override: string | null;
          robots_directive: string | null;
          updated_at: string | null;
        }
      | undefined;

    if (!row) {
      return null;
    }

    return {
      path: row.path,
      title: row.title,
      summary: row.summary ?? undefined,
      seoTitle: row.seo_title ?? undefined,
      metaDescription: row.meta_description ?? undefined,
      canonicalUrlOverride: row.canonical_url_override ?? undefined,
      robotsDirective: row.robots_directive ?? undefined,
      updatedAt: row.updated_at ?? undefined,
    } satisfies ArchiveRouteRecord;
  }

  function listArchiveRoutes() {
    const rows = getDb()
      .prepare(
        `
          SELECT v.path, v.title, v.summary, v.seo_title, v.meta_description, v.canonical_url_override, v.robots_directive, v.updated_at
          FROM cms_route_variants v
          INNER JOIN cms_route_groups g ON g.id = v.group_id
          WHERE g.kind = 'archive'
          ORDER BY v.path ASC
        `,
      )
      .all() as Array<{
      path: string;
      title: string;
      summary: string | null;
      seo_title: string | null;
      meta_description: string | null;
      canonical_url_override: string | null;
      robots_directive: string | null;
      updated_at: string | null;
    }>;

    return rows.map((row) => ({
      path: row.path,
      title: row.title,
      summary: row.summary ?? undefined,
      seoTitle: row.seo_title ?? undefined,
      metaDescription: row.meta_description ?? undefined,
      canonicalUrlOverride: row.canonical_url_override ?? undefined,
      robotsDirective: row.robots_directive ?? undefined,
      updatedAt: row.updated_at ?? undefined,
    })) satisfies ArchiveRouteRecord[];
  }

  const sqliteCmsRouteRegistry = createAstropressCmsRouteRegistry({
    normalizePath: normalizeSystemRoutePath,
    localeFromPath,
    listSystemRoutes,
    getSystemRoute,
    listStructuredPageRoutes,
    getStructuredPageRoute,
    getArchiveRoute,
    listArchiveRoutes,
    findSystemRouteForUpdate(pathname) {
      const row = getDb()
        .prepare(
          `
            SELECT v.id, g.render_strategy
            FROM cms_route_variants v
            INNER JOIN cms_route_groups g ON g.id = v.group_id
            WHERE g.kind = 'system' AND v.path = ?
            LIMIT 1
          `,
        )
        .get(pathname) as { id: string; render_strategy: SystemRouteRecord["renderStrategy"] } | undefined;
      return row ? { id: row.id, renderStrategy: row.render_strategy } : null;
    },
    persistSystemRoute({ routeId, title, summary, bodyHtml, settingsJson, actor }) {
      getDb()
        .prepare(
          `
            UPDATE cms_route_variants
            SET
              title = ?,
              summary = ?,
              body_html = ?,
              settings_json = ?,
              seo_title = ?,
              meta_description = ?,
              updated_at = CURRENT_TIMESTAMP,
              updated_by = ?
            WHERE id = ?
          `,
        )
        .run(title, summary, bodyHtml, settingsJson, title, summary ?? title, actor.email, routeId);
    },
    appendSystemRouteRevision({ routeId, pathname, locale, title, summary, bodyHtml, settings, renderStrategy, revisionNote, actor }) {
      getDb()
        .prepare(
          `
            INSERT INTO cms_route_revisions (id, variant_id, route_path, locale, snapshot_json, revision_note, created_by)
            VALUES (?, ?, ?, ?, ?, ?, ?)
          `,
        )
        .run(
          `revision:${routeId}:${randomId()}`,
          routeId,
          pathname,
          locale,
          JSON.stringify({ path: pathname, title, summary, bodyHtml, settings: settings ?? null, renderStrategy }),
          revisionNote,
          actor.email,
        );
    },
    isRoutePathTaken(pathname) {
      return Boolean(
        getDb()
          .prepare(
            `
              SELECT v.id
              FROM cms_route_variants v
              INNER JOIN cms_route_groups g ON g.id = v.group_id
              WHERE v.path = ?
              LIMIT 1
            `,
          )
          .get(pathname),
      );
    },
    findStructuredRouteForUpdate(pathname) {
      return (
        getDb()
          .prepare(
            `
              SELECT v.id
              FROM cms_route_variants v
              INNER JOIN cms_route_groups g ON g.id = v.group_id
              WHERE g.kind = 'page' AND g.render_strategy = 'structured_sections' AND v.path = ?
              LIMIT 1
            `,
          )
          .get(pathname) as { id: string } | undefined
      ) ?? null;
    },
    insertStructuredRoute({ pathname, locale, title, summary, seoTitle, metaDescription, canonicalUrlOverride, robotsDirective, ogImage, templateKey, alternateLinks, sections, actor }) {
      const groupId = `route-group:${randomId()}`;
      const variantId = `route-variant:${randomId()}`;
      getDb()
        .prepare(
          `
            INSERT INTO cms_route_groups (id, kind, render_strategy, canonical_locale, canonical_path)
            VALUES (?, 'page', 'structured_sections', ?, ?)
          `,
        )
        .run(groupId, locale, pathname);
      getDb()
        .prepare(
          `
            INSERT INTO cms_route_variants (
              id, group_id, locale, path, status, title, summary, sections_json, settings_json,
              seo_title, meta_description, og_image, canonical_url_override, robots_directive, updated_by
            ) VALUES (?, ?, ?, ?, 'published', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          `,
        )
        .run(
          variantId,
          groupId,
          locale,
          pathname,
          title,
          summary,
          sections ? JSON.stringify(sections) : null,
          JSON.stringify({ templateKey, alternateLinks }),
          seoTitle,
          metaDescription,
          ogImage,
          canonicalUrlOverride,
          robotsDirective,
          actor.email,
        );
    },
    persistStructuredRoute({ routeId, title, summary, seoTitle, metaDescription, canonicalUrlOverride, robotsDirective, ogImage, templateKey, alternateLinks, sections, actor }) {
      getDb()
        .prepare(
          `
            UPDATE cms_route_variants
            SET title = ?, summary = ?, seo_title = ?, meta_description = ?, canonical_url_override = ?, robots_directive = ?,
                og_image = ?, sections_json = ?, settings_json = ?, updated_at = CURRENT_TIMESTAMP, updated_by = ?
            WHERE id = ?
          `,
        )
        .run(
          title,
          summary,
          seoTitle,
          metaDescription,
          canonicalUrlOverride,
          robotsDirective,
          ogImage,
          sections ? JSON.stringify(sections) : null,
          JSON.stringify({ templateKey, alternateLinks }),
          actor.email,
          routeId,
        );
    },
    appendStructuredRouteRevision({ routeId, pathname, locale, title, summary, seoTitle, metaDescription, canonicalUrlOverride, robotsDirective, ogImage, templateKey, alternateLinks, sections, revisionNote, actor }) {
      getDb()
        .prepare(
          `
            INSERT INTO cms_route_revisions (id, variant_id, route_path, locale, snapshot_json, revision_note, created_by)
            VALUES (?, ?, ?, ?, ?, ?, ?)
          `,
        )
        .run(
          `revision:${routeId}:${randomId()}`,
          routeId,
          pathname,
          locale,
          JSON.stringify({
            path: pathname,
            title,
            summary,
            seoTitle,
            metaDescription,
            canonicalUrlOverride,
            robotsDirective,
            ogImage,
            templateKey,
            alternateLinks,
            sections,
          }),
          revisionNote,
          actor.email,
        );
    },
    findArchiveRouteForUpdate(pathname) {
      return (
        getDb()
          .prepare(
            `
              SELECT v.id
              FROM cms_route_variants v
              INNER JOIN cms_route_groups g ON g.id = v.group_id
              WHERE g.kind = 'archive' AND v.path = ?
              LIMIT 1
            `,
          )
          .get(pathname) as { id: string } | undefined
      ) ?? null;
    },
    persistArchiveRoute({ routeId, title, summary, seoTitle, metaDescription, canonicalUrlOverride, robotsDirective, actor }) {
      getDb()
        .prepare(
          `
            UPDATE cms_route_variants
            SET title = ?, summary = ?, seo_title = ?, meta_description = ?, canonical_url_override = ?, robots_directive = ?,
                updated_at = CURRENT_TIMESTAMP, updated_by = ?
            WHERE id = ?
          `,
        )
        .run(title, summary, seoTitle, metaDescription, canonicalUrlOverride, robotsDirective, actor.email, routeId);
    },
    appendArchiveRouteRevision({ routeId, pathname, title, summary, seoTitle, metaDescription, canonicalUrlOverride, robotsDirective, revisionNote, actor }) {
      getDb()
        .prepare(
          `
            INSERT INTO cms_route_revisions (id, variant_id, route_path, locale, snapshot_json, revision_note, created_by)
            VALUES (?, ?, ?, 'en', ?, ?, ?)
          `,
        )
        .run(
          `revision:${routeId}:${randomId()}`,
          routeId,
          pathname,
          JSON.stringify({ path: pathname, title, summary, seoTitle, metaDescription, canonicalUrlOverride, robotsDirective }),
          revisionNote,
          actor.email,
        );
    },
    recordRouteAudit({ actor, action, summary, targetId }) {
      recordAudit(actor, action, summary, "content", targetId);
    },
  });

  const sqliteCmsRegistryModule = createAstropressCmsRegistryModule({
    listSystemRoutes,
    getSystemRoute,
    saveSystemRoute: sqliteCmsRouteRegistry.saveSystemRoute,
    listStructuredPageRoutes,
    getStructuredPageRoute,
    saveStructuredPageRoute: sqliteCmsRouteRegistry.saveStructuredPageRoute,
    createStructuredPageRoute: sqliteCmsRouteRegistry.createStructuredPageRoute,
    getArchiveRoute,
    listArchiveRoutes,
    saveArchiveRoute: sqliteCmsRouteRegistry.saveArchiveRoute,
  });

  const sqliteRateLimitRepository = createAstropressRateLimitRepository({
    now,
    readRateLimitWindow(key) {
      const row = getDb()
        .prepare("SELECT count, window_start_ms, window_ms FROM rate_limits WHERE key = ? LIMIT 1")
        .get(key) as { count: number; window_start_ms: number; window_ms: number } | undefined;

      if (!row) {
        return null;
      }

      return {
        count: row.count,
        windowStartMs: row.window_start_ms,
        windowMs: row.window_ms,
      };
    },
    resetRateLimitWindow(key, currentTime, windowMs) {
      getDb()
        .prepare(
          `
            INSERT INTO rate_limits (key, count, window_start_ms, window_ms)
            VALUES (?, 1, ?, ?)
            ON CONFLICT(key) DO UPDATE SET
              count = 1,
              window_start_ms = excluded.window_start_ms,
              window_ms = excluded.window_ms
          `,
        )
        .run(key, currentTime, windowMs);
    },
    incrementRateLimitWindow(key) {
      getDb().prepare("UPDATE rate_limits SET count = count + 1 WHERE key = ?").run(key);
    },
  });

  function listMediaAssets() {
    const rows = getDb()
      .prepare(
        `
          SELECT id, source_url, local_path, r2_key, mime_type, width, height, file_size, alt_text, title, uploaded_at, uploaded_by
          FROM media_assets
          WHERE deleted_at IS NULL
          ORDER BY datetime(uploaded_at) DESC, id DESC
        `,
      )
      .all() as Array<{
      id: string;
      source_url: string | null;
      local_path: string;
      r2_key: string | null;
      mime_type: string | null;
      width: number | null;
      height: number | null;
      file_size: number | null;
      alt_text: string | null;
      title: string | null;
      uploaded_at: string;
      uploaded_by: string | null;
    }>;

    return rows.map((row) => ({
      id: row.id,
      sourceUrl: row.source_url,
      localPath: row.local_path,
      r2Key: row.r2_key,
      mimeType: row.mime_type,
      width: row.width,
      height: row.height,
      fileSize: row.file_size,
      altText: row.alt_text ?? "",
      title: row.title ?? "",
      uploadedAt: row.uploaded_at,
      uploadedBy: row.uploaded_by ?? "",
    }));
  }

  function listAuthors() {
    const rows = getDb()
      .prepare(
        `
          SELECT id, slug, name, bio, created_at, updated_at
          FROM authors
          WHERE deleted_at IS NULL
          ORDER BY name COLLATE NOCASE ASC, id ASC
        `,
      )
      .all() as Array<{ id: number; slug: string; name: string; bio: string | null; created_at: string; updated_at: string }>;

    return rows.map((row) => ({
      id: row.id,
      slug: row.slug,
      name: row.name,
      bio: row.bio ?? undefined,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    }));
  }

  const sqliteAuthorRepository = createAstropressAuthorRepository({
    listAuthors,
    slugifyTerm,
    createAuthor({ slug, name, bio }) {
      try {
        getDb()
          .prepare(
            `
              INSERT INTO authors (slug, name, bio)
              VALUES (?, ?, ?)
            `,
          )
          .run(slug, name, bio);
        return true;
      } catch {
        return false;
      }
    },
    updateAuthor({ id, slug, name, bio }) {
      try {
        const result = getDb()
          .prepare(
            `
              UPDATE authors
              SET slug = ?, name = ?, bio = ?, updated_at = CURRENT_TIMESTAMP
              WHERE id = ?
                AND deleted_at IS NULL
            `,
          )
          .run(slug, name, bio, id);
        return result.changes > 0;
      } catch {
        return false;
      }
    },
    deleteAuthor(id) {
      return (
        getDb()
          .prepare("UPDATE authors SET deleted_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP WHERE id = ? AND deleted_at IS NULL")
          .run(id).changes > 0
      );
    },
    recordAuthorAudit({ actor, action, summary, targetId }) {
      recordAudit(actor, action, summary, "content", targetId);
    },
  });

  function listTaxonomyTerms(table: "categories" | "tags", kind: "category" | "tag") {
    const rows = getDb()
      .prepare(
        `
          SELECT id, slug, name, description, created_at, updated_at
          FROM ${table}
          WHERE deleted_at IS NULL
          ORDER BY name COLLATE NOCASE ASC, id ASC
        `,
      )
      .all() as Array<{ id: number; slug: string; name: string; description: string | null; created_at: string; updated_at: string }>;

    return rows.map((row) => ({
      id: row.id,
      kind,
      slug: row.slug,
      name: row.name,
      description: row.description ?? undefined,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    }));
  }

  const sqliteTaxonomyRepository = createAstropressTaxonomyRepository({
    listCategories() {
      return listTaxonomyTerms("categories", "category");
    },
    listTags() {
      return listTaxonomyTerms("tags", "tag");
    },
    slugifyTerm,
    createTaxonomyTerm({ table, slug, name, description }) {
      try {
        getDb().prepare(`INSERT INTO ${table} (slug, name, description) VALUES (?, ?, ?)`).run(slug, name, description);
        return true;
      } catch {
        return false;
      }
    },
    updateTaxonomyTerm({ table, id, slug, name, description }) {
      try {
        const result = getDb()
          .prepare(
            `UPDATE ${table} SET slug = ?, name = ?, description = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ? AND deleted_at IS NULL`,
          )
          .run(slug, name, description, id);
        return result.changes > 0;
      } catch {
        return false;
      }
    },
    deleteTaxonomyTerm({ table, id }) {
      return (
        getDb()
          .prepare(`UPDATE ${table} SET deleted_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP WHERE id = ? AND deleted_at IS NULL`)
          .run(id).changes > 0
      );
    },
    recordTaxonomyAudit({ actor, action, summary, targetId }) {
      recordAudit(actor, action, summary, "content", targetId);
    },
  });

  function updateMediaAsset(
    input: {
      id: string;
      title?: string;
      altText?: string;
    },
    actor: Actor,
  ) {
    const id = input.id.trim();
    if (!id) {
      return { ok: false as const, error: "Media asset id is required." };
    }

    const result = getDb()
      .prepare("UPDATE media_assets SET title = ?, alt_text = ? WHERE id = ? AND deleted_at IS NULL")
      .run(input.title?.trim() ?? "", input.altText?.trim() ?? "", id);

    if (result.changes === 0) {
      return { ok: false as const, error: "The selected media asset could not be updated." };
    }

    recordAudit(actor, "media.update", `Updated media metadata for ${id}.`, "content", id);
    return { ok: true as const };
  }

  const sqliteMediaRepository = createAstropressLocalMediaRepository({
    listMediaAssets,
    updateMediaAsset,
    insertStoredMediaAsset({ asset, actor }) {
      getDb()
        .prepare(
          `
            INSERT INTO media_assets (
              id, source_url, local_path, r2_key, mime_type, file_size, alt_text, title, uploaded_by
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
          `,
        )
        .run(
          asset.id,
          null,
          asset.publicPath,
          asset.r2Key,
          asset.mimeType,
          asset.fileSize,
          asset.altText,
          asset.title,
          actor.email,
        );
    },
    getStoredMediaDeletionCandidate(id) {
      const row = getDb()
        .prepare("SELECT local_path FROM media_assets WHERE id = ? AND deleted_at IS NULL")
        .get(id) as { local_path: string } | undefined;
      return row ? { localPath: row.local_path } : null;
    },
    markStoredMediaDeleted(id) {
      return getDb().prepare("UPDATE media_assets SET deleted_at = CURRENT_TIMESTAMP WHERE id = ?").run(id).changes > 0;
    },
    recordMediaAudit({ actor, action, summary, targetId }) {
      recordAudit(actor, action, summary, "content", targetId);
    },
  });

  const sqliteAdminStore: AdminStoreAdapter = createAstropressAdminStoreAdapter("sqlite", {
    auth: {
      createSession: sqliteAuthRepository.createSession,
      getSessionUser: sqliteAuthRepository.getSessionUser,
      getCsrfToken: sqliteAuthRepository.getCsrfToken,
      revokeSession: sqliteAuthRepository.revokeSession,
      createPasswordResetToken: sqliteAuthRepository.createPasswordResetToken,
      getInviteRequest: sqliteAuthRepository.getInviteRequest,
      getPasswordResetRequest: sqliteAuthRepository.getPasswordResetRequest,
      consumeInviteToken: sqliteAuthRepository.consumeInviteToken,
      consumePasswordResetToken: sqliteAuthRepository.consumePasswordResetToken,
      recordSuccessfulLogin: sqliteAuthRepository.recordSuccessfulLogin,
      recordLogout: sqliteAuthRepository.recordLogout,
    },
    audit: {
      getAuditEvents: getPersistedAuditEvents,
    },
    users: {
      listAdminUsers,
      inviteAdminUser: sqliteUserRepository.inviteAdminUser,
      suspendAdminUser: sqliteUserRepository.suspendAdminUser,
      unsuspendAdminUser: sqliteUserRepository.unsuspendAdminUser,
    },
    authors: {
      listAuthors,
      createAuthor: sqliteAuthorRepository.createAuthor,
      updateAuthor: sqliteAuthorRepository.updateAuthor,
      deleteAuthor: sqliteAuthorRepository.deleteAuthor,
    },
    taxonomies: {
      listCategories: sqliteTaxonomyRepository.listCategories,
      createCategory: sqliteTaxonomyRepository.createCategory,
      updateCategory: sqliteTaxonomyRepository.updateCategory,
      deleteCategory: sqliteTaxonomyRepository.deleteCategory,
      listTags: sqliteTaxonomyRepository.listTags,
      createTag: sqliteTaxonomyRepository.createTag,
      updateTag: sqliteTaxonomyRepository.updateTag,
      deleteTag: sqliteTaxonomyRepository.deleteTag,
    },
    redirects: {
      getRedirectRules,
      createRedirectRule: sqliteRedirectRepository.createRedirectRule,
      deleteRedirectRule: sqliteRedirectRepository.deleteRedirectRule,
    },
    comments: {
      getComments,
      moderateComment: sqliteCommentRepository.moderateComment,
      submitPublicComment: sqliteCommentRepository.submitPublicComment,
      getApprovedCommentsForRoute: sqliteCommentRepository.getApprovedCommentsForRoute,
    },
    content: {
      listContentStates: sqliteContentRepository.listContentStates,
      getContentState: sqliteContentRepository.getContentState,
      getContentRevisions: sqliteContentRepository.getContentRevisions,
      createContentRecord: sqliteContentRepository.createContentRecord,
      saveContentState: sqliteContentRepository.saveContentState,
      restoreRevision: sqliteContentRepository.restoreRevision,
    },
    submissions: {
      submitContact: sqliteSubmissionRepository.submitContact,
      getContactSubmissions,
    },
    translations: {
      updateTranslationState: sqliteTranslationRepository.updateTranslationState,
      getEffectiveTranslationState: sqliteTranslationRepository.getEffectiveTranslationState,
    },
    settings: {
      getSettings,
      saveSettings: sqliteSettingsRepository.saveSettings,
    },
    rateLimits: {
      checkRateLimit: sqliteRateLimitRepository.checkRateLimit,
      peekRateLimit: sqliteRateLimitRepository.peekRateLimit,
      recordFailedAttempt: sqliteRateLimitRepository.recordFailedAttempt,
    },
    media: {
      listMediaAssets,
      createMediaAsset: sqliteMediaRepository.createMediaAsset,
      updateMediaAsset,
      deleteMediaAsset: sqliteMediaRepository.deleteMediaAsset,
    },
  });

  return {
    sqliteAdminStore,
    sqliteCmsRegistryModule,
    authenticatePersistedAdminUser: sqliteAuthRepository.authenticatePersistedAdminUser,
  };
}
