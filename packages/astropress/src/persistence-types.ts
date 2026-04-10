import type { SiteSettings } from "./site-settings";

type PersistenceModule = typeof import("./admin-persistence");

export type AdminRole = "admin" | "editor";
export type ContentStatus = "draft" | "review" | "published" | "archived";
export type CommentStatus = "pending" | "approved" | "rejected";
export type CommentPolicy = "legacy-readonly" | "disabled" | "open-moderated";
export type TaxonomyKind = "category" | "tag";

export interface SessionUser {
  email: string;
  role: AdminRole;
  name: string;
}

export interface Actor extends SessionUser {}

export interface AuditEvent {
  id: string;
  action: string;
  actorEmail: string;
  actorRole: AdminRole;
  summary: string;
  targetType: "auth" | "content" | "redirect" | "comment";
  targetId: string;
  createdAt: string;
}

export interface RedirectRule {
  sourcePath: string;
  targetPath: string;
  statusCode: 301 | 302;
}

export interface CommentRecord {
  id: string;
  author: string;
  email?: string;
  body?: string;
  route: string;
  status: CommentStatus;
  policy: CommentPolicy;
  submittedAt?: string;
}

export interface ContentOverride {
  title: string;
  status: ContentStatus;
  body?: string;
  scheduledAt?: string;
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
}

export interface ContentRecord extends ContentOverride {
  slug: string;
  legacyUrl: string;
  templateKey: string;
  sourceHtmlPath: string;
  kind?: string | null;
  updatedAt: string;
  summary?: string;
}

export interface ContentRevision extends ContentOverride {
  id: string;
  slug: string;
  source: "imported" | "reviewed";
  createdAt: string;
  revisionNote?: string;
  createdBy?: string;
}

export interface ContactSubmission {
  id: string;
  name: string;
  email: string;
  message: string;
  submittedAt: string;
}

export interface InviteRequest {
  email: string;
  name: string;
  role: AdminRole;
  expiresAt: string;
}

export interface PasswordResetRequest {
  email: string;
  name: string;
  expiresAt: string;
}

export interface ManagedAdminUser {
  id: number;
  email: string;
  role: AdminRole;
  name: string;
  active: boolean;
  status: "active" | "invited" | "suspended";
  createdAt: string;
}

export interface MediaAsset {
  id: string;
  sourceUrl: string | null;
  localPath: string;
  r2Key: string | null;
  mimeType: string | null;
  width: number | null;
  height: number | null;
  fileSize: number | null;
  altText: string;
  title: string;
  uploadedAt: string;
  uploadedBy: string;
}

export interface AuthorRecord {
  id: number;
  slug: string;
  name: string;
  bio?: string;
  createdAt: string;
  updatedAt: string;
}

export interface TaxonomyTerm {
  id: number;
  kind: TaxonomyKind;
  slug: string;
  name: string;
  description?: string;
  createdAt: string;
  updatedAt: string;
}

export interface AuthRepository {
  createSession: PersistenceModule["createSession"];
  getSessionUser: PersistenceModule["getSessionUser"];
  getCsrfToken: PersistenceModule["getCsrfToken"];
  revokeSession: PersistenceModule["revokeSession"];
  createPasswordResetToken: PersistenceModule["createPasswordResetToken"];
  getInviteRequest: PersistenceModule["getInviteRequest"];
  getPasswordResetRequest: PersistenceModule["getPasswordResetRequest"];
  consumeInviteToken: PersistenceModule["consumeInviteToken"];
  consumePasswordResetToken: PersistenceModule["consumePasswordResetToken"];
  recordSuccessfulLogin: PersistenceModule["recordSuccessfulLogin"];
  recordLogout: PersistenceModule["recordLogout"];
}

export interface AuditRepository {
  getAuditEvents: PersistenceModule["getPersistedAuditEvents"];
}

