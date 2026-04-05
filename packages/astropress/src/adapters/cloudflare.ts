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
import type { D1DatabaseLike } from "../d1-database";

type AstropressCloudflareSeedUser = AuthUser & {
  password: string;
};

export interface AstropressCloudflareAdapterOptions {
  db?: D1DatabaseLike;
  auth?: AuthStore;
  users?: AstropressCloudflareSeedUser[];
  gitSync?: GitSyncAdapter;
  deploy?: DeployTarget;
  importer?: ImportSource;
  preview?: PreviewSession;
}

function unsupportedCloudflareWrite(operation: string): never {
  throw new Error(`Cloudflare adapter does not support ${operation} yet. Use the runtime admin surface for mutations.`);
}

function mapContentRecordKind(record: { kind?: string | null }): ContentStoreRecord["kind"] {
  return record.kind === "post" ? "post" : "page";
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
        createFallbackCloudflareAuthStore(
          options.users ?? [{ id: "admin-1", email: "admin@example.com", role: "admin", password: "password" }],
        ),
      gitSync: options.gitSync,
      deploy: options.deploy,
      importer: options.importer,
      preview: options.preview,
    });
  }

  const readStore = createD1AdminReadStore(options.db);
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
      createFallbackCloudflareAuthStore(
        options.users ?? [{ id: "admin-1", email: "admin@example.com", role: "admin", password: "password" }],
      ),
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
      async save() {
        unsupportedCloudflareWrite("content.save");
      },
      async delete() {
        unsupportedCloudflareWrite("content.delete");
      },
    },
    media: {
      async put(_asset: MediaAssetRecord) {
        unsupportedCloudflareWrite("media.put");
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
      async delete() {
        unsupportedCloudflareWrite("media.delete");
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
      async append() {
        unsupportedCloudflareWrite("revisions.append");
      },
    },
    gitSync: options.gitSync,
    deploy: options.deploy,
    importer: options.importer,
    preview: options.preview,
  });
}
