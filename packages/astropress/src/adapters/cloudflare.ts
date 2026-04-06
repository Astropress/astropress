import {
  assertProviderContract,
  normalizeProviderCapabilities,
  type AstropressPlatformAdapter,
  type AuthStore,
  type AuthUser,
  type ContentStoreRecord,
  type DeployTarget,
  type GitSyncAdapter,
  type ImportSource,
  type MediaAssetRecord,
  type PreviewSession,
  type RevisionRecord,
} from "../platform-contracts";
import { createD1AdminReadStore } from "../d1-admin-store";
import { createSessionTokenDigest, verifyPassword } from "../crypto-utils.js";
import type { D1DatabaseLike } from "../d1-database";

type AstropressCloudflareSeedUser = AuthUser & {
  password: string;
};

export interface AstropressCloudflareAdapterOptions {
  db?: D1DatabaseLike;
  auth?: AuthStore;
  users?: AstropressCloudflareSeedUser[];
  allowInsecureFallbackAuth?: boolean;
  gitSync?: GitSyncAdapter;
  deploy?: DeployTarget;
  importer?: ImportSource;
  preview?: PreviewSession;
}

function mapContentRecordKind(record: { kind?: string | null }): ContentStoreRecord["kind"] {
  return record.kind === "post" ? "post" : "page";
}

function nowIso() {
  return new Date().toISOString();
}

function cloudflareActorEmail() {
  return "admin@example.com";
}

function normalizeContentStatus(status: ContentStoreRecord["status"]) {
  return status === "archived" ? "archived" : status === "draft" ? "draft" : "published";
}

function toContentStoreRecord(record: {
  slug: string;
  kind?: string | null;
  title: string;
  body?: string;
  status: "draft" | "review" | "published" | "archived";
  seoTitle: string;
  metaDescription: string;
  updatedAt: string;
  legacyUrl: string;
  templateKey: string;
  summary?: string;
}) {
  return {
    id: record.slug,
    kind: mapContentRecordKind(record),
    slug: record.slug,
    status: record.status === "review" ? "draft" : record.status,
    title: record.title,
    body: record.body ?? null,
    metadata: {
      seoTitle: record.seoTitle,
      metaDescription: record.metaDescription,
      updatedAt: record.updatedAt,
      legacyUrl: record.legacyUrl,
      templateKey: record.templateKey,
      summary: record.summary ?? "",
    },
  } satisfies ContentStoreRecord;
}

function toRedirectRecord(rule: { sourcePath: string; targetPath: string; statusCode: 301 | 302 }) {
  return {
    id: rule.sourcePath,
    kind: "redirect" as const,
    slug: rule.sourcePath,
    status: "published" as const,
    title: rule.sourcePath,
    metadata: {
      targetPath: rule.targetPath,
      statusCode: rule.statusCode,
    },
  };
}

function toTranslationRecord(route: string, state: string, updatedAt: string, updatedBy: string) {
  return {
    id: route,
    kind: "translation" as const,
    slug: route,
    status: state === "published" ? "published" : "draft",
    title: route,
    metadata: {
      state,
      updatedAt,
      updatedBy,
    },
  };
}

async function listTranslationRecords(db: D1DatabaseLike) {
  const rows = (
    await db
      .prepare("SELECT route, state, updated_at, updated_by FROM translation_overrides ORDER BY route ASC")
      .all<{ route: string; state: string; updated_at: string; updated_by: string }>()
  ).results;

  return rows.map((row) => toTranslationRecord(row.route, row.state, row.updated_at, row.updated_by));
}

