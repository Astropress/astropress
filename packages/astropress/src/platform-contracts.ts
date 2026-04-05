export type ProviderKind = "github-pages" | "cloudflare" | "supabase" | "runway" | "custom";

export interface ProviderCapabilities {
  name: ProviderKind | string;
  staticPublishing: boolean;
  hostedAdmin: boolean;
  previewEnvironments: boolean;
  serverRuntime: boolean;
  database: boolean;
  objectStorage: boolean;
  gitSync: boolean;
}

export interface ContentStoreRecord {
  id: string;
  kind: "page" | "post" | "redirect" | "comment" | "media" | "user" | "settings" | "translation";
  slug: string;
  status: "draft" | "published" | "archived";
  locale?: string | null;
  title?: string | null;
  body?: string | null;
  metadata?: Record<string, unknown>;
}

export interface ContentStore {
  list(kind?: ContentStoreRecord["kind"]): Promise<ContentStoreRecord[]>;
  get(id: string): Promise<ContentStoreRecord | null>;
  save(record: ContentStoreRecord): Promise<ContentStoreRecord>;
  delete(id: string): Promise<void>;
}

export interface MediaAssetRecord {
  id: string;
  filename: string;
  mimeType: string;
  bytes?: Uint8Array;
  publicUrl?: string | null;
  metadata?: Record<string, unknown>;
}

export interface MediaStore {
  put(asset: MediaAssetRecord): Promise<MediaAssetRecord>;
  get(id: string): Promise<MediaAssetRecord | null>;
  delete(id: string): Promise<void>;
}

export interface RevisionRecord {
  id: string;
  recordId: string;
  createdAt: string;
  actorId?: string | null;
  summary?: string | null;
  snapshot: Record<string, unknown>;
}

export interface RevisionStore {
  list(recordId: string): Promise<RevisionRecord[]>;
  append(revision: RevisionRecord): Promise<RevisionRecord>;
}

export interface AuthUser {
  id: string;
  email: string;
  role: "admin" | "editor";
}

export interface AuthStore {
  signIn(email: string, password: string): Promise<AuthUser | null>;
  signOut(sessionId: string): Promise<void>;
  getSession(sessionId: string): Promise<AuthUser | null>;
}

export interface GitSyncAdapter {
  exportSnapshot(targetDir: string): Promise<{ targetDir: string; fileCount: number }>;
  importSnapshot(sourceDir: string): Promise<{ sourceDir: string; fileCount: number }>;
}

export interface DeployTarget {
  provider: ProviderKind | string;
  deploy(input: {
    buildDir: string;
    projectName: string;
    environment?: string;
  }): Promise<{ url?: string; deploymentId?: string }>;
}

export interface ImportSource {
  inspectWordPress?(input: {
    sourceUrl?: string;
    exportFile?: string;
    includeComments?: boolean;
    includeUsers?: boolean;
    includeMedia?: boolean;
  }): Promise<AstropressWordPressImportInventory>;
  importWordPress(input: {
    sourceUrl?: string;
    exportFile?: string;
    includeComments?: boolean;
    includeUsers?: boolean;
    includeMedia?: boolean;
  }): Promise<AstropressWordPressImportReport>;
}

export interface AstropressWordPressImportInventory {
  exportFile?: string;
  sourceUrl?: string;
  detectedRecords: number;
  detectedMedia: number;
  detectedComments: number;
  detectedUsers: number;
  warnings: string[];
}

export interface AstropressWordPressImportPlan {
  sourceUrl?: string;
  exportFile?: string;
  includeComments: boolean;
  includeUsers: boolean;
  includeMedia: boolean;
}

export interface AstropressWordPressImportReport {
  importedRecords: number;
  importedMedia: number;
  importedComments: number;
  importedUsers: number;
  plan: AstropressWordPressImportPlan;
  inventory: AstropressWordPressImportInventory;
  warnings: string[];
}

export interface PreviewSession {
  create(input: { recordId: string; expiresAt?: string }): Promise<{ url: string; expiresAt?: string }>;
}

export interface AstropressPlatformAdapter {
  capabilities: ProviderCapabilities;
  content: ContentStore;
  media: MediaStore;
  revisions: RevisionStore;
  auth: AuthStore;
  gitSync?: GitSyncAdapter;
  deploy?: DeployTarget;
  importer?: ImportSource;
  preview?: PreviewSession;
}

export function normalizeProviderCapabilities(
  partial: Pick<ProviderCapabilities, "name"> & Partial<Omit<ProviderCapabilities, "name">>,
): ProviderCapabilities {
  return {
    name: partial.name,
    staticPublishing: partial.staticPublishing ?? false,
    hostedAdmin: partial.hostedAdmin ?? false,
    previewEnvironments: partial.previewEnvironments ?? false,
    serverRuntime: partial.serverRuntime ?? false,
    database: partial.database ?? false,
    objectStorage: partial.objectStorage ?? false,
    gitSync: partial.gitSync ?? false,
  };
}

export function assertProviderContract(adapter: AstropressPlatformAdapter) {
  if (!adapter.capabilities.name) {
    throw new Error("Provider adapter must declare a name.");
  }

  if (!adapter.content || !adapter.media || !adapter.revisions || !adapter.auth) {
    throw new Error("Provider adapter is missing one or more required stores.");
  }

  return adapter;
}
