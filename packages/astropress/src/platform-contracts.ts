// ─── WordPress import contracts ───────────────────────────────────────────────
// Extracted to keep this file under the 400-line limit.
export type {
  AstropressWordPressImportEntityCount,
  AstropressWordPressImportInventory,
  AstropressWordPressImportPlan,
  AstropressWordPressImportArtifacts,
  AstropressWordPressImportLocalApplyReport,
  AstropressWordPressImportReport,
  ImportSource,
} from "./wordpress-import-contracts.js";
import type {
  AstropressWordPressImportInventory,
  AstropressWordPressImportPlan,
  AstropressWordPressImportReport,
  ImportSource,
} from "./wordpress-import-contracts.js";

// ─── Branded types for key identifiers ───────────────────────────────────────
// Branded types prevent accidental mixing of IDs from different domains.
// Use `id as ContentId` to brand a plain string; use `String(id)` to unwrap.

/** A content record ID — prevents mixing with media or user IDs. */
export type ContentId = string & { readonly __brand: "ContentId" };

/** A media asset ID — prevents mixing with content or user IDs. */
export type MediaAssetId = string & { readonly __brand: "MediaAssetId" };

/** An admin user ID — prevents mixing with content or media IDs. */
export type AdminUserId = string & { readonly __brand: "AdminUserId" };

/** An API token ID — prevents mixing with other ID types. */
export type ApiTokenId = string & { readonly __brand: "ApiTokenId" };

/** An audit event ID — prevents mixing with content or user IDs. */
export type AuditEventId = string & { readonly __brand: "AuditEventId" };

// ─── Discriminated union for action results ───────────────────────────────────
/** Standard discriminated union for all repository / action operation results. */
export type ActionResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: string; code?: string };

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
   * (e.g. Supabase Studio, PocketBase admin).
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

// ─── API Token Store ─────────────────────────────────────────────────────────

export type ApiScope =
  | "content:read"
  | "content:write"
  | "media:read"
  | "media:write"
  | "settings:read"
  | "webhooks:manage"
  | "import:write";

export interface ApiTokenRecord {
  id: string;
  label: string;
  scopes: ApiScope[];
  createdAt: string;
  expiresAt?: string | null;
  lastUsedAt?: string | null;
  revokedAt?: string | null;
}

export interface ApiTokenStore {
  create(input: { label: string; scopes: ApiScope[]; expiresAt?: string }): Promise<{ record: ApiTokenRecord; rawToken: string }>;
  list(): Promise<ApiTokenRecord[]>;
  verify(rawToken: string): Promise<{ valid: true; record: ApiTokenRecord } | { valid: false; reason: string }>;
  revoke(id: string): Promise<void>;
}

// ─── Webhook Store ────────────────────────────────────────────────────────────

export type WebhookEvent =
  | "content.published"
  | "content.updated"
  | "content.deleted"
  | "media.uploaded"
  | "media.deleted";

export interface WebhookRecord {
  id: string;
  url: string;
  events: WebhookEvent[];
  active: boolean;
  createdAt: string;
  lastFiredAt?: string | null;
}

export interface WebhookStore {
  list(): Promise<WebhookRecord[]>;
  create(input: { url: string; events: WebhookEvent[] }): Promise<{
    record: WebhookRecord;
    verification: {
      algorithm: "ML-DSA-65";
      keyId: string;
      publicKey: string;
      encoding: "base64";
    };
  }>;
  delete(id: string): Promise<void>;
  dispatch(event: WebhookEvent, payload: unknown): Promise<void>;
}

// ─── Content kinds ───────────────────────────────────────────────────────────

/** Kinds that can be written via ContentStore.save. */
export type SaveableContentKind = "page" | "post" | "redirect" | "settings" | "translation";

/** All kinds that can be read via ContentStore.list/get (superset of SaveableContentKind). */
export type ReadableContentKind = SaveableContentKind | "comment" | "user" | "media";

/** A single FAQ item for AEO-optimised FAQPage JSON-LD. */
export interface FaqItem {
  question: string;
  answer: string;
}

/** A single step in a HowTo guide for AEO-optimised HowTo JSON-LD. */
export interface HowToStep {
  name: string;
  text: string;
  /** Optional URL pointing to an image illustrating this step. */
  imageUrl?: string;
}

/**
 * AEO (Answer Engine Optimisation) metadata that can be stored in a content record's
 * `metadata` field to trigger automatic JSON-LD rendering via AstropressContentLayout.
 */
export interface AeoMetadata {
  /** FAQ items — automatically renders AstropressFaqJsonLd (FAQPage schema). */
  faqItems?: FaqItem[];
  /** How-to steps — automatically renders AstropressHowToJsonLd (HowTo schema). */
  howToSteps?: HowToStep[];
  /** CSS selectors for speakable sections — renders AstropressSpeakableJsonLd. */
  speakableCssSelectors?: string[];
  /** How-to title override (defaults to the content record title). */
  howToName?: string;
  /** How-to description. */
  howToDescription?: string;
  /** ISO 8601 duration for the HowTo total time (e.g. "PT30M"). */
  howToTotalTime?: string;
}

export interface ContentStoreRecord {
  id: string;
  kind: ReadableContentKind;
  slug: string;
  status: "draft" | "published" | "archived";
  /** ISO 8601 datetime. When set and status is draft, content is scheduled for auto-publish. */
  scheduledAt?: string | null;
  locale?: string | null;
  title?: string | null;
  body?: string | null;
  metadata?: Record<string, unknown> & AeoMetadata;
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
  /** Full-text search query. Only applied when search.enabled is true in CmsConfig. */
  query?: string;
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
  /** Width in pixels — populated for image uploads when dimension detection succeeds. */
  width?: number;
  /** Height in pixels — populated for image uploads when dimension detection succeeds. */
  height?: number;
  /** Public URL of the 400px-wide WebP thumbnail; set when the upload was an image wider than 400px. */
  thumbnailUrl?: string;
  /** Responsive srcset string with 400w/800w/1200w WebP variants; auto-generated at upload time for images wider than 400px. */
  srcset?: string;
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
  /** Optional: Bearer-token API access management. Required to enable /ap-api/v1/* endpoints. */
  apiTokens?: ApiTokenStore;
  /** Optional: Webhook event dispatch. Required to enable outbound webhook delivery. */
  webhooks?: WebhookStore;
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
