/**
 * TYPE STUB — the real implementation is injected via Vite alias at build time.
 *
 * Dev build (astro.config.mjs):   alias /\/local-runtime-modules/ → website/src/astropress/local-runtime-modules.ts
 * Cloudflare build:               alias /\/local-runtime-modules/ → cloudflare-local-runtime-stubs.ts (no-ops)
 *
 * This file exists only so TypeScript can resolve the module and infer correct
 * return types for callers in this package. It is never executed.
 */

import type { AdminStoreAdapter, SessionUser } from "./persistence-types";
import type { RuntimeSystemRouteRecord, RuntimeArchiveRouteRecord, RuntimeStructuredPageRouteRecord } from "./runtime-route-registry";
import type { LocalMediaDescriptor } from "./local-media-storage";

export interface LocalAdminStoreModule extends AdminStoreAdapter {
  // Auth
  createSession: AdminStoreAdapter["auth"]["createSession"];
  getSessionUser: AdminStoreAdapter["auth"]["getSessionUser"];
  getCsrfToken: AdminStoreAdapter["auth"]["getCsrfToken"];
  revokeSession: AdminStoreAdapter["auth"]["revokeSession"];
  createPasswordResetToken: AdminStoreAdapter["auth"]["createPasswordResetToken"];
  getInviteRequest: AdminStoreAdapter["auth"]["getInviteRequest"];
  getPasswordResetRequest: AdminStoreAdapter["auth"]["getPasswordResetRequest"];
  consumeInviteToken: AdminStoreAdapter["auth"]["consumeInviteToken"];
  consumePasswordResetToken: AdminStoreAdapter["auth"]["consumePasswordResetToken"];
  recordSuccessfulLogin: AdminStoreAdapter["auth"]["recordSuccessfulLogin"];
  recordLogout: AdminStoreAdapter["auth"]["recordLogout"];
  // Audit
  getAuditEvents: AdminStoreAdapter["audit"]["getAuditEvents"];
  // Users
  listAdminUsers: AdminStoreAdapter["users"]["listAdminUsers"];
  inviteAdminUser: AdminStoreAdapter["users"]["inviteAdminUser"];
  suspendAdminUser: AdminStoreAdapter["users"]["suspendAdminUser"];
  unsuspendAdminUser: AdminStoreAdapter["users"]["unsuspendAdminUser"];
  // Authors
  listAuthors: AdminStoreAdapter["authors"]["listAuthors"];
  createAuthor: AdminStoreAdapter["authors"]["createAuthor"];
  updateAuthor: AdminStoreAdapter["authors"]["updateAuthor"];
  deleteAuthor: AdminStoreAdapter["authors"]["deleteAuthor"];
  // Taxonomies
  listCategories: AdminStoreAdapter["taxonomies"]["listCategories"];
  createCategory: AdminStoreAdapter["taxonomies"]["createCategory"];
  updateCategory: AdminStoreAdapter["taxonomies"]["updateCategory"];
  deleteCategory: AdminStoreAdapter["taxonomies"]["deleteCategory"];
  listTags: AdminStoreAdapter["taxonomies"]["listTags"];
  createTag: AdminStoreAdapter["taxonomies"]["createTag"];
  updateTag: AdminStoreAdapter["taxonomies"]["updateTag"];
  deleteTag: AdminStoreAdapter["taxonomies"]["deleteTag"];
  // Redirects
  getRedirectRules: AdminStoreAdapter["redirects"]["getRedirectRules"];
  createRedirectRule: AdminStoreAdapter["redirects"]["createRedirectRule"];
  deleteRedirectRule: AdminStoreAdapter["redirects"]["deleteRedirectRule"];
  // Comments
  getComments: AdminStoreAdapter["comments"]["getComments"];
  moderateComment: AdminStoreAdapter["comments"]["moderateComment"];
  submitPublicComment: AdminStoreAdapter["comments"]["submitPublicComment"];
  getApprovedCommentsForRoute: AdminStoreAdapter["comments"]["getApprovedCommentsForRoute"];
  // Content
  listContentStates: AdminStoreAdapter["content"]["listContentStates"];
  getContentState: AdminStoreAdapter["content"]["getContentState"];
  getContentRevisions: AdminStoreAdapter["content"]["getContentRevisions"];
  createContentRecord: AdminStoreAdapter["content"]["createContentRecord"];
  saveContentState: AdminStoreAdapter["content"]["saveContentState"];
  restoreRevision: AdminStoreAdapter["content"]["restoreRevision"];
  // Submissions
  getContactSubmissions: AdminStoreAdapter["submissions"]["getContactSubmissions"];
  submitContact: AdminStoreAdapter["submissions"]["submitContact"];
  // Translations
  updateTranslationState: AdminStoreAdapter["translations"]["updateTranslationState"];
  getEffectiveTranslationState: AdminStoreAdapter["translations"]["getEffectiveTranslationState"];
  // Settings
  getSettings: AdminStoreAdapter["settings"]["getSettings"];
  saveSettings: AdminStoreAdapter["settings"]["saveSettings"];
  // Rate limits
  checkRateLimit: AdminStoreAdapter["rateLimits"]["checkRateLimit"];
  peekRateLimit: AdminStoreAdapter["rateLimits"]["peekRateLimit"];
  recordFailedAttempt: AdminStoreAdapter["rateLimits"]["recordFailedAttempt"];
  // Media
  listMediaAssets: AdminStoreAdapter["media"]["listMediaAssets"];
  createMediaAsset: AdminStoreAdapter["media"]["createMediaAsset"];
  updateMediaAsset: AdminStoreAdapter["media"]["updateMediaAsset"];
  deleteMediaAsset: AdminStoreAdapter["media"]["deleteMediaAsset"];
}

