import type { D1DatabaseLike } from "./d1-database";
import type {
  AuthorRecord,
  AuditEvent,
  CommentRecord,
  CommentStatus,
  ContactSubmission,
  ContentOverride,
  ContentRecord,
  ContentRevision,
  ManagedAdminUser,
  MediaAsset,
  RedirectRule,
  TaxonomyTerm,
} from "./persistence-types";
import type { SiteSettings } from "./site-settings";
import { createD1ContentReadPart, createD1SchedulingPart } from "./d1-store-content";
import { createD1AuthorsReadPart, createD1AuthorsMutationPart, createD1TaxonomiesReadPart, createD1TaxonomiesMutationPart } from "./d1-store-taxonomies";
import { createD1OperationsReadPart, createD1OperationsMutationPart } from "./d1-store-operations";

// Re-export types so existing consumers don't need to change imports
export type {
  AuthorRecord,
  AuditEvent,
  CommentRecord,
  CommentStatus,
  ContactSubmission,
  ContentOverride,
  ContentRecord,
  ContentRevision,
  ManagedAdminUser,
  MediaAsset,
  RedirectRule,
  TaxonomyTerm,
  SiteSettings,
};

export interface D1AdminReadStore {
  audit: {
    getAuditEvents(): Promise<AuditEvent[]>;
  };
  users: {
    listAdminUsers(): Promise<ManagedAdminUser[]>;
  };
  authors: {
    listAuthors(): Promise<AuthorRecord[]>;
  };
  taxonomies: {
    listCategories(): Promise<TaxonomyTerm[]>;
    listTags(): Promise<TaxonomyTerm[]>;
  };
  redirects: {
    getRedirectRules(): Promise<RedirectRule[]>;
  };
  comments: {
    getComments(): Promise<CommentRecord[]>;
    getApprovedCommentsForRoute(route: string): Promise<CommentRecord[]>;
  };
  content: {
    listContentStates(): Promise<ContentRecord[]>;
    getContentState(slug: string): Promise<ContentRecord | null>;
    getContentRevisions(slug: string): Promise<ContentRevision[] | null>;
    schedulePublish(id: string, scheduledAt: string): Promise<void>;
    listScheduled(): Promise<Array<{ id: string; slug: string; title: string; scheduledAt: string }>>;
    cancelScheduledPublish(id: string): Promise<void>;
    runScheduledPublishes(): Promise<number>;
  };
  submissions: {
    getContactSubmissions(): Promise<ContactSubmission[]>;
  };
  translations: {
    getEffectiveTranslationState(route: string, fallback?: string): Promise<string>;
  };
  settings: {
    getSettings(): Promise<SiteSettings>;
  };
  rateLimits: {
    checkRateLimit(key: string, max: number, windowMs: number): Promise<boolean>;
    peekRateLimit(key: string, max: number, windowMs: number): Promise<boolean>;
    recordFailedAttempt(key: string, max: number, windowMs: number): Promise<void>;
  };
  media: {
    listMediaAssets(): Promise<MediaAsset[]>;
  };
}

export interface D1AdminMutationStore {
  authors: {
    createAuthor(input: { name: string; slug?: string; bio?: string }): Promise<{ ok: true } | { ok: false; error: string }>;
    updateAuthor(input: { id: number; name: string; slug?: string; bio?: string }): Promise<{ ok: true } | { ok: false; error: string }>;
    deleteAuthor(id: number): Promise<{ ok: true } | { ok: false; error: string }>;
  };
  taxonomies: {
    createCategory(input: { name: string; slug?: string; description?: string }): Promise<{ ok: true } | { ok: false; error: string }>;
    updateCategory(input: { id: number; name: string; slug?: string; description?: string }): Promise<{ ok: true } | { ok: false; error: string }>;
    deleteCategory(id: number): Promise<{ ok: true } | { ok: false; error: string }>;
    createTag(input: { name: string; slug?: string; description?: string }): Promise<{ ok: true } | { ok: false; error: string }>;
    updateTag(input: { id: number; name: string; slug?: string; description?: string }): Promise<{ ok: true } | { ok: false; error: string }>;
    deleteTag(id: number): Promise<{ ok: true } | { ok: false; error: string }>;
  };
  submissions: {
    submitContact(input: { name: string; email: string; message: string; submittedAt: string }): Promise<{
      ok: true;
      submission: ContactSubmission;
    }>;
  };
  comments: {
    submitPublicComment(input: {
      author: string;
      email: string;
      body: string;
      route: string;
      submittedAt: string;
    }): Promise<{
      ok: true;
      comment: CommentRecord;
    }>;
  };
  rateLimits: {
    checkRateLimit(key: string, max: number, windowMs: number): Promise<boolean>;
    peekRateLimit(key: string, max: number, windowMs: number): Promise<boolean>;
    recordFailedAttempt(key: string, max: number, windowMs: number): Promise<void>;
  };
}

export function createD1AdminReadStore(db: D1DatabaseLike): D1AdminReadStore {
  return {
    ...createD1OperationsReadPart(db),
    authors: createD1AuthorsReadPart(db),
    taxonomies: createD1TaxonomiesReadPart(db),
    content: { ...createD1ContentReadPart(db), ...createD1SchedulingPart(db) },
  };
}

export function createD1AdminMutationStore(db: D1DatabaseLike): D1AdminMutationStore {
  return {
    authors: createD1AuthorsMutationPart(db),
    taxonomies: createD1TaxonomiesMutationPart(db),
    ...createD1OperationsMutationPart(db),
  };
}
