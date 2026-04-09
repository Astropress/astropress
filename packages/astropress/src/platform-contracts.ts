export type ProviderKind = "github-pages" | "cloudflare" | "supabase" | "runway" | "custom";

/** Configuration for the editorial CMS panel embedded in the admin. */
export interface AstropressCmsConfig {
  /** The CMS system in use. */
  type:
    | "payload"
    | "sanity"
    | "directus"
    | "strapi"
    | "tina"
    | "contentful"
    | "storyblok"
    | "keystatic"
    | "custom";
  /**
   * How to surface the CMS panel.
   * "iframe" — embed the CMS URL in a full-screen iframe (best for self-hosted CMSes).
   * "link"   — show a branded "Open [CMS]" button that opens a new tab.
   */
  mode: "iframe" | "link";
  /** The base URL of the CMS admin (e.g. "http://localhost:3000" for self-hosted Payload). */
  url: string;
  /** Override the display label shown in the sidebar and on the panel page. */
  label?: string;
  /** Custom iframe allow attribute (e.g. "clipboard-write; fullscreen"). */
  iframeAllow?: string;
}

/** Database provider infrastructure panel declaration. */
export interface AstropressHostPanelCapability {
  /** How to surface the provider panel. */
  mode: "iframe" | "link";
  /** The URL of the provider's admin panel. */
  url: string;
  /** Label shown in the admin sidebar (e.g. "Supabase Studio"). */
  label: string;
}

export interface ProviderCapabilities {
  name: ProviderKind | string;
  staticPublishing: boolean;
  hostedAdmin: boolean;
  previewEnvironments: boolean;
  serverRuntime: boolean;
  database: boolean;
  objectStorage: boolean;
  gitSync: boolean;
  /**
   * Optional link to the database provider's own infrastructure panel
   * (e.g. Supabase Studio, Firebase Console, PocketBase admin).
   * When declared, a "Host" nav item is shown to admin-role users.
   */
  hostPanel?: AstropressHostPanelCapability;
  /**
   * Optional configuration for a deploy hook so the Publish button can
   * trigger a new static build without leaving the admin panel.
   */
  deployHook?: {
    type: "cloudflare-pages" | "vercel" | "netlify" | "render" | "github-actions";
    /** Env var names that must be set for the hook to be active. */
    configuredViaEnv: string[];
  };
}

/** Kinds that can be written via ContentStore.save. */
export type SaveableContentKind = "page" | "post" | "redirect" | "settings" | "translation";

/** All kinds that can be read via ContentStore.list/get (superset of SaveableContentKind). */
export type ReadableContentKind = SaveableContentKind | "comment" | "user" | "media";

export interface ContentStoreRecord {
  id: string;
  kind: ReadableContentKind;
  slug: string;
  status: "draft" | "published" | "archived";
  locale?: string | null;
  title?: string | null;
  body?: string | null;
  metadata?: Record<string, unknown>;
}

export interface ContentListOptions {
  /** Filter by status. "published" is the default for build-time usage. */
  status?: "published" | "draft" | "archived" | "all";
  /** Filter by locale code (e.g. "en", "fr"). */
  locale?: string;
  /** Maximum number of records to return. */
  limit?: number;
  /** Number of records to skip (for pagination). */
  offset?: number;
}

export interface ContentStore {
  list(kind?: ReadableContentKind, options?: ContentListOptions): Promise<ContentStoreRecord[]>;
  get(id: string): Promise<ContentStoreRecord | null>;
  save(record: Omit<ContentStoreRecord, "kind"> & { kind: SaveableContentKind }): Promise<ContentStoreRecord>;
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
  /**
   * Trigger a new build/deployment without requiring a local build directory.
   * Used by the admin Publish button to kick off a CI/CD rebuild.
   */
  triggerBuild?(options?: {
    environment?: string;
  }): Promise<{ buildId?: string; statusUrl?: string }>;
}