export interface LocalAdminAuthModule {
  authenticateAdminUser(email: string, password: string): Promise<SessionUser | null>;
}

export interface LocalCmsRegistryModule {
  listSystemRoutes(): RuntimeSystemRouteRecord[];
  getSystemRoute(pathname: string): RuntimeSystemRouteRecord | null;
  saveSystemRoute(
    pathname: string,
    input: Partial<RuntimeSystemRouteRecord>,
    actor: unknown,
  ): { ok: true; route: RuntimeSystemRouteRecord } | { ok: false; error: string };
  listStructuredPageRoutes(): RuntimeStructuredPageRouteRecord[];
  getStructuredPageRoute(pathname: string): RuntimeStructuredPageRouteRecord | null;
  saveStructuredPageRoute(
    pathname: string,
    input: {
      title: string;
      summary?: string;
      seoTitle?: string;
      metaDescription?: string;
      canonicalUrlOverride?: string;
      robotsDirective?: string;
      ogImage?: string;
      templateKey: string;
      alternateLinks?: Array<{ hreflang: string; href: string }>;
      sections?: Record<string, unknown> | null;
      revisionNote?: string;
    },
    actor: unknown,
  ): { ok: true; route: RuntimeStructuredPageRouteRecord } | { ok: false; error: string };
  createStructuredPageRoute(
    pathname: string,
    input: {
      title: string;
      summary?: string;
      seoTitle?: string;
      metaDescription?: string;
      canonicalUrlOverride?: string;
      robotsDirective?: string;
      ogImage?: string;
      templateKey: string;
      alternateLinks?: Array<{ hreflang: string; href: string }>;
      sections?: Record<string, unknown> | null;
      revisionNote?: string;
    },
    actor: unknown,
  ): { ok: true; route: RuntimeStructuredPageRouteRecord } | { ok: false; error: string };
  getArchiveRoute(pathname: string): RuntimeArchiveRouteRecord | null;
  listArchiveRoutes(): RuntimeArchiveRouteRecord[];
  saveArchiveRoute(
    pathname: string,
    input: {
      title: string;
      summary?: string;
      seoTitle?: string;
      metaDescription?: string;
      canonicalUrlOverride?: string;
      robotsDirective?: string;
      revisionNote?: string;
    },
    actor: unknown,
  ): { ok: true; route: RuntimeArchiveRouteRecord } | { ok: false; error: string };
}

export interface LocalMediaStorageModule {
  buildLocalMediaDescriptor(input: {
    filename: string;
    bytes: Uint8Array;
    mimeType?: string;
    title?: string;
    altText?: string;
  }): { ok: true; asset: LocalMediaDescriptor } | { ok: false; error: string };
  createLocalMediaUpload(input: {
    filename: string;
    bytes: Uint8Array;
    mimeType?: string;
    title?: string;
    altText?: string;
  }): { ok: true; asset: LocalMediaDescriptor } | { ok: false; error: string };
  deleteLocalMediaUpload(path: string): void;
}

export interface LocalImageStorageModule {
  readLocalImageAsset(publicPath: string):
    | { ok: false; error: string }
    | { ok: true; asset: { bytes: ArrayBuffer; mimeType: string } };
  resolveLocalImageDiskPath(publicPath: string): string;
}

function unavailable(): never {
  throw new Error(
    "Local runtime modules are only available when the host app provides them via the Astropress runtime alias.",
  );
}

export async function loadLocalAdminStore(): Promise<LocalAdminStoreModule> {
  return unavailable();
}

export async function loadLocalAdminAuth(): Promise<LocalAdminAuthModule> {
  return unavailable();
}

export async function loadLocalCmsRegistry(): Promise<LocalCmsRegistryModule> {
  return unavailable();
}

export async function loadLocalMediaStorage(): Promise<LocalMediaStorageModule> {
  return unavailable();
}

export async function loadLocalImageStorage(): Promise<LocalImageStorageModule> {
  return unavailable();
}
