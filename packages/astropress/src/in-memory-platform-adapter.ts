import {
  assertProviderContract,
  normalizeProviderCapabilities,
  type AstropressPlatformAdapter,
  type AuthStore,
  type AuthUser,
  type ContentStore,
  type ContentStoreRecord,
  type DeployTarget,
  type GitSyncAdapter,
  type ImportSource,
  type MediaAssetRecord,
  type MediaStore,
  type PreviewSession,
  type ProviderCapabilities,
  type RevisionRecord,
  type RevisionStore,
} from "./platform-contracts";

type AstropressSeedUser = AuthUser & {
  password: string;
};

export interface AstropressInMemoryPlatformAdapterOptions {
  capabilities: Pick<ProviderCapabilities, "name"> & Partial<Omit<ProviderCapabilities, "name">>;
  users?: AstropressSeedUser[];
  content?: ContentStore;
  media?: MediaStore;
  revisions?: RevisionStore;
  auth?: AuthStore;
  gitSync?: GitSyncAdapter;
  deploy?: DeployTarget;
  importer?: ImportSource;
  preview?: PreviewSession;
}

function createInMemoryContentStore(): ContentStore {
  const records = new Map<string, ContentStoreRecord>();
  return {
    async list(kind) {
      return [...records.values()].filter((record) => !kind || record.kind === kind);
    },
    async get(id) {
      return records.get(id) ?? null;
    },
    async save(record) {
      records.set(record.id, record);
      return record;
    },
    async delete(id) {
      records.delete(id);
    },
  };
}

function createInMemoryMediaStore(): MediaStore {
  const records = new Map<string, MediaAssetRecord>();
  return {
    async put(asset) {
      records.set(asset.id, asset);
      return asset;
    },
    async get(id) {
      return records.get(id) ?? null;
    },
    async delete(id) {
      records.delete(id);
    },
  };
}

function createInMemoryRevisionStore(): RevisionStore {
  const records = new Map<string, RevisionRecord[]>();
  return {
    async list(recordId) {
      return records.get(recordId) ?? [];
    },
    async append(revision) {
      const existing = records.get(revision.recordId) ?? [];
      existing.push(revision);
      records.set(revision.recordId, existing);
      return revision;
    },
  };
}

function createInMemoryAuthStore(seedUsers: AstropressSeedUser[]): AuthStore {
  const users = new Map(seedUsers.map((user) => [user.email.toLowerCase(), user]));
  const sessions = new Map<string, AuthUser>();

  return {
    async signIn(email, password) {
      const user = users.get(email.trim().toLowerCase());
      if (!user || user.password !== password) {
        return null;
      }

      const sessionUser = { id: user.id, email: user.email, role: user.role };
      sessions.set(`session:${user.id}`, sessionUser);
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

export function createAstropressInMemoryPlatformAdapter(
  options: AstropressInMemoryPlatformAdapterOptions,
): AstropressPlatformAdapter {
  return assertProviderContract({
    capabilities: normalizeProviderCapabilities(options.capabilities),
    content: options.content ?? createInMemoryContentStore(),
    media: options.media ?? createInMemoryMediaStore(),
    revisions: options.revisions ?? createInMemoryRevisionStore(),
    auth:
      options.auth ??
      createInMemoryAuthStore(
        options.users ?? [
          { id: "admin-1", email: "admin@example.com", role: "admin", password: "password" },
        ],
      ),
    gitSync: options.gitSync,
    deploy: options.deploy,
    importer: options.importer,
    preview: options.preview,
  });
}
