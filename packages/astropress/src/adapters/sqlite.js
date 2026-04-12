import { normalizeProviderCapabilities } from "../platform-contracts.js";
import { createAstropressSqliteAdminRuntime } from "../sqlite-admin-runtime.js";
import { createDefaultAstropressSqliteSeedToolkit } from "../sqlite-bootstrap.js";
import { registerHealthCheck } from "../runtime-health.js";
import { toContentStoreRecord, toRedirectRecord } from "./adapter-record-helpers.js";

export function createAstropressSqliteAdapter(
  options = {},
) {
  const seedToolkit = options.seedToolkit ?? createDefaultAstropressSqliteSeedToolkit();
  const workspaceRoot = options.workspaceRoot ?? process.cwd();
  const dbPath = options.dbPath ?? seedToolkit.getDefaultAdminDbPath(workspaceRoot);
  let seeded = false;
  let database = null;

  function ensureDatabase() {
    if (!seeded) {
      seedToolkit.seedDatabase({ dbPath, workspaceRoot });
      seeded = true;
    }

    if (!database) {
      database = seedToolkit.openSeedDatabase(dbPath);
    }

    return database;
  }

  registerHealthCheck(() => { ensureDatabase().prepare("SELECT 1").get(); });

  const actor = { email: "admin@example.com", role: "admin", name: "Astropress SQLite" };
  const runtime = createAstropressSqliteAdminRuntime({ getDatabase: ensureDatabase });

  return {
    capabilities: normalizeProviderCapabilities({
      name: "sqlite",
      hostedAdmin: true,
      previewEnvironments: true,
      serverRuntime: true,
      database: true,
      objectStorage: false,
      gitSync: true,
    }),
    auth: {
      async signIn(email, password) {
        const user = await runtime.authenticatePersistedAdminUser(email, password);
        if (!user) {
          return null;
        }
        const sessionId = runtime.sqliteAdminStore.auth.createSession(user, {});
        runtime.sqliteAdminStore.auth.recordSuccessfulLogin(user);
        return { id: sessionId, email: user.email, role: user.role };
      },
      async signOut(sessionId) {
        const user = runtime.sqliteAdminStore.auth.getSessionUser(sessionId);
        runtime.sqliteAdminStore.auth.revokeSession(sessionId);
        if (user) {
          runtime.sqliteAdminStore.auth.recordLogout(user);
        }
      },
      async getSession(sessionId) {
        const user = runtime.sqliteAdminStore.auth.getSessionUser(sessionId);
        return user ? { id: sessionId, email: user.email, role: user.role } : null;
      },
    },
    content: {
      async list(kind) {
        const records = [];
        if (!kind || kind === "page" || kind === "post") {
          for (const record of runtime.sqliteAdminStore.content.listContentStates()) {
            const mapped = toContentStoreRecord(record);
            if (!kind || mapped.kind === kind) {
              records.push(mapped);
            }
          }
        }
        if (!kind || kind === "redirect") {
          records.push(...runtime.sqliteAdminStore.redirects.getRedirectRules().map((rule) => toRedirectRecord(rule)));
        }
        if (!kind || kind === "comment") {
          records.push(
            ...runtime.sqliteAdminStore.comments.getComments().map((comment) => ({
              id: comment.id,
              kind: "comment",
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
            ...runtime.sqliteAdminStore.users.listAdminUsers().map((user) => ({
              id: String(user.id),
              kind: "user",
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
          const settings = runtime.sqliteAdminStore.settings.getSettings();
          records.push({
            id: "site-settings",
            kind: "settings",
            slug: "site-settings",
            status: "published",
            title: settings.siteTitle,
            metadata: settings,
          });
        }
        if (!kind || kind === "translation") {
          const rows = ensureDatabase()
            .prepare("SELECT route, state, updated_at, updated_by FROM translation_overrides ORDER BY route ASC")
            .all();
          records.push(
            ...rows.map((row) => ({
              id: row.route,
              kind: "translation",
              slug: row.route,
              status: row.state === "published" ? "published" : "draft",
              title: row.route,
              metadata: {
                state: row.state,
                updatedAt: row.updated_at,
                updatedBy: row.updated_by,
              },
            })),
          );
        }
        if (!kind || kind === "media") {
          records.push(
            ...runtime.sqliteAdminStore.media.listMediaAssets().map((asset) => ({
              id: asset.id,
              kind: "media",
              slug: asset.id,
              status: "published",
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
          const result = runtime.sqliteAdminStore.redirects.createRedirectRule(
            { sourcePath: slug, targetPath, statusCode },
            actor,
          );
          if (!result.ok) {
            throw new Error(result.error);
          }
          return toRedirectRecord({ sourcePath: slug, targetPath, statusCode });
        }

        if (record.kind === "settings") {
          const current = runtime.sqliteAdminStore.settings.getSettings();
          const next = { ...current, ...(record.metadata ?? {}) };
          const result = runtime.sqliteAdminStore.settings.saveSettings(next, actor);
          if (!result.ok) {
            throw new Error(result.error);
          }
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
          runtime.sqliteAdminStore.translations.updateTranslationState(slug, state, actor);
          return {
            id: slug,
            kind: "translation",
            slug,
            status: state === "published" ? "published" : "draft",
            title: slug,
            metadata: { state },
          };
        }

        if (record.kind === "page" || record.kind === "post") {
          const existing = runtime.sqliteAdminStore.content.getContentState(slug);
          const seoTitle = String(record.metadata?.seoTitle ?? record.title ?? slug);
          const metaDescription = String(record.metadata?.metaDescription ?? record.title ?? slug);
          if (existing) {
            const result = runtime.sqliteAdminStore.content.saveContentState(
              slug,
              {
                title: record.title ?? existing.title,
                status: record.status === "archived" ? "archived" : record.status === "draft" ? "draft" : "published",
                body: record.body ?? existing.body ?? "",
                seoTitle,
                metaDescription,
                excerpt: String(record.metadata?.summary ?? existing.summary ?? ""),
                ogTitle: typeof record.metadata?.ogTitle === "string" ? record.metadata.ogTitle : undefined,
                ogDescription:
                  typeof record.metadata?.ogDescription === "string" ? record.metadata.ogDescription : undefined,
                ogImage: typeof record.metadata?.ogImage === "string" ? record.metadata.ogImage : undefined,
                canonicalUrlOverride:
                  typeof record.metadata?.canonicalUrlOverride === "string"
                    ? record.metadata.canonicalUrlOverride
                    : undefined,
                robotsDirective:
                  typeof record.metadata?.robotsDirective === "string" ? record.metadata.robotsDirective : undefined,
              },
              actor,
            );
            if (!result.ok) {
              throw new Error(result.error);
            }
            return toContentStoreRecord(result.state);
          }

          const result = runtime.sqliteAdminStore.content.createContentRecord(
            {
              title: record.title ?? slug,
              slug,
              legacyUrl: typeof record.metadata?.legacyUrl === "string" ? record.metadata.legacyUrl : `/${slug}`,
              body: record.body ?? "",
              summary: String(record.metadata?.summary ?? ""),
              status: record.status === "archived" ? "archived" : record.status === "draft" ? "draft" : "published",
              seoTitle,
              metaDescription,
              ogTitle: typeof record.metadata?.ogTitle === "string" ? record.metadata.ogTitle : undefined,
              ogDescription:
                typeof record.metadata?.ogDescription === "string" ? record.metadata.ogDescription : undefined,
              ogImage: typeof record.metadata?.ogImage === "string" ? record.metadata.ogImage : undefined,
            },
            actor,
          );
          if (!result.ok) {
            throw new Error(result.error);
          }
          return toContentStoreRecord(result.state);
        }

        throw new Error(`SQLite content store does not support saving ${record.kind} records yet.`);
      },
      async delete(id) {
        const existing = await this.get(id);
        if (!existing) {
          return;
        }
        if (existing.kind === "redirect") {
          runtime.sqliteAdminStore.redirects.deleteRedirectRule(existing.slug, actor);
          return;
        }
        if (existing.kind === "page" || existing.kind === "post") {
          runtime.sqliteAdminStore.content.saveContentState(
            existing.slug,
            {
              title: existing.title ?? existing.slug,
              status: "archived",
              body: existing.body ?? "",
              seoTitle: String(existing.metadata?.seoTitle ?? existing.title ?? existing.slug),
              metaDescription: String(existing.metadata?.metaDescription ?? existing.title ?? existing.slug),
            },
            actor,
          );
          return;
        }
        throw new Error(`SQLite content store does not support deleting ${existing.kind} records yet.`);
      },
    },
    media: {
      async put(asset) {
        const now = new Date().toISOString();
        ensureDatabase()
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
          .run(
            asset.id,
            asset.publicUrl ?? null,
            asset.publicUrl ?? `/media/${asset.filename}`,
            asset.mimeType,
            asset.bytes?.byteLength ?? null,
            String(asset.metadata?.altText ?? ""),
            String(asset.metadata?.title ?? asset.filename),
            now,
            actor.email,
          );
        return asset;
      },
      async get(id) {
        const asset = runtime.sqliteAdminStore.media.listMediaAssets().find((entry) => entry.id === id);
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
        runtime.sqliteAdminStore.media.deleteMediaAsset(id, actor);
      },
    },
    revisions: {
      async list(recordId) {
        return (runtime.sqliteAdminStore.content.getContentRevisions(recordId) ?? []).map(
          (revision) => ({
            id: revision.id,
            recordId: revision.slug,
            createdAt: revision.createdAt,
            actorId: revision.createdBy ?? null,
            summary: revision.revisionNote ?? null,
            snapshot: revision,
          }),
        );
      },
      async append(revision) {
        const snapshot = revision.snapshot;
        ensureDatabase()
          .prepare(
            `
              INSERT INTO content_revisions (
                id, slug, source, title, status, scheduled_at, body, seo_title, meta_description, excerpt,
                og_title, og_description, og_image, author_ids, category_ids, tag_ids, canonical_url_override,
                robots_directive, revision_note, created_at, created_by
              ) VALUES (?, ?, 'reviewed', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            `,
          )
          .run(
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
            revision.actorId ?? actor.email,
          );
        return revision;
      },
    },
  };
}
