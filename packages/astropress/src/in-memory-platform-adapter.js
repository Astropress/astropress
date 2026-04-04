import { assertProviderContract, normalizeProviderCapabilities } from "./platform-contracts.js";

function createInMemoryContentStore() {
  const records = new Map();
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

function createInMemoryMediaStore() {
  const records = new Map();
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

function createInMemoryRevisionStore() {
  const records = new Map();
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

function createInMemoryAuthStore(seedUsers) {
  const users = new Map(seedUsers.map((user) => [user.email.toLowerCase(), user]));
  const sessions = new Map();

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

export function createAstropressInMemoryPlatformAdapter(options) {
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