async function saveD1Revision(db: D1DatabaseLike, revision: RevisionRecord, actorEmail: string) {
  const snapshot = revision.snapshot as Record<string, unknown>;
  await db
    .prepare(
      `
        INSERT INTO content_revisions (
          id, slug, source, title, status, scheduled_at, body, seo_title, meta_description, excerpt,
          og_title, og_description, og_image, author_ids, category_ids, tag_ids, canonical_url_override,
          robots_directive, revision_note, created_at, created_by
        ) VALUES (?, ?, 'reviewed', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `,
    )
    .bind(
      revision.id,
      revision.recordId,
      String(snapshot.title ?? revision.recordId),
      snapshot.status === "archived" ? "archived" : snapshot.status === "draft" ? "draft" : "published",
      snapshot.scheduledAt ?? null,
      snapshot.body ?? null,
      String(snapshot.seoTitle ?? snapshot.title ?? revision.recordId),
      String(snapshot.metaDescription ?? snapshot.title ?? revision.recordId),
      snapshot.excerpt ?? null,
      snapshot.ogTitle ?? null,
      snapshot.ogDescription ?? null,
      snapshot.ogImage ?? null,
      JSON.stringify(snapshot.authorIds ?? []),
      JSON.stringify(snapshot.categoryIds ?? []),
      JSON.stringify(snapshot.tagIds ?? []),
      snapshot.canonicalUrlOverride ?? null,
      snapshot.robotsDirective ?? null,
      revision.summary ?? null,
      revision.createdAt,
      revision.actorId ?? actorEmail,
    )
    .run();
}

function createFallbackCloudflareAuthStore(seedUsers: AstropressCloudflareSeedUser[]): AuthStore {
  const users = new Map(seedUsers.map((user) => [user.email.toLowerCase(), user]));
  const sessions = new Map<string, AuthUser>();

  return {
    async signIn(email, password) {
      const user = users.get(email.trim().toLowerCase());
      if (!user || user.password !== password) {
        return null;
      }

      const sessionId = `cloudflare-session:${user.id}`;
      const sessionUser = { id: sessionId, email: user.email, role: user.role };
      sessions.set(sessionId, sessionUser);
      return sessionUser;
    },
    async signOut(sessionId) {
      sessions.delete(sessionId);
    },
    async getSession(sessionId) {
      return sessions.get(sessionId) ?? null;
    },
  };
}

function createDisabledCloudflareAuthStore(): AuthStore {
  return {
    async signIn() {
      return null;
    },
    async signOut() {},
    async getSession() {
      return null;
    },
  };
}

const CLOUDFLARE_SESSION_TTL_MS = 12 * 60 * 60 * 1000;

