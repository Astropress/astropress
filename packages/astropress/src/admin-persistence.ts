/**
 * TYPE STUB — mirrors the public exports of website/src/astropress/admin-persistence.ts
 *
 * This file exists so that packages/astropress/src/persistence-types.ts can derive
 * repository interface types via `typeof import("./admin-persistence")`.
 * It is never executed; the real implementation lives in the website and is
 * linked at build time via the local-runtime-modules injection pattern.
 */

import type {
  SessionUser,
  AuditEvent,
  ManagedAdminUser,
  InviteRequest,
  PasswordResetRequest,
  ContentRecord,
  ContentRevision,
  ContactSubmission,
  CommentRecord,
  CommentStatus,
  RedirectRule,
  MediaAsset,
  AuthorRecord,
  TaxonomyTerm,
  Actor,
} from "./persistence-types";
import type { SiteSettings } from "./site-settings";

// ── Auth ─────────────────────────────────────────────────────────────────────

export declare function createSession(
  user: SessionUser,
  metadata?: { ipAddress?: string | null; userAgent?: string | null },
): string;

export declare function getSessionUser(sessionToken: string | null | undefined): SessionUser | null;

export declare function getCsrfToken(sessionToken: string | null | undefined): string | null;

export declare function revokeSession(sessionToken: string | null | undefined): void;

export declare function createPasswordResetToken(
  email: string,
  actor?: Actor | null,
): { ok: true; resetUrl: string | null } | { ok: false; error: string };

export declare function getInviteRequest(rawToken: string): InviteRequest | null;

export declare function getPasswordResetRequest(rawToken: string): PasswordResetRequest | null;

export declare function consumeInviteToken(
  rawToken: string,
  password: string,
): { ok: true; user: SessionUser } | { ok: false; error: string };

export declare function consumePasswordResetToken(
  rawToken: string,
  password: string,
): { ok: true; user: SessionUser } | { ok: false; error: string };

export declare function recordSuccessfulLogin(actor: Actor): void;

export declare function recordLogout(actor: Actor): void;

// ── Audit ────────────────────────────────────────────────────────────────────

export declare function getPersistedAuditEvents(): AuditEvent[];

// ── Users ────────────────────────────────────────────────────────────────────

export declare function listAdminUsers(): Array<ManagedAdminUser>;

export declare function inviteAdminUser(
  input: { name: string; email: string; role: string },
  actor: Actor,
): { ok: true; inviteUrl: string } | { ok: false; error: string };

export declare function suspendAdminUser(
  email: string,
  actor: Actor,
): { ok: true } | { ok: false; error: string };

export declare function unsuspendAdminUser(
  email: string,
  actor: Actor,
): { ok: true } | { ok: false; error: string };

// ── Authors ──────────────────────────────────────────────────────────────────

export declare function listAuthors(): AuthorRecord[];

export declare function createAuthor(
  input: { name: string; slug?: string; bio?: string },
  actor: Actor,
): { ok: true } | { ok: false; error: string };

export declare function updateAuthor(
  input: { id: number; name: string; slug?: string; bio?: string },
  actor: Actor,
): { ok: true } | { ok: false; error: string };

export declare function deleteAuthor(id: number, actor: Actor): { ok: true } | { ok: false; error: string };

// ── Taxonomies ───────────────────────────────────────────────────────────────

export declare function listCategories(): TaxonomyTerm[];
export declare function createCategory(
  input: { name: string; slug?: string; description?: string },
  actor: Actor,
): { ok: true } | { ok: false; error: string };
export declare function updateCategory(
  input: { id: number; name: string; slug?: string; description?: string },
  actor: Actor,
): { ok: true } | { ok: false; error: string };
export declare function deleteCategory(id: number, actor: Actor): { ok: true } | { ok: false; error: string };

export declare function listTags(): TaxonomyTerm[];
export declare function createTag(
  input: { name: string; slug?: string; description?: string },
  actor: Actor,
): { ok: true } | { ok: false; error: string };
export declare function updateTag(
  input: { id: number; name: string; slug?: string; description?: string },
  actor: Actor,
): { ok: true } | { ok: false; error: string };
export declare function deleteTag(id: number, actor: Actor): { ok: true } | { ok: false; error: string };