export interface UserRepository {
  listAdminUsers: PersistenceModule["listAdminUsers"];
  inviteAdminUser: PersistenceModule["inviteAdminUser"];
  suspendAdminUser: PersistenceModule["suspendAdminUser"];
  unsuspendAdminUser: PersistenceModule["unsuspendAdminUser"];
}

export interface AuthorRepository {
  listAuthors: PersistenceModule["listAuthors"];
  createAuthor: PersistenceModule["createAuthor"];
  updateAuthor: PersistenceModule["updateAuthor"];
  deleteAuthor: PersistenceModule["deleteAuthor"];
}

export interface TaxonomyRepository {
  listCategories: PersistenceModule["listCategories"];
  createCategory: PersistenceModule["createCategory"];
  updateCategory: PersistenceModule["updateCategory"];
  deleteCategory: PersistenceModule["deleteCategory"];
  listTags: PersistenceModule["listTags"];
  createTag: PersistenceModule["createTag"];
  updateTag: PersistenceModule["updateTag"];
  deleteTag: PersistenceModule["deleteTag"];
}

export interface RedirectRepository {
  getRedirectRules: PersistenceModule["getRedirectRules"];
  createRedirectRule: PersistenceModule["createRedirectRule"];
  deleteRedirectRule: PersistenceModule["deleteRedirectRule"];
}

export interface CommentRepository {
  getComments: PersistenceModule["getComments"];
  moderateComment: PersistenceModule["moderateComment"];
  submitPublicComment: PersistenceModule["submitPublicComment"];
  getApprovedCommentsForRoute: PersistenceModule["getApprovedCommentsForRoute"];
}

export interface ContentRepository {
  listContentStates: PersistenceModule["listContentStates"];
  getContentState: PersistenceModule["getContentState"];
  getContentRevisions: PersistenceModule["getContentRevisions"];
  createContentRecord: PersistenceModule["createContentRecord"];
  saveContentState: PersistenceModule["saveContentState"];
  restoreRevision: PersistenceModule["restoreRevision"];
  schedulePublish?: (id: string, scheduledAt: string) => void;
  listScheduled?: () => Array<{ id: string; slug: string; title: string; scheduledAt: string }>;
  cancelScheduledPublish?: (id: string) => void;
  runScheduledPublishes?: () => number;
}

export interface SubmissionRepository {
  submitContact: PersistenceModule["submitContact"];
  getContactSubmissions: PersistenceModule["getContactSubmissions"];
}

export interface TranslationRepository {
  updateTranslationState: PersistenceModule["updateTranslationState"];
  getEffectiveTranslationState: PersistenceModule["getEffectiveTranslationState"];
}

export interface SettingsRepository {
  getSettings: () => SiteSettings;
  saveSettings: PersistenceModule["saveSettings"];
}

export interface RateLimitRepository {
  checkRateLimit: PersistenceModule["checkRateLimit"];
  peekRateLimit: PersistenceModule["peekRateLimit"];
  recordFailedAttempt: PersistenceModule["recordFailedAttempt"];
}

export interface MediaRepository {
  listMediaAssets: PersistenceModule["listMediaAssets"];
  createMediaAsset: PersistenceModule["createMediaAsset"];
  updateMediaAsset: PersistenceModule["updateMediaAsset"];
  deleteMediaAsset: PersistenceModule["deleteMediaAsset"];
}

export interface AdminStoreAdapter {
  backend: "sqlite";
  auth: AuthRepository;
  audit: AuditRepository;
  users: UserRepository;
  authors: AuthorRepository;
  taxonomies: TaxonomyRepository;
  redirects: RedirectRepository;
  comments: CommentRepository;
  content: ContentRepository;
  submissions: SubmissionRepository;
  translations: TranslationRepository;
  settings: SettingsRepository;
  rateLimits: RateLimitRepository;
  media: MediaRepository;
  apiTokens?: import("./platform-contracts").ApiTokenStore;
  webhooks?: import("./platform-contracts").WebhookStore;
}