async function cleanupExpiredCloudflareSessions(db: D1DatabaseLike) {
  await db
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

async function getLiveCloudflareSessionRow(db: D1DatabaseLike, sessionId: string) {
  await cleanupExpiredCloudflareSessions(db);

  const sessionCandidates = [sessionId, await createSessionTokenDigest(sessionId, "cloudflare-adapter-session-secret")];
  let row: {
    id: string;
    last_active_at: string;
    email: string;
    role: AuthUser["role"];
  } | null = null;

  for (const candidate of sessionCandidates) {
    row = await db
      .prepare(
        `
          SELECT s.id, s.last_active_at, u.email, u.role
          FROM admin_sessions s
          JOIN admin_users u ON u.id = s.user_id
          WHERE s.id = ?
            AND s.revoked_at IS NULL
            AND u.active = 1
          LIMIT 1
        `,
      )
      .bind(candidate)
      .first<{
        id: string;
        last_active_at: string;
        email: string;
        role: AuthUser["role"];
      }>();
    if (row) {
      break;
    }
  }

  if (!row) {
    return null;
  }

  const lastActiveAt = Date.parse(row.last_active_at);
  if (!Number.isFinite(lastActiveAt) || Date.now() - lastActiveAt > CLOUDFLARE_SESSION_TTL_MS) {
    await db
      .prepare(
        `
          UPDATE admin_sessions
          SET revoked_at = CURRENT_TIMESTAMP
          WHERE id = ?
            AND revoked_at IS NULL
        `,
      )
      .bind(row.id)
      .run();
    return null;
  }

  await db.prepare("UPDATE admin_sessions SET last_active_at = CURRENT_TIMESTAMP WHERE id = ?").bind(row.id).run();
  return row;
}

function createD1CloudflareAuthStore(db: D1DatabaseLike): AuthStore {
  return {
    async signIn(email, password) {
      const row = await db
        .prepare(
          `
            SELECT id, email, role, password_hash
            FROM admin_users
            WHERE email = ?
              AND active = 1
            LIMIT 1
          `,
        )
        .bind(email.trim().toLowerCase())
        .first<{ id: number; email: string; role: AuthUser["role"]; password_hash: string }>();

      if (!row || !(await verifyPassword(password, row.password_hash))) {
        return null;
      }

      const sessionId = crypto.randomUUID();
      const storedSessionId = await createSessionTokenDigest(sessionId, "cloudflare-adapter-session-secret");
      const csrfToken = crypto.randomUUID();

      await db
        .prepare(
          `
            INSERT INTO admin_sessions (id, user_id, csrf_token, ip_address, user_agent)
            VALUES (?, ?, ?, ?, ?)
          `,
        )
        .bind(storedSessionId, row.id, csrfToken, null, "astropress-cloudflare-adapter")
        .run();

      return { id: sessionId, email: row.email, role: row.role };
    },
    async signOut(sessionId) {
      for (const candidate of [sessionId, await createSessionTokenDigest(sessionId, "cloudflare-adapter-session-secret")]) {
        await db
          .prepare(
            `
              UPDATE admin_sessions
              SET revoked_at = CURRENT_TIMESTAMP
              WHERE id = ?
                AND revoked_at IS NULL
            `,
          )
          .bind(candidate)
          .run();
      }
    },
    async getSession(sessionId) {
      const row = await getLiveCloudflareSessionRow(db, sessionId);
      if (!row) {
        return null;
      }

      return { id: sessionId, email: row.email, role: row.role };
    },
  };
}

export function createAstropressCloudflareAdapter(
  options: AstropressCloudflareAdapterOptions = {},
): AstropressPlatformAdapter {
  if (!options.db) {
    return assertProviderContract({
      capabilities: normalizeProviderCapabilities({
        name: "cloudflare",
        staticPublishing: true,
        hostedAdmin: true,
        previewEnvironments: true,
        serverRuntime: true,
        database: true,
        objectStorage: true,
        gitSync: true,
      }),
      content: {
        async list() {
          return [];
        },
        async get() {
          return null;
        },
        async save(record) {
          return record;
        },
        async delete() {},
      },
      media: {
        async put(asset) {
          return asset;
        },
        async get() {
          return null;
        },
        async delete() {},
      },
      revisions: {
        async list() {
          return [];
        },
        async append(revision) {
          return revision;
        },
      },
      auth:
        options.auth ??
        (options.allowInsecureFallbackAuth && options.users
          ? createFallbackCloudflareAuthStore(options.users)
          : createDisabledCloudflareAuthStore()),
      gitSync: options.gitSync,
      deploy: options.deploy,
      importer: options.importer,
      preview: options.preview,
    });
  }

  const readStore = createD1AdminReadStore(options.db);
  const db = options.db;
  return assertProviderContract({
    capabilities: normalizeProviderCapabilities({
      name: "cloudflare",
      staticPublishing: true,
      hostedAdmin: true,
      previewEnvironments: true,
      serverRuntime: true,
      database: true,
      objectStorage: true,
      gitSync: true,
    }),
    auth:
      options.auth ??
      (options.allowInsecureFallbackAuth && options.users
        ? createFallbackCloudflareAuthStore(options.users)
        : createD1CloudflareAuthStore(options.db)),
    content: {
      async list(kind) {
        const records: ContentStoreRecord[] = [];

        if (!kind || kind === "page" || kind === "post") {
          for (const record of await readStore.content.listContentStates()) {
            const mapped = toContentStoreRecord(record);
            if (!kind || mapped.kind === kind) {
              records.push(mapped);
            }
          }
        }

        if (!kind || kind === "redirect") {
          records.push(...(await readStore.redirects.getRedirectRules()).map((rule) => toRedirectRecord(rule)));
        }

        if (!kind || kind === "comment") {
          records.push(
            ...(await readStore.comments.getComments()).map((comment) => ({
              id: comment.id,
              kind: "comment" as const,
              slug: comment.id,
              status: comment.status === "approved" ? "published" : "draft",
              title: comment.author,
              body: comment.body ?? null,
              metadata: {
                route: comment.route,
                email: comment.email ?? null,
                policy: comment.policy,
                submittedAt: comment.submittedAt ?? null,
              },
            })),
          );
        }

        if (!kind || kind === "user") {
          records.push(
            ...(await readStore.users.listAdminUsers()).map((user) => ({
              id: String(user.id),
              kind: "user" as const,
              slug: user.email,
              status: user.active ? "published" : "archived",
              title: user.name,
              metadata: {
                email: user.email,
                role: user.role,
                createdAt: user.createdAt,
                userStatus: user.status,
              },
            })),
          );
        }

        if (!kind || kind === "settings") {
          const settings = await readStore.settings.getSettings();
          records.push({
            id: "site-settings",
            kind: "settings",
            slug: "site-settings",
            status: "published",
            title: settings.siteTitle,
            metadata: settings,
          });
        }

        if (!kind || kind === "media") {
          records.push(
            ...(await readStore.media.listMediaAssets()).map((asset) => ({
              id: asset.id,
              kind: "media" as const,
              slug: asset.id,
              status: "published" as const,
              title: asset.title || asset.id,
              metadata: {
                sourceUrl: asset.sourceUrl,
                localPath: asset.localPath,
                mimeType: asset.mimeType,
                altText: asset.altText,
                uploadedAt: asset.uploadedAt,
              },
            })),
          );
        }

        if (!kind || kind === "translation") {
          records.push(...(await listTranslationRecords(db)));
        }

        return records;
      },
      async get(id) {
        const normalizedId = id.trim();
        if (!normalizedId) {
          return null;
        }
        const all = await this.list();
        return all.find((record) => record.id === normalizedId || record.slug === normalizedId) ?? null;
      },
      async save(record) {
        const slug = record.slug || record.id;

        if (record.kind === "redirect") {
          const targetPath = String(record.metadata?.targetPath ?? "").trim();
          const statusCode = Number(record.metadata?.statusCode) === 302 ? 302 : 301;
          await db
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
            .bind(slug, targetPath, statusCode, cloudflareActorEmail())
            .run();
          return toRedirectRecord({ sourcePath: slug, targetPath, statusCode });
        }

        if (record.kind === "settings") {
          const current = await readStore.settings.getSettings();
          const next = { ...current, ...(record.metadata ?? {}) };
          await db
            .prepare(
              `
                INSERT INTO site_settings (
                  id, site_title, site_tagline, donation_url, newsletter_enabled, comments_default_policy, admin_slug, updated_at, updated_by
                ) VALUES (1, ?, ?, ?, ?, ?, ?, ?, ?)
                ON CONFLICT(id) DO UPDATE SET
                  site_title = excluded.site_title,
                  site_tagline = excluded.site_tagline,
                  donation_url = excluded.donation_url,
                  newsletter_enabled = excluded.newsletter_enabled,
                  comments_default_policy = excluded.comments_default_policy,
                  admin_slug = excluded.admin_slug,
                  updated_at = excluded.updated_at,
                  updated_by = excluded.updated_by
              `,
            )
            .bind(
              next.siteTitle,
              next.siteTagline,
              next.donationUrl,
              next.newsletterEnabled ? 1 : 0,
              next.commentsDefaultPolicy,
              next.adminSlug,
              nowIso(),
              cloudflareActorEmail(),
            )
            .run();
          return {
            id: "site-settings",
            kind: "settings",
            slug: "site-settings",
            status: "published",
            title: next.siteTitle,
            metadata: next,
          };
        }

        if (record.kind === "translation") {
          const state = String(record.metadata?.state ?? "not_started");
          const updatedAt = nowIso();
          const updatedBy = cloudflareActorEmail();
          await db
            .prepare(
              `
                INSERT INTO translation_overrides (route, state, updated_at, updated_by)
                VALUES (?, ?, ?, ?)
                ON CONFLICT(route) DO UPDATE SET
                  state = excluded.state,
                  updated_at = excluded.updated_at,
                  updated_by = excluded.updated_by
              `,
            )
            .bind(slug, state, updatedAt, updatedBy)
            .run();
          return toTranslationRecord(slug, state, updatedAt, updatedBy);
        }

        if (record.kind === "page" || record.kind === "post") {
          const existing = await readStore.content.getContentState(slug);
          const title = record.title ?? existing?.title ?? slug;
          const body = record.body ?? existing?.body ?? "";
          const summary = String(record.metadata?.summary ?? existing?.summary ?? "");
          const seoTitle = String(record.metadata?.seoTitle ?? title);
          const metaDescription = String(record.metadata?.metaDescription ?? title);
          const ogTitle = typeof record.metadata?.ogTitle === "string" ? record.metadata.ogTitle : existing?.ogTitle ?? null;
          const ogDescription =
            typeof record.metadata?.ogDescription === "string" ? record.metadata.ogDescription : existing?.ogDescription ?? null;
          const ogImage = typeof record.metadata?.ogImage === "string" ? record.metadata.ogImage : existing?.ogImage ?? null;
          const canonicalUrlOverride =
            typeof record.metadata?.canonicalUrlOverride === "string"
              ? record.metadata.canonicalUrlOverride
              : existing?.canonicalUrlOverride ?? null;
          const robotsDirective =
            typeof record.metadata?.robotsDirective === "string"
              ? record.metadata.robotsDirective
              : existing?.robotsDirective ?? null;
          const status = normalizeContentStatus(record.status);

          if (!existing) {
            await db
              .prepare(
                `
                  INSERT INTO content_entries (
                    slug, legacy_url, title, kind, template_key, source_html_path, updated_at, body, summary,
                    seo_title, meta_description, og_title, og_description, og_image
                  ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                `,
              )
              .bind(
                slug,
                typeof record.metadata?.legacyUrl === "string" ? record.metadata.legacyUrl : `/${slug}`,
                title,
                record.kind,
                typeof record.metadata?.templateKey === "string" ? record.metadata.templateKey : "content",
                `runtime://content/${slug}`,
                nowIso(),
                body,
                summary,
                seoTitle,
                metaDescription,
                ogTitle,
                ogDescription,
                ogImage,
              )
              .run();
          }

          await db
            .prepare(
              `
                INSERT INTO content_overrides (
                  slug, title, status, scheduled_at, body, seo_title, meta_description, excerpt,
                  og_title, og_description, og_image, canonical_url_override, robots_directive, updated_at, updated_by
                ) VALUES (?, ?, ?, NULL, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
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
                  canonical_url_override = excluded.canonical_url_override,
                  robots_directive = excluded.robots_directive,
                  updated_at = excluded.updated_at,
                  updated_by = excluded.updated_by
              `,
            )
            .bind(
              slug,
              title,
              status,
              body,
              seoTitle,
              metaDescription,
              summary,
              ogTitle,
              ogDescription,
              ogImage,
              canonicalUrlOverride,
              robotsDirective,
              nowIso(),
              cloudflareActorEmail(),
            )
            .run();

          await saveD1Revision(
            db,
            {
              id: `cloudflare-${crypto.randomUUID()}`,
              recordId: slug,
              createdAt: nowIso(),
              actorId: cloudflareActorEmail(),
              snapshot: {
                title,
                status,
                body,
                seoTitle,
                metaDescription,
                excerpt: summary,
                ogTitle,
                ogDescription,
                ogImage,
                canonicalUrlOverride,
                robotsDirective,
              },
            },
            cloudflareActorEmail(),
          );

          const saved = await readStore.content.getContentState(slug);
          if (!saved) {
            throw new Error(`Cloudflare adapter failed to persist content record ${slug}.`);
          }
          return toContentStoreRecord(saved);
        }

        throw new Error(`Cloudflare content store does not support saving ${record.kind} records yet.`);
      },
      async delete(id) {
        const existing = await this.get(id);
        if (!existing) {
          return;
        }
        if (existing.kind === "redirect") {
          await db
            .prepare("UPDATE redirect_rules SET deleted_at = CURRENT_TIMESTAMP WHERE source_path = ? AND deleted_at IS NULL")
            .bind(existing.slug)
            .run();
          return;
        }
        if (existing.kind === "page" || existing.kind === "post") {
          await this.save({ ...existing, status: "archived" });
          return;
        }
        if (existing.kind === "media") {
          await db.prepare("UPDATE media_assets SET deleted_at = CURRENT_TIMESTAMP WHERE id = ?").bind(existing.id).run();
          return;
        }
        throw new Error(`Cloudflare content store does not support deleting ${existing.kind} records yet.`);
      },
    },
    media: {
      async put(asset: MediaAssetRecord) {
        await db
          .prepare(
            `
              INSERT INTO media_assets (
                id, source_url, local_path, mime_type, file_size, alt_text, title, uploaded_at, uploaded_by, deleted_at
              ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, NULL)
              ON CONFLICT(id) DO UPDATE SET
                source_url = excluded.source_url,
                local_path = excluded.local_path,
                mime_type = excluded.mime_type,
                file_size = excluded.file_size,
                alt_text = excluded.alt_text,
                title = excluded.title,
                deleted_at = NULL
            `,
          )
          .bind(
            asset.id,
            asset.publicUrl ?? null,
            asset.publicUrl ?? `/media/${asset.filename}`,
            asset.mimeType,
            asset.bytes?.byteLength ?? null,
            String(asset.metadata?.altText ?? ""),
            String(asset.metadata?.title ?? asset.filename),
            nowIso(),
            cloudflareActorEmail(),
          )
          .run();
        return asset;
      },
      async get(id) {
        const asset = (await readStore.media.listMediaAssets()).find((entry) => entry.id === id);
        if (!asset) {
          return null;
        }
        return {
          id: asset.id,
          filename: asset.title || asset.id,
          mimeType: asset.mimeType ?? "application/octet-stream",
          publicUrl: asset.sourceUrl ?? asset.localPath,
          metadata: {
            altText: asset.altText,
            uploadedAt: asset.uploadedAt,
          },
        };
      },
      async delete(id) {
        await db.prepare("UPDATE media_assets SET deleted_at = CURRENT_TIMESTAMP WHERE id = ?").bind(id).run();
      },
    },
    revisions: {
      async list(recordId) {
        return ((await readStore.content.getContentRevisions(recordId)) ?? []).map(
          (revision): RevisionRecord => ({
            id: revision.id,
            recordId: revision.slug,
            createdAt: revision.createdAt,
            actorId: revision.createdBy ?? null,
            summary: revision.revisionNote ?? null,
            snapshot: revision as unknown as Record<string, unknown>,
          }),
        );
      },
      async append(revision) {
        await saveD1Revision(db, revision, cloudflareActorEmail());
        return revision;
      },
    },
    gitSync: options.gitSync,
    deploy: options.deploy,
    importer: options.importer,
    preview: options.preview,
  });
}