export interface ImportSource {
  inspectWordPress?(input: {
    sourceUrl?: string;
    exportFile?: string;
    includeComments?: boolean;
    includeUsers?: boolean;
    includeMedia?: boolean;
  }): Promise<AstropressWordPressImportInventory>;
  planWordPressImport?(input: {
    inventory: AstropressWordPressImportInventory;
    includeComments?: boolean;
    includeUsers?: boolean;
    includeMedia?: boolean;
    downloadMedia?: boolean;
    artifactDir?: string;
    applyLocal?: boolean;
  }): Promise<AstropressWordPressImportPlan>;
  importWordPress(input: {
    sourceUrl?: string;
    exportFile?: string;
    includeComments?: boolean;
    includeUsers?: boolean;
    includeMedia?: boolean;
    downloadMedia?: boolean;
    artifactDir?: string;
    applyLocal?: boolean;
    workspaceRoot?: string;
    adminDbPath?: string;
    resumeFrom?: string;
    plan?: AstropressWordPressImportPlan;
  }): Promise<AstropressWordPressImportReport>;
  resumeWordPressImport?(input: {
    sourceUrl?: string;
    exportFile?: string;
    artifactDir: string;
    includeComments?: boolean;
    includeUsers?: boolean;
    includeMedia?: boolean;
    downloadMedia?: boolean;
    applyLocal?: boolean;
    workspaceRoot?: string;
    adminDbPath?: string;
  }): Promise<AstropressWordPressImportReport>;
}

export interface AstropressWordPressImportEntityCount {
  posts: number;
  pages: number;
  attachments: number;
  redirects: number;
  comments: number;
  users: number;
  categories: number;
  tags: number;
  skipped: number;
}

export interface AstropressWordPressImportInventory {
  exportFile?: string;
  sourceUrl?: string;
  detectedRecords: number;
  detectedMedia: number;
  detectedComments: number;
  detectedUsers: number;
  detectedShortcodes: number;
  detectedBuilderMarkers: number;
  entityCounts: AstropressWordPressImportEntityCount;
  unsupportedPatterns: string[];
  remediationCandidates: string[];
  warnings: string[];
}

export interface AstropressWordPressImportPlan {
  sourceUrl?: string;
  exportFile?: string;
  artifactDir?: string;
  includeComments: boolean;
  includeUsers: boolean;
  includeMedia: boolean;
  downloadMedia: boolean;
  applyLocal: boolean;
  permalinkStrategy: "preserve-wordpress-links";
  resumeSupported: boolean;
  entityCounts: AstropressWordPressImportEntityCount;
  reviewRequired: boolean;
  manualTasks: string[];
}

export interface AstropressWordPressImportArtifacts {
  artifactDir?: string;
  inventoryFile?: string;
  planFile?: string;
  contentFile?: string;
  mediaFile?: string;
  commentFile?: string;
  userFile?: string;
  redirectFile?: string;
  taxonomyFile?: string;
  remediationFile?: string;
  downloadStateFile?: string;
  localApplyReportFile?: string;
  reportFile?: string;
}

export interface AstropressWordPressImportLocalApplyReport {
  runtime: "sqlite-local";
  workspaceRoot: string;
  adminDbPath: string;
  appliedRecords: number;
  appliedMedia: number;
  appliedComments: number;
  appliedUsers: number;
  appliedRedirects: number;
}

export interface AstropressWordPressImportReport {
  status: "completed" | "completed_with_warnings";
  importedRecords: number;
  importedMedia: number;
  importedComments: number;
  importedUsers: number;
  importedRedirects: number;
  downloadedMedia: number;
  failedMedia: Array<{ id: string; sourceUrl?: string; reason: string }>;
  reviewRequired: boolean;
  manualTasks: string[];
  plan: AstropressWordPressImportPlan;
  inventory: AstropressWordPressImportInventory;
  artifacts?: AstropressWordPressImportArtifacts;
  localApply?: AstropressWordPressImportLocalApplyReport;
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

/**
 * Fill missing boolean flags in a partial capabilities object with `false` defaults,
 * producing a complete `ProviderCapabilities` value.
 *
 * @example
 * ```ts
 * import { normalizeProviderCapabilities } from "astropress";
 *
 * const caps = normalizeProviderCapabilities({ name: "sqlite", database: true });
 * // { name: "sqlite", database: true, staticPublishing: false, hostedAdmin: false, ... }
 * ```
 */
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
    hostPanel: partial.hostPanel,
    deployHook: partial.deployHook,
  };
}

/**
 * Validate that a provider adapter implements the required contract.
 * Throws a descriptive error if `capabilities.name` is missing or any of
 * `content`, `media`, `revisions`, `auth` stores are absent.
 *
 * @example
 * ```ts
 * import { assertProviderContract, createAstropressSqliteAdapter } from "astropress";
 *
 * const adapter = createAstropressSqliteAdapter({ db });
 * assertProviderContract(adapter); // throws if adapter is incomplete
 * ```
 */
export function assertProviderContract(adapter: AstropressPlatformAdapter) {
  if (!adapter.capabilities.name) {
    throw new Error("Provider adapter must declare a name.");
  }

  if (!adapter.content || !adapter.media || !adapter.revisions || !adapter.auth) {
    throw new Error("Provider adapter is missing one or more required stores.");
  }

  return adapter;
}
