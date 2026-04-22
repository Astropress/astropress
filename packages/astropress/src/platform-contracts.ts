export type {
	AstropressWordPressImportEntityCount,
	AstropressWordPressImportInventory,
	AstropressWordPressImportPlan,
	AstropressWordPressImportArtifacts,
	AstropressWordPressImportLocalApplyReport,
	AstropressWordPressImportReport,
	ImportSource,
} from "./wordpress-import-contracts.js";

export type {
	ApiScope,
	ApiTokenId,
	ApiTokenRecord,
	ApiTokenStore,
} from "./platform-contracts-helpers";
import type { ApiTokenStore } from "./platform-contracts-helpers";

// ─── Branded types for key identifiers ───────────────────────────────────────
/** A content record ID — prevents mixing with media or user IDs. */
export type ContentId = string & { readonly __brand: "ContentId" };

/** A media asset ID — prevents mixing with content or user IDs. */
export type MediaAssetId = string & { readonly __brand: "MediaAssetId" };

/** An admin user ID — prevents mixing with content or media IDs. */
export type AdminUserId = string & { readonly __brand: "AdminUserId" };

/** An audit event ID — prevents mixing with content or user IDs. */
export type AuditEventId = string & { readonly __brand: "AuditEventId" };

// ─── Discriminated union for action results ───────────────────────────────────
/** Standard discriminated union for all repository / action operation results. */
export type ActionResult<T> =
	| { ok: true; data: T }
	| { ok: false; error: string; code?: string };

export type ProviderKind =
	| "github-pages"
	| "cloudflare"
	| "supabase"
	| "custom";

/** Configuration for the editorial CMS panel embedded in the admin. */
export interface AstropressCmsConfig {
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
	mode: "iframe" | "link";
	url: string;
	label?: string;
	iframeAllow?: string;
}

/** Database provider infrastructure panel declaration. */
export interface AstropressHostPanelCapability {
	mode: "iframe" | "link";
	url: string;
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
	hostPanel?: AstropressHostPanelCapability;
	deployHook?: {
		type:
			| "cloudflare-pages"
			| "vercel"
			| "netlify"
			| "render"
			| "github-actions";
		configuredViaEnv: string[];
	};
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
export type SaveableContentKind =
	| "page"
	| "post"
	| "redirect"
	| "settings"
	| "translation";

/** All kinds that can be read via ContentStore.list/get (superset of SaveableContentKind). */
export type ReadableContentKind =
	| SaveableContentKind
	| "comment"
	| "user"
	| "media";

/** A single FAQ item for AEO-optimised FAQPage JSON-LD. */
export interface FaqItem {
	question: string;
	answer: string;
}

/** A single step in a HowTo guide for AEO-optimised HowTo JSON-LD. */
export interface HowToStep {
	name: string;
	text: string;
	imageUrl?: string;
}

export interface AeoMetadata {
	faqItems?: FaqItem[];
	howToSteps?: HowToStep[];
	speakableCssSelectors?: string[];
	howToName?: string;
	howToDescription?: string;
	howToTotalTime?: string;
}

export interface ContentStoreRecord {
	id: string;
	kind: ReadableContentKind;
	slug: string;
	status: "draft" | "published" | "archived";
	scheduledAt?: string | null;
	locale?: string | null;
	title?: string | null;
	body?: string | null;
	metadata?: Record<string, unknown> & AeoMetadata;
}

export interface ContentListOptions {
	status?: "published" | "draft" | "archived" | "all";
	locale?: string;
	limit?: number;
	offset?: number;
	query?: string;
}

export interface ContentStore {
	list(
		kind?: ReadableContentKind,
		options?: ContentListOptions,
	): Promise<ContentStoreRecord[]>;
	get(id: string): Promise<ContentStoreRecord | null>;
	save(
		record: Omit<ContentStoreRecord, "kind"> & { kind: SaveableContentKind },
	): Promise<ContentStoreRecord>;
	delete(id: string): Promise<void>;
}

export interface MediaAssetRecord {
	id: string;
	filename: string;
	mimeType: string;
	bytes?: Uint8Array;
	publicUrl?: string | null;
	metadata?: Record<string, unknown>;
	width?: number;
	height?: number;
	thumbnailUrl?: string;
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
	exportSnapshot(
		targetDir: string,
	): Promise<{ targetDir: string; fileCount: number }>;
	importSnapshot(
		sourceDir: string,
	): Promise<{ sourceDir: string; fileCount: number }>;
}

export interface DeployTarget {
	provider: ProviderKind | string;
	deploy(input: {
		buildDir: string;
		projectName: string;
		environment?: string;
	}): Promise<{ url?: string; deploymentId?: string }>;
	triggerBuild?(options?: {
		environment?: string;
	}): Promise<{ buildId?: string; statusUrl?: string }>;
}

export interface PreviewSession {
	create(input: { recordId: string; expiresAt?: string }): Promise<{
		url: string;
		expiresAt?: string;
	}>;
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
 * import { normalizeProviderCapabilities } from "@astropress-diy/astropress";
 *
 * const caps = normalizeProviderCapabilities({ name: "sqlite", database: true });
 * // { name: "sqlite", database: true, staticPublishing: false, hostedAdmin: false, ... }
 * ```
 */
export function normalizeProviderCapabilities(
	partial: Pick<ProviderCapabilities, "name"> &
		Partial<Omit<ProviderCapabilities, "name">>,
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
 * import { assertProviderContract, createAstropressSqliteAdapter } from "@astropress-diy/astropress";
 *
 * const adapter = createAstropressSqliteAdapter({ db });
 * assertProviderContract(adapter); // throws if adapter is incomplete
 * ```
 */
export function assertProviderContract(adapter: AstropressPlatformAdapter) {
	if (!adapter.capabilities.name) {
		throw new Error("Provider adapter must declare a name.");
	}

	if (
		!adapter.content ||
		!adapter.media ||
		!adapter.revisions ||
		!adapter.auth
	) {
		throw new Error("Provider adapter is missing one or more required stores.");
	}

	return adapter;
}