// ── Redirects ────────────────────────────────────────────────────────────────

export declare function getRedirectRules(): RedirectRule[];

export declare function createRedirectRule(
  input: { sourcePath: string; targetPath: string; statusCode: number },
  actor: Actor,
): { ok: true; rule: RedirectRule } | { ok: false; error: string };

export declare function deleteRedirectRule(
  sourcePath: string,
  actor: Actor,
): { ok: true } | { ok: false };

// ── Comments ─────────────────────────────────────────────────────────────────

export declare function getComments(): CommentRecord[];

export declare function moderateComment(
  commentId: string,
  nextStatus: CommentStatus,
  actor: Actor,
): { ok: true } | { ok: false; error: string };

export declare function submitPublicComment(input: {
  author: string;
  email: string;
  body: string;
  route: string;
  submittedAt: string;
}): { ok: true; comment: CommentRecord } | { ok: false; error: string };

export declare function getApprovedCommentsForRoute(route: string): CommentRecord[];

// ── Content ──────────────────────────────────────────────────────────────────

export declare function listContentStates(): ContentRecord[];

export declare function getContentState(slug: string): ContentRecord | null;

export declare function getContentRevisions(slug: string): ContentRevision[] | null;

export declare function createContentRecord(
  input: {
    title: string;
    slug: string;
    legacyUrl?: string;
    status: string;
    body?: string;
    summary?: string;
    seoTitle: string;
    metaDescription: string;
    excerpt?: string;
    ogTitle?: string;
    ogDescription?: string;
    ogImage?: string;
    canonicalUrlOverride?: string;
    robotsDirective?: string;
  },
  actor: Actor,
): { ok: true; state: ContentRecord | null } | { ok: false; error: string };

export declare function saveContentState(
  slug: string,
  input: {
    title: string;
    status: string;
    scheduledAt?: string;
    body?: string;
    authorIds?: number[];
    categoryIds?: number[];
    tagIds?: number[];
    seoTitle: string;
    metaDescription: string;
    excerpt?: string;
    ogTitle?: string;
    ogDescription?: string;
    ogImage?: string;
    canonicalUrlOverride?: string;
    robotsDirective?: string;
    revisionNote?: string;
    metadata?: Record<string, unknown>;
  },
  actor: Actor,
): { ok: true } | { ok: false; error: string };

export declare function restoreRevision(
  slug: string,
  revisionId: string,
  actor: Actor,
): { ok: true } | { ok: false; error: string };

// ── Submissions ──────────────────────────────────────────────────────────────

export declare function submitContact(input: {
  name: string;
  email: string;
  message: string;
  submittedAt: string;
}): { ok: true; submission: ContactSubmission };

export declare function getContactSubmissions(): ContactSubmission[];

// ── Translations ─────────────────────────────────────────────────────────────

export declare function updateTranslationState(
  route: string,
  state: string,
  actor: Actor,
): { ok: true } | { ok: false; error: string };

export declare function getEffectiveTranslationState(route: string, fallback?: string): string;

// ── Settings ─────────────────────────────────────────────────────────────────

export declare function getSettings(): SiteSettings;

export declare function saveSettings(
  partial: Partial<SiteSettings>,
  actor: Actor,
): { ok: true; settings: SiteSettings } | { ok: false; error: string };

// ── Rate limits ──────────────────────────────────────────────────────────────

export declare function checkRateLimit(key: string, max: number, windowMs: number): boolean;

export declare function peekRateLimit(key: string, max: number, windowMs: number): boolean;

export declare function recordFailedAttempt(key: string, max: number, windowMs: number): void;

// ── Media ─────────────────────────────────────────────────────────────────────

export declare function listMediaAssets(): MediaAsset[];

export declare function createMediaAsset(
  input: {
    filename: string;
    bytes: Uint8Array;
    mimeType?: string;
    title?: string;
    altText?: string;
  },
  actor: Actor,
): { ok: true; id: string } | { ok: false; error: string };

export declare function updateMediaAsset(
  input: { id: string; title?: string; altText?: string },
  actor: Actor,
): { ok: true } | { ok: false; error: string };

export declare function deleteMediaAsset(
  id: string,
  actor: Actor,
): { ok: true } | { ok: false; error: string };
